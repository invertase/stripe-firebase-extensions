import * as admin from 'firebase-admin';
import { DocumentReference, DocumentData } from '@google-cloud/firestore';
import { UserRecord } from 'firebase-functions/v1/auth';
import setupEmulator from '../../helpers/setupEmulator';
import { generateRecurringPrice } from '../../helpers/setupProducts';
import {
  createFirebaseUser,
  waitForDocumentToExistInCollection,
  waitForDocumentToExistWithField,
} from '../../helpers/utils';
import { Subscription } from '../../../src/interfaces';

admin.initializeApp({ projectId: 'demo-project' });
setupEmulator();

const firestore = admin.firestore();

describe('createCheckoutSession', () => {
  let user: UserRecord;
  let price = null;

  beforeEach(async () => {
    price = await generateRecurringPrice();
    user = await createFirebaseUser();
  });

  afterEach(async () => {
    await admin.auth().deleteUser(user.uid);
  });

  describe('using a web client', () => {
    test('successfully creates a checkout session', async () => {
      const collection = firestore.collection('customers');

      const customer: DocumentData = await waitForDocumentToExistInCollection(
        collection,
        'email',
        user.email
      );

      const checkoutSessionCollection = collection
        .doc(customer.doc.id)
        .collection('checkout_sessions');

      const checkoutSessionDocument: DocumentReference =
        await checkoutSessionCollection.add({
          success_url: 'http://test.com/success',
          cancel_url: 'http://test.com/cancel',
          line_items: [
            {
              //@ts-ignore
              price: price.id,
              quantity: 1,
            },
          ],
        });

      const customerDoc = await waitForDocumentToExistWithField(
        checkoutSessionDocument,
        'created'
      );

      const { client, success_url } = customerDoc.data();

      expect(client).toBe('web');
      expect(success_url).toBe('http://test.com/success');
    });

    test.skip('throws an error when success_url has not been provided', async () => {});

    test.skip('throws an error when cancel_url has not been provided', async () => {});
    test.skip('throws an error when a line items parameter has not been provided', async () => {});
    test.skip('throws an error when a subscription data array parameter has not been provided', async () => {});
  });

  describe('using a mobile client', () => {
    let price: Subscription;
    beforeEach(async () => {
      price = await generateRecurringPrice();
    });

    test('successfully creates a checkout session', async () => {
      const collection = firestore.collection('customers');

      const customer: DocumentData = await waitForDocumentToExistInCollection(
        collection,
        'email',
        user.email
      );

      const checkoutSessionCollection = collection
        .doc(customer.doc.id)
        .collection('checkout_sessions');

      const checkoutSessionDocument: DocumentReference =
        await checkoutSessionCollection.add({
          client: 'mobile',
          mode: 'subscription',
          success_url: 'http://test.com/success',
          cancel_url: 'http://test.com/cancel',
          //@ts-ignore
          price: price.id,
        });

      const customerDoc = await waitForDocumentToExistWithField(
        checkoutSessionDocument,
        'created'
      );

      const {
        amount,
        client,
        success_url,
        ephemeralKeySecret,
        paymentIntentClientSecret,
        error,
      } = customerDoc.data();

      expect(client).toBe('mobile');
      expect(success_url).toBe('http://test.com/success');
      expect(paymentIntentClientSecret).toBeDefined();
      expect(ephemeralKeySecret).toBeDefined();
      expect(error).toBeUndefined();
    });
  });
});
