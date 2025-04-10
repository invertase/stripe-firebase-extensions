// silence some annoying warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(' ');
  if (
    message.includes('FIREBASE_CONFIG') ||
    message.includes('GCLOUD_PROJECT')
  ) {
    return;
  }
  originalWarn(...args);
};

import {
  processStripeEvent,
  webhookEventHandler,
} from '../../../../src/controllers/webhook';
import * as productHandler from '../../../../src/handlers/product';
import * as priceHandler from '../../../../src/handlers/price';
import * as taxRateHandler from '../../../../src/handlers/tax-rate';
import * as subscriptionHandler from '../../../../src/handlers/subscription';
import * as paymentHandler from '../../../../src/handlers/payment';
import * as invoiceHandler from '../../../../src/handlers/invoice';
import { stripe } from '../../../../src/services';

// Mock modules
jest.mock('../../../../src/handlers/product');
jest.mock('../../../../src/handlers/customer');
jest.mock('../../../../src/handlers/price');
jest.mock('../../../../src/handlers/tax-rate');
jest.mock('../../../../src/handlers/subscription');
jest.mock('../../../../src/handlers/payment');
jest.mock('../../../../src/handlers/invoice');
jest.mock('../../../../src/services', () => ({
  stripe: {
    paymentIntents: {
      retrieve: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  },
}));

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('processStripeEvent', () => {
  const testConfigs = [
    {
      type: 'product.created',
      object: { id: 'prod_123', name: 'Test Product' },
      expectedMock: productHandler.createProductRecord,
    },
    {
      type: 'product.updated',
      object: { id: 'prod_456', name: 'Updated Product' },
      expectedMock: productHandler.createProductRecord,
    },
    {
      type: 'product.deleted',
      object: { id: 'prod_789' },
      expectedMock: productHandler.deleteProductOrPrice,
    },
    {
      type: 'price.created',
      object: { id: 'price_123' },
      expectedMock: priceHandler.insertPriceRecord,
    },
    {
      type: 'price.updated',
      object: { id: 'price_456' },
      expectedMock: priceHandler.insertPriceRecord,
    },
    {
      type: 'price.deleted',
      object: { id: 'price_789' },
      expectedMock: productHandler.deleteProductOrPrice,
    },
    {
      type: 'tax_rate.created',
      object: { id: 'txr_123' },
      expectedMock: taxRateHandler.insertTaxRateRecord,
    },
    {
      type: 'tax_rate.updated',
      object: { id: 'txr_456' },
      expectedMock: taxRateHandler.insertTaxRateRecord,
    },
    {
      type: 'customer.subscription.created',
      object: { id: 'sub_123', customer: 'cus_001' },
      expectedMock: subscriptionHandler.manageSubscriptionStatusChange,
      expectedArgs: ['sub_123', 'cus_001', true],
    },
    {
      type: 'customer.subscription.updated',
      object: { id: 'sub_456', customer: 'cus_002' },
      expectedMock: subscriptionHandler.manageSubscriptionStatusChange,
      expectedArgs: ['sub_456', 'cus_002', false],
    },
    {
      type: 'customer.subscription.deleted',
      object: { id: 'sub_789', customer: 'cus_003' },
      expectedMock: subscriptionHandler.manageSubscriptionStatusChange,
      expectedArgs: ['sub_789', 'cus_003', false],
    },
    {
      type: 'invoice.paid',
      object: { id: 'in_123' },
      expectedMock: invoiceHandler.insertInvoiceRecord,
    },
    {
      type: 'invoice.payment_succeeded',
      object: { id: 'in_456' },
      expectedMock: invoiceHandler.insertInvoiceRecord,
    },
    {
      type: 'invoice.payment_failed',
      object: { id: 'in_789' },
      expectedMock: invoiceHandler.insertInvoiceRecord,
    },
    {
      type: 'invoice.upcoming',
      object: { id: 'in_101' },
      expectedMock: invoiceHandler.insertInvoiceRecord,
    },
    {
      type: 'invoice.marked_uncollectible',
      object: { id: 'in_102' },
      expectedMock: invoiceHandler.insertInvoiceRecord,
    },
    {
      type: 'invoice.payment_action_required',
      object: { id: 'in_103' },
      expectedMock: invoiceHandler.insertInvoiceRecord,
    },
    {
      type: 'payment_intent.processing',
      object: { id: 'pi_123' },
      expectedMock: paymentHandler.insertPaymentRecord,
    },
    {
      type: 'payment_intent.succeeded',
      object: { id: 'pi_456' },
      expectedMock: paymentHandler.insertPaymentRecord,
    },
    {
      type: 'payment_intent.canceled',
      object: { id: 'pi_789' },
      expectedMock: paymentHandler.insertPaymentRecord,
    },
    {
      type: 'payment_intent.payment_failed',
      object: { id: 'pi_101' },
      expectedMock: paymentHandler.insertPaymentRecord,
    },
  ];

  testConfigs.forEach(({ type, object, expectedMock, expectedArgs }) => {
    it(`calls ${expectedMock.name} for event type ${type}`, async () => {
      const event = {
        id: 'evt_test',
        type,
        data: { object },
      };

      await processStripeEvent(event as any);

      if (expectedArgs) {
        expect(expectedMock).toHaveBeenCalledWith(...expectedArgs);
      } else {
        expect(expectedMock).toHaveBeenCalledWith(object);
      }
    });
  });

  it('calls insertPaymentRecord with retrieved intent for checkout.session', async () => {
    const mockIntent = { id: 'pi_checkout' };
    (stripe.paymentIntents.retrieve as jest.Mock).mockResolvedValue(mockIntent);

    const checkoutEvent = {
      id: 'evt_checkout',
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'payment',
          payment_intent: 'pi_abc',
          customer: 'cus_abc',
          tax_id_collection: { enabled: false },
        },
      },
    };

    await processStripeEvent(checkoutEvent as any);

    expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_abc');
    expect(paymentHandler.insertPaymentRecord).toHaveBeenCalledWith(
      mockIntent,
      checkoutEvent.data.object
    );
  });

  it('calls manageSubscriptionStatusChange for checkout.session with subscription', async () => {
    const event = {
      id: 'evt_checkout_sub',
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          subscription: 'sub_checkout',
          customer: 'cus_checkout',
        },
      },
    };

    await processStripeEvent(event as any);

    expect(
      subscriptionHandler.manageSubscriptionStatusChange
    ).toHaveBeenCalledWith('sub_checkout', 'cus_checkout', true);
  });
});

describe('webhookEventHandler', () => {
  it('verifies Stripe event and processes it', async () => {
    const mockEvent = {
      id: 'evt_test',
      type: 'product.created',
      data: {
        object: { id: 'prod_123' },
      },
    };

    // Mock constructEvent
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

    const req = {
      rawBody: Buffer.from(JSON.stringify(mockEvent)),
      headers: {
        'stripe-signature': 'test-signature',
      },
    } as any;

    const statusMock = jest.fn(() => res);
    const jsonMock = jest.fn();
    const sendMock = jest.fn();

    const res = {
      status: statusMock,
      json: jsonMock,
      send: sendMock,
    } as any;

    await webhookEventHandler(req, res);

    expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(
      req.rawBody,
      'test-signature',
      expect.any(String)
    );

    expect(jsonMock).toHaveBeenCalledWith({ received: true });
  });
});
