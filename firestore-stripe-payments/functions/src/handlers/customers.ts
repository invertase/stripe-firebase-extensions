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
import { Timestamp } from 'firebase-admin/firestore';
import { admin, stripe } from '../services';
import * as logs from '../logs';
import config from '../config';
import { CustomerData } from '../interfaces';
import Stripe from 'stripe';

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
export const copyBillingDetailsToCustomer = async (
  payment_method: Stripe.PaymentMethod
): Promise<void> => {
  const customer = payment_method.customer as string;
  const { name, phone, address } = payment_method.billing_details;
  await stripe.customers.update(customer, { name, phone, address });
};

/**
 * Delete a Stripe customer and update related subscriptions in Firestore.
 */
export const deleteStripeCustomer = async ({
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
      ended_at: Timestamp.now(),
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

/**
 * Cloud Function: Create a customer object in Stripe when a user is created.
 */
export const createCustomer = functions.auth
  .user()
  .onCreate(async (user): Promise<void> => {
    if (!config.syncUsersOnCreate) return;
    const { email, uid, phoneNumber } = user;
    await createCustomerRecord({
      email,
      uid,
      phone: phoneNumber,
    });
  });

/**
 * Cloud Function: Delete the customer object in Stripe when a user is deleted.
 */
export const onUserDeleted = functions.auth.user().onDelete(async (user) => {
  if (!config.autoDeleteUsers) return;
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

/**
 * Cloud Function: Delete the customer object in Stripe when customer data is deleted.
 */
export const onCustomerDataDeleted = functions.firestore
  .document(`/${config.customersCollectionPath}/{uid}`)
  .onDelete(async (snap, context) => {
    if (!config.autoDeleteUsers) return;
    const { stripeId } = snap.data();
    await deleteStripeCustomer({ uid: context.params.uid, stripeId });
  });
