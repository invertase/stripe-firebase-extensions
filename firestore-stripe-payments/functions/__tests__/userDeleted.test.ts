import * as admin from 'firebase-admin';
import config from '../src/config';
import setupEmulator from './helpers/setupEmulator';
import { findCustomer } from './helpers/stripeApi/customers';
import { repeat } from './helpers/utils';
import { auth } from 'firebase-admin';

admin.initializeApp({ projectId: 'demo-project' });
setupEmulator();

const firestore = admin.firestore();

describe('customerDataDeleted', () => {
  test('successfully deletes a stripe customer on delete', async () => {
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

          if (stripeId) {
            /* Delete auth user */
            await auth().deleteUser(id);

            /* Check Stripe deletion */
            const check = ($) => {
              return $?.deleted;
            };

            const toRun = () => findCustomer(stripeId);
            await repeat(toRun, check, 5, 5000);

            unsubscribe();
            resolve(true);
          }
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
