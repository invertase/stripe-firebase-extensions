import * as admin from 'firebase-admin';
import { DocumentData } from '@google-cloud/firestore';
import { Product } from '../../../src/interfaces';
import setupEmulator from '../../helpers/setupEmulator';

import {
  createRandomProduct,
  updateProduct,
} from '../../helpers/setupProducts';
import {
  waitForDocumentToExistInCollection,
  waitForDocumentUpdate,
} from '../../helpers/utils';
import config from '../../../src/config';

admin.initializeApp({ projectId: 'demo-project' });
setupEmulator();

const stripe = require('stripe')(config.stripeSecretKey);
const firestore = admin.firestore();

describe('webhook events', () => {
  describe('products', () => {
    let product: Product;

    beforeAll(async () => {
      const { v4: uuid } = require('uuid');
      const name = `product_${uuid()}`;
      product = await stripe.products.create({
        name,
        description: `Description for ${name}`,
      });
    });

    test('successfully creates a new product', async () => {
      console.log('Checking product >>>>>>', product.name);
      const collection = firestore.collection('products');
      const productDoc: DocumentData = await waitForDocumentToExistInCollection(
        collection,
        'name',
        product.name
      );

      expect(productDoc.data().name).toBe(product.name);
    }, 300000);

    xtest('successfully updates an existing product', async () => {
      const updatedProduct: Product = await updateProduct(product.id, {
        name: `updated_${product.name}`,
      });

      const doc = firestore.collection('products').doc(product.id);

      const updated = await waitForDocumentUpdate(
        doc,
        'name',
        `updated_${product.name}`
      );

      expect(updated.data().name).toBe(updatedProduct.name);
    }, 300000);
  });
});
