import * as admin from 'firebase-admin';
import config from '../src/config';
import setupEmulator from './helpers/setupEmulator';
import { cleanupCustomers } from './helpers/cleanup';

admin.initializeApp({ projectId: 'extensions-testing' });
setupEmulator();

const firestore = admin.firestore();

describe('createCustomer', () => {
  afterEach(async () => {
    // await cleanupCustomers();
  }, 60000);
  test('successfully creates a new customer', async () => {
    const email = `${Math.random().toString(36).substr(2, 5)}@google.com`;
    await admin.auth().createUser({ email });

    const collection = firestore.collection('customers');

    return new Promise((resolve, reject) => {
      const unsubscribe = collection.onSnapshot((snapshot) => {
        const docs = snapshot.docChanges().map(($) => $.doc.data());
        const hasCustomer = docs.filter(($) => $.email === email).length;

        if (hasCustomer) {
          unsubscribe();
          resolve(true);
        }
      });
    });
  });
});
