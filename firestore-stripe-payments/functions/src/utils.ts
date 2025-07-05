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
import {
  CustomerData,
  Product,
  Subscription,
  Price,
  TaxRate,
} from './interfaces';
import * as logs from './logs';
import config from './config';
import { stripe } from './config';
import Stripe from 'stripe';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Prefix Stripe metadata keys with `stripe_metadata_` to be spread onto Product and Price docs in Cloud Firestore.
 */
export const prefixMetadata = (metadata: object) =>
  Object.keys(metadata).reduce((prefixedMetadata, key) => {
    prefixedMetadata[`stripe_metadata_${key}`] = metadata[key];
    return prefixedMetadata;
  }, {});

/**
 * Create a Product record in Firestore based on a Stripe Product object.
 */
export const createProductRecord = async (
  product: Stripe.Product
): Promise<void> => {
  const { firebaseRole, ...rawMetadata } = product.metadata;

  const productData: Product = {
    active: product.active,
    name: product.name,
    description: product.description,
    role: firebaseRole ?? null,
    images: product.images,
    metadata: product.metadata,
    tax_code: product.tax_code ?? null,
    ...prefixMetadata(rawMetadata),
  };
  await admin
    .firestore()
    .collection(config.productsCollectionPath)
    .doc(product.id)
    .set(productData, { merge: true });
  logs.firestoreDocCreated(config.productsCollectionPath, product.id);
};

/**
 * Create a customer object in Stripe when a user is created.
 */
export const createCustomerRecord = async ({
  email,
  uid,
  phone,
}: {
  email?: string;
  phone?: string;
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
    if (phone) customerData.phone = phone;
    const customer = await stripe.customers.create(customerData);

    // Add a mapping record in Cloud Firestore.
    const customerRecord = {
      email: customer.email,
      stripeId: customer.id,
      stripeLink: `https://dashboard.stripe.com${
        customer.livemode ? '' : '/test'
      }/customers/${customer.id}`,
    };
    if (phone) (customerRecord as any).phone = phone;
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

/**
 * Copies the billing details from the payment method to the customer object.
 */
const copyBillingDetailsToCustomer = async (
  payment_method: Stripe.PaymentMethod
): Promise<void> => {
  const customer = payment_method.customer as string;
  const { name, phone, address } = payment_method.billing_details;
  // @ts-ignore
  await stripe.customers.update(customer, { name, phone, address });
};

/**
 * Manage subscription status changes.
 */
export const manageSubscriptionStatusChange = async (
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
      // @ts-ignore
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
    // @ts-ignore
    quantity: subscription.items.data[0].quantity ?? null,
    items: subscription.items.data,
    cancel_at_period_end: subscription.cancel_at_period_end,
    cancel_at: subscription.cancel_at
      ? Timestamp.fromMillis(subscription.cancel_at * 1000)
      : null,
    canceled_at: subscription.canceled_at
      ? Timestamp.fromMillis(subscription.canceled_at * 1000)
      : null,
    current_period_start: Timestamp.fromMillis(
      subscription.current_period_start * 1000
    ),
    current_period_end: Timestamp.fromMillis(
      subscription.current_period_end * 1000
    ),
    created: Timestamp.fromMillis(subscription.created * 1000),
    ended_at: subscription.ended_at
      ? Timestamp.fromMillis(subscription.ended_at * 1000)
      : null,
    trial_start: subscription.trial_start
      ? Timestamp.fromMillis(subscription.trial_start * 1000)
      : null,
    trial_end: subscription.trial_end
      ? Timestamp.fromMillis(subscription.trial_end * 1000)
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
 * Create a price (billing price plan) and insert it into a subcollection in Products.
 */
export const insertPriceRecord = async (price: Stripe.Price): Promise<void> => {
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
    // @ts-ignore
    unit_amount: price.unit_amount,
    recurring: price.recurring,
    interval: price.recurring?.interval ?? null,
    interval_count: price.recurring?.interval_count ?? null,
    trial_period_days: price.recurring?.trial_period_days ?? null,
    transform_quantity: price.transform_quantity,
    tax_behavior: price.tax_behavior ?? null,
    metadata: price.metadata,
    product: price.product,
    ...prefixMetadata(price.metadata),
  };
  const dbRef = admin
    .firestore()
    .collection(config.productsCollectionPath)
    .doc(price.product as string)
    .collection('prices');
  await dbRef.doc(price.id).set(priceData, { merge: true });
  logs.firestoreDocCreated('prices', price.id);
};

/**
 * Insert tax rates into the products collection in Cloud Firestore.
 */
export const insertTaxRateRecord = async (
  taxRate: Stripe.TaxRate
): Promise<void> => {
  const taxRateData: TaxRate = {
    ...taxRate,
    // @ts-ignore
    ...prefixMetadata(taxRate.metadata),
  };
  // @ts-ignore
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
 * Add invoice objects to Cloud Firestore.
 */
export const insertInvoiceRecord = async (invoice: Stripe.Invoice) => {
  // Get customer's UID from Firestore
  const customersSnap = await admin
    .firestore()
    .collection(config.customersCollectionPath)
    .where('stripeId', '==', invoice.customer)
    .get();
  if (customersSnap.size !== 1) {
    throw new Error('User not found!');
  }
  // Write to invoice to a subcollection on the subscription doc.
  await customersSnap.docs[0].ref
    .collection('subscriptions')
    .doc(invoice.subscription as string)
    .collection('invoices')
    .doc(invoice.id)
    .set(invoice);

  const prices = [];
  for (const item of invoice.lines.data) {
    prices.push(
      // @ts-ignore
      admin
        .firestore()
        .collection(config.productsCollectionPath)
        // @ts-ignore
        .doc(item.price.product as string)
        .collection('prices')
        // @ts-ignore
        .doc(item.price.id)
    );
  }

  // An Invoice object does not always have an associated Payment Intent
  const recordId: string = (invoice.payment_intent as string) ?? invoice.id;

  // Update subscription payment with price data
  await customersSnap.docs[0].ref
    .collection('payments')
    .doc(recordId)
    .set({ prices }, { merge: true });
  logs.firestoreDocCreated('invoices', invoice.id);
};

/**
 * Add PaymentIntent objects to Cloud Firestore for one-time payments.
 */
export const insertPaymentRecord = async (
  payment: Stripe.PaymentIntent,
  checkoutSession?: Stripe.Checkout.Session
) => {
  // Get customer's UID from Firestore
  const customersSnap = await admin
    .firestore()
    .collection(config.customersCollectionPath)
    .where('stripeId', '==', payment.customer)
    .get();
  if (customersSnap.size !== 1) {
    throw new Error('User not found!');
  }
  if (checkoutSession) {
    const lineItems = await stripe.checkout.sessions.listLineItems(
      checkoutSession.id
    );
    const prices = [];
    for (const item of lineItems.data) {
      prices.push(
        // @ts-ignore
        admin
          .firestore()
          .collection(config.productsCollectionPath)
          // @ts-ignore
          .doc(item.price.product as string)
          .collection('prices')
          // @ts-ignore
          .doc(item.price.id)
      );
    }
    payment['prices'] = prices;
    payment['items'] = lineItems.data;
  }
  // Write to invoice to a subcollection on the customer doc.
  await customersSnap.docs[0].ref
    .collection('payments')
    .doc(payment.id)
    .set(payment, { merge: true });
  logs.firestoreDocCreated('payments', payment.id);
};

/**
 * Delete a product or price from Firestore.
 */
export const deleteProductOrPrice = async (
  pr: Stripe.Product | Stripe.Price
) => {
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
