/*
 * Copyright 2020 Stripe, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import Stripe from 'stripe';
import * as logs from './logs';
import config from './config';
import { Timestamp } from 'firebase-admin/firestore';
import { stripe, eventChannel } from './config';
import {
  createCustomerRecord,
  createProductRecord,
  manageSubscriptionStatusChange,
  insertPriceRecord,
  deleteProductOrPrice,
  insertTaxRateRecord,
  insertInvoiceRecord,
  insertPaymentRecord,
} from './utils';
import { handleCheckoutSessionCreation } from './handlers/checkout-session-creation';

admin.initializeApp();

exports.createCustomer = functions.auth
  .user()
  .onCreate(async (user): Promise<void> => {
    if (!config.syncUsersOnCreate) return;
    const { email, uid, phoneNumber } = user;
    await createCustomerRecord({
      email,
      uid,
      phone: phoneNumber,
    });
  });

/**
 * Create a CheckoutSession or PaymentIntent based on which client is being used.
 */
exports.createCheckoutSession = functions
  .runWith({
    minInstances: config.minCheckoutInstances,
  })
  .firestore.document(
    `/${config.customersCollectionPath}/{uid}/checkout_sessions/{id}`
  )
  .onCreate(handleCheckoutSessionCreation);

/**
 * Create a billing portal link
 */
