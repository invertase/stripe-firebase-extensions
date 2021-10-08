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
import { deleteApp, FirebaseApp, initializeApp } from "@firebase/app";
import {
  collection,
  collectionGroup,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  DocumentChange,
  DocumentData,
  DocumentReference,
  Firestore,
  getDocs,
  getFirestore,
  onSnapshot,
  Query,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  WriteBatch,
  writeBatch,
} from "@firebase/firestore";
import {
  createCheckoutSession,
  getCurrentUserSubscription,
  getCurrentUserSubscriptions,
  getPrice,
  getPrices,
  getProduct,
  getProducts,
  getStripePayments,
  onCurrentUserSubscriptionUpdate,
  Price,
  Product,
  Subscription,
  SubscriptionSnapshot,
  StripePayments,
  StripePaymentsError,
} from "../src/index";
import {
  economyPlan,
  premiumPlan,
  premiumPlanPrice,
  ProductData,
  rawProductData,
  rawSubscriptionData,
  standardPlan,
  standardPlanPrice1,
  standardPlanPrice2,
  subscription1,
  subscription2,
  subscription3,
  SubscriptionData,
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

  const db: Firestore = getFirestore(app);
  const auth: Auth = getAuth(app);

  before(async () => {
    connectFirestoreEmulator(db, "localhost", 8080);
    connectAuthEmulator(auth, "http://localhost:9099", {
      disableWarnings: true,
    });

    for (const [productId, data] of Object.entries(rawProductData)) {
      await addProductData(productId, data);
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
      before(async () => {
        currentUser = (await signInAnonymously(auth)).user.uid;
        await addUserData(currentUser);
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

      it("rejects with deadline-exceeded when the timeout has expired", async () => {
        // Backend trigger is already initialized above in beforeEach.
        // Teardown it here so the session will never get created.
        await backend.tearDown();

        const err: any = await expect(
          createCheckoutSession(
            payments,
            { priceId: "foo" },
            { timeoutMillis: 10 }
          )
        ).to.be.rejectedWith("Timeout while waiting for session response.");

        expect(err).to.be.instanceOf(StripePaymentsError);
        expect(err.code).to.equal("deadline-exceeded");
        expect(err.cause).to.be.undefined;
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

  describe("getCurrentUserSubscription()", () => {
    let currentUser: string = "";

    context("without user signed in", () => {
      it("rejects when fetching a subscription", async () => {
        const err: any = await expect(
          getCurrentUserSubscription(payments, "sub1")
        ).to.be.rejectedWith(
          "Failed to determine currently signed in user. User not signed in."
        );

        expect(err).to.be.instanceOf(StripePaymentsError);
        expect(err.code).to.equal("unauthenticated");
        expect(err.cause).to.be.undefined;
      });
    });

    context("with user signed in", () => {
      before(async () => {
        currentUser = (await signInAnonymously(auth)).user.uid;
        await addUserData(currentUser);
        await addSubscriptionData(currentUser, rawSubscriptionData);
      });

      after(async () => {
        await signOut(auth);
      });

      it("should return a subscription when called with a valid subscriptionId", async () => {
        const sub: Subscription = await getCurrentUserSubscription(
          payments,
          "sub1"
        );

        const expected: Subscription = { ...subscription1, uid: currentUser };
        expect(sub).to.eql(expected);
      });

      it("should return a fully populated subscription when available", async () => {
        const sub: Subscription = await getCurrentUserSubscription(
          payments,
          "sub2"
        );

        const expected: Subscription = { ...subscription2, uid: currentUser };
        expect(sub).to.eql(expected);
      });

      it("should reject with not-found error when the specified subscription does not exist", async () => {
        const err: any = await expect(
          getCurrentUserSubscription(payments, "unavailable")
        ).to.be.rejectedWith(
          `No subscription found with the ID: unavailable for user: ${currentUser}`
        );

        expect(err).to.be.instanceOf(StripePaymentsError);
        expect(err.code).to.equal("not-found");
        expect(err.cause).to.be.undefined;
      });
    });
  });

  describe("getCurrentUserSubscriptions()", () => {
    context("without user signed in", () => {
      it("rejects when fetching a subscription", async () => {
        const err: any = await expect(
          getCurrentUserSubscriptions(payments)
        ).to.be.rejectedWith(
          "Failed to determine currently signed in user. User not signed in."
        );

        expect(err).to.be.instanceOf(StripePaymentsError);
        expect(err.code).to.equal("unauthenticated");
        expect(err.cause).to.be.undefined;
      });
    });

    context("with user signed in", () => {
      let currentUser: string = "";

      before(async () => {
        currentUser = (await signInAnonymously(auth)).user.uid;
        await addUserData(currentUser);
        await addSubscriptionData(currentUser, rawSubscriptionData);
      });

      after(async () => {
        await signOut(auth);
      });

      it("should return all subscriptions when called without options", async () => {
        const subs: Subscription[] = await getCurrentUserSubscriptions(
          payments
        );

        const expected: Subscription[] = [
          { ...subscription1, uid: currentUser },
          { ...subscription2, uid: currentUser },
          { ...subscription3, uid: currentUser },
        ];
        expect(subs).to.eql(expected);
      });

      it("should only return subscriptions with the given status", async () => {
        const subs: Subscription[] = await getCurrentUserSubscriptions(
          payments,
          {
            status: "active",
          }
        );

        const expected: Subscription[] = [
          { ...subscription1, uid: currentUser },
        ];
        expect(subs).to.eql(expected);
      });

      it("should only return subscriptions with the given statuses", async () => {
        const subs: Subscription[] = await getCurrentUserSubscriptions(
          payments,
          {
            status: ["active", "incomplete"],
          }
        );

        const expected: Subscription[] = [
          { ...subscription1, uid: currentUser },
          { ...subscription2, uid: currentUser },
        ];
        expect(subs).to.eql(expected);
      });
    });
  });

  describe("onCurrentUserSubscriptionUpdate()", () => {
    context("without user signed in", () => {
      it("throws when registering a listener", async () => {
        expect(() =>
          onCurrentUserSubscriptionUpdate(
            payments,
            (snap: SubscriptionSnapshot) => {}
          )
        ).to.throw(
          "Failed to determine currently signed in user. User not signed in."
        );
      });
    });

    context("with user signed in", () => {
      let currentUser: string = "";
      let cancelers: Array<() => void> = [];

      before(async () => {
        currentUser = (await signInAnonymously(auth)).user.uid;
        await addUserData(currentUser);
      });

      after(async () => {
        await signOut(auth);
      });

      beforeEach(async () => {
        await addSubscriptionData(currentUser, rawSubscriptionData);
      });

      afterEach(async () => {
        cancelers.forEach((cancel) => {
          cancel();
        });
        cancelers = [];

        await deleteSubscriptions(currentUser);
      });

      it("should fire an event with all existing subscriptions", async () => {
        const events: SubscriptionSnapshot[] = [];

        const cancel = onCurrentUserSubscriptionUpdate(payments, (snapshot) => {
          events.push(snapshot);
        });
        cancelers.push(cancel);
        await until(() => events.length > 0);

        expect(events.length).to.equal(1);
        expect(events[0]).to.eql({
          subscriptions: [
            { ...subscription1, uid: currentUser },
            { ...subscription2, uid: currentUser },
            { ...subscription3, uid: currentUser },
          ],
          changes: [
            {
              type: "added",
              subscription: { ...subscription1, uid: currentUser },
            },
            {
              type: "added",
              subscription: { ...subscription2, uid: currentUser },
            },
            {
              type: "added",
              subscription: { ...subscription3, uid: currentUser },
            },
          ],
          size: 3,
          empty: false,
        });
      });

      it("should fire an event with empty snapshot when no subscriptions are present", async () => {
        await deleteSubscriptions(currentUser);
        const events: SubscriptionSnapshot[] = [];

        const cancel = onCurrentUserSubscriptionUpdate(payments, (snapshot) => {
          events.push(snapshot);
        });
        cancelers.push(cancel);
        await until(() => events.length > 0);

        expect(events.length).to.equal(1);
        expect(events[0]).to.eql({
          subscriptions: [],
          changes: [],
          size: 0,
          empty: true,
        });
      });

      it("should fire an event for each subscription update", async () => {
        const events: SubscriptionSnapshot[] = [];

        const cancel = onCurrentUserSubscriptionUpdate(payments, (snapshot) => {
          events.push(snapshot);
        });
        cancelers.push(cancel);
        await until(() => events.length > 0);

        expect(events.length).to.equal(1);

        const sub2: DocumentReference = doc(
          db,
          "customers",
          currentUser,
          "subscriptions",
          "sub2"
        );
        await updateDoc(sub2, { status: "active" });
        await until(() => events.length > 1);

        expect(events.length).to.equal(2);
        expect(events[1]).to.eql({
          subscriptions: [
            { ...subscription1, uid: currentUser },
            { ...subscription2, uid: currentUser, status: "active" },
            { ...subscription3, uid: currentUser },
          ],
          changes: [
            {
              type: "modified",
              subscription: {
                ...subscription2,
                uid: currentUser,
                status: "active",
              },
            },
          ],
          size: 3,
          empty: false,
        });

        const sub3: DocumentReference = doc(
          db,
          "customers",
          currentUser,
          "subscriptions",
          "sub3"
        );
        await updateDoc(sub3, { status: "active" });
        await until(() => events.length > 2);

        expect(events.length).to.equal(3);
        expect(events[2]).to.eql({
          subscriptions: [
            { ...subscription1, uid: currentUser },
            { ...subscription2, uid: currentUser, status: "active" },
            { ...subscription3, uid: currentUser, status: "active" },
          ],
          changes: [
            {
              type: "modified",
              subscription: {
                ...subscription3,
                uid: currentUser,
                status: "active",
              },
            },
          ],
          size: 3,
          empty: false,
        });
      });

      it("should fire an event when a subscription is created", async () => {
        const events: SubscriptionSnapshot[] = [];

        const cancel = onCurrentUserSubscriptionUpdate(payments, (snapshot) => {
          events.push(snapshot);
        });
        cancelers.push(cancel);
        await until(() => events.length > 0);

        const sub4: DocumentReference = doc(
          db,
          "customers",
          currentUser,
          "subscriptions",
          "sub4"
        );
        await setDoc(sub4, buildSubscriptionDocument(rawSubscriptionData.sub1));
        await until(() => events.length > 1);

        expect(events.length).to.equal(2);
        expect(events[1]).to.eql({
          subscriptions: [
            { ...subscription1, uid: currentUser },
            { ...subscription2, uid: currentUser },
            { ...subscription3, uid: currentUser },
            { ...subscription1, uid: currentUser, id: "sub4" },
          ],
          changes: [
            {
              type: "added",
              subscription: { ...subscription1, uid: currentUser, id: "sub4" },
            },
          ],
          size: 4,
          empty: false,
        });
      });

      it("should fire an event when a subscription is deleted", async () => {
        const events: SubscriptionSnapshot[] = [];
        const cancel = onCurrentUserSubscriptionUpdate(
          payments,
          (subscriptions) => {
            events.push(subscriptions);
          }
        );
        cancelers.push(cancel);
        await until(() => events.length > 0);

        const sub3: DocumentReference = doc(
          db,
          "customers",
          currentUser,
          "subscriptions",
          "sub3"
        );
        await deleteDoc(sub3);
        await until(() => events.length > 1);

        expect(events.length).to.equal(2);
        expect(events[1]).to.eql({
          subscriptions: [
            { ...subscription1, uid: currentUser },
            { ...subscription2, uid: currentUser },
          ],
          changes: [
            {
              type: "removed",
              subscription: { ...subscription3, uid: currentUser },
            },
          ],
          size: 2,
          empty: false,
        });
      });

      async function until(
        predicate: () => boolean,
        intervalMillis: number = 50,
        timeoutMillis: number = 5 * 1000
      ) {
        const start = Date.now();
        let done = false;
        // If the condition is already met, return without any delay.
        if (predicate()) {
          return;
        }

        // If not, start polling for the condition.
        do {
          await new Promise((resolve) => setTimeout(resolve, intervalMillis));
          if (predicate()) {
            done = true;
          } else if (Date.now() > start + timeoutMillis) {
            throw new Error(
              `Timed out waiting for predicate after ${timeoutMillis} ms.`
            );
          }
        } while (!done);
      }
    });
  });

  async function addProductData(
    productId: string,
    data: ProductData
  ): Promise<void> {
    const batch: WriteBatch = writeBatch(db);
    batch.set(doc(db, payments.productsCollection, productId), data.product);
    for (const [priceId, price] of Object.entries(data.prices)) {
      batch.set(
        doc(db, payments.productsCollection, productId, "prices", priceId),
        price
      );
    }

    await batch.commit();
  }

  async function addUserData(uid: string): Promise<void> {
    await setDoc(doc(db, payments.customersCollection, uid), { uid });
  }

  async function addSubscriptionData(
    uid: string,
    data: SubscriptionData
  ): Promise<void> {
    const batch: WriteBatch = writeBatch(db);
    for (const [id, subscription] of Object.entries(data)) {
      batch.set(
        doc(db, "customers", uid, "subscriptions", id),
        buildSubscriptionDocument(subscription)
      );
    }

    await batch.commit();
  }

  async function deleteSubscriptions(uid: string): Promise<void> {
    const subs = await getDocs(
      collection(db, "customers", uid, "subscriptions")
    );
    const batch: WriteBatch = writeBatch(db);
    subs.forEach((sub) => {
      batch.delete(sub.ref);
    });

    await batch.commit();
  }

  function buildSubscriptionDocument(
    subscription: Record<string, any>
  ): DocumentData {
    const prices: DocumentReference[] = subscription.prices.map(
      (item: { product: string; price: string }) =>
        doc(db, "products", item.product, "prices", item.price)
    );
    return {
      ...subscription,
      product: doc(db, "products", subscription.product),
      price: doc(
        db,
        "products",
        subscription.product,
        "prices",
        subscription.price
      ),
      prices,
    };
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
