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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { FirebaseApp } from "@firebase/app";
import {
  getCurrentUserPayment,
  getCurrentUserPayments,
  getStripePayments,
  onCurrentUserPaymentUpdate,
  Payment,
  StripePayments,
  StripePaymentsError,
} from "../src/index";
import { payment1, payment2 } from "./testdata";
import { setUserDAO, UserDAO } from "../src/user";
import { PaymentDAO, PaymentSnapshot, setPaymentDAO } from "../src/payment";

// Add custom matcher for toHaveBeenCalledBefore
expect.extend({
  toHaveBeenCalledBefore(received: any, expected: any) {
    const receivedCalls = received.mock.invocationCallOrder;
    const expectedCalls = expected.mock.invocationCallOrder;
    const pass = receivedCalls[0] < expectedCalls[0];
    return {
      message: () =>
        `expected ${received.getMockName()} to have been called before ${expected.getMockName()}`,
      pass,
    };
  },
});

declare module 'vitest' {
  interface Assertion<T = any> {
    toHaveBeenCalledBefore(expected: any): T;
  }
}

const app: FirebaseApp = {
  name: "mock",
  options: {},
  automaticDataCollectionEnabled: false,
};

const payments: StripePayments = getStripePayments(app, {
  customersCollection: "customers",
  productsCollection: "products",
});

describe("getCurrentUserPayment()", () => {
  [null, [], {}, true, 1, 0, NaN, ""].forEach((paymentId: any) => {
    it(`should throw when called with invalid paymentId: ${JSON.stringify(
      paymentId
    )}`, () => {
      expect(() => getCurrentUserPayment(payments, paymentId)).toThrow(
        "paymentId must be a non-empty string."
      );
    });
  });

  it("should return a payment when called with a valid paymentId", async () => {
    const expected: Payment = { ...payment1, uid: "alice" };
    const fake = vi.fn().mockResolvedValue(expected);
    setPaymentDAO(payments, testPaymentDAO("getPayment", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const payment: Payment = await getCurrentUserPayment(payments, "pay1");

    expect(payment).toEqual(expected);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("alice", "pay1");
    expect(userFake).toHaveBeenCalledTimes(1);
  });

  it("should reject when the payment data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "not-found",
      "no such payment"
    );
    const fake = vi.fn().mockRejectedValue(error);
    setPaymentDAO(payments, testPaymentDAO("getPayment", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));

    await expect(getCurrentUserPayment(payments, "pay1")).rejects.toThrow(error);

    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("alice", "pay1");
    expect(userFake).toHaveBeenCalledTimes(1);
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

    await expect(getCurrentUserPayment(payments, "pay1")).rejects.toThrow(error);

    expect(userFake).toHaveBeenCalledTimes(1);
  });
});

describe("getCurrentUserPayments()", () => {
  it("should return all payments when called without options", async () => {
    const fake = vi.fn().mockResolvedValue([payment1, payment2]);
    setPaymentDAO(payments, testPaymentDAO("getPayments", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const paymentData: Payment[] = await getCurrentUserPayments(payments);

    expect(paymentData).toEqual([payment1, payment2]);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("alice", {});
    expect(userFake).toHaveBeenCalledTimes(1);
  });

  it("should return empty array if no payments are available", async () => {
    const fake = vi.fn().mockResolvedValue([]);
    setPaymentDAO(payments, testPaymentDAO("getPayments", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const paymentData: Payment[] = await getCurrentUserPayments(payments);

    expect(paymentData).toEqual([]);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("alice", {});
  });

  it("should only return payments with the given status", async () => {
    const fake = vi.fn().mockResolvedValue([payment1]);
    setPaymentDAO(payments, testPaymentDAO("getPayments", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const paymentData: Payment[] = await getCurrentUserPayments(payments, {
      status: "succeeded",
    });

    expect(paymentData).toEqual([payment1]);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("alice", {
      status: ["succeeded"],
    });
    expect(userFake).toHaveBeenCalledTimes(1);
  });

  it("should only return payments with the given statuses", async () => {
    const fake = vi.fn().mockResolvedValue([payment1, payment2]);
    setPaymentDAO(payments, testPaymentDAO("getPayments", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const paymentData: Payment[] = await getCurrentUserPayments(payments, {
      status: ["succeeded", "requires_action"],
    });

    expect(paymentData).toEqual([payment1, payment2]);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("alice", {
      status: ["succeeded", "requires_action"],
    });
    expect(userFake).toHaveBeenCalledTimes(1);
  });

  [null, [], {}, true, 1, 0, NaN].forEach((status: any) => {
    it(`should throw when called with invalid status option: ${JSON.stringify(
      status
    )}`, async () => {
      expect(() =>
        getCurrentUserPayments(payments, {
          status,
        })
      ).toThrow("status must be a non-empty array.");
    });
  });

  it("should reject when the payment data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "not-found",
      "no such payment"
    );
    const fake = vi.fn().mockRejectedValue(error);
    setPaymentDAO(payments, testPaymentDAO("getPayments", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));

    await expect(getCurrentUserPayments(payments)).rejects.toThrow(error);

    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("alice", {});
    expect(userFake).toHaveBeenCalledTimes(1);
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

    await expect(getCurrentUserPayments(payments)).rejects.toThrow(error);

    expect(userFake).toHaveBeenCalledTimes(1);
  });
});

describe("onCurrentUserPaymentUpdate()", () => {
  it("should register a callback to receive payment updates", () => {
    let canceled: boolean = false;
    const fake = vi.fn().mockReturnValue(() => {
      canceled = true;
    });
    setPaymentDAO(payments, testPaymentDAO("onPaymentUpdate", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));
    const onUpdate: (snap: PaymentSnapshot) => void = () => {};

    const cancel = onCurrentUserPaymentUpdate(payments, onUpdate);
    cancel();

    expect(canceled).toBe(true);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("alice", onUpdate, undefined);
    expect(userFake).toHaveBeenCalledTimes(1);
  });

  it("should register a callback to receive errors when specified", () => {
    let canceled: boolean = false;
    const fake = vi.fn().mockReturnValue(() => {
      canceled = true;
    });
    setPaymentDAO(payments, testPaymentDAO("onPaymentUpdate", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));
    const onUpdate: (snap: PaymentSnapshot) => void = () => {};
    const onError: (err: StripePaymentsError) => void = () => {};

    const cancel = onCurrentUserPaymentUpdate(payments, onUpdate, onError);
    cancel();

    expect(canceled).toBe(true);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("alice", onUpdate, onError);
    expect(userFake).toHaveBeenCalledTimes(1);
  });

  it("should throw when the user data access object throws", () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "unauthenticated",
      "user not signed in"
    );
    const userFake = vi.fn().mockImplementation(() => {
      throw error;
    });
    setUserDAO(payments, testUserDAO(userFake));

    expect(() => onCurrentUserPaymentUpdate(payments, () => {})).toThrow(error);

    expect(userFake).toHaveBeenCalledTimes(1);
  });
});

function testPaymentDAO(name: string, fake: ReturnType<typeof vi.fn>): PaymentDAO {
  return {
    [name]: fake,
  } as unknown as PaymentDAO;
}

function testUserDAO(fake: ReturnType<typeof vi.fn>): UserDAO {
  return {
    getCurrentUser: fake,
  } as UserDAO;
} 