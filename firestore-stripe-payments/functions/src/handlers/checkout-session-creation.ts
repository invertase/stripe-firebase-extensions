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
import * as logs from '../logs';
import config, { apiVersion, stripe } from '../config';
import { Timestamp } from 'firebase-admin/firestore';
import { createCustomerRecord } from '../utils';

export const handleCheckoutSessionCreation = async (
  snap: functions.firestore.QueryDocumentSnapshot,
  context: functions.EventContext,
) => {
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

    const parentRef = snap.ref.parent?.parent;
    if (!parentRef) {
      throw new Error('Invalid document reference, no parent collection found');
    }
    let customerRecord = (await parentRef.get()).data();
    if (!customerRecord?.stripeId) {
      const { email, phoneNumber } = await admin
        .auth()
        .getUser(context.params.uid);

      const newCustomerRecord = await createCustomerRecord({
        uid: context.params.uid,
        email,
        phone: phoneNumber,
      });

      if (!newCustomerRecord) {
        throw new Error('Failed to create customer record');
      }

      customerRecord = newCustomerRecord;
    }
    // @ts-ignore
    const customer = customerRecord.stripeId;

    if (client === 'web') {
      // Get shipping countries
      const shippingCountries: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] =
        collect_shipping_address
          ? ((
              await admin
                .firestore()
                .collection(
                  config.stripeConfigCollectionPath ||
                    config.productsCollectionPath,
                )
                .doc('shipping_countries')
                .get()
            ).data()?.['allowed_countries'] ?? [])
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
        // @ts-ignore
        sessionCreateParams.customer_update.name = 'auto';
        // @ts-ignore
        sessionCreateParams.customer_update.address = 'auto';
        // @ts-ignore
        sessionCreateParams.customer_update.shipping = 'auto';
      }
      if (tax_id_collection) {
        sessionCreateParams.tax_id_collection = {
          enabled: true,
        }; // @ts-ignore
        sessionCreateParams.customer_update.name = 'auto';
        // @ts-ignore
        sessionCreateParams.customer_update.address = 'auto';
        // @ts-ignore
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
        { idempotencyKey: context.params.id },
      );
      await snap.ref.set(
        {
          client,
          mode,
          sessionId: session.id,
          url: session.url,
          created: Timestamp.now(),
        },
        { merge: true },
      );
    } else if (client === 'mobile') {
      let paymentIntentClientSecret = null;
      let setupIntentClientSecret = null;
      if (mode === 'payment') {
        if (!amount || !currency) {
          throw new Error(
            `When using 'client:mobile' and 'mode:payment' you must specify amount and currency!`,
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
          paymentIntentCreateParams.payment_method_types = payment_method_types;
        } else {
          paymentIntentCreateParams.automatic_payment_methods =
            automatic_payment_methods;
        }
        const paymentIntent = await stripe.paymentIntents.create(
          paymentIntentCreateParams,
        );
        // @ts-ignore
        paymentIntentClientSecret = paymentIntent.client_secret;
      } else if (mode === 'setup') {
        const setupIntent = await stripe.setupIntents.create({
          customer,
          metadata,
          payment_method_types: payment_method_types ?? ['card'],
        });
        // @ts-ignore
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
          // @ts-ignore
          subscription.latest_invoice.payment_intent.client_secret;
      } else {
        throw new Error(`Mode '${mode} is not supported for 'client:mobile'!`);
      }
      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer },
        { apiVersion: apiVersion },
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
        { merge: true },
      );
    } else {
      throw new Error(
        `Client ${client} is not supported. Only 'web' or ' mobile' is supported!`,
      );
    }
    logs.checkoutSessionCreated(context.params.id);
    return;
  } catch (error) {
    logs.checkoutSessionCreationError(context.params.id, error);
    await snap.ref.set({ error: { message: error.message } }, { merge: true });
  }
};
