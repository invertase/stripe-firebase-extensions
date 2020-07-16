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
import * as functions from 'firebase-functions';
import Stripe from 'stripe';
import { Product, Price, Subscription } from './interfaces';
import * as logs from './logs';
import config from './config';

const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: '2020-03-02',
  // Register extension as a Stripe plugin
  // https://stripe.com/docs/building-plugins#setappinfo
  appInfo: {
    name: 'Firebase firestore-stripe-subscriptions',
    version: '0.1.0',
  },
});

admin.initializeApp();

/**
 * Create a customer object in Stripe when a user is created.
 */
exports.createCustomer = functions.auth.user().onCreate(
  async (user): Promise<void> => {
    const { email, uid } = user;
    if (!email) {
      logs.userNoEmail();
      return;
    }
    try {
      logs.creatingCustomer(uid);
      const customer = await stripe.customers.create({
        email,
        metadata: {
          firebaseUID: uid,
        },
      });
      // Add a mapping
      await admin
        .firestore()
        .collection(config.customersCollectionPath)
        .doc(uid)
        .set({
          stripeId: customer.id,
          stripeLink: `https://dashboard.stripe.com${
            customer.livemode ? '' : '/test'
          }/customers/${customer.id}`,
        });
      logs.customerCreated(customer.id, customer.livemode);
    } catch (error) {
      logs.customerCreationError(error, uid);
    }
  }
);

/**
 * Create a CheckoutSession for the customer so they can sign up for the subscription.
 */
exports.createCheckoutSession = functions.firestore
  .document(`/${config.customersCollectionPath}/{uid}/checkout_sessions/{id}`)
  .onCreate(async (snap, context) => {
    const {
      price,
      success_url,
      cancel_url,
      quantity = 1,
      payment_method_types = ['card'],
    } = snap.data();
    try {
      logs.creatingCheckoutSession(context.params.id);
      // Get stripe customer id
      const customer = (await snap.ref.parent.parent.get()).data().stripeId;
      const session = await stripe.checkout.sessions.create(
        {
          payment_method_types,
          customer,
          line_items: [
            {
              price,
              quantity,
            },
          ],
          mode: 'subscription',
          success_url,
          cancel_url,
        },
        { idempotencyKey: context.params.id }
      );
      await snap.ref.set(
        {
          sessionId: session.id,
          created: admin.firestore.Timestamp.now(),
        },
        { merge: true }
      );
      logs.checkoutSessionCreated(context.params.id);
      return;
    } catch (error) {
      logs.checkoutSessionCreationError(context.params.id, error);
    }
  });

/**
 * Create a billing portal link
 */
