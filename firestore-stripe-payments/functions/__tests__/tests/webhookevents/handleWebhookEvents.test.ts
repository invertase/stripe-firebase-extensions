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

admin.initializeApp({ projectId: 'demo-project' });
setupEmulator();

const firestore = admin.firestore();

describe('webhook events', () => {
  describe('products', () => {
    let product: Product;

    /**
     * Skipping tests for now, these work locally but never on CI
     * Could be an environmental issue
     * TODO: Fix this
     */
    beforeEach(async () => {
      product = await createRandomProduct();
    });
    xtest('successfully creates a new product', async () => {
      const collection = firestore.collection('products');
      const productDoc: DocumentData = await waitForDocumentToExistInCollection(
        collection,
        'name',
        product.name
      );

      expect(productDoc.doc.data().name).toBe(product.name);
    });

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
    });
  });
});
