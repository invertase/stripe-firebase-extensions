import * as admin from 'firebase-admin';
import { DocumentData } from '@google-cloud/firestore';
import setupEmulator from './../../helpers/setupEmulator';
import { findCustomer } from './../../helpers/stripeApi/customers';
import {
  repeat,
  waitForDocumentToExistWithField,
  waitForDocumentToExistInCollection,
  createFirebaseUser,
} from './../../helpers/utils';
import { UserRecord } from 'firebase-functions/v1/auth';

admin.initializeApp({ projectId: 'demo-project' });
setupEmulator();

const firestore = admin.firestore();

describe('customerDataDeleted', () => {
  let user: UserRecord;
  beforeEach(async () => {
    user = await createFirebaseUser();
  });

  test('successfully deletes a stripe customer', async () => {
    const collection = firestore.collection('customers');

    const customer: DocumentData = await waitForDocumentToExistInCollection(
      collection,
      'email',
      user.email
    );

    const doc = collection.doc(customer.doc.id);
    const userDoc = await waitForDocumentToExistWithField(doc, 'stripeId');

    await admin.auth().deleteUser(customer.doc.id);

    const check = ($) => $?.deleted;
    const toRun = () => findCustomer(userDoc.data().stripeId);
    await repeat(toRun, check, 5, 2000);
  });
});