exports.createPortalLink = functions.https.onCall(async (data, context) => {
  // Checking that the user is authenticated.
  if (!context.auth) {
    // Throwing an HttpsError so that the client gets the error details.
    throw new functions.https.HttpsError(
      'failed-precondition',
      'The function must be called while authenticated!'
    );
  }
  const uid = context.auth.uid;
  try {
    if (!uid) throw new Error('Not authenticated!');
    const return_url = data.returnUrl;
    // Get stripe customer id
    const customer = (
      await admin
        .firestore()
        .collection(config.customersCollectionPath)
        .doc(uid)
        .get()
    ).data().stripeId;
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url,
    });
    logs.createdBillingPortalLink(uid);
    return session;
  } catch (error) {
    logs.billingPortalLinkCreationError(uid, error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Create a Product record in Firestore based on a Stripe Product object.
 */
const createProductRecord = async (product: Stripe.Product): Promise<void> => {
  const productData: Product = {
    active: product.active,
    name: product.name,
    description: product.description,
    role: product.metadata.firebaseRole ?? null,
    images: product.images,
  };
  await admin
    .firestore()
    .collection(config.productsCollectionPath)
    .doc(product.id)
    .set(productData, { merge: true });
  logs.firestoreDocCreated(config.productsCollectionPath, product.id);
};

/**
 * Create a price (billing price plan) and insert it into a subcollection in Products.
 */
const insertPriceRecord = async (price: Stripe.Price): Promise<void> => {
  const priceData: Price = {
    active: price.active,
    currency: price.currency,
    unit_amount: price.unit_amount,
    interval: price.recurring.interval,
    interval_count: price.recurring.interval_count,
    trial_period_days: price.recurring.trial_period_days,
  };
  const dbRef = admin
    .firestore()
    .collection(config.productsCollectionPath)
    .doc(price.product as string)
    .collection('prices');
  await dbRef.doc(price.id).set(priceData);
  logs.firestoreDocCreated('prices', price.id);
};

/**
 * Manage subscription status changes.
 */
const manageSubscriptionStatusChange = async (
  subscriptionId: string
): Promise<void> => {
  // Retrieve latest subscription status and write it to the Firestore
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price.product'],
  });
  const customerId = subscription.customer as string;
  // Get customer's UID from Firestore
  const customersSnap = await admin
    .firestore()
    .collection(config.customersCollectionPath)
    .where('stripeId', '==', customerId)
    .get();
  if (customersSnap.size !== 1) throw new Error('User not found!');
  const uid = customersSnap.docs[0].id;
  const price: Stripe.Price = subscription.items.data[0].price;
  const product: Stripe.Product = price.product as Stripe.Product;
  const role = product.metadata.firebaseRole ?? null;
  // Write the subscription to the cutsomer in Firestore
  const subsDbRef = customersSnap.docs[0].ref
    .collection('subscriptions')
    .doc(subscription.id);
  // Update with new Subscription status
  const subscriptionData: Subscription = {
    role,
    status: subscription.status,
    stripeLink: `https://dashboard.stripe.com${
      subscription.livemode ? '' : '/test'
    }/subscriptions/${subscription.id}`,
    price: admin
      .firestore()
      .collection(config.productsCollectionPath)
      .doc(product.id)
      .collection('prices')
      .doc(price.id),
    quantity: subscription.quantity,
    cancel_at_period_end: subscription.cancel_at_period_end,
    created: admin.firestore.Timestamp.fromMillis(subscription.created * 1000),
    ended_at: subscription.ended_at
      ? admin.firestore.Timestamp.fromMillis(subscription.ended_at * 1000)
      : null,
  };
  await subsDbRef.set(subscriptionData);
  logs.firestoreDocCreated('subscriptions', subscription.id);

  // Update their custom claims
  if (role) {
    // Set new role in custom claims as long as the subs status allows
    if (['trialing', 'active'].includes(subscription.status)) {
      logs.userCustomClaimSet(uid, { stripeRole: role });
      await admin.auth().setCustomUserClaims(uid, { stripeRole: role });
    } else {
      logs.userCustomClaimSet(uid, { stripeRole: null });
      await admin.auth().setCustomUserClaims(uid, { stripeRole: null });
    }
  }
  return;
};

/**
 * A webhook handler function for the relevant Stripe events.
 */
export const handleWebhookEvents = functions.handler.https.onRequest(
  async (req: functions.https.Request, resp) => {
    const relevantEvents = new Set([
      'product.created',
      'product.updated',
      'price.created',
      'price.updated',
      'checkout.session.completed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ]);
    let event: Stripe.Event;

    // Instead of getting the `Stripe.Event`
    // object directly from `req.body`,
    // use the Stripe webhooks API to make sure
    // this webhook call came from a trusted source
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
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
            const product = event.data.object as Stripe.Product;
            await createProductRecord(product);
            break;
          case 'price.created':
          case 'price.updated':
            const price = event.data.object as Stripe.Price;
            await insertPriceRecord(price);
            break;
          case 'customer.subscription.updated':
          case 'customer.subscription.deleted':
            const subscription = event.data.object as Stripe.Subscription;
            await manageSubscriptionStatusChange(subscription.id);
            break;
          case 'checkout.session.completed':
            const checkoutSession = event.data
              .object as Stripe.Checkout.Session;
            if (checkoutSession.mode === 'subscription') {
              const subscriptionId = checkoutSession.subscription as string;
              await manageSubscriptionStatusChange(subscriptionId);
            }
            break;
          default:
            throw new Error('Unhandled relevant event!');
        }
        logs.webhookHandlerSucceeded(event.id, event.type);
      } catch (error) {
        logs.webhookHandlerError(error, event.id, event.type);
        resp.status(400).send('Webhook handler failed. View logs.');
        return;
      }
    }

    // Return a response to Stripe to acknowledge receipt of the event.
    resp.json({ received: true });
  }
);
