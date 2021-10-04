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
import { FirebaseApp } from "@firebase/app";
import {
  getCurrentUserSubscription,
  getStripePayments,
  Subscription,
  StripePayments,
  StripePaymentsError,
} from "../src/index";
import { subscription1 } from "./testdata";
import { setSubscriptionDAO, SubscriptionDAO } from "../src/subscription";
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
      expect(() => getCurrentUserSubscription(payments, subscriptionId)).to.throw(
        "subscriptionId must be a non-empty string."
      );
    });
  });

  it("should return a subscription when called with a valid subscriptionId", async () => {
    const expected: Subscription = {...subscription1, uid: "alice"};
    const fake: SinonSpy = sinonFake.resolves(expected);
    setSubscriptionDAO(payments, testSubscriptionDAO("getSubscription", fake));
    const userFake: SinonSpy = sinonFake.resolves("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const subscription: Subscription = await getCurrentUserSubscription(
      payments,
      "sub1",
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
    const userFake: SinonSpy = sinonFake.resolves("alice");
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
    const userFake: SinonSpy = sinonFake.rejects(error);
    setUserDAO(payments, testUserDAO(userFake));

    await expect(
      getCurrentUserSubscription(payments, "subscription1")
    ).to.be.rejectedWith(error);

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
