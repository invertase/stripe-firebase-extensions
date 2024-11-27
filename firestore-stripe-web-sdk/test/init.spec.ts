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

import { FirebaseApp } from "firebase/app";
import { expect } from "chai";
import {
  getStripePayments,
  StripePayments,
  StripePaymentsError,
} from "../src/index";

const app: FirebaseApp = {
  name: "mock",
  options: {},
  automaticDataCollectionEnabled: false,
};

describe("getStripePayments()", () => {
  it("should return a new instance of StripePayments", () => {
    const payments: StripePayments = getStripePayments(app, {
      customersCollection: "customers",
      productsCollection: "products",
    });

    expect(payments).to.be.instanceOf(StripePayments);
    expect(payments.app).to.equal(app);
  });
});

describe("StripePayments", () => {
  const payments: StripePayments = getStripePayments(app, {
    customersCollection: "customers",
    productsCollection: "products",
  });

  it("should expose customersCollection as a property", () => {
    expect(payments.customersCollection).to.equal("customers");
  });

  it("should expose productsCollection as a property", () => {
    expect(payments.productsCollection).to.equal("products");
  });

  it("should expose FirebaseApp as a property", () => {
    expect(payments.app).to.equal(app);
  });

  describe("getComponent()", () => {
    it("should return null when a non-existing component is requested", () => {
      expect(payments.getComponent("non-existing")).to.be.null;
    });

    it("should return the requested component when available", () => {
      const component: any = {};
      payments.setComponent("test-component", component);

      expect(payments.getComponent("test-component")).to.equal(component);
    });
  });

  describe("setComponent()", () => {
    it("should overwrite the existing component", () => {
      const component: any = {};
      const otherComponent: any = { other: true };

      payments.setComponent("test-component", component);
      expect(payments.getComponent("test-component")).to.equal(component);

      payments.setComponent("test-component", otherComponent);
      expect(payments.getComponent("test-component")).to.equal(otherComponent);
    });
  });
});

describe("StripePaymentsError", () => {
  it("should be able to create an error with code and message", () => {
    const error = new StripePaymentsError("not-found", "test message");

    expect(error.code).to.equal("not-found");
    expect(error.message).to.equal("test message");
    expect(error.cause).to.be.undefined;
  });

  it("should be able to create an error with code, message and cause", () => {
    const cause = new Error("root cause");
    const error = new StripePaymentsError("not-found", "test message", cause);

    expect(error.code).to.equal("not-found");
    expect(error.message).to.equal("test message");
    expect(error.cause).to.equal(cause);
  });
});
