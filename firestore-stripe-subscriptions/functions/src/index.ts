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
import {
  Product,
  Price,
  Subscription,
  CustomerData,
  TaxRate,
} from './interfaces';
import * as logs from './logs';
import config from './config';

const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: '2020-03-02',
  // Register extension as a Stripe plugin
  // https://stripe.com/docs/building-plugins#setappinfo
  appInfo: {
    name: 'Firebase firestore-stripe-subscriptions',
    version: '0.1.9',
  },
});

admin.initializeApp();

/**
 * Create a customer object in Stripe when a user is created.
 */
const createCustomerRecord = async ({
  email,
  uid,
}: {
  email?: string;
  uid: string;
}) => {
  try {
    logs.creatingCustomer(uid);
    const customerData: CustomerData = {
      metadata: {
        firebaseUID: uid,
      },
    };
    if (email) customerData.email = email;
    const customer = await stripe.customers.create(customerData);
    // Add a mapping record in Cloud Firestore.
    const customerRecord = {
      stripeId: customer.id,
      stripeLink: `https://dashboard.stripe.com${
        customer.livemode ? '' : '/test'
      }/customers/${customer.id}`,
    };
    await admin
      .firestore()
      .collection(config.customersCollectionPath)
      .doc(uid)
      .set(customerRecord, { merge: true });
    logs.customerCreated(customer.id, customer.livemode);
    return customerRecord;
  } catch (error) {
    logs.customerCreationError(error, uid);
    return null;
  }
};

