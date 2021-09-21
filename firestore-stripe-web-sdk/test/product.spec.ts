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
import * as chaiAsPromised from "chai-as-promised";
import * as sinon from "sinon";
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
  getProduct,
  getStripePayments,
  Price,
  Product,
  StripePayments,
  StripePaymentsError,
} from "../src/index";
import { ProductDAO, setProductDAO } from "../src/product";

use(chaiAsPromised);

const premiumPlan: Product = {
  active: true,
  customProperty: "customValue",
  description: "Product description",
  id: "premium",
  images: [],
  metadata: {
    firebaseRole: "moderator",
  },
  name: "Product name",
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
  [null, [], {}, true, 1, 0, NaN, "payments"].forEach(
    (invalidPayments: any) => {
      it(`should reject given invalid StripePayments: ${JSON.stringify(
        invalidPayments
      )}`, async () => {
        await expect(
          getProduct(invalidPayments, "productId")
        ).to.be.rejectedWith(
          "payments must be a valid StripePayments instance."
        );
      });
    }
  );

  [null, [], {}, true, 1, 0, NaN, ""].forEach((invalidProductId: any) => {
    it(`should reject given invalid productId: ${JSON.stringify(
      invalidProductId
    )}`, async () => {
      await expect(getProduct(payments, invalidProductId)).to.be.rejectedWith(
        "productId must be a non-empty string."
      );
    });
  });

  it("should return Product with the specified ID", async () => {
    const fake = sinon.fake.resolves(premiumPlan);
    setProductDAO(payments, testProductDAO("getProduct", fake));

    const product: Product = await getProduct(payments, "product1");

    expect(product).to.eql(premiumPlan);
    expect(fake.calledOnceWithExactly("product1")).to.be.ok;
  });

  it("should reject when the data access object throws", async () => {
    const error = new StripePaymentsError("not-found", "no such product");
    const fake = sinon.fake.rejects(error);
    setProductDAO(payments, testProductDAO("getProduct", fake));

    await expect(getProduct(payments, "product1")).to.be.rejectedWith(error);

    expect(fake.calledOnceWithExactly("product1")).to.be.ok;
  });
});

describe("getPrice()", () => {
  [null, [], {}, true, 1, 0, NaN, "payments"].forEach(
    (invalidPayments: any) => {
      it(`should reject given invalid StripePayments: ${JSON.stringify(
        invalidPayments
      )}`, async () => {
        await expect(
          getPrice(invalidPayments, "productId", "priceId")
        ).to.be.rejectedWith(
          "payments must be a valid StripePayments instance."
        );
      });
    }
  );

  [null, [], {}, true, 1, 0, NaN, ""].forEach((invalidProductId: any) => {
    it(`should reject given invalid productId: ${JSON.stringify(
      invalidProductId
    )}`, async () => {
      await expect(
        getPrice(payments, invalidProductId, "priceId")
      ).to.be.rejectedWith("productId must be a non-empty string.");
    });
  });

  [null, [], {}, true, 1, 0, NaN, ""].forEach((invalidPriceId: any) => {
    it(`should reject given invalid priceId: ${JSON.stringify(
      invalidPriceId
    )}`, async () => {
      await expect(
        getPrice(payments, "productId", invalidPriceId)
      ).to.be.rejectedWith("priceId must be a non-empty string.");
    });
  });

  it("should return Price with the specified ID", async () => {
    const fake = sinon.fake.resolves(premiumPlanPrice);
    setProductDAO(payments, testProductDAO("getPrice", fake));

    const price: Price = await getPrice(payments, "product1", "price1");

    expect(price).to.eql(premiumPlanPrice);
    expect(fake.calledOnceWithExactly("product1", "price1")).to.be.ok;
  });

  it("should reject when the data access object throws", async () => {
    const error = new StripePaymentsError("not-found", "no such product");
    const fake = sinon.fake.rejects(error);
    setProductDAO(payments, testProductDAO("getPrice", fake));

    await expect(getPrice(payments, "product1", "price1")).to.be.rejectedWith(
      error
    );

    expect(fake.calledOnceWithExactly("product1", "price1")).to.be.ok;
  });
});

function testProductDAO(name: string, fake: sinon.SinonSpy): ProductDAO {
  return ({
    [name]: fake,
  } as unknown) as ProductDAO;
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
      description: "Product description",
      images: [],
      metadata: {
        firebaseRole: "moderator",
      },
      name: "Product name",
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
    const db = getFirestore(emulatedApp);
    connectFirestoreEmulator(db, "localhost", 8080);

    for (const [productId, data] of Object.entries(rawTestData)) {
      await addProductData(db, productId, data);
    }
  });

  after(async () => {
    await deleteApp(emulatedApp);
  });

  describe("getProduct()", () => {
    it("should return Product with the specified ID", async () => {
      const product: Product = await getProduct(emulatedPayments, "premium");

      expect(product).to.eql(premiumPlan);
    });

    it("should reject with not-found error when the specified product does not exist", async () => {
      const err: any = await expect(
        getProduct(emulatedPayments, "product2")
      ).to.be.rejectedWith("No product found with the ID: product2");

      expect(err).to.be.instanceOf(StripePaymentsError);
      expect(err.code).to.equal("not-found");
      expect(err.cause).to.be.undefined;
    });
  });

  describe("getPrice()", () => {
    it("should return Price for the specified product and price ID", async () => {
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
