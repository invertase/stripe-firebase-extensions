import * as admin from 'firebase-admin';
import { cleanupCustomers } from './helpers/cleanup';
import setupEmulator from './helpers/setupEmulator';
import { generateRecurringPrice } from './helpers/setupProducts';

admin.initializeApp({ projectId: 'extensions-testing' });
setupEmulator();

const firestore = admin.firestore();

describe('createCheckoutSession', () => {
  let price = null;

  beforeEach(async () => {
    price = await generateRecurringPrice();
  });

  afterAll(async () => {
    // await cleanupCustomers();
  }, 60000);
  describe('using a web client', () => {
    test('successfully creates a checkout session', async () => {
      const email = `${Math.random().toString(36).substr(2, 5)}@google.com`;
      await admin.auth().createUser({ email });

      const collection = firestore.collection('customers');

      const checkSession = async (customerId) => {
        const checkoutSessionCollection = collection
          .doc(customerId)
          .collection('checkout_sessions');

        const checkoutSessionDocument = await checkoutSessionCollection.add({
          success_url: 'http://test.com/success',
          cancel_url: 'http://test.com/cancel',
          line_items: [
            {
              price: price.id,
              quantity: 1,
            },
          ],
        });

        return new Promise((resolve, reject) => {
          const unsubscribeDoc = checkoutSessionDocument.onSnapshot(
            async (snapshot) => {
              const doc = snapshot.data();
              if (doc.created) {
                expect(doc.client).toBe('web');
                expect(doc.success_url).toBe('http://test.com/success');
                unsubscribeDoc();
                resolve(true);
              }
            }
          );
        });
      };

      return new Promise((resolve, reject) => {
        const unsubscribeCustomers = collection.onSnapshot(async (snapshot) => {
          const docs = snapshot.docChanges();

          const customerDocument = docs.filter(
            ($) => $.doc.data().email === email
          )[0];

          if (customerDocument) {
            await checkSession(customerDocument.doc.id);
            unsubscribeCustomers();
            resolve(true);
          }
        });
      });
    });

    test.skip('throws an error when success_url has not been provided', async () => {});

    test.skip('throws an error when cancel_url has not been provided', async () => {});
    test.skip('throws an error when a line items parameter has not been provided', async () => {});
    test.skip('throws an error when a subscription data array parameter has not been provided', async () => {});
  });
});
