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
import { Price } from '../interfaces';
import { prefixMetadata } from '../utils';

/**
 * Create a price (billing price plan) and insert it into a subcollection in Products.
 */
export const insertPriceRecord = async (price: Stripe.Price): Promise<void> => {
  if (price.billing_scheme === 'tiered')
    // Tiers aren't included by default, we need to retrieve and expand.
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
 * Delete a price from Firestore.
 */
export const deletePriceRecord = async (price: Stripe.Price): Promise<void> => {
  await admin
    .firestore()
    .collection(config.productsCollectionPath)
    .doc(price.product as string)
    .collection('prices')
    .doc(price.id)
    .delete();

  logs.firestoreDocDeleted('prices', price.id);
};
