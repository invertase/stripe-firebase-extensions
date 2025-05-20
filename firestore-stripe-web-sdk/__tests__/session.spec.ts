/*
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, expect, it, vi } from "vitest";
import { FirebaseApp } from "@firebase/app";
import {
  CREATE_SESSION_TIMEOUT_MILLIS,
  createCheckoutSession,
  getStripePayments,
  Session,
  SessionCreateParams,
  StripePayments,
  StripePaymentsError,
} from "../src/index";
import { SessionDAO, setSessionDAO } from "../src/session";
import { setUserDAO, UserDAO } from "../src/user";

// Mock window object for Node.js environment
const mockWindow = {
  location: {
    href: "https://example.com",
  },
};
global.window = mockWindow as any;

const app: FirebaseApp = {
  name: "mock",
  options: {},
  automaticDataCollectionEnabled: false,
};

const payments: StripePayments = getStripePayments(app, {
  customersCollection: "customers",
  productsCollection: "products",
});

const testSession: Session = {
  allow_promotion_codes: true,
  automatic_tax: true,
  cancel_url: "https://example.com/cancel",
  client_reference_id: "example",
  created_at: new Date().toUTCString(),
  id: "test_session_1",
  metadata: {
    test: true,
  },
  mode: "subscription",
  payment_method_types: ["card"],
  price: "price1",
  promotion_code: "discount",
  success_url: "https://example.com/success",
  tax_id_collection: true,
  trial_from_plan: true,
  url: "https://example.stripe.com/session/test_session_1",
};

describe("createCheckoutSession()", () => {
  const invalidUrls: any[] = [null, [], {}, true, 1, 0, NaN, ""];

  invalidUrls.forEach((cancelUrl: any) => {
    it(`should throw when called with invalid cancelUrl: ${cancelUrl}`, () => {
      expect(() =>
        createCheckoutSession(payments, {
          cancel_url: cancelUrl,
          price: "price1",
        })
      ).toThrow("cancel_url must be a non-empty string.");
    });
  });

  invalidUrls.forEach((successUrl: any) => {
    it(`should throw when called with invalid successUrl: ${successUrl}`, () => {
      expect(() =>
        createCheckoutSession(payments, {
          success_url: successUrl,
          price: "price1",
        })
      ).toThrow("success_url must be a non-empty string.");
    });
  });

  [null, [], {}, true, -1, 0, NaN, ""].forEach((lineItems: any) => {
    it(`should throw when called with invalid line_items: ${lineItems}`, () => {
      expect(() =>
        createCheckoutSession(payments, {
          line_items: lineItems,
        })
      ).toThrow("line_items must be a non-empty array.");
    });
  });

  [null, [], {}, true, -1, 0, NaN, ""].forEach((price: any) => {
    it(`should throw when called with invalid price ID: ${price}`, () => {
      expect(() =>
        createCheckoutSession(payments, {
          price,
        })
      ).toThrow("price must be a non-empty string.");
    });
  });

  [null, [], {}, true, -1, 0, NaN, ""].forEach((quantity: any) => {
    it(`should throw when called with invalid quantity: ${quantity}`, () => {
      expect(() =>
        createCheckoutSession(payments, {
          quantity,
          price: "price1",
        })
      ).toThrow("quantity must be a positive integer.");
    });
  });

  [null, [], {}, true, -1, 0, NaN, ""].forEach((timeoutMillis: any) => {
    it(`should throw hen called with invalid timeoutMillis: ${timeoutMillis}`, () => {
      expect(() =>
        createCheckoutSession(
          payments,
          {
            quantity: 1,
            price: "price1",
          },
          { timeoutMillis }
        )
      ).toThrow("timeoutMillis must be a positive number.");
    });
  });

  it("should return a session when called with minimum valid parameters", async () => {
    const fake = vi.fn().mockResolvedValue(testSession);
    setSessionDAO(payments, testSessionDAO("createCheckoutSession", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const session: Session = await createCheckoutSession(payments, {
      price: "price1",
    });

    expect(session).toEqual(testSession);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith(
      "alice",
      {
        cancel_url: window.location.href,
        mode: "subscription",
        price: "price1",
        success_url: window.location.href,
      },
      CREATE_SESSION_TIMEOUT_MILLIS
    );
    expect(userFake).toHaveBeenCalledTimes(1);
    expect(userFake.mock.invocationCallOrder[0]).toBeLessThan(fake.mock.invocationCallOrder[0]);
  });

  it("should return a session when called with line items", async () => {
    const fake = vi.fn().mockResolvedValue(testSession);
    setSessionDAO(payments, testSessionDAO("createCheckoutSession", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));
    const params: SessionCreateParams = {
      cancel_url: "https://example.com/cancel",
      line_items: [
        {
          description: "Economy package subscription",
          price: "price1",
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: "https://example.com/success",
    };

    const session: Session = await createCheckoutSession(payments, params);

    expect(session).toEqual(testSession);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith(
      "alice",
      params,
      CREATE_SESSION_TIMEOUT_MILLIS
    );
    expect(userFake).toHaveBeenCalledTimes(1);
    expect(userFake.mock.invocationCallOrder[0]).toBeLessThan(fake.mock.invocationCallOrder[0]);
  });

  it("should return a session when called with price ID", async () => {
    const fake = vi.fn().mockResolvedValue(testSession);
    setSessionDAO(payments, testSessionDAO("createCheckoutSession", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));
    const params: SessionCreateParams = {
      allow_promotion_codes: true,
      automatic_tax: true,
      client_reference_id: "example",
      cancel_url: "https://example.com/cancel",
      metadata: {
        test: true,
      },
      mode: "subscription",
      payment_method_types: ["card"],
      price: "price1",
      promotion_code: "discount",
      quantity: 5,
      success_url: "https://example.com/success",
      tax_id_collection: true,
      trial_from_plan: true,
    };

    const session: Session = await createCheckoutSession(payments, params);

    expect(session).toEqual(testSession);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith(
      "alice",
      params,
      CREATE_SESSION_TIMEOUT_MILLIS
    );
    expect(userFake).toHaveBeenCalledTimes(1);
    expect(userFake.mock.invocationCallOrder[0]).toBeLessThan(fake.mock.invocationCallOrder[0]);
  });

  it("should return a session when called with valid timeout", async () => {
    const fake = vi.fn().mockResolvedValue(testSession);
    setSessionDAO(payments, testSessionDAO("createCheckoutSession", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const session: Session = await createCheckoutSession(
      payments,
      {
        price: "price1",
      },
      { timeoutMillis: 3000 }
    );

    expect(session).toEqual(testSession);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith(
      "alice",
      {
        cancel_url: window.location.href,
        mode: "subscription",
        price: "price1",
        success_url: window.location.href,
      },
      3000
    );
    expect(userFake).toHaveBeenCalledTimes(1);
    expect(userFake.mock.invocationCallOrder[0]).toBeLessThan(fake.mock.invocationCallOrder[0]);
  });

  it("should reject when the session data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "internal",
      "failed to create session"
    );
    const fake = vi.fn().mockRejectedValue(error);
    setSessionDAO(payments, testSessionDAO("createCheckoutSession", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));

    await expect(
      createCheckoutSession(payments, { price: "price1" })
    ).rejects.toThrow(error);

    expect(fake).toHaveBeenCalledTimes(1);
    expect(userFake).toHaveBeenCalledTimes(1);
    expect(userFake.mock.invocationCallOrder[0]).toBeLessThan(fake.mock.invocationCallOrder[0]);
  });

  it("should reject when the user data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "unauthenticated",
      "user not signed in"
    );
    const userFake = vi.fn().mockImplementation(() => {
      throw error;
    });
    setUserDAO(payments, testUserDAO(userFake));

    await expect(
      createCheckoutSession(payments, { price: "price1" })
    ).rejects.toThrow(error);

    expect(userFake).toHaveBeenCalledTimes(1);
  });
});

function testSessionDAO(name: string, fake: ReturnType<typeof vi.fn>): SessionDAO {
  return {
    [name]: fake,
  } as unknown as SessionDAO;
}

function testUserDAO(fake: ReturnType<typeof vi.fn>): UserDAO {
  return {
    getCurrentUser: fake,
  } as UserDAO;
}
