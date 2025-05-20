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
  getCurrentUserSubscription,
  getCurrentUserSubscriptions,
  getStripePayments,
  onCurrentUserSubscriptionUpdate,
  Subscription,
  StripePayments,
  StripePaymentsError,
} from "../src/index";
import { subscription1, subscription2 } from "./testdata";
import {
  setSubscriptionDAO,
  SubscriptionDAO,
  SubscriptionSnapshot,
} from "../src/subscription";
import { setUserDAO, UserDAO } from "../src/user";

const app: FirebaseApp = {
  name: "mock",
  options: {},
  automaticDataCollectionEnabled: false,
};

const payments: StripePayments = getStripePayments(app, {
  customersCollection: "customers",
  productsCollection: "products",
});

describe("getCurrentUserSubscription()", () => {
  [null, [], {}, true, 1, 0, NaN, ""].forEach((subscriptionId: any) => {
    it(`should throw when called with invalid subscriptionId: ${JSON.stringify(
      subscriptionId
    )}`, () => {
      expect(() =>
        getCurrentUserSubscription(payments, subscriptionId)
      ).toThrow("subscriptionId must be a non-empty string.");
    });
  });

  it("should return a subscription when called with a valid subscriptionId", async () => {
    const expected: Subscription = { ...subscription1, uid: "alice" };
    const fake = vi.fn().mockResolvedValue(expected);
    setSubscriptionDAO(payments, testSubscriptionDAO("getSubscription", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const subscription: Subscription = await getCurrentUserSubscription(
      payments,
      "sub1"
    );

    expect(subscription).toEqual(expected);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("alice", "sub1");
    expect(userFake).toHaveBeenCalledTimes(1);
    expect(userFake.mock.invocationCallOrder[0]).toBeLessThan(fake.mock.invocationCallOrder[0]);
  });

  it("should reject when the subscription data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "not-found",
      "no such subscription"
    );
    const fake = vi.fn().mockRejectedValue(error);
    setSubscriptionDAO(payments, testSubscriptionDAO("getSubscription", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));

    await expect(
      getCurrentUserSubscription(payments, "sub1")
    ).rejects.toThrow(error);

    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("alice", "sub1");
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
      getCurrentUserSubscription(payments, "subscription1")
    ).rejects.toThrow(error);

    expect(userFake).toHaveBeenCalledTimes(1);
  });
});

