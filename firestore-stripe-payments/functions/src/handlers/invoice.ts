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
import { admin } from '../services';
import * as logs from '../logs';
import config from '../config';

/**
 * Add invoice objects to Cloud Firestore.
 */
export const insertInvoiceRecord = async (
  invoice: Stripe.Invoice
): Promise<void> => {
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
      admin
        .firestore()
        .collection(config.productsCollectionPath)
        .doc(item.price.product as string)
        .collection('prices')
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
