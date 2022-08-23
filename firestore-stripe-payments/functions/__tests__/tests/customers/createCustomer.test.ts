import * as admin from 'firebase-admin';
import { DocumentData } from '@google-cloud/firestore';

import setupEmulator from '../../helpers/setupEmulator';
import { UserRecord } from 'firebase-functions/v1/auth';
import {
  createFirebaseUser,
  waitForDocumentToExistInCollection,
} from '../../helpers/utils';

admin.initializeApp({ projectId: 'demo-project' });
setupEmulator();

const firestore = admin.firestore();

describe('createCustomer', () => {
  let user: UserRecord;
  beforeEach(async () => {
    user = await createFirebaseUser();
  });

  test('successfully creates a new customers', async () => {
    const collection = firestore.collection('customers');

    const customer: DocumentData = await waitForDocumentToExistInCollection(
      collection,
      'email',
      user.email
    );

    const doc = collection.doc(customer.doc.id);

    expect(doc.id).toBeDefined();
  });
});
