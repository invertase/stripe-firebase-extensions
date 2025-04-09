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

import * as functions from 'firebase-functions';
import Stripe from 'stripe';
import * as logs from './logs';
import config from './config';
import { Timestamp } from 'firebase-admin/firestore';
import { apiVersion, stripe, admin, eventChannel } from './services';

import { createCustomerRecord } from './handlers/customer';
import { manageSubscriptionStatusChange } from './handlers/subscription';
import { insertPaymentRecord } from './handlers/payment';
export {
  createCustomer,
  onUserDeleted,
  onCustomerDataDeleted,
} from './handlers/customer';
import { deleteProductOrPrice, createProductRecord } from './handlers/product';
import { insertTaxRateRecord } from './handlers/tax-rate';
import { insertPriceRecord } from './handlers/price';
import { insertInvoiceRecord } from './handlers/invoice';

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
  .onCreate(async (snap, context) => {
    const {
      client = 'web',
      amount,
      currency,
      mode = 'subscription',
      price,
      success_url,
      cancel_url,
      quantity = 1,
      payment_method_types,
      shipping_rates = [],
      metadata = {},
      automatic_payment_methods = { enabled: true },
      automatic_tax = false,
      invoice_creation = false,
      tax_rates = [],
      tax_id_collection = false,
      allow_promotion_codes = false,
      trial_period_days,
      line_items,
      billing_address_collection = 'required',
      collect_shipping_address = false,
      customer_update = {},
      locale = 'auto',
      promotion_code,
      client_reference_id,
      setup_future_usage,
      after_expiration = {},
      consent_collection = {},
      expires_at,
      phone_number_collection = {},
      payment_method_collection = 'always',
    } = snap.data();
    try {
      logs.creatingCheckoutSession(context.params.id);
      // Get stripe customer id
      let customerRecord = (await snap.ref.parent.parent.get()).data();
      if (!customerRecord?.stripeId) {
        const { email, phoneNumber } = await admin
          .auth()
          .getUser(context.params.uid);
        customerRecord = await createCustomerRecord({
          uid: context.params.uid,
          email,
          phone: phoneNumber,
        });
      }
      const customer = customerRecord.stripeId;

      if (client === 'web') {
        // Get shipping countries
        const shippingCountries: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] =
          collect_shipping_address
            ? (
                await admin
                  .firestore()
                  .collection(
                    config.stripeConfigCollectionPath ||
                      config.productsCollectionPath
                  )
                  .doc('shipping_countries')
                  .get()
              ).data()?.['allowed_countries'] ?? []
            : [];
        const sessionCreateParams: Stripe.Checkout.SessionCreateParams = {
          billing_address_collection,
          shipping_address_collection: { allowed_countries: shippingCountries },
          shipping_rates,
          customer,
          customer_update,
          line_items: line_items
            ? line_items
            : [
                {
                  price,
                  quantity,
                },
              ],
          mode,
          success_url,
          cancel_url,
          locale,
          after_expiration,
          consent_collection,
          phone_number_collection,
          ...(expires_at && { expires_at }),
        };
        if (payment_method_types) {
          sessionCreateParams.payment_method_types = payment_method_types;
        }
        if (mode === 'subscription') {
          sessionCreateParams.payment_method_collection =
            payment_method_collection;
          sessionCreateParams.subscription_data = {
            metadata,
          };
          if (trial_period_days) {
            sessionCreateParams.subscription_data.trial_period_days =
              trial_period_days;
          }
          if (!automatic_tax) {
            sessionCreateParams.subscription_data.default_tax_rates = tax_rates;
          }
        } else if (mode === 'payment') {
          sessionCreateParams.payment_intent_data = {
            metadata,
            ...(setup_future_usage && { setup_future_usage }),
          };
          if (invoice_creation) {
            sessionCreateParams.invoice_creation = {
              enabled: true,
            };
          }
        }
        if (automatic_tax) {
          sessionCreateParams.automatic_tax = {
            enabled: true,
          };
          sessionCreateParams.customer_update.name = 'auto';
          sessionCreateParams.customer_update.address = 'auto';
          sessionCreateParams.customer_update.shipping = 'auto';
        }
        if (tax_id_collection) {
          sessionCreateParams.tax_id_collection = {
            enabled: true,
          };
          sessionCreateParams.customer_update.name = 'auto';
          sessionCreateParams.customer_update.address = 'auto';
          sessionCreateParams.customer_update.shipping = 'auto';
        }
        if (promotion_code) {
          sessionCreateParams.discounts = [{ promotion_code }];
        } else {
          sessionCreateParams.allow_promotion_codes = allow_promotion_codes;
        }
        if (client_reference_id)
          sessionCreateParams.client_reference_id = client_reference_id;
        const session = await stripe.checkout.sessions.create(
          sessionCreateParams,
          { idempotencyKey: context.params.id }
        );
        await snap.ref.set(
          {
            client,
            mode,
            sessionId: session.id,
            url: session.url,
            created: Timestamp.now(),
          },
          { merge: true }
        );
      } else if (client === 'mobile') {
        let paymentIntentClientSecret = null;
        let setupIntentClientSecret = null;
        if (mode === 'payment') {
          if (!amount || !currency) {
            throw new Error(
              `When using 'client:mobile' and 'mode:payment' you must specify amount and currency!`
            );
          }
          const paymentIntentCreateParams: Stripe.PaymentIntentCreateParams = {
            amount,
            currency,
            customer,
            metadata,
            ...(setup_future_usage && { setup_future_usage }),
          };
          if (payment_method_types) {
            paymentIntentCreateParams.payment_method_types =
              payment_method_types;
          } else {
            paymentIntentCreateParams.automatic_payment_methods =
              automatic_payment_methods;
          }
          const paymentIntent = await stripe.paymentIntents.create(
            paymentIntentCreateParams
          );
          paymentIntentClientSecret = paymentIntent.client_secret;
        } else if (mode === 'setup') {
          const setupIntent = await stripe.setupIntents.create({
            customer,
            metadata,
            payment_method_types: payment_method_types ?? ['card'],
          });
          setupIntentClientSecret = setupIntent.client_secret;
        } else if (mode === 'subscription') {
          const subscription = await stripe.subscriptions.create({
            customer,
            items: [{ price }],
            trial_period_days: trial_period_days,
            payment_behavior: 'default_incomplete',
            expand: ['latest_invoice.payment_intent'],
            metadata: {
              firebaseUserUID: context.params.id,
            },
          });

          paymentIntentClientSecret =
            //@ts-ignore
            subscription.latest_invoice.payment_intent.client_secret;
        } else {
          throw new Error(
            `Mode '${mode} is not supported for 'client:mobile'!`
          );
        }
        const ephemeralKey = await stripe.ephemeralKeys.create(
          { customer },
          { apiVersion }
        );
        await snap.ref.set(
          {
            client,
            mode,
            customer,
            created: Timestamp.now(),
            ephemeralKeySecret: ephemeralKey.secret,
            paymentIntentClientSecret,
            setupIntentClientSecret,
          },
          { merge: true }
        );
      } else {
        throw new Error(
          `Client ${client} is not supported. Only 'web' or ' mobile' is supported!`
        );
      }
      logs.checkoutSessionCreated(context.params.id);
      return;
    } catch (error) {
      logs.checkoutSessionCreationError(context.params.id, error);
      await snap.ref.set(
        { error: { message: error.message } },
        { merge: true }
      );
    }
  });

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
        customerRecord = await createCustomerRecord({
          uid,
          email,
          phone: phoneNumber,
        });
      }
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
export const handleWebhookEvents = functions.handler.https.onRequest(
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
