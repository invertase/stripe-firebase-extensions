import * as admin from 'firebase-admin';
import { DocumentReference, DocumentData } from '@google-cloud/firestore';
import {
  waitForDocumentToExistInCollection,
  waitForDocumentToExistWithField,
} from './utils';
import { UserRecord } from 'firebase-functions/v1/auth';
import setupEmulator from './setupEmulator';

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: 'demo-project' });
}

setupEmulator();

const firestore = admin.firestore();

function customerCollection() {
  return firestore.collection('customers');
}

function paymentsCollection(userId) {
  return firestore.collection('customers').doc(userId).collection('payments');
}

export async function findCustomerInCollection(user: UserRecord) {
  const doc = firestore.collection('customers').doc(user.uid);

  const customerDoc = await waitForDocumentToExistWithField(
    doc,
    'stripeId',
    60000
  );

  return Promise.resolve({ docId: user.uid, ...customerDoc.data() });
}

export async function findCustomerPaymentInCollection(
  userId: string,
  stripeId: string
) {
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
}

export async function createCheckoutSession(userId, subscription) {
  const checkoutSessionCollection = customerCollection()
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
}
