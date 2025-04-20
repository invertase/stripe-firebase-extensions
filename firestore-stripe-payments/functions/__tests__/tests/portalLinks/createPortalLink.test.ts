import * as admin from 'firebase-admin';
import { DocumentData } from '@google-cloud/firestore';
import functions from 'firebase-functions-test';
import * as cloudFunctions from '../../../src';
import setupEmulator from '../../helpers/setupEmulator';

import {
  createFirebaseUser,
  waitForDocumentToExistInCollection,
  waitForDocumentToExistWithField,
} from '../../helpers/utils';
import { UserRecord } from 'firebase-functions/v1/auth';

const testEnv = functions({ projectId: 'demo-project' });
const createPortalLink = testEnv.wrap(cloudFunctions.createPortalLink);
setupEmulator();

const firestore = admin.firestore();

function request(uid: string, returnUrl: string) {
  return createPortalLink(
    { returnUrl },
    {
      auth: {
        uid,
        token: 'test',
      },
    }
  );
}

describe('createPortalLink', () => {
  let user: UserRecord;
  beforeEach(async () => {
    user = await createFirebaseUser();
  });

  afterEach(async () => {
    await admin.auth().deleteUser(user.uid);
  });

  test('successfully creates a new portal link', async () => {
    const collection = firestore.collection('customers');

    const customer: DocumentData = await waitForDocumentToExistInCollection(
      collection,
      'email',
      user.email
    );

    const doc = collection.doc(customer.doc.id);
    const customerDoc = await waitForDocumentToExistWithField(doc, 'stripeId');

    const returnUrl = 'http://test.com';
    const result = await request(customerDoc.id, returnUrl);

    expect(result.object).toBe('billing_portal.session');
    expect(result.customer).toBe(customerDoc.data().stripeId);
    expect(result.livemode).toBe(false);
    expect(result.return_url).toBe(returnUrl);
    expect(result.url).toBeDefined();
  });
});
