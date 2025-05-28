import * as admin from 'firebase-admin';
import * as logs from './logs';
import config, { stripe } from './config';
import { CustomerData } from './interfaces';

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
