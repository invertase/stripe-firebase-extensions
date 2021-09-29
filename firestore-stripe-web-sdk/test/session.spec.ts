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
  createCheckoutSession,
  getStripePayments,
  Session,
  SessionCreateParams,
  StripePayments,
  StripePaymentsError,
} from "../src/index";
import { SessionDAO, setSessionDAO } from "../src/session";
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

const testSession: Session = {
  cancelUrl: "https://example.com/cancel",
  createdAt: new Date().toUTCString(),
  id: "test_session_1",
  mode: "subscription",
  priceId: "price1",
  successUrl: "https://example.com/success",
  url: "https://example.stripe.com/session/test_session_1",
};

describe("createCheckoutSession()", () => {
  const invalidUrls: any[] = [null, [], {}, true, 1, 0, NaN, ""];

  invalidUrls.forEach((cancelUrl: any) => {
    it(`should throw when called with invalid cancelUrl: ${cancelUrl}`, () => {
      expect(() =>
        createCheckoutSession(payments, {
          cancelUrl,
          priceId: "price1",
        })
      ).to.throw("cancelUrl must be a non-empty string.");
    });
  });

  invalidUrls.forEach((successUrl: any) => {
    it(`should throw when called with invalid successUrl: ${successUrl}`, () => {
      expect(() =>
        createCheckoutSession(payments, {
          successUrl,
          priceId: "price1",
        })
      ).to.throw("successUrl must be a non-empty string.");
    });
  });

  [null, [], {}, true, -1, 0, NaN, ""].forEach((quantity: any) => {
    it(`should throw when called with invalid quantity: ${quantity}`, () => {
      expect(() =>
        createCheckoutSession(payments, {
          quantity,
          priceId: "price1",
        })
      ).to.throw("quantity must be a positive integer.");
    });
  });

  it("should return a session when called with minimum valid parameters", async () => {
    const fake: SinonSpy = sinonFake.resolves(testSession);
    setSessionDAO(payments, testSessionDAO("createCheckoutSession", fake));
    const userFake: SinonSpy = sinonFake.resolves("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const session: Session = await createCheckoutSession(payments, {
      priceId: "price1",
    });

    expect(session).to.eql(testSession);
    expect(fake).to.have.been.calledOnceWithExactly("alice", {
      cancelUrl: window.location.href,
      mode: "subscription",
      priceId: "price1",
      successUrl: window.location.href,
    });
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  it("should return a session when called with all valid parameters", async () => {
    const fake: SinonSpy = sinonFake.resolves(testSession);
    setSessionDAO(payments, testSessionDAO("createCheckoutSession", fake));
    const userFake: SinonSpy = sinonFake.resolves("alice");
    setUserDAO(payments, testUserDAO(userFake));
    const params: SessionCreateParams = {
      cancelUrl: "https://example.com/cancel",
      mode: "subscription",
      priceId: "price1",
      quantity: 5,
      successUrl: "https://example.com/success",
    };

    const session: Session = await createCheckoutSession(payments, params);

    expect(session).to.eql(testSession);
    expect(fake).to.have.been.calledOnceWithExactly("alice", params);
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  it("should reject when the session data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "internal",
      "failed to create session"
    );
    const fake: SinonSpy = sinonFake.rejects(error);
    setSessionDAO(payments, testSessionDAO("createCheckoutSession", fake));
    const userFake: SinonSpy = sinonFake.resolves("alice");
    setUserDAO(payments, testUserDAO(userFake));

    await expect(
      createCheckoutSession(payments, { priceId: "price1" })
    ).to.be.rejectedWith(error);

    expect(fake).to.have.been.calledOnce;
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
      createCheckoutSession(payments, { priceId: "price1" })
    ).to.be.rejectedWith(error);

    expect(userFake).to.have.been.calledOnce;
  });
});

function testSessionDAO(name: string, fake: SinonSpy): SessionDAO {
  return {
    [name]: fake,
  } as unknown as SessionDAO;
}

function testUserDAO(fake: SinonSpy): UserDAO {
  return {
    getCurrentUser: fake,
  } as UserDAO;
}
