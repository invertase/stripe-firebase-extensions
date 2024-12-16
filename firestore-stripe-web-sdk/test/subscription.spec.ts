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

import { expect, use } from "chai";
import { fake as sinonFake, SinonSpy } from "sinon";
import { FirebaseApp } from "firebase/app";
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

use(require("chai-as-promised"));
use(require("sinon-chai"));

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
      ).to.throw("subscriptionId must be a non-empty string.");
    });
  });

  it("should return a subscription when called with a valid subscriptionId", async () => {
    const expected: Subscription = { ...subscription1, uid: "alice" };
    const fake: SinonSpy = sinonFake.resolves(expected);
    setSubscriptionDAO(payments, testSubscriptionDAO("getSubscription", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const subscription: Subscription = await getCurrentUserSubscription(
      payments,
      "sub1"
    );

    expect(subscription).to.eql(expected);
    expect(fake).to.have.been.calledOnceWithExactly("alice", "sub1");
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  it("should reject when the subscription data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "not-found",
      "no such subscription"
    );
    const fake: SinonSpy = sinonFake.rejects(error);
    setSubscriptionDAO(payments, testSubscriptionDAO("getSubscription", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));

    await expect(
      getCurrentUserSubscription(payments, "sub1")
    ).to.be.rejectedWith(error);

    expect(fake).to.have.been.calledOnceWithExactly("alice", "sub1");
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  it("should reject when the user data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "unauthenticated",
      "user not signed in"
    );
    const userFake: SinonSpy = sinonFake.throws(error);
    setUserDAO(payments, testUserDAO(userFake));

    await expect(
      getCurrentUserSubscription(payments, "subscription1")
    ).to.be.rejectedWith(error);

    expect(userFake).to.have.been.calledOnce;
  });
});

describe("getCurrentUserSubscriptions()", () => {
  it("should return all subscriptions when called without options", async () => {
    const fake: SinonSpy = sinonFake.resolves([subscription1, subscription2]);
    setSubscriptionDAO(payments, testSubscriptionDAO("getSubscriptions", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const subscriptions: Subscription[] = await getCurrentUserSubscriptions(
      payments
    );

    expect(subscriptions).to.eql([subscription1, subscription2]);
    expect(fake).to.have.been.calledOnceWithExactly("alice", {});
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  it("should return empty array if no subscriptions are available", async () => {
    const fake: SinonSpy = sinonFake.resolves([]);
    setSubscriptionDAO(payments, testSubscriptionDAO("getSubscriptions", fake));

    const subscriptions: Subscription[] = await getCurrentUserSubscriptions(
      payments
    );

    expect(subscriptions).to.be.an("array").and.be.empty;
    expect(fake).to.have.been.calledOnceWithExactly("alice", {});
  });

  it("should only return subscriptions with the given status", async () => {
    const fake: SinonSpy = sinonFake.resolves([subscription1]);
    setSubscriptionDAO(payments, testSubscriptionDAO("getSubscriptions", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const subscriptions: Subscription[] = await getCurrentUserSubscriptions(
      payments,
      {
        status: "active",
      }
    );

    expect(subscriptions).to.eql([subscription1]);
    expect(fake).to.have.been.calledOnceWithExactly("alice", {
      status: ["active"],
    });
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  it("should only return subscriptions with the given statuses", async () => {
    const fake: SinonSpy = sinonFake.resolves([subscription1, subscription2]);
    setSubscriptionDAO(payments, testSubscriptionDAO("getSubscriptions", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const subscriptions: Subscription[] = await getCurrentUserSubscriptions(
      payments,
      {
        status: ["active", "incomplete"],
      }
    );

    expect(subscriptions).to.eql([subscription1, subscription2]);
    expect(fake).to.have.been.calledOnceWithExactly("alice", {
      status: ["active", "incomplete"],
    });
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  [null, [], {}, true, 1, 0, NaN].forEach((status: any) => {
    it(`should throw when called with invalid status option: ${JSON.stringify(
      status
    )}`, async () => {
      expect(() =>
        getCurrentUserSubscriptions(payments, {
          status,
        })
      ).to.throw("status must be a non-empty array.");
    });
  });

  it("should reject when the subscription data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "not-found",
      "no such subscription"
    );
    const fake: SinonSpy = sinonFake.rejects(error);
    setSubscriptionDAO(payments, testSubscriptionDAO("getSubscriptions", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));

    await expect(getCurrentUserSubscriptions(payments)).to.be.rejectedWith(
      error
    );

    expect(fake).to.have.been.calledOnceWithExactly("alice", {});
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  it("should reject when the user data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "unauthenticated",
      "user not signed in"
    );
    const userFake: SinonSpy = sinonFake.throws(error);
    setUserDAO(payments, testUserDAO(userFake));

    await expect(getCurrentUserSubscriptions(payments)).to.be.rejectedWith(
      error
    );

    expect(userFake).to.have.been.calledOnce;
  });
});

describe("onCurrentUserSubscriptionUpdate()", () => {
  it("should register a callback to receive subscription updates", () => {
    let canceled: boolean = false;
    const fake: SinonSpy = sinonFake.returns(() => {
      canceled = true;
    });
    setSubscriptionDAO(
      payments,
      testSubscriptionDAO("onSubscriptionUpdate", fake)
    );
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));
    const onUpdate: (snap: SubscriptionSnapshot) => void = () => {};

    const cancel = onCurrentUserSubscriptionUpdate(payments, onUpdate);
    cancel();

    expect(canceled).to.be.true;
    expect(fake).to.have.been.calledOnceWithExactly(
      "alice",
      onUpdate,
      undefined
    );
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  it("should register a callback to receive errors when specified", () => {
    let canceled: boolean = false;
    const fake: SinonSpy = sinonFake.returns(() => {
      canceled = true;
    });
    setSubscriptionDAO(
      payments,
      testSubscriptionDAO("onSubscriptionUpdate", fake)
    );
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));
    const onUpdate: (snap: SubscriptionSnapshot) => void = () => {};
    const onError: (err: StripePaymentsError) => void = () => {};

    const cancel = onCurrentUserSubscriptionUpdate(payments, onUpdate, onError);
    cancel();

    expect(canceled).to.be.true;
    expect(fake).to.have.been.calledOnceWithExactly("alice", onUpdate, onError);
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  it("should throw when the user data access object throws", () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "unauthenticated",
      "user not signed in"
    );
    const userFake: SinonSpy = sinonFake.throws(error);
    setUserDAO(payments, testUserDAO(userFake));

    expect(() => onCurrentUserSubscriptionUpdate(payments, () => {})).to.throw(
      error
    );

    expect(userFake).to.have.been.calledOnce;
  });
});

function testSubscriptionDAO(name: string, fake: SinonSpy): SubscriptionDAO {
  return {
    [name]: fake,
  } as unknown as SubscriptionDAO;
}

function testUserDAO(fake: SinonSpy): UserDAO {
  return {
    getCurrentUser: fake,
  } as UserDAO;
}
