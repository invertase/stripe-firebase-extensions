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
      ).to.throw("cancel_url must be a non-empty string.");
    });
  });

  invalidUrls.forEach((successUrl: any) => {
    it(`should throw when called with invalid successUrl: ${successUrl}`, () => {
      expect(() =>
        createCheckoutSession(payments, {
          success_url: successUrl,
          price: "price1",
        })
      ).to.throw("success_url must be a non-empty string.");
    });
  });

  [null, [], {}, true, -1, 0, NaN, ""].forEach((lineItems: any) => {
    it(`should throw when called with invalid line_items: ${lineItems}`, () => {
      expect(() =>
        createCheckoutSession(payments, {
          line_items: lineItems,
        })
      ).to.throw("line_items must be a non-empty array.");
    });
  });

  [null, [], {}, true, -1, 0, NaN, ""].forEach((price: any) => {
    it(`should throw when called with invalid price ID: ${price}`, () => {
      expect(() =>
        createCheckoutSession(payments, {
          price,
        })
      ).to.throw("price must be a non-empty string.");
    });
  });

  [null, [], {}, true, -1, 0, NaN, ""].forEach((quantity: any) => {
    it(`should throw when called with invalid quantity: ${quantity}`, () => {
      expect(() =>
        createCheckoutSession(payments, {
          quantity,
          price: "price1",
        })
      ).to.throw("quantity must be a positive integer.");
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
      ).to.throw("timeoutMillis must be a positive number.");
    });
  });

  it("should return a session when called with minimum valid parameters", async () => {
    const fake: SinonSpy = sinonFake.resolves(testSession);
    setSessionDAO(payments, testSessionDAO("createCheckoutSession", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const session: Session = await createCheckoutSession(payments, {
      price: "price1",
    });

    expect(session).to.eql(testSession);
    expect(fake).to.have.been.calledOnceWithExactly(
      "alice",
      {
        cancel_url: window.location.href,
        mode: "subscription",
        price: "price1",
        success_url: window.location.href,
      },
      CREATE_SESSION_TIMEOUT_MILLIS
    );
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  it("should return a session when called with line items", async () => {
    const fake: SinonSpy = sinonFake.resolves(testSession);
    setSessionDAO(payments, testSessionDAO("createCheckoutSession", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
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

    expect(session).to.eql(testSession);
    expect(fake).to.have.been.calledOnceWithExactly(
      "alice",
      params,
      CREATE_SESSION_TIMEOUT_MILLIS
    );
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  it("should return a session when called with price ID", async () => {
    const fake: SinonSpy = sinonFake.resolves(testSession);
    setSessionDAO(payments, testSessionDAO("createCheckoutSession", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
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

    expect(session).to.eql(testSession);
    expect(fake).to.have.been.calledOnceWithExactly(
      "alice",
      params,
      CREATE_SESSION_TIMEOUT_MILLIS
    );
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  it("should return a session when called with valid timeout", async () => {
    const fake: SinonSpy = sinonFake.resolves(testSession);
    setSessionDAO(payments, testSessionDAO("createCheckoutSession", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const session: Session = await createCheckoutSession(
      payments,
      {
        price: "price1",
      },
      { timeoutMillis: 3000 }
    );

    expect(session).to.eql(testSession);
    expect(fake).to.have.been.calledOnceWithExactly(
      "alice",
      {
        cancel_url: window.location.href,
        mode: "subscription",
        price: "price1",
        success_url: window.location.href,
      },
      3000
    );
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  it("should reject when the session data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "internal",
      "failed to create session"
    );
    const fake: SinonSpy = sinonFake.rejects(error);
    setSessionDAO(payments, testSessionDAO("createCheckoutSession", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));

    await expect(
      createCheckoutSession(payments, { price: "price1" })
    ).to.be.rejectedWith(error);

    expect(fake).to.have.been.calledOnce;
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
      createCheckoutSession(payments, { price: "price1" })
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