exports.createCustomer = functions.auth.user().onCreate(
  async (user): Promise<void> => {
    if (!config.syncUsersOnCreate) return;
    const { email, uid } = user;
    await createCustomerRecord({ email, uid });
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
      metadata = {},
      tax_rates = [],
      allow_promotion_codes = false,
      trial_from_plan = true,
      line_items,
      billing_address_collection = 'required',
    } = snap.data();
    try {
      logs.creatingCheckoutSession(context.params.id);
      // Get stripe customer id
      let customerRecord = (await snap.ref.parent.parent.get()).data();
      if (!customerRecord?.stripeId) {
        const { email } = await admin.auth().getUser(context.params.uid);
        customerRecord = await createCustomerRecord({
          uid: context.params.uid,
          email,
        });
      }
      const customer = customerRecord.stripeId;
      const session = await stripe.checkout.sessions.create(
        {
          billing_address_collection,
          payment_method_types,
          customer,
          line_items: line_items
            ? line_items
            : [
                {
                  price,
                  quantity,
                  tax_rates,
                },
              ],
          mode: 'subscription',
          allow_promotion_codes,
          subscription_data: {
            trial_from_plan,
            metadata,
          },
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
      await snap.ref.set(
        { error: { message: error.message } },
        { merge: true }
      );
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
 * Prefix Stripe metadata keys with `stripe_metadata_` to be spread onto Product and Price docs in Cloud Firestore.
 */
const prefixMetadata = (metadata: object) =>
  Object.keys(metadata).reduce((prefixedMetadata, key) => {
    prefixedMetadata[`stripe_metadata_${key}`] = metadata[key];
    return prefixedMetadata;
  }, {});

/**
 * Create a Product record in Firestore based on a Stripe Product object.
 */
const createProductRecord = async (product: Stripe.Product): Promise<void> => {
  const { firebaseRole, ...rawMetadata } = product.metadata;

  const productData: Product = {
    active: product.active,
    name: product.name,
    description: product.description,
    role: firebaseRole ?? null,
    images: product.images,
    ...prefixMetadata(rawMetadata),
  };
  await admin
    .firestore()
    .collection(config.productsCollectionPath)
    .doc(product.id)
    .set(productData);
  logs.firestoreDocCreated(config.productsCollectionPath, product.id);
};

/**
 * Create a price (billing price plan) and insert it into a subcollection in Products.
 */
const insertPriceRecord = async (price: Stripe.Price): Promise<void> => {
  if (price.billing_scheme === 'tiered')
    // Tiers aren't included by default, we need to retireve and expand.
    price = await stripe.prices.retrieve(price.id, { expand: ['tiers'] });

  const priceData: Price = {
    active: price.active,
    billing_scheme: price.billing_scheme,
    tiers_mode: price.tiers_mode,
    tiers: price.tiers ?? null,
    currency: price.currency,
    description: price.nickname,
    type: price.type,
    unit_amount: price.unit_amount,
    recurring: price.recurring,
    interval: price.recurring?.interval ?? null,
    interval_count: price.recurring?.interval_count ?? null,
    trial_period_days: price.recurring?.trial_period_days ?? null,
    transform_quantity: price.transform_quantity,
    ...prefixMetadata(price.metadata),
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
 * Insert tax rates into the products collection in Cloud Firestore.
 */
const insertTaxRateRecord = async (taxRate: Stripe.TaxRate): Promise<void> => {
  const taxRateData: TaxRate = {
    ...taxRate,
    ...prefixMetadata(taxRate.metadata),
  };
  delete taxRateData.metadata;
  await admin
    .firestore()
    .collection(config.productsCollectionPath)
    .doc('tax_rates')
    .collection('tax_rates')
    .doc(taxRate.id)
    .set(taxRateData);
  logs.firestoreDocCreated('tax_rates', taxRate.id);
};

/**
 * Copies the billing details from the payment method to the customer object.
 */
const copyBillingDetailsToCustomer = async (
  payment_method: Stripe.PaymentMethod
): Promise<void> => {
  const customer = payment_method.customer as string;
  const { name, phone, address } = payment_method.billing_details;
  await stripe.customers.update(customer, { name, phone, address });
};

/**
 * Manage subscription status changes.
 */
const manageSubscriptionStatusChange = async (
  subscriptionId: string,
  customerId: string,
  createAction: boolean
): Promise<void> => {
  // Get customer's UID from Firestore
  const customersSnap = await admin
    .firestore()
    .collection(config.customersCollectionPath)
    .where('stripeId', '==', customerId)
    .get();
  if (customersSnap.size !== 1) {
    throw new Error('User not found!');
  }
  const uid = customersSnap.docs[0].id;
  // Retrieve latest subscription status and write it to the Firestore
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['default_payment_method', 'items.data.price.product'],
  });
  const price: Stripe.Price = subscription.items.data[0].price;
  const prices = [];
  for (const item of subscription.items.data) {
    prices.push(
      admin
        .firestore()
        .collection(config.productsCollectionPath)
        .doc((item.price.product as Stripe.Product).id)
        .collection('prices')
        .doc(item.price.id)
    );
  }
  const product: Stripe.Product = price.product as Stripe.Product;
  const role = product.metadata.firebaseRole ?? null;
  // Get reference to subscription doc in Cloud Firestore.
  const subsDbRef = customersSnap.docs[0].ref
    .collection('subscriptions')
    .doc(subscription.id);
  // Update with new Subscription status
  const subscriptionData: Subscription = {
    metadata: subscription.metadata,
    role,
    status: subscription.status,
    stripeLink: `https://dashboard.stripe.com${
      subscription.livemode ? '' : '/test'
    }/subscriptions/${subscription.id}`,
    product: admin
      .firestore()
      .collection(config.productsCollectionPath)
      .doc(product.id),
    price: admin
      .firestore()
      .collection(config.productsCollectionPath)
      .doc(product.id)
      .collection('prices')
      .doc(price.id),
    prices,
    quantity: subscription.quantity,
    cancel_at_period_end: subscription.cancel_at_period_end,
    cancel_at: subscription.cancel_at
      ? admin.firestore.Timestamp.fromMillis(subscription.cancel_at * 1000)
      : null,
    canceled_at: subscription.canceled_at
      ? admin.firestore.Timestamp.fromMillis(subscription.canceled_at * 1000)
      : null,
    current_period_start: admin.firestore.Timestamp.fromMillis(
      subscription.current_period_start * 1000
    ),
    current_period_end: admin.firestore.Timestamp.fromMillis(
      subscription.current_period_end * 1000
    ),
    created: admin.firestore.Timestamp.fromMillis(subscription.created * 1000),
    ended_at: subscription.ended_at
      ? admin.firestore.Timestamp.fromMillis(subscription.ended_at * 1000)
      : null,
    trial_start: subscription.trial_start
      ? admin.firestore.Timestamp.fromMillis(subscription.trial_start * 1000)
      : null,
    trial_end: subscription.trial_end
      ? admin.firestore.Timestamp.fromMillis(subscription.trial_end * 1000)
      : null,
  };
  await subsDbRef.set(subscriptionData);
  logs.firestoreDocCreated('subscriptions', subscription.id);

  // Update their custom claims
  if (role) {
    try {
      // Get existing claims for the user
      const { customClaims } = await admin.auth().getUser(uid);
      // Set new role in custom claims as long as the subs status allows
      if (['trialing', 'active'].includes(subscription.status)) {
        logs.userCustomClaimSet(uid, 'stripeRole', role);
        await admin
          .auth()
          .setCustomUserClaims(uid, { ...customClaims, stripeRole: role });
      } else {
        logs.userCustomClaimSet(uid, 'stripeRole', 'null');
        await admin
          .auth()
          .setCustomUserClaims(uid, { ...customClaims, stripeRole: null });
      }
    } catch (error) {
      // User has been deleted, simply return.
      return;
    }
  }

  // NOTE: This is a costly operation and should happen at the very end.
  // Copy the billing deatils to the customer object.
  if (createAction && subscription.default_payment_method) {
    await copyBillingDetailsToCustomer(
      subscription.default_payment_method as Stripe.PaymentMethod
    );
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
      'product.deleted',
      'price.created',
      'price.updated',
      'price.deleted',
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'tax_rate.created',
      'tax_rate.updated',
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
            const checkoutSession = event.data
              .object as Stripe.Checkout.Session;
            if (checkoutSession.mode === 'subscription') {
              const subscriptionId = checkoutSession.subscription as string;
              await manageSubscriptionStatusChange(
                subscriptionId,
                checkoutSession.customer as string,
                true
              );
            }
            break;
          default:
            logs.webhookHandlerError(
              new Error('Unhandled relevant event!'),
              event.id,
              event.type
            );
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

const deleteProductOrPrice = async (pr: Stripe.Product | Stripe.Price) => {
  if (pr.object === 'product') {
    await admin
      .firestore()
      .collection(config.productsCollectionPath)
      .doc(pr.id)
      .delete();
    logs.firestoreDocDeleted(config.productsCollectionPath, pr.id);
  }
  if (pr.object === 'price') {
    await admin
      .firestore()
      .collection(config.productsCollectionPath)
      .doc((pr as Stripe.Price).product as string)
      .collection('prices')
      .doc(pr.id)
      .delete();
    logs.firestoreDocDeleted('prices', pr.id);
  }
};

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
      ended_at: admin.firestore.Timestamp.now(),
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
    const { stripeId } = snap.data();
    await deleteStripeCustomer({ uid: context.params.uid, stripeId });
  });
