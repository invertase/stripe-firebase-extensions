import * as admin from 'firebase-admin';
import config from '../src/config';
import { Product } from '../src/interfaces';
import setupEmulator from './helpers/setupEmulator';

import { createRandomProduct, updateProduct } from './helpers/setupProducts';

admin.initializeApp({ projectId: 'extensions-testing' });
setupEmulator();

const firestore = admin.firestore();

describe('webhook events', () => {
  describe('products', () => {
    let product: Product;

    beforeEach(async () => {
      product = await createRandomProduct();
    });
    test('successfully creates a new product', async () => {
      const collection = firestore.collection('products');

      return new Promise((resolve, reject) => {
        const unsubscribeCustomers = collection.onSnapshot(async (snapshot) => {
          const docs = snapshot.docChanges();

          const productDocument = docs.filter(
            ($) => $.doc.data().name === product.name
          )[0];

          if (productDocument) {
            const { name, description } = productDocument.doc.data();

            if (name) {
              expect(name).toBe(product.name);

              unsubscribeCustomers();
              resolve(true);
            }
          }
        });
      });
    });

    test('successfully updates an existing product', async () => {
      const updatedProduct: Product = await updateProduct(product.id, {
        name: `updated_${product.name}`,
      });

      const collection = firestore.collection('products').doc(product.id);

      return new Promise((resolve, reject) => {
        const unsubscribe = collection.onSnapshot(async (snapshot) => {
          const doc = snapshot.data();

          if (doc && doc.name === updatedProduct.name) {
            expect(doc.name).toBe(updatedProduct.name);

            unsubscribe();
            resolve(true);
          }
        });
      });
    });
  });
});
