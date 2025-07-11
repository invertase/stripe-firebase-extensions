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

import { getEventarc } from 'firebase-admin/eventarc';
import Stripe from 'stripe';

export interface ExtensionConfig {
  stripeSecretKey: string;
  stripeWebhookSecret?: string;
  productsCollectionPath: string;
  customersCollectionPath: string;
  stripeConfigCollectionPath?: string;
  syncUsersOnCreate: boolean;
  autoDeleteUsers: boolean;
  minCheckoutInstances: number;
}

const config: ExtensionConfig = {
  stripeSecretKey: process.env.STRIPE_API_KEY as string,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  productsCollectionPath: process.env.PRODUCTS_COLLECTION as string,
  customersCollectionPath: process.env.CUSTOMERS_COLLECTION as string,
  stripeConfigCollectionPath: process.env.STRIPE_CONFIG_COLLECTION,
  syncUsersOnCreate: process.env.SYNC_USERS_ON_CREATE === 'Sync',
  autoDeleteUsers: process.env.DELETE_STRIPE_CUSTOMERS === 'Auto delete',
  minCheckoutInstances:
    Number(process.env.CREATE_CHECKOUT_SESSION_MIN_INSTANCES) ?? 0,
};

export const apiVersion = '2022-11-15';

export const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion,
  // Register extension as a Stripe plugin
  // https://stripe.com/docs/building-plugins#setappinfo
  appInfo: {
    name: 'Firebase Invertase firestore-stripe-payments',
    version: '0.3.5',
  },
});

export const getEventChannel = () => {
  return (
    process.env.EVENTARC_CHANNEL &&
    getEventarc().channel(process.env.EVENTARC_CHANNEL, {
      allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
    })
  );
};

export default config;