export const createPortalLink = functions.https.onCall(
  async (data, context) => {
    // Checking that the user is authenticated.
    const uid = context.auth?.uid;
    if (!uid) {
      // Throwing an HttpsError so that the client gets the error details.
      throw new functions.https.HttpsError(
        'unauthenticated',
        'The function must be called while authenticated!'
      );
    }
    try {
      const {
        returnUrl: return_url,
        locale = 'auto',
        configuration,
        flow_data,
      } = data;

      // Get stripe customer id
      let customerRecord = (
        await admin
          .firestore()
          .collection(config.customersCollectionPath)
          .doc(uid)
          .get()
      ).data();

      if (!customerRecord?.stripeId) {
        // Create Stripe customer on-the-fly
        const { email, phoneNumber } = await admin.auth().getUser(uid);
        // @ts-ignore
        customerRecord = await createCustomerRecord({
          uid,
          email,
          phone: phoneNumber,
        });
      }
      // @ts-ignore
      const customer = customerRecord.stripeId;

      const params: Stripe.BillingPortal.SessionCreateParams = {
        customer,
        return_url,
        locale,
      };
      if (configuration) {
        params.configuration = configuration;
      }
      if (flow_data) {
        // Ignore type-checking because `flow_data` was added to
        // `Stripe.BillingPortal.SessionCreateParams` in
        // stripe@11.2.0 (API version 2022-12-06)
        (params as any).flow_data = flow_data;
      }
      const session = await stripe.billingPortal.sessions.create(params);
      logs.createdBillingPortalLink(uid);
      return session;
    } catch (error) {
      logs.billingPortalLinkCreationError(uid, error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

/**
 * A webhook handler function for the relevant Stripe events.
 */
export const handleWebhookEvents = functions.https.onRequest(
  async (req: functions.https.Request, resp) => {
    const relevantEvents = new Set([
      'product.created',
      'product.updated',
      'product.deleted',
      'price.created',
      'price.updated',
      'price.deleted',
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'tax_rate.created',
      'tax_rate.updated',
      'invoice.paid',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'invoice.upcoming',
      'invoice.marked_uncollectible',
      'invoice.payment_action_required',
      'payment_intent.processing',
      'payment_intent.succeeded',
      'payment_intent.canceled',
      'payment_intent.payment_failed',
    ]);
    let event: Stripe.Event;

    // Instead of getting the `Stripe.Event`
    // object directly from `req.body`,
    // use the Stripe webhooks API to make sure
    // this webhook call came from a trusted source
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        // @ts-ignore
        req.headers['stripe-signature'],
        config.stripeWebhookSecret
      );
    } catch (error) {
      logs.badWebhookSecret(error);
      resp.status(401).send('Webhook Error: Invalid Secret');
      return;
    }

    if (relevantEvents.has(event.type)) {
      logs.startWebhookEventProcessing(event.id, event.type);
      try {
        switch (event.type) {
          case 'product.created':
          case 'product.updated':
            await createProductRecord(event.data.object as Stripe.Product);
            break;
          case 'price.created':
          case 'price.updated':
            await insertPriceRecord(event.data.object as Stripe.Price);
            break;
          case 'product.deleted':
            await deleteProductOrPrice(event.data.object as Stripe.Product);
            break;
          case 'price.deleted':
            await deleteProductOrPrice(event.data.object as Stripe.Price);
            break;
          case 'tax_rate.created':
          case 'tax_rate.updated':
            await insertTaxRateRecord(event.data.object as Stripe.TaxRate);
            break;
          case 'customer.subscription.created':
          case 'customer.subscription.updated':
          case 'customer.subscription.deleted':
            const subscription = event.data.object as Stripe.Subscription;
            await manageSubscriptionStatusChange(
              subscription.id,
              subscription.customer as string,
              event.type === 'customer.subscription.created'
            );
            break;
          case 'checkout.session.completed':
          case 'checkout.session.async_payment_succeeded':
          case 'checkout.session.async_payment_failed':
            const checkoutSession = event.data
              .object as Stripe.Checkout.Session;
            if (checkoutSession.mode === 'subscription') {
              const subscriptionId = checkoutSession.subscription as string;
              await manageSubscriptionStatusChange(
                subscriptionId,
                checkoutSession.customer as string,
                true
              );
            } else {
              const paymentIntentId = checkoutSession.payment_intent as string;
              const paymentIntent = await stripe.paymentIntents.retrieve(
                paymentIntentId
              );
              await insertPaymentRecord(paymentIntent, checkoutSession);
            }
            if (checkoutSession.tax_id_collection?.enabled) {
              const customersSnap = await admin
                .firestore()
                .collection(config.customersCollectionPath)
                .where('stripeId', '==', checkoutSession.customer as string)
                .get();
              if (customersSnap.size === 1) {
                customersSnap.docs[0].ref.set(
                  // @ts-ignore
                  checkoutSession.customer_details,
                  { merge: true }
                );
              }
            }
            break;
          case 'invoice.paid':
          case 'invoice.payment_succeeded':
          case 'invoice.payment_failed':
          case 'invoice.upcoming':
          case 'invoice.marked_uncollectible':
          case 'invoice.payment_action_required':
            const invoice = event.data.object as Stripe.Invoice;
            await insertInvoiceRecord(invoice);
            break;
          case 'payment_intent.processing':
          case 'payment_intent.succeeded':
          case 'payment_intent.canceled':
          case 'payment_intent.payment_failed':
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            await insertPaymentRecord(paymentIntent);
            break;
          default:
            logs.webhookHandlerError(
              new Error('Unhandled relevant event!'),
              event.id,
              event.type
            );
        }

        if (eventChannel) {
          await eventChannel.publish({
            type: `com.stripe.v1.${event.type}`,
            data: event.data.object,
          });
        }

        logs.webhookHandlerSucceeded(event.id, event.type);
      } catch (error) {
        logs.webhookHandlerError(error, event.id, event.type);
        resp.json({
          error: 'Webhook handler failed. View function logs in Firebase.',
        });
        return;
      }
    }

    // Return a response to Stripe to acknowledge receipt of the event.
    resp.json({ received: true });
  }
);

const deleteStripeCustomer = async ({
  uid,
  stripeId,
}: {
  uid: string;
  stripeId: string;
}) => {
  try {
    // Delete their customer object.
    // Deleting the customer object will immediately cancel all their active subscriptions.
    await stripe.customers.del(stripeId);
    logs.customerDeleted(stripeId);
    // Mark all their subscriptions as cancelled in Firestore.
    const update = {
      status: 'canceled',
      ended_at: Timestamp.now(),
    };
    // Set all subscription records to canceled.
    const subscriptionsSnap = await admin
      .firestore()
      .collection(config.customersCollectionPath)
      .doc(uid)
      .collection('subscriptions')
      .where('status', 'in', ['trialing', 'active'])
      .get();
    subscriptionsSnap.forEach((doc) => {
      doc.ref.set(update, { merge: true });
    });
  } catch (error) {
    logs.customerDeletionError(error, uid);
  }
};

/*
 * The `onUserDeleted` deletes their customer object in Stripe which immediately cancels all their subscriptions.
 */
export const onUserDeleted = functions.auth.user().onDelete(async (user) => {
  if (!config.autoDeleteUsers) return;
  // Get the Stripe customer id.
  const customer = (
    await admin
      .firestore()
      .collection(config.customersCollectionPath)
      .doc(user.uid)
      .get()
  ).data();
  // If you use the `delete-user-data` extension it could be the case that the customer record is already deleted.
  // In that case, the `onCustomerDataDeleted` function below takes care of deleting the Stripe customer object.
  if (customer) {
    await deleteStripeCustomer({ uid: user.uid, stripeId: customer.stripeId });
  }
});

/*
 * The `onCustomerDataDeleted` deletes their customer object in Stripe which immediately cancels all their subscriptions.
 */
export const onCustomerDataDeleted = functions.firestore
  .document(`/${config.customersCollectionPath}/{uid}`)
  .onDelete(async (snap, context) => {
    if (!config.autoDeleteUsers) return;
    const { stripeId } = snap.data();
    await deleteStripeCustomer({ uid: context.params.uid, stripeId });
  });