describe("getCurrentUserSubscriptions()", () => {
  it("should return all subscriptions when called without options", async () => {
    const fake = vi.fn().mockResolvedValue([subscription1, subscription2]);
    setSubscriptionDAO(payments, testSubscriptionDAO("getSubscriptions", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const subscriptions: Subscription[] =
      await getCurrentUserSubscriptions(payments);

    expect(subscriptions).toEqual([subscription1, subscription2]);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("alice", {});
    expect(userFake).toHaveBeenCalledTimes(1);
    expect(userFake.mock.invocationCallOrder[0]).toBeLessThan(fake.mock.invocationCallOrder[0]);
  });

  it("should return empty array if no subscriptions are available", async () => {
    const fake = vi.fn().mockResolvedValue([]);
    setSubscriptionDAO(payments, testSubscriptionDAO("getSubscriptions", fake));

    const subscriptions: Subscription[] =
      await getCurrentUserSubscriptions(payments);

    expect(subscriptions).toEqual([]);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("alice", {});
  });

  it("should only return subscriptions with the given status", async () => {
    const fake = vi.fn().mockResolvedValue([subscription1]);
    setSubscriptionDAO(payments, testSubscriptionDAO("getSubscriptions", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const subscriptions: Subscription[] = await getCurrentUserSubscriptions(
      payments,
      {
        status: "active",
      }
    );

    expect(subscriptions).toEqual([subscription1]);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("alice", {
      status: ["active"],
    });
    expect(userFake).toHaveBeenCalledTimes(1);
    expect(userFake.mock.invocationCallOrder[0]).toBeLessThan(fake.mock.invocationCallOrder[0]);
  });

  it("should only return subscriptions with the given statuses", async () => {
    const fake = vi.fn().mockResolvedValue([subscription1, subscription2]);
    setSubscriptionDAO(payments, testSubscriptionDAO("getSubscriptions", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const subscriptions: Subscription[] = await getCurrentUserSubscriptions(
      payments,
      {
        status: ["active", "incomplete"],
      }
    );

    expect(subscriptions).toEqual([subscription1, subscription2]);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("alice", {
      status: ["active", "incomplete"],
    });
    expect(userFake).toHaveBeenCalledTimes(1);
    expect(userFake.mock.invocationCallOrder[0]).toBeLessThan(fake.mock.invocationCallOrder[0]);
  });

  [null, [], {}, true, 1, 0, NaN].forEach((status: any) => {
    it(`should throw when called with invalid status option: ${JSON.stringify(
      status
    )}`, async () => {
      expect(() =>
        getCurrentUserSubscriptions(payments, {
          status,
        })
      ).toThrow("status must be a non-empty array.");
    });
  });

  it("should reject when the subscription data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "not-found",
      "no such subscription"
    );
    const fake = vi.fn().mockRejectedValue(error);
    setSubscriptionDAO(payments, testSubscriptionDAO("getSubscriptions", fake));
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));

    await expect(getCurrentUserSubscriptions(payments)).rejects.toThrow(error);

    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("alice", {});
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

    await expect(getCurrentUserSubscriptions(payments)).rejects.toThrow(error);

    expect(userFake).toHaveBeenCalledTimes(1);
  });
});

describe("onCurrentUserSubscriptionUpdate()", () => {
  it("should register a callback to receive subscription updates", () => {
    let canceled: boolean = false;
    const fake = vi.fn().mockReturnValue(() => {
      canceled = true;
    });
    setSubscriptionDAO(
      payments,
      testSubscriptionDAO("onSubscriptionUpdate", fake)
    );
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));
    const onUpdate: (snap: SubscriptionSnapshot) => void = () => {};

    const cancel = onCurrentUserSubscriptionUpdate(payments, onUpdate);
    cancel();

    expect(canceled).toBe(true);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("alice", onUpdate, undefined);
    expect(userFake).toHaveBeenCalledTimes(1);
    expect(userFake.mock.invocationCallOrder[0]).toBeLessThan(fake.mock.invocationCallOrder[0]);
  });

  it("should register a callback to receive errors when specified", () => {
    let canceled: boolean = false;
    const fake = vi.fn().mockReturnValue(() => {
      canceled = true;
    });
    setSubscriptionDAO(
      payments,
      testSubscriptionDAO("onSubscriptionUpdate", fake)
    );
    const userFake = vi.fn().mockReturnValue("alice");
    setUserDAO(payments, testUserDAO(userFake));
    const onUpdate: (snap: SubscriptionSnapshot) => void = () => {};
    const onError: (err: StripePaymentsError) => void = () => {};

    const cancel = onCurrentUserSubscriptionUpdate(payments, onUpdate, onError);
    cancel();

    expect(canceled).toBe(true);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("alice", onUpdate, onError);
    expect(userFake).toHaveBeenCalledTimes(1);
    expect(userFake.mock.invocationCallOrder[0]).toBeLessThan(fake.mock.invocationCallOrder[0]);
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

    expect(() => onCurrentUserSubscriptionUpdate(payments, () => {})).toThrow(error);

    expect(userFake).toHaveBeenCalledTimes(1);
  });
});

function testSubscriptionDAO(name: string, fake: ReturnType<typeof vi.fn>): SubscriptionDAO {
  return {
    [name]: fake,
  } as unknown as SubscriptionDAO;
}

function testUserDAO(fake: ReturnType<typeof vi.fn>): UserDAO {
  return {
    getCurrentUser: fake,
  } as UserDAO;
}
