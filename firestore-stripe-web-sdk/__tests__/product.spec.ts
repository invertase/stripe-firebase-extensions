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

import { describe, expect, it, vi } from "vitest";
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
    const fakes: Record<string, ReturnType<typeof vi.fn>> = {
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
    // Verify call order by checking mock call timestamps
    expect(fakes.getPrices.mock.invocationCallOrder[0]).toBeGreaterThan(
      fakes.getProduct.mock.invocationCallOrder[0]
    );
  });

  it("should return a product without prices when includePrices is set but the product has no prices", async () => {
    const fakes: Record<string, ReturnType<typeof vi.fn>> = {
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
    // Verify call order by checking mock call timestamps
    expect(fakes.getPrices.mock.invocationCallOrder[0]).toBeGreaterThan(
      fakes.getProduct.mock.invocationCallOrder[0]
    );
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
    const fakes: Record<string, ReturnType<typeof vi.fn>> = {
      getProducts: vi.fn().mockResolvedValue([economyPlan, premiumPlan, standardPlan]),
      getPrices: vi.fn().mockImplementation(getPricesForTest),
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
    // Verify call order by checking mock call timestamps
    expect(fakes.getPrices.mock.invocationCallOrder[0]).toBeGreaterThan(
      fakes.getProducts.mock.invocationCallOrder[0]
    );
    expect(fakes.getPrices).toHaveBeenNthCalledWith(1, "economy");
    expect(fakes.getPrices).toHaveBeenNthCalledWith(2, "premium");
    expect(fakes.getPrices).toHaveBeenNthCalledWith(3, "standard");
  });

  it("should return active products with prices when activeOnly and includePrices are set", async () => {
    const fakes: Record<string, ReturnType<typeof vi.fn>> = {
      getProducts: vi.fn().mockResolvedValue([premiumPlan, standardPlan]),
      getPrices: vi.fn().mockImplementation(getPricesForTest),
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
    expect(fakes.getProducts).toHaveBeenCalledWith({ activeOnly: true });
    expect(fakes.getPrices).toHaveBeenCalledTimes(2);
    // Verify call order by checking mock call timestamps
    expect(fakes.getPrices.mock.invocationCallOrder[0]).toBeGreaterThan(
      fakes.getProducts.mock.invocationCallOrder[0]
    );
    expect(fakes.getPrices).toHaveBeenNthCalledWith(1, "premium");
    expect(fakes.getPrices).toHaveBeenNthCalledWith(2, "standard");
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
    const fakes: Record<string, ReturnType<typeof vi.fn>> = {
      getProducts: vi.fn().mockResolvedValue([premiumPlan]),
      getPrices: vi.fn().mockImplementation(getPricesForTest),
    };
    setProductDAO(payments, testProductDAO(fakes));

    const products: Product[] = await getProducts(payments, {
      activeOnly: true,
      includePrices: true,
      limit: 1,
      where: [["metadata.firebaseRole", "==", "moderator"]],
    });

    const expected: Product[] = [
      { ...premiumPlan, prices: [premiumPlanPrice] },
    ];
    expect(products).toEqual(expected);
    expect(fakes.getProducts).toHaveBeenCalledTimes(1);
    expect(fakes.getProducts).toHaveBeenCalledWith({
      activeOnly: true,
      limit: 1,
      where: [["metadata.firebaseRole", "==", "moderator"]],
    });
    expect(fakes.getPrices).toHaveBeenCalledTimes(1);
    // Verify call order by checking mock call timestamps
    expect(fakes.getPrices.mock.invocationCallOrder[0]).toBeGreaterThan(
      fakes.getProducts.mock.invocationCallOrder[0]
    );
    expect(fakes.getPrices).toHaveBeenCalledWith("premium");
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
});

async function getPricesForTest(productId: string): Promise<Price[]> {
  switch (productId) {
    case "premium":
      return [premiumPlanPrice];
    case "standard":
      return [standardPlanPrice1, standardPlanPrice2];
    default:
      return [];
  }
}

function testProductDAO(fakes: Record<string, ReturnType<typeof vi.fn>>): ProductDAO;
function testProductDAO(name: string, fake: ReturnType<typeof vi.fn>): ProductDAO;
function testProductDAO(
  nameOrFakes: string | Record<string, ReturnType<typeof vi.fn>>,
  fake?: ReturnType<typeof vi.fn>
): ProductDAO {
  if (typeof nameOrFakes === "string") {
    return {
      [nameOrFakes]: fake,
    } as unknown as ProductDAO;
  }

  return nameOrFakes as unknown as ProductDAO;
}
