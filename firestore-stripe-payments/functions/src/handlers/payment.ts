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
import { admin, stripe } from '../services';
import * as logs from '../logs';
import config from '../config';

/**
 * Add PaymentIntent objects to Cloud Firestore for one-time payments.
 */
export const insertPaymentRecord = async (
  payment: Stripe.PaymentIntent,
  checkoutSession?: Stripe.Checkout.Session
): Promise<void> => {
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
        admin
          .firestore()
          .collection(config.productsCollectionPath)
          .doc(item.price.product as string)
          .collection('prices')
          .doc(item.price.id)
      );
    }

    payment['prices'] = prices;
    payment['items'] = lineItems.data;
  }

  // Write to payments subcollection on the customer doc
  await customersSnap.docs[0].ref
    .collection('payments')
    .doc(payment.id)
    .set(payment, { merge: true });

  logs.firestoreDocCreated('payments', payment.id);
};
