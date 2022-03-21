import * as admin from 'firebase-admin';
import config from '../src/config';
import setupEmulator from './helpers/setupEmulator';
import { cleanupCustomers } from './helpers/cleanup';
import { findCustomer } from './helpers/stripeApi/customers';
import { repeat } from './helpers/utils';

admin.initializeApp({ projectId: 'extensions-testing' });
setupEmulator();

const firestore = admin.firestore();

describe('customerDataDeleted', () => {
  test('successfully creates a new customer', async () => {
    const email = `${Math.random().toString(36).substr(2, 5)}@google.com`;
    await admin.auth().createUser({ email });

    const collection = firestore.collection('customers');

    const checkCustomer = async (id) => {
      return new Promise(async (resolve) => {
        let stripeId;
        const doc = collection.doc(id);

        const unsubscribe = doc.onSnapshot(async (snapshot) => {
          if (snapshot.exists) {
            stripeId = snapshot.data().stripeId;
          }

          if (!snapshot.exists && stripeId) {
            const check = ($) => {
              return $?.deleted;
            };

            const toRun = () => findCustomer(stripeId);
            await repeat(toRun, check, 5, 2000);

            unsubscribe();
            resolve(true);
          }

          if (stripeId) await doc.delete();
        });
      });
    };

    return new Promise((resolve, reject) => {
      const unsubscribe = collection.onSnapshot(async (snapshot) => {
        const docs = snapshot.docChanges().map(($) => $.doc);

        const customer: FirebaseFirestore.DocumentData = docs.filter(
          ($) => $.data().email === email
        )[0];

        if (customer) {
          await checkCustomer(customer.id);
          unsubscribe();
          resolve(true);
        }
      });
    });
  });
});
