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
import { Product } from '../interfaces';
import { prefixMetadata } from '../utils';

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
 * Delete a product from Firestore.
 */
export const deleteProductRecord = async (productId: string): Promise<void> => {
  await admin
    .firestore()
    .collection(config.productsCollectionPath)
    .doc(productId)
    .delete();

  logs.firestoreDocDeleted(config.productsCollectionPath, productId);
};

/**
 * Delete a product or price from Firestore based on the object type.
 */
export const deleteProductOrPrice = async (
  pr: Stripe.Product | Stripe.Price
): Promise<void> => {
  if (pr.object === 'product') {
    await deleteProductRecord(pr.id);
  } else if (pr.object === 'price') {
    // This is handled by price handler, but included here for completeness
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
