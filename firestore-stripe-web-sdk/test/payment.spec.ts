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
  getCurrentUserPayment,
  getStripePayments,
  Payment,
  StripePayments,
  StripePaymentsError,
} from "../src/index";
import { payment1 } from "./testdata";
import { setUserDAO, UserDAO } from "../src/user";
import { PaymentDAO, setPaymentDAO } from "../src/payment";

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

describe("getCurrentUserPayment()", () => {
  [null, [], {}, true, 1, 0, NaN, ""].forEach((paymentId: any) => {
    it(`should throw when called with invalid paymentId: ${JSON.stringify(
      paymentId
    )}`, () => {
      expect(() => getCurrentUserPayment(payments, paymentId)).to.throw(
        "paymentId must be a non-empty string."
      );
    });
  });

  it("should return a payment when called with a valid paymentId", async () => {
    const expected: Payment = { ...payment1, uid: "alice" };
    const fake: SinonSpy = sinonFake.resolves(expected);
    setPaymentDAO(payments, testPaymentDAO("getPayment", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const payment: Payment = await getCurrentUserPayment(payments, "pay1");

    expect(payment).to.eql(expected);
    expect(fake).to.have.been.calledOnceWithExactly("alice", "pay1");
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  it("should reject when the payment data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "not-found",
      "no such payment"
    );
    const fake: SinonSpy = sinonFake.rejects(error);
    setPaymentDAO(payments, testPaymentDAO("getPayment", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));

    await expect(getCurrentUserPayment(payments, "pay1")).to.be.rejectedWith(
      error
    );

    expect(fake).to.have.been.calledOnceWithExactly("alice", "pay1");
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  it("should reject when the user data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "unauthenticated",
      "user not signed in"
    );
    const userFake: SinonSpy = sinonFake.throws(error);
    setUserDAO(payments, testUserDAO(userFake));

    await expect(getCurrentUserPayment(payments, "pay1")).to.be.rejectedWith(
      error
    );

    expect(userFake).to.have.been.calledOnce;
  });
});

function testPaymentDAO(name: string, fake: SinonSpy): PaymentDAO {
  return {
    [name]: fake,
  } as unknown as PaymentDAO;
}

function testUserDAO(fake: SinonSpy): UserDAO {
  return {
    getCurrentUser: fake,
  } as UserDAO;
}
