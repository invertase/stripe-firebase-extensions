import * as admin from 'firebase-admin';

import setupEmulator from '../helpers/setupEmulator';

admin.initializeApp({ projectId: 'demo-project' });
setupEmulator();

const firestore = admin.firestore();

describe('invoices', () => {
  test('can successfulyl run a test scenario', async () => {
    expect(true).toBeTruthy();
  });
});
