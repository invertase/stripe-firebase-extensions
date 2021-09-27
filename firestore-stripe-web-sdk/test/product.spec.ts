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
import { fake as sinonFake, SinonSpy } from "sinon";
import { FirebaseApp } from "@firebase/app";
import {
  getPrice,
  getPrices,
  getProduct,
  getStripePayments,
  Price,
  Product,
  StripePayments,
  StripePaymentsError,
} from "../src/index";
import { ProductDAO, setProductDAO } from "../src/product";
import {
  premiumPlan,
  premiumPlanPrice,
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
    it(`should throw given invalid productId: ${JSON.stringify(
      invalidProductId
    )}`, () => {
      expect(() => getProduct(payments, invalidProductId)).to.throw(
        "productId must be a non-empty string."
      );
    });
  });

  it("should return product with the specified ID", async () => {
    const fake: SinonSpy = sinonFake.resolves(premiumPlan);
    setProductDAO(payments, testProductDAO("getProduct", fake));

    const product: Product = await getProduct(payments, "premium");

    expect(product).to.eql(premiumPlan);
    expect(fake).to.have.been.calledOnceWithExactly("premium");
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

  context("when includePrices is set", () => {
    it("should return product with prices", async () => {
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

    it("should return product with empty prices if the product does not have prices", async () => {
      const fakes: Record<string, SinonSpy> = {
        getProduct: sinonFake.resolves(premiumPlan),
        getPrices: sinonFake.resolves([]),
      };
      setProductDAO(payments, testProductDAO(fakes));

      const product: Product = await getProduct(payments, "premium", {
        includePrices: true,
      });

      expect(product).to.eql(premiumPlan);
      expect(fakes.getProduct).to.have.been.calledOnceWithExactly("premium");
      expect(fakes.getPrices)
        .to.have.been.calledAfter(fakes.getProduct)
        .and.calledOnceWithExactly("premium");
    });
  });
});

describe("getPrice()", () => {
  [null, [], {}, true, 1, 0, NaN, ""].forEach((invalidProductId: any) => {
    it(`should throw given invalid productId: ${JSON.stringify(
      invalidProductId
    )}`, () => {
      expect(() => getPrice(payments, invalidProductId, "priceId")).to.throw(
        "productId must be a non-empty string."
      );
    });
  });

  [null, [], {}, true, 1, 0, NaN, ""].forEach((invalidPriceId: any) => {
    it(`should throw given invalid priceId: ${JSON.stringify(
      invalidPriceId
    )}`, () => {
      expect(() => getPrice(payments, "productId", invalidPriceId)).to.throw(
        "priceId must be a non-empty string."
      );
    });
  });

  it("should return price with the specified ID", async () => {
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
    it(`should throw given invalid productId: ${JSON.stringify(
      invalidProductId
    )}`, () => {
      expect(() => getPrices(payments, invalidProductId)).to.throw(
        "productId must be a non-empty string."
      );
    });
  });

  it("should return prices as an array for the specified product ID", async () => {
    const expected: Price[] = [standardPlanPrice1, standardPlanPrice2];
    const fake: SinonSpy = sinonFake.resolves(expected);
    setProductDAO(payments, testProductDAO("getPrices", fake));

    const prices: Price[] = await getPrices(payments, "premium");

    expect(prices).to.eql(expected);
    expect(fake).to.have.been.calledOnceWithExactly("premium", {
      assertProduct: true,
    });
  });

  it("should return empty array for existing product with no prices", async () => {
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
    return ({
      [nameOrFakes]: fake,
    } as unknown) as ProductDAO;
  }

  return (nameOrFakes as unknown) as ProductDAO;
}
