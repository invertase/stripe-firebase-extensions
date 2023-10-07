import * as admin from 'firebase-admin';
import { DocumentData } from '@google-cloud/firestore';
import { Subscription } from '../../../src/interfaces';
import setupEmulator from '../../helpers/setupEmulator';

import { createRandomSubscription } from '../../helpers/stripeApi/subscriptions';
import {
  createFirebaseUser,
  waitForDocumentToExistInCollection,
  waitForDocumentToExistWithField,
} from '../../helpers/utils';
import { UserRecord } from 'firebase-functions/v1/auth';

admin.initializeApp({ projectId: 'demo-project' });
setupEmulator();

const firestore = admin.firestore();

describe('subscription webhook events', () => {
  let user: UserRecord;

  beforeEach(async () => {
    user = await createFirebaseUser();
  });

  afterEach(async () => {
    await admin.auth().deleteUser(user.uid);
  });

  describe('successfully creates a subscription', () => {
    test('successfully creates a new subscription', async () => {
      const collection = firestore.collection('customers');

      const customer: DocumentData = await waitForDocumentToExistInCollection(
        collection,
        'email',
        user.email
      );

      const doc = collection.doc(customer.doc.id);
      const customerDoc = await waitForDocumentToExistWithField(
        doc,
        'stripeId'
      );

      const { stripeId } = customerDoc.data();

      const stripeSubscription: Subscription = await createRandomSubscription(
        stripeId
      );

      const subscriptionCollection = firestore
        .collection('customers')
        .doc(user.uid)
        .collection('payments');

      const subscriptionDoc: DocumentData =
        await waitForDocumentToExistInCollection(
          subscriptionCollection,
          'invoice',
          stripeSubscription.latest_invoice
        );

      const { prices } = subscriptionDoc.doc.data();

      expect(prices).toBeDefined();
      expect(prices.length).toBe(1);
    }, 20000);
  });
});
