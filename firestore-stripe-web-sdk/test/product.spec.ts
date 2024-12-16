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

describe("getProduct()", () => {
  [null, [], {}, true, 1, 0, NaN, ""].forEach((invalidProductId: any) => {
    it(`should throw when called with invalid productId: ${JSON.stringify(
      invalidProductId
    )}`, () => {
      expect(() => getProduct(payments, invalidProductId)).to.throw(
        "productId must be a non-empty string."
      );
    });
  });

  it("should return a product when called with a valid productId", async () => {
    const fake: SinonSpy = sinonFake.resolves(premiumPlan);
    setProductDAO(payments, testProductDAO("getProduct", fake));

    const product: Product = await getProduct(payments, "premium");

    expect(product).to.eql(premiumPlan);
    expect(fake).to.have.been.calledOnceWithExactly("premium");
  });

  it("should return a product with prices when includePrices is set", async () => {
    const fakes: Record<string, SinonSpy> = {
      getProduct: sinonFake.resolves(premiumPlan),
      getPrices: sinonFake.resolves([premiumPlanPrice]),
    };
    setProductDAO(payments, testProductDAO(fakes));

    const product: Product = await getProduct(payments, "premium", {
      includePrices: true,
    });

    const expected: Product = { ...premiumPlan, prices: [premiumPlanPrice] };
    expect(product).to.eql(expected);
    expect(fakes.getProduct).to.have.been.calledOnceWithExactly("premium");
    expect(fakes.getPrices)
      .to.have.been.calledAfter(fakes.getProduct)
      .and.calledOnceWithExactly("premium");
  });

  it("should return a product without prices when includePrices is set but the product has no prices", async () => {
    const fakes: Record<string, SinonSpy> = {
      getProduct: sinonFake.resolves(economyPlan),
      getPrices: sinonFake.resolves([]),
    };
    setProductDAO(payments, testProductDAO(fakes));

    const product: Product = await getProduct(payments, "economy", {
      includePrices: true,
    });

    expect(product).to.eql(economyPlan);
    expect(fakes.getProduct).to.have.been.calledOnceWithExactly("economy");
    expect(fakes.getPrices)
      .to.have.been.calledAfter(fakes.getProduct)
      .and.calledOnceWithExactly("economy");
  });

  it("should reject when the data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "not-found",
      "no such product"
    );
    const fake: SinonSpy = sinonFake.rejects(error);
    setProductDAO(payments, testProductDAO("getProduct", fake));

    await expect(getProduct(payments, "product1")).to.be.rejectedWith(error);

    expect(fake).to.have.been.calledOnceWithExactly("product1");
  });
});

describe("getProducts()", () => {
  it("should return all products when called without options", async () => {
    const fake: SinonSpy = sinonFake.resolves([
      economyPlan,
      premiumPlan,
      standardPlan,
    ]);
    setProductDAO(payments, testProductDAO("getProducts", fake));

    const products: Product[] = await getProducts(payments);

    expect(products).to.eql([economyPlan, premiumPlan, standardPlan]);
    expect(fake).to.have.been.calledOnceWithExactly({});
  });

  it("should return empty array if no products are available", async () => {
    const fake: SinonSpy = sinonFake.resolves([]);
    setProductDAO(payments, testProductDAO("getProducts", fake));

    const products: Product[] = await getProducts(payments);

    expect(products).to.be.an("array").and.be.empty;
    expect(fake).to.have.been.calledOnceWithExactly({});
  });

  it("should only return active products when activeOnly is set", async () => {
    const fake: SinonSpy = sinonFake.resolves([premiumPlan, standardPlan]);
    setProductDAO(payments, testProductDAO("getProducts", fake));

    const products: Product[] = await getProducts(payments, {
      activeOnly: true,
    });

    expect(products).to.eql([premiumPlan, standardPlan]);
    expect(fake).to.have.been.calledOnceWithExactly({ activeOnly: true });
  });

  it("should return products with prices when includePrices is set", async () => {
    const fakes: Record<string, SinonSpy> = {
      getProducts: sinonFake.resolves([economyPlan, premiumPlan, standardPlan]),
      getPrices: sinonFake(getPricesForTest),
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
    expect(products).to.eql(expected);
    expect(fakes.getProducts).to.have.been.calledOnceWithExactly({});
    expect(fakes.getPrices).to.have.been.calledAfter(fakes.getProducts).and
      .calledThrice;
    expect(fakes.getPrices.firstCall).to.have.been.calledWithExactly("economy");
    expect(fakes.getPrices.secondCall).to.have.been.calledWithExactly(
      "premium"
    );
    expect(fakes.getPrices.thirdCall).to.have.been.calledWithExactly(
      "standard"
    );
  });

  it("should return active products with prices when activeOnly and includePrices are set", async () => {
    const fakes: Record<string, SinonSpy> = {
      getProducts: sinonFake.resolves([premiumPlan, standardPlan]),
      getPrices: sinonFake(getPricesForTest),
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
    expect(products).to.eql(expected);
    expect(fakes.getProducts).to.have.been.calledOnceWithExactly({
      activeOnly: true,
    });
    expect(fakes.getPrices).to.have.been.calledAfter(fakes.getProducts).and
      .calledTwice;
    expect(fakes.getPrices.firstCall).to.have.been.calledWithExactly("premium");
    expect(fakes.getPrices.secondCall).to.have.been.calledWithExactly(
      "standard"
    );
  });

  it("should return specified number of products when limit is set", async () => {
    const fake: SinonSpy = sinonFake.resolves([premiumPlan, standardPlan]);
    setProductDAO(payments, testProductDAO("getProducts", fake));

    const products: Product[] = await getProducts(payments, {
      limit: 2,
    });

    expect(products).to.eql([premiumPlan, standardPlan]);
    expect(fake).to.have.been.calledOnceWithExactly({ limit: 2 });
  });

  it("should return matching products when filters is set", async () => {
    const fake: SinonSpy = sinonFake.resolves([premiumPlan]);
    setProductDAO(payments, testProductDAO("getProducts", fake));

    const products: Product[] = await getProducts(payments, {
      where: [["metadata.firebaseRole", "==", "moderator"]],
    });

    expect(products).to.eql([premiumPlan]);
    expect(fake).to.have.been.calledOnceWithExactly({
      where: [["metadata.firebaseRole", "==", "moderator"]],
    });
  });

  it("should return a matching product array when called with all options", async () => {
    const fakes: Record<string, SinonSpy> = {
      getProducts: sinonFake.resolves([premiumPlan]),
      getPrices: sinonFake(getPricesForTest),
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
    expect(products).to.eql(expected);
    expect(fakes.getProducts).to.have.been.calledOnceWithExactly({
      activeOnly: true,
      where: [["metadata.firebaseRole", "==", "moderator"]],
      limit: 2,
    });
    expect(fakes.getPrices).to.have.been.calledAfter(fakes.getProducts).and
      .calledOnce;
    expect(fakes.getPrices.firstCall).to.have.been.calledWithExactly("premium");
  });

  it("should reject when the data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "not-found",
      "no such product"
    );
    const fake: SinonSpy = sinonFake.rejects(error);
    setProductDAO(payments, testProductDAO("getProducts", fake));

    await expect(getProducts(payments)).to.be.rejectedWith(error);

    expect(fake).to.have.been.calledOnceWithExactly({});
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
      expect(() => getPrice(payments, invalidProductId, "priceId")).to.throw(
        "productId must be a non-empty string."
      );
    });
  });

  [null, [], {}, true, 1, 0, NaN, ""].forEach((invalidPriceId: any) => {
    it(`should throw when called with invalid priceId: ${JSON.stringify(
      invalidPriceId
    )}`, () => {
      expect(() => getPrice(payments, "productId", invalidPriceId)).to.throw(
        "priceId must be a non-empty string."
      );
    });
  });

  it("should return a price when called with valid product and price IDs", async () => {
    const fake: SinonSpy = sinonFake.resolves(premiumPlanPrice);
    setProductDAO(payments, testProductDAO("getPrice", fake));

    const price: Price = await getPrice(payments, "premium", "price1");

    expect(price).to.eql(premiumPlanPrice);
    expect(fake).to.have.been.calledOnceWithExactly("premium", "price1");
  });

  it("should reject when the data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "not-found",
      "no such product"
    );
    const fake: SinonSpy = sinonFake.rejects(error);
    setProductDAO(payments, testProductDAO("getPrice", fake));

    await expect(getPrice(payments, "premium", "price1")).to.be.rejectedWith(
      error
    );

    expect(fake).to.have.been.calledOnceWithExactly("premium", "price1");
  });
});

