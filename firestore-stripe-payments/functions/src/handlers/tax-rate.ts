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
import { TaxRate } from '../interfaces';
import { prefixMetadata } from '../utils';

/**
 * Insert tax rates into the products collection in Cloud Firestore.
 */
export const insertTaxRateRecord = async (
  taxRate: Stripe.TaxRate
): Promise<void> => {
  const taxRateData: TaxRate = {
    ...taxRate,
    ...prefixMetadata(taxRate.metadata),
  };

  // Remove the original metadata to avoid duplication
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
