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

import { describe, it, expect, vi } from "vitest";
import { FirebaseApp } from "@firebase/app";
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
import { ProductDAO, setProductDAO } from "../src/product";
import {
  economyPlan,
  premiumPlan,
  premiumPlanPrice,
  standardPlan,
  standardPlanPrice1,
  standardPlanPrice2,
} from "./testdata";

// Add custom matcher for toHaveBeenCalledBefore
expect.extend({
  toHaveBeenCalledBefore(received: any, expected: any) {
    const receivedCalls = received.mock.invocationCallOrder;
    const expectedCalls = expected.mock.invocationCallOrder;
    const pass = receivedCalls[0] < expectedCalls[0];
    return {
      message: () =>
        `expected ${received.getMockName()} to have been called before ${expected.getMockName()}`,
      pass,
    };
  },
});

declare module 'vitest' {
  interface Assertion<T = any> {
    toHaveBeenCalledBefore(expected: any): T;
  }
}

const app: FirebaseApp = {
  name: "mock",
  options: {},
  automaticDataCollectionEnabled: false,
};

const payments: StripePayments = getStripePayments(app, {
  customersCollection: "customers",
  productsCollection: "products",
});

describe("getProduct()", () => {
  [null, [], {}, true, 1, 0, NaN, ""].forEach((invalidProductId: any) => {
    it(`should throw when called with invalid productId: ${JSON.stringify(
      invalidProductId
    )}`, () => {
      expect(() => getProduct(payments, invalidProductId)).toThrow(
        "productId must be a non-empty string."
      );
    });
  });

  it("should return a product when called with a valid productId", async () => {
    const fake = vi.fn().mockResolvedValue(premiumPlan);
    setProductDAO(payments, testProductDAO("getProduct", fake));

    const product: Product = await getProduct(payments, "premium");

    expect(product).toEqual(premiumPlan);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("premium");
  });

  it("should return a product with prices when includePrices is set", async () => {
    const fakes = {
      getProduct: vi.fn().mockResolvedValue(premiumPlan),
      getPrices: vi.fn().mockResolvedValue([premiumPlanPrice]),
    };
    setProductDAO(payments, testProductDAO(fakes));

    const product: Product = await getProduct(payments, "premium", {
      includePrices: true,
    });

    const expected: Product = { ...premiumPlan, prices: [premiumPlanPrice] };
    expect(product).toEqual(expected);
    expect(fakes.getProduct).toHaveBeenCalledTimes(1);
    expect(fakes.getProduct).toHaveBeenCalledWith("premium");
    expect(fakes.getPrices).toHaveBeenCalledTimes(1);
    expect(fakes.getPrices).toHaveBeenCalledWith("premium");
    expect(fakes.getProduct).toHaveBeenCalledBefore(fakes.getPrices);
  });

  it("should return a product without prices when includePrices is set but the product has no prices", async () => {
    const fakes = {
      getProduct: vi.fn().mockResolvedValue(economyPlan),
      getPrices: vi.fn().mockResolvedValue([]),
    };
    setProductDAO(payments, testProductDAO(fakes));

    const product: Product = await getProduct(payments, "economy", {
      includePrices: true,
    });

    expect(product).toEqual(economyPlan);
    expect(fakes.getProduct).toHaveBeenCalledTimes(1);
    expect(fakes.getProduct).toHaveBeenCalledWith("economy");
    expect(fakes.getPrices).toHaveBeenCalledTimes(1);
    expect(fakes.getPrices).toHaveBeenCalledWith("economy");
    expect(fakes.getProduct).toHaveBeenCalledBefore(fakes.getPrices);
  });

  it("should reject when the data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "not-found",
      "no such product"
    );
    const fake = vi.fn().mockRejectedValue(error);
    setProductDAO(payments, testProductDAO("getProduct", fake));

    await expect(getProduct(payments, "product1")).rejects.toThrow(error);

    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("product1");
  });
});

