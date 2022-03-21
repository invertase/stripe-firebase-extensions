import * as admin from 'firebase-admin';
import functions from 'firebase-functions-test';
import * as cloudFunctions from '../src';
import setupEmulator from './helpers/setupEmulator';
import { cleanupCustomers } from './helpers/cleanup';

const testEnv = functions({ projectId: 'extensions-testing' });
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
  afterEach(async () => {
    // await cleanupCustomers();
  }, 60000);
  test('successfully creates a new portal link', async () => {
    const email = `${Math.random().toString(36).substr(2, 5)}@google.com`;
    await admin.auth().createUser({ email });

    const collection = firestore.collection('customers');

    return new Promise((resolve, reject) => {
      const unsubscribeCustomers = collection.onSnapshot(async (snapshot) => {
        const docs = snapshot.docChanges();

        const customerDocument = docs.filter(
          ($) => $.doc.data().email === email
        )[0];

        if (customerDocument) {
          const { stripeId } = customerDocument.doc.data();

          if (stripeId) {
            const returnUrl = 'http://test.com';
            const result = await request(customerDocument.doc.id, returnUrl);

            expect(result.object).toBe('billing_portal.session');
            expect(result.customer).toBe(stripeId);
            expect(result.livemode).toBe(false);
            expect(result.return_url).toBe(returnUrl);
            expect(result.url).toBeDefined();

            unsubscribeCustomers();
            resolve(true);
          }
        }
      });
    });
  });
});
