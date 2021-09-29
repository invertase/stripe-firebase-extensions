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
  collectionGroup,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  DocumentChange,
  DocumentData,
  Firestore,
  getFirestore,
  onSnapshot,
  Query,
  setDoc,
  setLogLevel,
  Timestamp,
  Unsubscribe,
} from "@firebase/firestore";
import {
  createCheckoutSession,
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
import {
  Auth,
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  signOut,
} from "@firebase/auth";

use(require("chai-like"));

describe("Emulator tests", () => {
  const app: FirebaseApp = initializeApp({
    apiKey: "fake-api-key",
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

  describe("createCheckoutSession()", () => {
    let backend: ExtensionBackend;
    let currentUser: string = "";

    beforeEach(() => {
      backend = new ExtensionBackend(payments);
    });

    afterEach(async () => {
      await backend.tearDown();
    });

    context("without user signed in", () => {
      it("rejects when creating a new session", async () => {
        const err: any = await expect(
          createCheckoutSession(payments, {
            priceId: "foo",
          })
        ).to.be.rejectedWith(
          "Failed to determine currently signed in user. User not signed in."
        );

        expect(err).to.be.instanceOf(StripePaymentsError);
        expect(err.code).to.equal("unauthenticated");
        expect(err.cause).to.be.undefined;
      });
    });

    context("with user signed in", () => {
      const auth: Auth = getAuth(app);

      before(async () => {
        connectAuthEmulator(auth, "http://localhost:9099", {
          disableWarnings: true,
        });
        currentUser = (await signInAnonymously(auth)).user.uid;

        const db = getFirestore(app);
        await addUserData(db, currentUser);
      });

      after(async () => {
        await signOut(auth);
      });

      it("creates a session with defaults when only the priceId is specified", async () => {
        const session = await createCheckoutSession(payments, {
          priceId: "foo",
        });

        expect(backend.events).to.have.length(1);
        const { uid, docId, data, timestamp } = backend.events[0];
        expect(session).to.eql({
          cancelUrl: window.location.href,
          createdAt: timestamp.toDate().toUTCString(),
          id: `test_session_${docId}`,
          mode: "subscription",
          priceId: "foo",
          successUrl: window.location.href,
          url: `https://example.stripe.com/session/${docId}`,
        });
        expect(uid).to.equal(currentUser);
        expect(data).to.eql({
          cancel_url: window.location.href,
          mode: "subscription",
          price: "foo",
          success_url: window.location.href,
        });
      });

      it("creates a session with all the given parameters", async () => {
        const session = await createCheckoutSession(payments, {
          cancelUrl: "https://example.com/cancel",
          priceId: "foo",
          quantity: 5,
          successUrl: "https://example.com/success",
        });

        expect(backend.events).to.have.length(1);
        const { uid, docId, data, timestamp } = backend.events[0];
        expect(session).to.eql({
          cancelUrl: "https://example.com/cancel",
          createdAt: timestamp.toDate().toUTCString(),
          id: `test_session_${docId}`,
          mode: "subscription",
          priceId: "foo",
          quantity: 5,
          successUrl: "https://example.com/success",
          url: `https://example.stripe.com/session/${docId}`,
        });
        expect(uid).to.equal(currentUser);
        expect(data).to.eql({
          cancel_url: "https://example.com/cancel",
          mode: "subscription",
          price: "foo",
          quantity: 5,
          success_url: "https://example.com/success",
        });
      });
    });
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
      const products: Product[] = await getProducts(payments, {
        activeOnly: true,
      });

      expect(products).to.eql([premiumPlan, standardPlan]);
    });

    it("should return products with prices when includePrices is set", async () => {
      const products: Product[] = await getProducts(payments, {
        includePrices: true,
      });

      const expected: Product[] = [
        economyPlan,
        { ...premiumPlan, prices: [premiumPlanPrice] },
        { ...standardPlan, prices: [standardPlanPrice1, standardPlanPrice2] },
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
        { ...standardPlan, prices: [standardPlanPrice1, standardPlanPrice2] },
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

  async function addUserData(db: Firestore, uid: string): Promise<void> {
    await setDoc(doc(db, payments.customersCollection, uid), { uid });
  }
});

interface Event {
  readonly uid: string;
  readonly docId: string;
  readonly data: DocumentData;
  readonly timestamp: Timestamp;
}

class ExtensionBackend {
  public readonly events: Event[] = [];
  private readonly cancel: Unsubscribe;

  constructor(private readonly payments: StripePayments) {
    this.cancel = this.initCreateCheckoutSessionTrigger();
  }

  public async tearDown(): Promise<void> {
    this.cancel();
    const db: Firestore = getFirestore(this.payments.app);
    for (const event of this.events) {
      const docRef = doc(
        db,
        this.payments.customersCollection,
        event.uid,
        "checkout_sessions",
        event.docId
      );
      await deleteDoc(docRef);
    }
  }

  private initCreateCheckoutSessionTrigger(): Unsubscribe {
    const db: Firestore = getFirestore(this.payments.app);
    const sessions: Query = collectionGroup(db, "checkout_sessions");
    return onSnapshot(sessions, async (snap) => {
      const promises: Promise<void>[] = [];
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          promises.push(this.onSessionCreate(change));
        }
      });

      await Promise.all(promises);
    });
  }

  private async onSessionCreate(change: DocumentChange): Promise<void> {
    const timestamp: Timestamp = Timestamp.now();
    const docId = change.doc.id;
    this.events.push({
      uid: change.doc.ref.parent.parent!.id,
      docId,
      data: change.doc.data(),
      timestamp,
    });
    await setDoc(
      change.doc.ref,
      {
        sessionId: `test_session_${docId}`,
        url: `https://example.stripe.com/session/${docId}`,
        created: timestamp,
      },
      { merge: true }
    );
  }
}
