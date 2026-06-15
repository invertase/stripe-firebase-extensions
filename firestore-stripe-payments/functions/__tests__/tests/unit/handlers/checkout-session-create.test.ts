import * as admin from 'firebase-admin';
import { handleCheckoutSessionCreation } from '../../../../src/handlers/checkout-session-creation';
import { createCustomerRecord } from '../../../../src/utils';

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  firestore: jest.fn(),
  auth: jest.fn(),
}));

// Mock createCustomerRecord utility
jest.mock('../../../../src/utils', () => ({
  createCustomerRecord: jest.fn(),
}));

// Mock Stripe to prevent actual API calls
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({}));
});

describe('Customer Record Creation Logic', () => {
  let mockAuth: any;
  let mockParentRef: any;
  let mockCreateCustomerRecord: jest.MockedFunction<
    typeof createCustomerRecord
  >;

  beforeEach(() => {
    // Setup Auth mock
    mockAuth = {
      getUser: jest.fn(),
    };

    // Setup parent reference mock
    mockParentRef = {
      get: jest.fn(),
    };

    // Setup mocked functions
    mockCreateCustomerRecord = createCustomerRecord as jest.MockedFunction<
      typeof createCustomerRecord
    >;

    (admin.auth as jest.Mock).mockReturnValue(mockAuth);

    jest.clearAllMocks();
  });

  it('should create new customer record when customer does not have stripeId', async () => {
    // Arrange
    const mockSnap = {
      ref: {
        parent: {
          parent: mockParentRef,
        },
        set: jest.fn().mockResolvedValue(undefined),
      },
      data: () => ({
        client: 'web',
        mode: 'subscription',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      }),
    };

    const mockContext = {
      params: { uid: 'user123', id: 'session123' },
    };

    // Mock existing customer without stripeId
    mockParentRef.get.mockResolvedValue({
      data: () => ({
        email: 'existing@example.com',
        // No stripeId field
      }),
    });

    // Mock auth user
    mockAuth.getUser.mockResolvedValue({
      uid: 'user123',
      email: 'user@example.com',
      phoneNumber: '+1234567890',
    });

    // Mock successful customer creation
    mockCreateCustomerRecord.mockResolvedValue({
      email: 'user@example.com',
      stripeId: 'cus_new123',
      stripeLink: 'https://dashboard.stripe.com/customers/cus_new123',
    });

    // Act
    await handleCheckoutSessionCreation(mockSnap as any, mockContext as any);

    // Assert
    expect(mockParentRef.get).toHaveBeenCalled();
    expect(mockAuth.getUser).toHaveBeenCalledWith('user123');
    expect(mockCreateCustomerRecord).toHaveBeenCalledWith({
      uid: 'user123',
      email: 'user@example.com',
      phone: '+1234567890',
    });
  });

  it('should write error to document when parent collection is missing', async () => {
    // Arrange
    const mockSetFn = jest.fn().mockResolvedValue(undefined);
    const mockSnap = {
      ref: {
        parent: null, // No parent
        set: mockSetFn,
      },
      data: () => ({
        client: 'web',
        mode: 'subscription',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      }),
    };

    const mockContext = {
      params: { uid: 'user123', id: 'session123' },
    };

    // Act
    await handleCheckoutSessionCreation(mockSnap as any, mockContext as any);

    // Assert
    expect(mockSetFn).toHaveBeenCalledWith(
      {
        error: {
          message: 'Invalid document reference, no parent collection found',
        },
      },
      { merge: true },
    );
  });
});
