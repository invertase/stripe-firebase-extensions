import * as admin from 'firebase-admin';
import runCheckout from '../../helpers/forms/runCheckout';

import { UserRecord } from 'firebase-functions/v1/auth';
import { Subscription } from '../../../src/interfaces';
import setupEmulator from '../../helpers/setupEmulator';
import { createRandomSubscription } from '../../helpers/stripeApi/subscriptions';
import { createFirebaseUser } from '../../helpers/utils';

import {
  findCustomerInCollection,
  createCheckoutSession,
  findCustomerPaymentInCollection,
} from '../../helpers/collections';

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: 'demo-project' });
}

setupEmulator();

describe('createSubscriptionCheckoutSession', () => {
  let user: UserRecord;

  beforeEach(async () => {
    user = await createFirebaseUser();
  });

  afterEach(async () => {
    await admin.auth().deleteUser(user.uid);
  });

  describe('using a web client', () => {
    test('successfully creates a subscription based checkout session', async () => {
      /** find the customer document */
      const { docId, stripeId } = await findCustomerInCollection(user);

      /** create a new subscription */
      const stripeSubscription: Subscription = await createRandomSubscription(
        stripeId
      );

      /** create a new checkout session */
      const { client, success_url, url } = await createCheckoutSession(docId, {
        line_items: [
          {
            //@ts-ignore
            price: stripeSubscription.items.data[0].price.id,
            quantity: 1,
          },
        ],
      });

      expect(client).toBe('web');
      expect(success_url).toBe('http://test.com/success');

      /** complete the checkout fortm */
      await runCheckout(url);

      /** find user payment */
      const { prices } = await findCustomerPaymentInCollection(docId, stripeId);

      /** extract prices from array */
      const priceRef = await prices[0].get();
      const price = priceRef.id;

      /** assert values */
      //@ts-ignore
      expect(price).toEqual(stripeSubscription.items.data[0].price.id);
    });
  });
});