describe("getProducts()", () => {
  it("should return all products when called without options", async () => {
    const fake = vi.fn().mockResolvedValue([
      economyPlan,
      premiumPlan,
      standardPlan,
    ]);
    setProductDAO(payments, testProductDAO("getProducts", fake));

    const products: Product[] = await getProducts(payments);

    expect(products).toEqual([economyPlan, premiumPlan, standardPlan]);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith({});
  });

  it("should return empty array if no products are available", async () => {
    const fake = vi.fn().mockResolvedValue([]);
    setProductDAO(payments, testProductDAO("getProducts", fake));

    const products: Product[] = await getProducts(payments);

    expect(products).toEqual([]);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith({});
  });

  it("should only return active products when activeOnly is set", async () => {
    const fake = vi.fn().mockResolvedValue([premiumPlan, standardPlan]);
    setProductDAO(payments, testProductDAO("getProducts", fake));

    const products: Product[] = await getProducts(payments, {
      activeOnly: true,
    });

    expect(products).toEqual([premiumPlan, standardPlan]);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith({ activeOnly: true });
  });

  it("should return products with prices when includePrices is set", async () => {
    const fakes = {
      getProducts: vi.fn().mockResolvedValue([economyPlan, premiumPlan, standardPlan]),
      getPrices: vi.fn(getPricesForTest),
    };
    setProductDAO(payments, testProductDAO(fakes));

    const products: Product[] = await getProducts(payments, {
      includePrices: true,
    });

    const expected: Product[] = [
      economyPlan,
      { ...premiumPlan, prices: [premiumPlanPrice] },
      { ...standardPlan, prices: [standardPlanPrice1, standardPlanPrice2] },
    ];
    expect(products).toEqual(expected);
    expect(fakes.getProducts).toHaveBeenCalledTimes(1);
    expect(fakes.getProducts).toHaveBeenCalledWith({});
    expect(fakes.getPrices).toHaveBeenCalledTimes(3);
    expect(fakes.getPrices).toHaveBeenCalledWith("economy");
    expect(fakes.getPrices).toHaveBeenCalledWith("premium");
    expect(fakes.getPrices).toHaveBeenCalledWith("standard");
    expect(fakes.getProducts).toHaveBeenCalledBefore(fakes.getPrices);
  });

  it("should return active products with prices when activeOnly and includePrices are set", async () => {
    const fakes = {
      getProducts: vi.fn().mockResolvedValue([premiumPlan, standardPlan]),
      getPrices: vi.fn(getPricesForTest),
    };
    setProductDAO(payments, testProductDAO(fakes));

    const products: Product[] = await getProducts(payments, {
      activeOnly: true,
      includePrices: true,
    });

    const expected: Product[] = [
      { ...premiumPlan, prices: [premiumPlanPrice] },
      { ...standardPlan, prices: [standardPlanPrice1, standardPlanPrice2] },
    ];
    expect(products).toEqual(expected);
    expect(fakes.getProducts).toHaveBeenCalledTimes(1);
    expect(fakes.getProducts).toHaveBeenCalledWith({
      activeOnly: true,
    });
    expect(fakes.getPrices).toHaveBeenCalledTimes(2);
    expect(fakes.getPrices).toHaveBeenCalledWith("premium");
    expect(fakes.getPrices).toHaveBeenCalledWith("standard");
    expect(fakes.getProducts).toHaveBeenCalledBefore(fakes.getPrices);
  });

  it("should return specified number of products when limit is set", async () => {
    const fake = vi.fn().mockResolvedValue([premiumPlan, standardPlan]);
    setProductDAO(payments, testProductDAO("getProducts", fake));

    const products: Product[] = await getProducts(payments, {
      limit: 2,
    });

    expect(products).toEqual([premiumPlan, standardPlan]);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith({ limit: 2 });
  });

  it("should return matching products when filters is set", async () => {
    const fake = vi.fn().mockResolvedValue([premiumPlan]);
    setProductDAO(payments, testProductDAO("getProducts", fake));

    const products: Product[] = await getProducts(payments, {
      where: [["metadata.firebaseRole", "==", "moderator"]],
    });

    expect(products).toEqual([premiumPlan]);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith({
      where: [["metadata.firebaseRole", "==", "moderator"]],
    });
  });

  it("should return a matching product array when called with all options", async () => {
    const fakes = {
      getProducts: vi.fn().mockResolvedValue([premiumPlan]),
      getPrices: vi.fn(getPricesForTest),
    };
    setProductDAO(payments, testProductDAO(fakes));

    const products: Product[] = await getProducts(payments, {
      activeOnly: true,
      where: [["metadata.firebaseRole", "==", "moderator"]],
      includePrices: true,
      limit: 2,
    });

    const expected: Product[] = [
      { ...premiumPlan, prices: [premiumPlanPrice] },
    ];
    expect(products).toEqual(expected);
    expect(fakes.getProducts).toHaveBeenCalledTimes(1);
    expect(fakes.getProducts).toHaveBeenCalledWith({
      activeOnly: true,
      where: [["metadata.firebaseRole", "==", "moderator"]],
      limit: 2,
    });
    expect(fakes.getPrices).toHaveBeenCalledTimes(1);
    expect(fakes.getPrices).toHaveBeenCalledWith("premium");
    expect(fakes.getProducts).toHaveBeenCalledBefore(fakes.getPrices);
  });

  it("should reject when the data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "not-found",
      "no such product"
    );
    const fake = vi.fn().mockRejectedValue(error);
    setProductDAO(payments, testProductDAO("getProducts", fake));

    await expect(getProducts(payments)).rejects.toThrow(error);

    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith({});
  });

  function getPricesForTest(productId: string): Promise<Price[]> {
    if (productId === "premium") {
      return Promise.resolve([premiumPlanPrice]);
    } else if (productId === "standard") {
      return Promise.resolve([standardPlanPrice1, standardPlanPrice2]);
    } else if (productId === "economy") {
      return Promise.resolve([]);
    }

    throw new Error(`Invalid product ID: ${productId}`);
  }
});

