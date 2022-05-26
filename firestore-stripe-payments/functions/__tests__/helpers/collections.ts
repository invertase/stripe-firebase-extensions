import * as admin from 'firebase-admin';
import { DocumentReference, DocumentData } from '@google-cloud/firestore';
import {
  waitForDocumentToExistInCollection,
  waitForDocumentToExistWithField,
} from './utils';
import { UserRecord } from 'firebase-functions/v1/auth';

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: 'demo-project' });
}

const firestore = admin.firestore();

export const customerCollection = firestore.collection('customers');

export const paymentsCollection = (userId) => {
  return firestore.collection('customers').doc(userId).collection('payments');
};

export const findCustomerInCollection = async (user: UserRecord) => {
  const doc = customerCollection.doc(user.uid);
  const customerDoc = await waitForDocumentToExistWithField(doc, 'stripeId');

  return { docId: user.uid, ...customerDoc.data() };
};

export const findCustomerPaymentInCollection = async (
  userId: string,
  stripeId: string
) => {
  const paymentDoc: DocumentData = await waitForDocumentToExistInCollection(
    paymentsCollection(userId),
    'customer',
    stripeId
  );

  const paymentRef = paymentsCollection(userId).doc(paymentDoc.doc.id);

  const updatedPaymentDoc = await waitForDocumentToExistWithField(
    paymentRef,
    'prices'
  );

  return updatedPaymentDoc.data();
};

export const createCheckoutSession = async (userId, subscription) => {
  const checkoutSessionCollection = customerCollection
    .doc(userId)
    .collection('checkout_sessions');

  const checkoutSessionDocument: DocumentReference =
    await checkoutSessionCollection.add({
      success_url: 'http://test.com/success',
      cancel_url: 'http://test.com/cancel',
      ...subscription,
    });

  const checkoutSessionDoc = await waitForDocumentToExistWithField(
    checkoutSessionDocument,
    'created'
  );

  return checkoutSessionDoc.data();
};
