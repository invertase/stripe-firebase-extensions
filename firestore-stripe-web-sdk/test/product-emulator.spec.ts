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

import { expect, use } from "chai";
import { deleteApp, FirebaseApp, initializeApp } from "@firebase/app";
import {
  connectFirestoreEmulator,
  doc,
  Firestore,
  getFirestore,
  setDoc,
} from "@firebase/firestore";
import {
  getPrice,
  getPrices,
  getProduct,
  getProducts,
  getStripePayments,
  Price,
  Product,
  StripePayments,
  StripePaymentsError,
} from "../src/index";
import {
  economyPlan,
  premiumPlan,
  premiumPlanPrice,
  ProductData,
  rawProductData,
  standardPlan,
  standardPlanPrice1,
  standardPlanPrice2,
} from "./testdata";

use(require("chai-like"));

describe("Product emulator tests", () => {
  const app: FirebaseApp = initializeApp({
    projectId: "fake-project-id",
  });

  const payments: StripePayments = getStripePayments(app, {
    customersCollection: "customers",
    productsCollection: "products",
  });

  before(async () => {
    const db: Firestore = getFirestore(app);
    connectFirestoreEmulator(db, "localhost", 8080);

    for (const [productId, data] of Object.entries(rawProductData)) {
      await addProductData(db, productId, data);
    }
  });

  after(async () => {
    await deleteApp(app);
  });

  describe("getProduct()", () => {
    it("should return a product when called with a valid productId", async () => {
      const product: Product = await getProduct(payments, "premium");

      expect(product).to.eql(premiumPlan);
    });

    it("should return a product with prices when includePrices is set", async () => {
      const product: Product = await getProduct(payments, "premium", {
        includePrices: true,
      });

      const expected: Product = { ...premiumPlan, prices: [premiumPlanPrice] };
      expect(product).to.be.like(expected);
    });

    it("should reject with not-found error when the specified product does not exist", async () => {
      const err: any = await expect(
        getProduct(payments, "unavailable")
      ).to.be.rejectedWith("No product found with the ID: unavailable");

      expect(err).to.be.instanceOf(StripePaymentsError);
      expect(err.code).to.equal("not-found");
      expect(err.cause).to.be.undefined;
    });
  });

  describe("getProducts()", () => {
    it("should return all products when called without options", async () => {
      const products: Product[] = await getProducts(payments);

      expect(products).to.eql([economyPlan, premiumPlan, standardPlan]);
    });

    it("should only return active products when activeOnly is set", async () => {
      const products: Product[] = await getProducts(payments, {activeOnly: true});

      expect(products).to.eql([premiumPlan, standardPlan]);
    });

    it("should return products with prices when includePrices is set", async () => {
      const products: Product[] = await getProducts(payments, {
        includePrices: true,
      });

      const expected: Product[] = [
        economyPlan,
        { ...premiumPlan, prices: [premiumPlanPrice] },
        { ...standardPlan, prices: [standardPlanPrice1, standardPlanPrice2]},
      ];
      expect(products).to.be.an("array").of.length(3).and.to.be.like(expected);
    });

    it("should return active products with prices when activeOnly and includePrices are set", async () => {
      const products: Product[] = await getProducts(payments, {
        activeOnly: true,
        includePrices: true,
      });

      const expected: Product[] = [
        { ...premiumPlan, prices: [premiumPlanPrice] },
        { ...standardPlan, prices: [standardPlanPrice1, standardPlanPrice2]},
      ];
      expect(products).to.be.an("array").of.length(2).and.be.like(expected);
    });
  });

  describe("getPrice()", () => {
    it("should return a price when called with valid product and price IDs", async () => {
      const price: Price = await getPrice(payments, "premium", "price1");

      expect(price).to.include(premiumPlanPrice);
    });

    it("should reject with not-found when the specified product does not exist", async () => {
      const err: any = await expect(
        getPrice(payments, "unavailable", "price1")
      ).to.be.rejectedWith(
        "No price found with the product ID: unavailable and price ID: price1"
      );

      expect(err).to.be.instanceOf(StripePaymentsError);
      expect(err.code).to.equal("not-found");
      expect(err.cause).to.be.undefined;
    });

    it("should reject with not-found when the specified price does not exist", async () => {
      const err: any = await expect(
        getPrice(payments, "premium", "unavailable")
      ).to.be.rejectedWith(
        "No price found with the product ID: premium and price ID: unavailable"
      );

      expect(err).to.be.instanceOf(StripePaymentsError);
      expect(err.code).to.equal("not-found");
      expect(err.cause).to.be.undefined;
    });
  });

  describe("getPrices()", () => {
    it("should return prices as an array when the product has only one price", async () => {
      const prices: Price[] = await getPrices(payments, "premium");

      expect(prices)
        .to.be.an("array")
        .of.length(1)
        .and.be.like([premiumPlanPrice]);
    });

    it("should return prices as an array when the product has multiple prices", async () => {
      const prices: Price[] = await getPrices(payments, "standard");

      expect(prices)
        .to.be.an("array")
        .of.length(2)
        .and.be.like([standardPlanPrice1, standardPlanPrice2]);
    });

    it("should return empty array for when the product has no prices", async () => {
      const prices: Price[] = await getPrices(payments, "economy");

      expect(prices).to.be.an("array").and.be.empty;
    });

    it("should reject with not-found when the specified product does not exist", async () => {
      const err: any = await expect(
        getPrices(payments, "unavailable")
      ).to.be.rejectedWith("No product found with the ID: unavailable");

      expect(err).to.be.instanceOf(StripePaymentsError);
      expect(err.code).to.equal("not-found");
      expect(err.cause).to.be.undefined;
    });
  });

  async function addProductData(
    db: Firestore,
    productId: string,
    data: ProductData
  ): Promise<void> {
    await setDoc(doc(db, payments.productsCollection, productId), data.product);
    for (const [priceId, price] of Object.entries(data.prices)) {
      await setDoc(
        doc(db, payments.productsCollection, productId, "prices", priceId),
        price
      );
    }
  }
});
