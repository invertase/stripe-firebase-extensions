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
  getFirestore,
  setDoc,
} from "@firebase/firestore";
import {
  getProduct,
  getStripePayments,
  Product,
  StripePayments,
  StripePaymentsError,
} from "../src/index";
import { ProductDAO, setProductDAO } from "../src/product";

use(chaiAsPromised);

const testProduct: Product = {
  id: "product1",
  prices: [],
  active: true,
  name: "Product name",
  description: "Product description",
  role: "moderator",
  images: [],
  metadata: {
    firebaseRole: "moderator",
  },
};

describe("getProduct()", () => {
  const app: FirebaseApp = {
    name: "mock",
    options: {},
    automaticDataCollectionEnabled: false,
  };
  const payments: StripePayments = getStripePayments(app, {
    customersCollection: "customers",
    productsCollection: "products",
  });

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
    const fake = sinon.fake.resolves(testProduct);
    setProductDAO(payments, testProductDAO("getProduct", fake));

    const product: Product = await getProduct(payments, "product1");

    expect(product).to.eql(testProduct);
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

function testProductDAO(name: string, fake: sinon.SinonSpy): ProductDAO {
  return ({
    [name]: fake,
  } as unknown) as ProductDAO;
}

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
    const docRef = doc(db, emulatedPayments.productsCollection, "product1");
    const { id, prices, ...rest } = testProduct;
    await setDoc(docRef, rest);
  });

  after(async () => {
    await deleteApp(emulatedApp);
  });

  describe("getProduct()", () => {
    it("should return Product with the specified ID", async () => {
      const product: Product = await getProduct(emulatedPayments, "product1");

      expect(product).to.eql(testProduct);
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
});
