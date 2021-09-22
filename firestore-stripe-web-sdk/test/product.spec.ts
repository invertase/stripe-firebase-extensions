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
  getStripePayments,
  Price,
  Product,
  StripePayments,
  StripePaymentsError,
} from "../src/index";
import { ProductDAO, setProductDAO } from "../src/product";

use(require("chai-as-promised"));
use(require("chai-like"));
use(require("sinon-chai"));

const premiumPlan: Product = {
  active: true,
  customProperty: "customValue",
  description: "Access to all our content",
  id: "premium",
  images: [],
  metadata: {
    firebaseRole: "moderator",
  },
  name: "Premium plan",
  prices: [],
  role: "moderator",
};

const premiumPlanPrice: Price = {
  active: true,
  customProperty: "customValue",
  currency: "usd",
  description: "Test price 1",
  id: "price1",
  interval: "month",
  intervalCount: null,
  productId: "premium",
  trialPeriodDays: null,
  type: "recurring",
  unitAmount: 999,
};

const standardPlanPrice1: Price = {
  active: true,
  currency: "usd",
  description: "Test price 1",
  id: "price1",
  interval: "month",
  intervalCount: null,
  productId: "standard",
  trialPeriodDays: null,
  type: "recurring",
  unitAmount: 899,
};

const standardPlanPrice2: Price = {
  active: true,
  currency: "usd",
  description: "Test price 1",
  id: "price2",
  interval: "year",
  intervalCount: null,
  productId: "standard",
  trialPeriodDays: null,
  type: "recurring",
  unitAmount: 9999,
};

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

/**
 * An interface for raw product data stored in Firestore. Each product is saved as a separate
 * document in the `productsCollection`. Each product can have 0 or more prices stored in
 * the `prices` subcollection.
 */
interface ProductData {
  product: Record<string, any>;
  prices: Record<string, Record<string, any>>;
}

const rawTestData: Record<string, ProductData> = {
  premium: {
    product: {
      active: true,
      customProperty: "customValue",
      description: "Access to all our content",
      images: [],
      metadata: {
        firebaseRole: "moderator",
      },
      name: "Premium plan",
      role: "moderator",
    },
    prices: {
      price1: {
        active: true,
        customProperty: "customValue",
        currency: "usd",
        description: "Test price 1",
        interval: "month",
        interval_count: null,
        trial_period_days: null,
        type: "recurring",
        unit_amount: 999,
      },
    },
  },
  standard: {
    product: {
      active: true,
      description: "Product description",
      images: [],
      metadata: {},
      name: "Product name",
      role: null,
    },
    prices: {
      price1: {
        active: true,
        currency: "usd",
        description: "Test price 1",
        interval: "month",
        interval_count: null,
        trial_period_days: null,
        type: "recurring",
        unit_amount: 899,
      },
      price2: {
        active: true,
        currency: "usd",
        description: "Test price 1",
        interval: "year",
        interval_count: null,
        trial_period_days: null,
        type: "recurring",
        unit_amount: 9999,
      },
    },
  },
  test: {
    product: {
      active: true,
      description: "Product description",
      images: [],
      metadata: {},
      name: "Product name",
      role: null,
    },
    prices: {},
  },
};

describe("Product emulator tests", () => {
  const emulatedApp: FirebaseApp = initializeApp({
    projectId: "fake-project-id",
  });

  const emulatedPayments: StripePayments = getStripePayments(emulatedApp, {
    customersCollection: "customers",
    productsCollection: "products",
  });

  before(async () => {
    const db: Firestore = getFirestore(emulatedApp);
    connectFirestoreEmulator(db, "localhost", 8080);

    for (const [productId, data] of Object.entries(rawTestData)) {
      await addProductData(db, productId, data);
    }
  });

  after(async () => {
    await deleteApp(emulatedApp);
  });

  describe("getProduct()", () => {
    it("should return product with the specified ID", async () => {
      const product: Product = await getProduct(emulatedPayments, "premium");

      expect(product).to.eql(premiumPlan);
    });

    it("should return product with prices when includePrices is set", async () => {
      const product: Product = await getProduct(emulatedPayments, "premium", {
        includePrices: true,
      });

      const expected: Product = { ...premiumPlan, prices: [premiumPlanPrice] };
      expect(product).to.be.like(expected);
    });

    it("should reject with not-found error when the specified product does not exist", async () => {
      const err: any = await expect(
        getProduct(emulatedPayments, "unavailable")
      ).to.be.rejectedWith("No product found with the ID: unavailable");

      expect(err).to.be.instanceOf(StripePaymentsError);
      expect(err.code).to.equal("not-found");
      expect(err.cause).to.be.undefined;
    });
  });

  describe("getPrice()", () => {
    it("should return price for the specified product and price ID", async () => {
      const price: Price = await getPrice(
        emulatedPayments,
        "premium",
        "price1"
      );

      expect(price).to.include(premiumPlanPrice);
    });

    it("should reject with not-found when the specified product does not exist", async () => {
      const err: any = await expect(
        getPrice(emulatedPayments, "unavailable", "price1")
      ).to.be.rejectedWith(
        "No price found with the product ID: unavailable and price ID: price1"
      );

      expect(err).to.be.instanceOf(StripePaymentsError);
      expect(err.code).to.equal("not-found");
      expect(err.cause).to.be.undefined;
    });

    it("should reject with not-found when the specified price does not exist", async () => {
      const err: any = await expect(
        getPrice(emulatedPayments, "premium", "unavailable")
      ).to.be.rejectedWith(
        "No price found with the product ID: premium and price ID: unavailable"
      );

      expect(err).to.be.instanceOf(StripePaymentsError);
      expect(err.code).to.equal("not-found");
      expect(err.cause).to.be.undefined;
    });
  });

  describe("getPrices()", () => {
    it("should return the only price as an array for the specified product ID", async () => {
      const prices: Price[] = await getPrices(emulatedPayments, "premium");

      expect(prices)
        .to.be.an("array")
        .of.length(1)
        .and.be.like([premiumPlanPrice]);
    });

    it("should return prices as an array for the specified product ID", async () => {
      const prices: Price[] = await getPrices(emulatedPayments, "standard");

      expect(prices)
        .to.be.an("array")
        .of.length(2)
        .and.be.like([standardPlanPrice1, standardPlanPrice2]);
    });

    it("should return empty array for existing product with no prices", async () => {
      const prices: Price[] = await getPrices(emulatedPayments, "test");

      expect(prices).to.be.an("array").and.be.empty;
    });

    it("should reject with not-found when the specified product does not exist", async () => {
      const err: any = await expect(
        getPrices(emulatedPayments, "unavailable")
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
