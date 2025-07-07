import * as logs from '../../../../src/logs';
import { handleWebhookEvents } from '../../../../src/handlers/webhook-events';
import * as httpMocks from 'node-mocks-http';
import { getEventChannel } from '../../../../src/config';

// Firebase functions will add rawBody to the request object before it reaches the handler
declare module 'express' {
  interface Request {
    rawBody: Buffer;
  }
}

jest.mock('../../../../src/logs', () => ({
  startWebhookEventProcessing: jest.fn(),
  webhookHandlerError: jest.fn(),
  webhookHandlerSucceeded: jest.fn(),
  badWebhookSecret: jest.fn(),
}));

jest.mock('../../../../src/config', () => ({
  stripeWebhookSecret: 'test-webhook-secret',
  customersCollectionPath: 'customers',
  stripe: {
    webhooks: {
      constructEvent: jest.fn(),
    },
    paymentIntents: {
      retrieve: jest.fn(),
    },
  },
  getEventChannel: () => null,
}));

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(() => {
    throw new Error('Firestore operation failed');
  }),
}));

describe('Webhook Events Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const config = require('../../../../src/config');
    config.stripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_123',
      type: 'product.created',
      data: {
        object: { id: 'prod_123' },
      },
    });
  });

  it('should return 500 status when webhook handler fails', async () => {
    const mockRequest = httpMocks.createRequest({
      rawBody: Buffer.from('test-body'),
      headers: {
        'stripe-signature': 'test-signature',
      },
    });

    const mockResponse = httpMocks.createResponse();

    await handleWebhookEvents(mockRequest, mockResponse);

    expect(logs.webhookHandlerError).toHaveBeenCalledWith(
      expect.any(Error),
      'evt_123',
      'product.created',
    );

    expect(mockResponse.statusCode).toBe(500);

    const responseData = JSON.parse(mockResponse._getData());
    expect(responseData).toEqual({
      error: 'Webhook handler failed. View function logs in Firebase.',
    });
  });
});