describe("getPrices()", () => {
  [null, [], {}, true, 1, 0, NaN, ""].forEach((invalidProductId: any) => {
    it(`should throw when called with invalid productId: ${JSON.stringify(
      invalidProductId
    )}`, () => {
      expect(() => getPrices(payments, invalidProductId)).to.throw(
        "productId must be a non-empty string."
      );
    });
  });

  it("should return prices as an array when the product has only one price", async () => {
    const expected: Price[] = [premiumPlanPrice];
    const fake: SinonSpy = sinonFake.resolves(expected);
    setProductDAO(payments, testProductDAO("getPrices", fake));

    const prices: Price[] = await getPrices(payments, "premium");

    expect(prices).to.eql(expected);
    expect(fake).to.have.been.calledOnceWithExactly("premium", {
      assertProduct: true,
    });
  });

  it("should return prices as an array when the product has multiple prices", async () => {
    const expected: Price[] = [standardPlanPrice1, standardPlanPrice2];
    const fake: SinonSpy = sinonFake.resolves(expected);
    setProductDAO(payments, testProductDAO("getPrices", fake));

    const prices: Price[] = await getPrices(payments, "standard");

    expect(prices).to.eql(expected);
    expect(fake).to.have.been.calledOnceWithExactly("standard", {
      assertProduct: true,
    });
  });

  it("should return empty array for product with no prices", async () => {
    const fake: SinonSpy = sinonFake.resolves([]);
    setProductDAO(payments, testProductDAO("getPrices", fake));

    const prices: Price[] = await getPrices(payments, "premium");

    expect(prices).to.be.an("array").and.be.empty;
    expect(fake).to.have.been.calledOnceWithExactly("premium", {
      assertProduct: true,
    });
  });

  it("should reject when the data access object throws", async () => {
    const error: StripePaymentsError = new StripePaymentsError(
      "not-found",
      "no such product"
    );
    const fake: SinonSpy = sinonFake.rejects(error);
    setProductDAO(payments, testProductDAO("getPrices", fake));

    await expect(getPrices(payments, "product1")).to.be.rejectedWith(error);

    expect(fake).to.have.been.calledOnceWithExactly("product1", {
      assertProduct: true,
    });
  });
});

function testProductDAO(fakes: Record<string, SinonSpy>): ProductDAO;
function testProductDAO(name: string, fake: SinonSpy): ProductDAO;
function testProductDAO(
  nameOrFakes: string | Record<string, SinonSpy>,
  fake?: SinonSpy
): ProductDAO {
  if (typeof nameOrFakes === "string") {
    return {
      [nameOrFakes]: fake,
    } as unknown as ProductDAO;
  }

  return nameOrFakes as unknown as ProductDAO;
}
