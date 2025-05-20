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

import { FirebaseApp } from "@firebase/app";
import { describe, expect, it } from "vitest";
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

    expect(payments).toBeInstanceOf(StripePayments);
    expect(payments.app).toBe(app);
  });
});

describe("StripePayments", () => {
  const payments: StripePayments = getStripePayments(app, {
    customersCollection: "customers",
    productsCollection: "products",
  });

  it("should expose customersCollection as a property", () => {
    expect(payments.customersCollection).toBe("customers");
  });

  it("should expose productsCollection as a property", () => {
    expect(payments.productsCollection).toBe("products");
  });

  it("should expose FirebaseApp as a property", () => {
    expect(payments.app).toBe(app);
  });

  describe("getComponent()", () => {
    it("should return null when a non-existing component is requested", () => {
      expect(payments.getComponent("non-existing")).toBeNull();
    });

    it("should return the requested component when available", () => {
      const component: any = {};
      payments.setComponent("test-component", component);

      expect(payments.getComponent("test-component")).toBe(component);
    });
  });

  describe("setComponent()", () => {
    it("should overwrite the existing component", () => {
      const component: any = {};
      const otherComponent: any = { other: true };

      payments.setComponent("test-component", component);
      expect(payments.getComponent("test-component")).toBe(component);

      payments.setComponent("test-component", otherComponent);
      expect(payments.getComponent("test-component")).toBe(otherComponent);
    });
  });
});

describe("StripePaymentsError", () => {
  it("should be able to create an error with code and message", () => {
    const error = new StripePaymentsError("not-found", "test message");

    expect(error.code).toBe("not-found");
    expect(error.message).toBe("test message");
    expect(error.cause).toBeUndefined();
  });

  it("should be able to create an error with code, message and cause", () => {
    const cause = new Error("root cause");
    const error = new StripePaymentsError("not-found", "test message", cause);

    expect(error.code).toBe("not-found");
    expect(error.message).toBe("test message");
    expect(error.cause).toBe(cause);
  });
});
