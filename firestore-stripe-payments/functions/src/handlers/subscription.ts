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

import Stripe from 'stripe';
import { Timestamp } from 'firebase-admin/firestore';
import { admin, stripe } from '../services';
import * as logs from '../logs';
import config from '../config';
import { Subscription } from '../interfaces';
import { copyBillingDetailsToCustomer } from './customer';

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
  // Copy the billing details to the customer object.
  if (createAction && subscription.default_payment_method) {
    await copyBillingDetailsToCustomer(
      subscription.default_payment_method as Stripe.PaymentMethod
    );
  }
};
