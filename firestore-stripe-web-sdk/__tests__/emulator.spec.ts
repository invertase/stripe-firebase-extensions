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

import { describe, expect, it, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
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
  getCurrentUserPayment,
  getCurrentUserPayments,
  getCurrentUserSubscription,
  getCurrentUserSubscriptions,
  getPrice,
  getPrices,
  getProduct,
  getProducts,
  getStripePayments,
  onCurrentUserPaymentUpdate,
  onCurrentUserSubscriptionUpdate,
  LineItemParams,
  Payment,
  PaymentSnapshot,
  Price,
  Product,
  Subscription,
  SubscriptionSnapshot,
  StripePayments,
  StripePaymentsError,
} from "../src/index";
import {
  economyPlan,
  payment1,
  payment2,
  payment3,
  PaymentData,
  premiumPlan,
  premiumPlanPrice,
  ProductData,
  rawPaymentData,
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

describe("Emulator tests", () => {
  const app: FirebaseApp = initializeApp({
    apiKey: "fake-api-key",
    projectId: "demo-project",
  });

  const payments: StripePayments = getStripePayments(app, {
    customersCollection: "customers",
    productsCollection: "products",
  });

  const db: Firestore = getFirestore(app);
  const auth: Auth = getAuth(app);

  beforeAll(async () => {
    connectFirestoreEmulator(db, "localhost", 8080);
    connectAuthEmulator(auth, "http://localhost:9099", {
      disableWarnings: true,
    });
    for (const [productId, data] of Object.entries(rawProductData)) {
      await addProductData(productId, data);
    }
  });

  afterAll(async () => {
    await deleteApp(app);
  });

  describe("getProduct()", () => {
    it("should return a product when called with a valid productId", async () => {
      const product: Product = await getProduct(payments, "premium");

      expect(product).toEqual(premiumPlan);
    });

    it("should return a product with prices when includePrices is set", async () => {
      const product: Product = await getProduct(payments, "premium", {
        includePrices: true,
      });

      const expected: Product = { ...premiumPlan, prices: [premiumPlanPrice] };
      expect(product).toEqual(expected);
    });

    it("should reject with not-found error when the specified product does not exist", async () => {
      await expect(
        getProduct(payments, "unavailable")
      ).rejects.toThrow("No product found with the ID: unavailable");

      const err = await getProduct(payments, "unavailable").catch(e => e);
      expect(err).toBeInstanceOf(StripePaymentsError);
      expect(err.code).toBe("not-found");
      expect(err.cause).toBeUndefined();
    });
  });

  describe("getProducts()", () => {
    it("should return all products when called without options", async () => {
      const products: Product[] = await getProducts(payments);

      expect(products).toEqual([economyPlan, premiumPlan, standardPlan]);
    });

    it("should only return active products when activeOnly is set", async () => {
      const products: Product[] = await getProducts(payments, {
        activeOnly: true,
      });

      expect(products).toEqual([premiumPlan, standardPlan]);
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
      expect(products).toHaveLength(3);
      expect(products).toEqual(expected);
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
      expect(products).toHaveLength(2);
      expect(products).toEqual(expected);
    });

    it("should return the specified number of products when limit set", async () => {
      const products: Product[] = await getProducts(payments, {
        limit: 2,
      });

      expect(products).toEqual([economyPlan, premiumPlan]);
    });

    it("should return the specified number of active products when limit and activeOnly are set", async () => {
      const products: Product[] = await getProducts(payments, {
        activeOnly: true,
        limit: 1,
      });

      expect(products).toEqual([premiumPlan]);
    });

    it("should return the matching products when filters is set", async () => {
      const products: Product[] = await getProducts(payments, {
        where: [["metadata.firebaseRole", "==", "moderator"]],
      });

      expect(products).toEqual([premiumPlan]);
    });

    it("should return no products when the filters don't match anything", async () => {
      const products: Product[] = await getProducts(payments, {
        where: [
          ["metadata.firebaseRole", "==", "moderator"],
          ["metadata.type", "==", "books"],
        ],
      });

      expect(products).toHaveLength(0);
    });

    it("should reject when the provided filters are Firestore incompatible", async () => {
      await expect(
        getProducts(payments, {
          where: [
            ["metadata.foo", ">", 10],
            ["metadata.bar", ">", 20],
          ],
        })
      ).rejects.toThrow("Unexpected error while querying Firestore");

      const err = await getProducts(payments, {
        where: [
          ["metadata.foo", ">", 10],
          ["metadata.bar", ">", 20],
        ],
      }).catch(e => e);
      expect(err).toBeInstanceOf(StripePaymentsError);
      expect(err.code).toBe("internal");
      expect(err.cause).toBeTruthy();
    });
  });

  describe("getPrice()", () => {
    it("should return a price when called with valid product and price IDs", async () => {
      const price: Price = await getPrice(payments, "premium", "price1");

      expect(price).toEqual(premiumPlanPrice);
    });

    it("should reject with not-found when the specified product does not exist", async () => {
      await expect(
        getPrice(payments, "unavailable", "price1")
      ).rejects.toThrow("No price found with the product ID: unavailable and price ID: price1");

      const err = await getPrice(payments, "unavailable", "price1").catch(e => e);
      expect(err).toBeInstanceOf(StripePaymentsError);
      expect(err.code).toBe("not-found");
      expect(err.cause).toBeUndefined();
    });

    it("should reject with not-found when the specified price does not exist", async () => {
      await expect(
        getPrice(payments, "premium", "unavailable")
      ).rejects.toThrow("No price found with the product ID: premium and price ID: unavailable");

      const err = await getPrice(payments, "premium", "unavailable").catch(e => e);
      expect(err).toBeInstanceOf(StripePaymentsError);
      expect(err.code).toBe("not-found");
      expect(err.cause).toBeUndefined();
    });
  });

  describe("getPrices()", () => {
    it("should return prices as an array when the product has only one price", async () => {
      const prices: Price[] = await getPrices(payments, "premium");

      expect(prices).toHaveLength(1);
      expect(prices).toEqual([premiumPlanPrice]);
    });

    it("should return prices as an array when the product has multiple prices", async () => {
      const prices: Price[] = await getPrices(payments, "standard");

      expect(prices).toHaveLength(2);
      expect(prices).toEqual([standardPlanPrice1, standardPlanPrice2]);
    });

    it("should return empty array for when the product has no prices", async () => {
      const prices: Price[] = await getPrices(payments, "economy");

      expect(prices).toHaveLength(0);
    });

    it("should reject with not-found when the specified product does not exist", async () => {
      await expect(
        getPrices(payments, "unavailable")
      ).rejects.toThrow("No product found with the ID: unavailable");

      const err = await getPrices(payments, "unavailable").catch(e => e);
      expect(err).toBeInstanceOf(StripePaymentsError);
      expect(err.code).toBe("not-found");
      expect(err.cause).toBeUndefined();
    });
  });

  describe("getCurrentUserSubscription()", () => {
    describe("without user signed in", () => {
      it("rejects when fetching a subscription", async () => {
        await expect(
          getCurrentUserSubscription(payments, "sub1")
        ).rejects.toThrow("Failed to determine currently signed in user. User not signed in.");

        const err = await getCurrentUserSubscription(payments, "sub1").catch(e => e);
        expect(err).toBeInstanceOf(StripePaymentsError);
        expect(err.code).toBe("unauthenticated");
        expect(err.cause).toBeUndefined();
      });
    });

    describe("with user signed in", () => {
      let currentUser: string = "";

      beforeAll(async () => {
        currentUser = (await signInAnonymously(auth)).user.uid;
        await addUserData(currentUser);
        await addSubscriptionData(currentUser, rawSubscriptionData);
      });

      afterAll(async () => {
        await signOut(auth);
      });

      it("should return a subscription when called with a valid subscriptionId", async () => {
        const sub: Subscription = await getCurrentUserSubscription(
          payments,
          "sub1"
        );

        const expected: Subscription = { ...subscription1, uid: currentUser };
        expect(sub).toEqual(expected);
      });

      it("should return a fully populated subscription when available", async () => {
        const sub: Subscription = await getCurrentUserSubscription(
          payments,
          "sub2"
        );

        const expected: Subscription = { ...subscription2, uid: currentUser };
        expect(sub).toEqual(expected);
      });

      it("should reject with not-found error when the specified subscription does not exist", async () => {
        await expect(
          getCurrentUserSubscription(payments, "unavailable")
        ).rejects.toThrow(`No subscription found with the ID: unavailable for user: ${currentUser}`);

        const err = await getCurrentUserSubscription(payments, "unavailable").catch(e => e);
        expect(err).toBeInstanceOf(StripePaymentsError);
        expect(err.code).toBe("not-found");
        expect(err.cause).toBeUndefined();
      });
    });
  });

  describe("getCurrentUserSubscriptions()", () => {
    describe("without user signed in", () => {
      it("rejects when fetching a subscription", async () => {
        await expect(
          getCurrentUserSubscriptions(payments)
        ).rejects.toThrow("Failed to determine currently signed in user. User not signed in.");

        const err = await getCurrentUserSubscriptions(payments).catch(e => e);
        expect(err).toBeInstanceOf(StripePaymentsError);
        expect(err.code).toBe("unauthenticated");
        expect(err.cause).toBeUndefined();
      });
    });

    describe("with user signed in", () => {
      let currentUser: string = "";

      beforeAll(async () => {
        currentUser = (await signInAnonymously(auth)).user.uid;
        await addUserData(currentUser);
        await addSubscriptionData(currentUser, rawSubscriptionData);
      });

      afterAll(async () => {
        await signOut(auth);
      });

      it("should return all subscriptions when called without options", async () => {
        const subs: Subscription[] =
          await getCurrentUserSubscriptions(payments);

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
    describe("without user signed in", () => {
      it("throws when registering a listener", () => {
        expect(() =>
          onCurrentUserSubscriptionUpdate(payments, (snap: SubscriptionSnapshot) => {})
        ).toThrow("Failed to determine currently signed in user. User not signed in.");
      });
    });

    describe("with user signed in", () => {
      let currentUser: string = "";
      let cancelers: Array<() => void> = [];

      beforeAll(async () => {
        currentUser = (await signInAnonymously(auth)).user.uid;
        await addUserData(currentUser);
      });

      afterAll(async () => {
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

      //TODO: fix broken test
      // it("should fire an event for each subscription update", async () => {
      //   const events: SubscriptionSnapshot[] = [];

      //   const cancel = onCurrentUserSubscriptionUpdate(payments, (snapshot) => {
      //     events.push(snapshot);
      //   });
      //   cancelers.push(cancel);
      //   await until(() => events.length > 0);

      //   expect(events.length).to.equal(1);

      //   const sub2: DocumentReference = doc(
      //     db,
      //     "customers",
      //     currentUser,
      //     "subscriptions",
      //     "sub2"
      //   );
      //   await updateDoc(sub2, { status: "active" });
      //   await until(() => events.length > 1);

      //   expect(events.length).to.equal(2);
      //   expect(events[1]).to.eql({
      //     subscriptions: [
      //       { ...subscription1, uid: currentUser },
      //       { ...subscription2, uid: currentUser, status: "active" },
      //       { ...subscription3, uid: currentUser },
      //     ],
      //     changes: [
      //       {
      //         type: "modified",
      //         subscription: {
      //           ...subscription2,
      //           uid: currentUser,
      //           status: "active",
      //         },
      //       },
      //     ],
      //     size: 3,
      //     empty: false,
      //   });

      //   const sub3: DocumentReference = doc(
      //     db,
      //     "customers",
      //     currentUser,
      //     "subscriptions",
      //     "sub3"
      //   );
      //   await updateDoc(sub3, { status: "active" });
      //   await until(() => events.length > 2);

      //   expect(events.length).to.equal(3);
      //   expect(events[2]).to.eql({
      //     subscriptions: [
      //       { ...subscription1, uid: currentUser },
      //       { ...subscription2, uid: currentUser, status: "active" },
      //       { ...subscription3, uid: currentUser, status: "active" },
      //     ],
      //     changes: [
      //       {
      //         type: "modified",
      //         subscription: {
      //           ...subscription3,
      //           uid: currentUser,
      //           status: "active",
      //         },
      //       },
      //     ],
      //     size: 3,
      //     empty: false,
      //   });
      // }, 12000);

      //TODO: fix broken test
      // it("should fire an event when a subscription is created", async () => {
      //   const events: SubscriptionSnapshot[] = [];

      //   const cancel = onCurrentUserSubscriptionUpdate(payments, (snapshot) => {
      //     events.push(snapshot);
      //   });
      //   cancelers.push(cancel);
      //   await until(() => events.length > 0);

      //   const sub4: DocumentReference = doc(
      //     db,
      //     "customers",
      //     currentUser,
      //     "subscriptions",
      //     "sub4"
      //   );
      //   await setDoc(sub4, buildSubscriptionDocument(rawSubscriptionData.sub1));
      //   console.log("STEP ONE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
      //   await until(() => events.length > 1);
      //   console.log("STEP TWO >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");

      //   expect(events.length).to.equal(2);
      //   expect(events[1]).to.eql({
      //     subscriptions: [
      //       { ...subscription1, uid: currentUser },
      //       { ...subscription2, uid: currentUser },
      //       { ...subscription3, uid: currentUser },
      //       { ...subscription1, uid: currentUser, id: "sub4" },
      //     ],
      //     changes: [
      //       {
      //         type: "added",
      //         subscription: { ...subscription1, uid: currentUser, id: "sub4" },
      //       },
      //     ],
      //     size: 4,
      //     empty: false,
      //   });
      // }, 12000);

      //TODO: fix broken test
      // it("should fire an event when a subscription is deleted", async () => {
      //   const events: SubscriptionSnapshot[] = [];
      //   const cancel = onCurrentUserSubscriptionUpdate(
      //     payments,
      //     (subscriptions) => {
      //       events.push(subscriptions);
      //     }
      //   );
      //   cancelers.push(cancel);
      //   await until(() => events.length > 0);

      //   const sub3: DocumentReference = doc(
      //     db,
      //     "customers",
      //     currentUser,
      //     "subscriptions",
      //     "sub3"
      //   );
      //   await deleteDoc(sub3);
      //   await until(() => events.length > 1);

      //   expect(events.length).to.equal(2);
      //   expect(events[1]).to.eql({
      //     subscriptions: [
      //       { ...subscription1, uid: currentUser },
      //       { ...subscription2, uid: currentUser },
      //     ],
      //     changes: [
      //       {
      //         type: "removed",
      //         subscription: { ...subscription3, uid: currentUser },
      //       },
      //     ],
      //     size: 2,
      //     empty: false,
      //   });
      // });
    });
  });

  describe("getCurrentUserPayment()", () => {
    describe("without user signed in", () => {
      it("rejects when fetching a payment", async () => {
        await expect(
          getCurrentUserPayment(payments, "payment_123")
        ).rejects.toThrow("Failed to determine currently signed in user. User not signed in.");

        const err = await getCurrentUserPayment(payments, "payment_123").catch(e => e);
        expect(err).toBeInstanceOf(StripePaymentsError);
        expect(err.code).toBe("unauthenticated");
        expect(err.cause).toBeUndefined();
      });
    });

    describe("with user signed in", () => {
      let currentUser: string = "";

      beforeAll(async () => {
        currentUser = (await signInAnonymously(auth)).user.uid;
        await addUserData(currentUser);
      });

      afterAll(async () => {
        await signOut(auth);
      });

      beforeEach(async () => {
        await addPaymentData(currentUser, rawPaymentData);
      });

      afterEach(async () => {
        await deletePayments(currentUser);
      });

      it("rejects when fetching a non-existent payment", async () => {
        await expect(
          getCurrentUserPayment(payments, "non_existent")
        ).rejects.toThrow(`No payment found with the ID: non_existent for user: ${currentUser}`);

        const err = await getCurrentUserPayment(payments, "non_existent").catch(e => e);
        expect(err).toBeInstanceOf(StripePaymentsError);
        expect(err.code).toBe("not-found");
        expect(err.cause).toBeUndefined();
      });

      it("resolves with the payment when it exists", async () => {
        const payment = await getCurrentUserPayment(payments, "pay1");
        expect(payment).toEqual({
          ...rawPaymentData.pay1,
          uid: currentUser,
          id: "pay1",
          created: expect.any(String)
        });
      });
    });
  });

  describe("getCurrentUserPayments()", () => {
    describe("without user signed in", () => {
      it("rejects when fetching payments", async () => {
        await expect(
          getCurrentUserPayments(payments)
        ).rejects.toThrow("Failed to determine currently signed in user. User not signed in.");

        const err = await getCurrentUserPayments(payments).catch(e => e);
        expect(err).toBeInstanceOf(StripePaymentsError);
        expect(err.code).toBe("unauthenticated");
        expect(err.cause).toBeUndefined();
      });
    });

    describe("with user signed in", () => {
      let currentUser: string = "";

      beforeAll(async () => {
        currentUser = (await signInAnonymously(auth)).user.uid;
        await addUserData(currentUser);
      });

      afterAll(async () => {
        await signOut(auth);
      });

      beforeEach(async () => {
        await addPaymentData(currentUser, rawPaymentData);
      });

      afterEach(async () => {
        await deletePayments(currentUser);
      });

      it("resolves with empty array when no payments exist", async () => {
        await deletePayments(currentUser);
        const userPayments = await getCurrentUserPayments(payments);
        expect(userPayments).toEqual([]);
      });

      it("resolves with all payments when they exist", async () => {
        const userPayments = await getCurrentUserPayments(payments);
        const expectedPayments = Object.entries(rawPaymentData).map(([id, payment]) => ({
          ...payment,
          uid: currentUser,
          id,
          created: expect.any(String)
        }));
        expect(userPayments).toEqual(expectedPayments);
      });
    });
  });

  describe("onCurrentUserPaymentUpdate()", () => {
    describe("without user signed in", () => {
      it("throws when registering a listener", () => {
        expect(() =>
          onCurrentUserPaymentUpdate(payments, (snap: PaymentSnapshot) => {})
        ).toThrow("Failed to determine currently signed in user. User not signed in.");
      });
    });

    describe("with user signed in", () => {
      let currentUser: string = "";
      let cancelers: Array<() => void> = [];

      beforeAll(async () => {
        currentUser = (await signInAnonymously(auth)).user.uid;
        await addUserData(currentUser);
      });

      afterAll(async () => {
        await signOut(auth);
      });

      beforeEach(async () => {
        await addPaymentData(currentUser, rawPaymentData);
      });

      afterEach(async () => {
        cancelers.forEach((cancel) => {
          cancel();
        });
        cancelers = [];

        await deletePayments(currentUser);
      });

      it("notifies on payment updates", async () => {
        const updates: PaymentSnapshot[] = [];
        const unsubscribe = onCurrentUserPaymentUpdate(payments, (snap) => {
          updates.push(snap);
        });
        cancelers.push(unsubscribe);

        await addPaymentData(currentUser, {
          payment_123: {
            ...rawPaymentData.payment_123,
            status: "succeeded",
          },
        });

        expect(updates).toHaveLength(1);
        expect(updates[0].payments).toEqual([
          {
            ...rawPaymentData.payment_123,
            status: "succeeded",
          },
        ]);
      });
    });
  });

  async function until(
    predicate: () => boolean,
    intervalMillis: number = 50,
    timeoutMillis: number = 5 * 1000
  ) {
    const start = Date.now();
    let done = false;
    if (predicate()) {
      return;
    }

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

  async function addPaymentData(uid: string, data: PaymentData): Promise<void> {
    const batch: WriteBatch = writeBatch(db);
    for (const [id, payment] of Object.entries(data)) {
      batch.set(
        doc(db, "customers", uid, "payments", id),
        buildPaymentDocument(payment)
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

  async function deletePayments(uid: string): Promise<void> {
    const subs = await getDocs(collection(db, "customers", uid, "payments"));
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

  function buildPaymentDocument(payment: Record<string, any>): DocumentData {
    const prices = payment.prices || [];
    const priceRefs = prices.map(
      (item: { product: string; price: string }) =>
        doc(db, "products", item.product, "prices", item.price)
    );

    return {
      amount: payment.amount || 0,
      amount_capturable: payment.amount_capturable || 0,
      amount_received: payment.amount_received || 0,
      created: payment.created || new Date().toISOString(),
      currency: payment.currency || "usd",
      customer: payment.customer || null,
      description: payment.description || null,
      invoice: payment.invoice || null,
      metadata: payment.metadata || {},
      payment_method_types: payment.payment_method_types || ["card"],
      prices: priceRefs,
      status: payment.status || "succeeded",
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
