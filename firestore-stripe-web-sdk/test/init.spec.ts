/*
 * Copyright 2021 Stripe, Inc.
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
import { expect } from "chai";
import { getStripePayments, StripePayments } from "../src/index";

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
