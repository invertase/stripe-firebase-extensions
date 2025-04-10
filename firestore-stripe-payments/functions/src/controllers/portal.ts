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

import * as functions from 'firebase-functions';
import Stripe from 'stripe';
import { admin, stripe } from '../services';
import * as logs from '../logs';
import config from '../config';
import { createCustomerRecord } from '../handlers/customer';

/**
 * Create a billing portal link
 */
export const createPortalLink = functions.https.onCall(
  async (data, context) => {
    // Checking that the user is authenticated.
    const uid = context.auth?.uid;
    if (!uid) {
      // Throwing an HttpsError so that the client gets the error details.
      throw new functions.https.HttpsError(
        'unauthenticated',
        'The function must be called while authenticated!'
      );
    }
    try {
      const {
        returnUrl: return_url,
        locale = 'auto',
        configuration,
        flow_data,
      } = data;

      // Get stripe customer id
      let customerRecord = (
        await admin
          .firestore()
          .collection(config.customersCollectionPath)
          .doc(uid)
          .get()
      ).data();

      if (!customerRecord?.stripeId) {
        // Create Stripe customer on-the-fly
        const { email, phoneNumber } = await admin.auth().getUser(uid);
        customerRecord = await createCustomerRecord({
          uid,
          email,
          phone: phoneNumber,
        });
      }
      const customer = customerRecord.stripeId;

      const params: Stripe.BillingPortal.SessionCreateParams = {
        customer,
        return_url,
        locale,
      };
      if (configuration) {
        params.configuration = configuration;
      }
      if (flow_data) {
        // Ignore type-checking because `flow_data` was added to
        // `Stripe.BillingPortal.SessionCreateParams` in
        // stripe@11.2.0 (API version 2022-12-06)
        (params as any).flow_data = flow_data;
      }
      const session = await stripe.billingPortal.sessions.create(params);
      logs.createdBillingPortalLink(uid);
      return session;
    } catch (error) {
      logs.billingPortalLinkCreationError(uid, error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);