describe("getPrice()", () => {
  [null, [], {}, true, 1, 0, NaN, ""].forEach((invalidProductId: any) => {
    it(`should throw when called with productId: ${JSON.stringify(
      invalidProductId
    )}`, () => {
      expect(() => getPrice(payments, invalidProductId, "priceId")).toThrow(
        "productId must be a non-empty string."
      );
    });
  });

  [null, [], {}, true, 1, 0, NaN, ""].forEach((invalidPriceId: any) => {
    it(`should throw when called with invalid priceId: ${JSON.stringify(
      invalidPriceId
    )}`, () => {
      expect(() => getPrice(payments, "productId", invalidPriceId)).toThrow(
        "priceId must be a non-empty string."
      );
    });
  });

  it("should return a price when called with valid product and price IDs", async () => {
    const fake = vi.fn().mockResolvedValue(premiumPlanPrice);
    setProductDAO(payments, testProductDAO("getPrice", fake));

    const price: Price = await getPrice(payments, "premium", "price1");

    expect(price).toEqual(premiumPlanPrice);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("premium", "price1");
  });

  it("should reject when the data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "not-found",
      "no such product"
    );
    const fake = vi.fn().mockRejectedValue(error);
    setProductDAO(payments, testProductDAO("getPrice", fake));

    await expect(getPrice(payments, "premium", "price1")).rejects.toThrow(error);

    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("premium", "price1");
  });
});

describe("getPrices()", () => {
  [null, [], {}, true, 1, 0, NaN, ""].forEach((invalidProductId: any) => {
    it(`should throw when called with invalid productId: ${JSON.stringify(
      invalidProductId
    )}`, () => {
      expect(() => getPrices(payments, invalidProductId)).toThrow(
        "productId must be a non-empty string."
      );
    });
  });

  it("should return prices as an array when the product has only one price", async () => {
    const expected: Price[] = [premiumPlanPrice];
    const fake = vi.fn().mockResolvedValue(expected);
    setProductDAO(payments, testProductDAO("getPrices", fake));

    const prices: Price[] = await getPrices(payments, "premium");

    expect(prices).toEqual(expected);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("premium", {
      assertProduct: true,
    });
  });

  it("should return prices as an array when the product has multiple prices", async () => {
    const expected: Price[] = [standardPlanPrice1, standardPlanPrice2];
    const fake = vi.fn().mockResolvedValue(expected);
    setProductDAO(payments, testProductDAO("getPrices", fake));

    const prices: Price[] = await getPrices(payments, "standard");

    expect(prices).toEqual(expected);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("standard", {
      assertProduct: true,
    });
  });

  it("should return empty array for product with no prices", async () => {
    const fake = vi.fn().mockResolvedValue([]);
    setProductDAO(payments, testProductDAO("getPrices", fake));

    const prices: Price[] = await getPrices(payments, "premium");

    expect(prices).toEqual([]);
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("premium", {
      assertProduct: true,
    });
  });

  it("should reject when the data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "not-found",
      "no such product"
    );
    const fake = vi.fn().mockRejectedValue(error);
    setProductDAO(payments, testProductDAO("getPrices", fake));

    await expect(getPrices(payments, "product1")).rejects.toThrow(error);

    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake).toHaveBeenCalledWith("product1", {
      assertProduct: true,
    });
  });
});

function testProductDAO(fakes: Record<string, any>): ProductDAO;
function testProductDAO(name: string, fake: any): ProductDAO;
function testProductDAO(
  nameOrFakes: string | Record<string, any>,
  fake?: any
): ProductDAO {
  if (typeof nameOrFakes === "string") {
    return {
      [nameOrFakes]: fake,
    } as unknown as ProductDAO;
  }

  return nameOrFakes as unknown as ProductDAO;
} 