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

describe("getCurrentUserPayments()", () => {
  it("should return all payments when called without options", async () => {
    const fake: SinonSpy = sinonFake.resolves([payment1, payment2]);
    setPaymentDAO(payments, testPaymentDAO("getPayments", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const paymentData: Payment[] = await getCurrentUserPayments(payments);

    expect(paymentData).to.eql([payment1, payment2]);
    expect(fake).to.have.been.calledOnceWithExactly("alice", {});
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  it("should return empty array if no payments are available", async () => {
    const fake: SinonSpy = sinonFake.resolves([]);
    setPaymentDAO(payments, testPaymentDAO("getPayments", fake));

    const paymentData: Payment[] = await getCurrentUserPayments(payments);

    expect(paymentData).to.be.an("array").and.be.empty;
    expect(fake).to.have.been.calledOnceWithExactly("alice", {});
  });

  it("should only return payments with the given status", async () => {
    const fake: SinonSpy = sinonFake.resolves([payment1]);
    setPaymentDAO(payments, testPaymentDAO("getPayments", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const paymentData: Payment[] = await getCurrentUserPayments(payments, {
      status: "succeeded",
    });

    expect(paymentData).to.eql([payment1]);
    expect(fake).to.have.been.calledOnceWithExactly("alice", {
      status: ["succeeded"],
    });
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  it("should only return payments with the given statuses", async () => {
    const fake: SinonSpy = sinonFake.resolves([payment1, payment2]);
    setPaymentDAO(payments, testPaymentDAO("getPayments", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));

    const paymentData: Payment[] = await getCurrentUserPayments(payments, {
      status: ["succeeded", "requires_action"],
    });

    expect(paymentData).to.eql([payment1, payment2]);
    expect(fake).to.have.been.calledOnceWithExactly("alice", {
      status: ["succeeded", "requires_action"],
    });
    expect(userFake).to.have.been.calledOnce.and.calledBefore(fake);
  });

  [null, [], {}, true, 1, 0, NaN].forEach((status: any) => {
    it(`should throw when called with invalid status option: ${JSON.stringify(
      status
    )}`, async () => {
      expect(() =>
        getCurrentUserPayments(payments, {
          status,
        })
      ).to.throw("status must be a non-empty array.");
    });
  });

  it("should reject when the payment data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "not-found",
      "no such payment"
    );
    const fake: SinonSpy = sinonFake.rejects(error);
    setPaymentDAO(payments, testPaymentDAO("getPayments", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));

    await expect(getCurrentUserPayments(payments)).to.be.rejectedWith(error);

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

    await expect(getCurrentUserPayments(payments)).to.be.rejectedWith(error);

    expect(userFake).to.have.been.calledOnce;
  });
});

describe("onCurrentUserPaymentUpdate()", () => {
  it("should register a callback to receive payment updates", () => {
    let canceled: boolean = false;
    const fake: SinonSpy = sinonFake.returns(() => {
      canceled = true;
    });
    setPaymentDAO(payments, testPaymentDAO("onPaymentUpdate", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));
    const onUpdate: (snap: PaymentSnapshot) => void = () => {};

    const cancel = onCurrentUserPaymentUpdate(payments, onUpdate);
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
    setPaymentDAO(payments, testPaymentDAO("onPaymentUpdate", fake));
    const userFake: SinonSpy = sinonFake.returns("alice");
    setUserDAO(payments, testUserDAO(userFake));
    const onUpdate: (snap: PaymentSnapshot) => void = () => {};
    const onError: (err: StripePaymentsError) => void = () => {};

    const cancel = onCurrentUserPaymentUpdate(payments, onUpdate, onError);
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

    expect(() => onCurrentUserPaymentUpdate(payments, () => {})).to.throw(
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
