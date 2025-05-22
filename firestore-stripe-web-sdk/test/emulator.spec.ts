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

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
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
import { exec } from "child_process";
import { promisify } from "util";
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

const runTerminalCmd = promisify(exec);

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
    const prices: DocumentReference[] = payment.prices.map(
      (item: { product: string; price: string }) =>
        doc(db, "products", item.product, "prices", item.price)
    );
    return {
      ...payment,
      prices,
    };
  }

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
      await expect(getProduct(payments, "unavailable")).rejects.toThrow(
        "No product found with the ID: unavailable"
      );
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
      expect(products).toEqual([]);
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
    });
  });

  describe("getPrice()", () => {
    it("should return a price when called with valid product and price IDs", async () => {
      const price: Price = await getPrice(payments, "premium", "price1");
      expect(price).toEqual(premiumPlanPrice);
    });

    it("should reject with not-found when the specified product does not exist", async () => {
      await expect(getPrice(payments, "unavailable", "price1")).rejects.toThrow(
        "No price found with the product ID: unavailable and price ID: price1"
      );
    });
  });

  describe("createCheckoutSession()", () => {
    let currentUser: string = "";
    let backend: ExtensionBackend;

    beforeEach(() => {
      backend = new ExtensionBackend(payments);
    });

    afterEach(async () => {
      await backend.tearDown();
    });

    describe("without user signed in", () => {
      it("should reject when creating a new session", async () => {
        await expect(
          createCheckoutSession(payments, {
            price: "foo",
          })
        ).rejects.toThrow(
          "Failed to determine currently signed in user. User not signed in."
        );
      });
    });

    describe("with user signed in", () => {
      beforeAll(async () => {
        currentUser = (await signInAnonymously(auth)).user.uid;
        await addUserData(currentUser);
      });

      afterAll(async () => {
        await signOut(auth);
      });

      it("should create a session when called with minimum line item parameters", async () => {
        const lineItems: LineItemParams[] = [
          {
            price: "foo",
          },
        ];
        const session = await createCheckoutSession(payments, {
          line_items: lineItems,
        });

        expect(session).toEqual(
          expect.objectContaining({
            cancel_url: window.location.href,
            line_items: lineItems,
            mode: "subscription",
            success_url: window.location.href,
          })
        );
      });

      it("should create a session when called with all line item parameters", async () => {
        const lineItems: LineItemParams[] = [
          {
            description: "Economy package subscription",
            price: "foo",
            quantity: 5,
          },
        ];
        const session = await createCheckoutSession(payments, {
          allow_promotion_codes: true,
          automatic_tax: true,
          cancel_url: "https://example.com/cancel",
          client_reference_id: "example",
          line_items: lineItems,
          metadata: {
            test: true,
          },
          mode: "subscription",
          payment_method_types: ["card"],
          promotion_code: "discount",
          success_url: "https://example.com/success",
          tax_id_collection: true,
          trial_from_plan: true,
        });

        expect(session).toMatchObject({
          allow_promotion_codes: true,
          automatic_tax: true,
          cancel_url: "https://example.com/cancel",
          client_reference_id: "example",
          line_items: lineItems,
          metadata: {
            test: true,
          },
          mode: "subscription",
          payment_method_types: ["card"],
          promotion_code: "discount",
          success_url: "https://example.com/success",
          tax_id_collection: true,
          trial_from_plan: true,
        });
      });

      it("should create a session when called with minimum price ID parameters", async () => {
        const session = await createCheckoutSession(payments, {
          price: "foo",
        });

        expect(session).toMatchObject({
          cancel_url: window.location.href,
          mode: "subscription",
          price: "foo",
          success_url: window.location.href,
        });
      });

      it("should create a session when called with all price ID parameters", async () => {
        const session = await createCheckoutSession(payments, {
          allow_promotion_codes: true,
          automatic_tax: true,
          cancel_url: "https://example.com/cancel",
          client_reference_id: "example",
          metadata: {
            test: true,
          },
          mode: "subscription",
          payment_method_types: ["card"],
          price: "foo",
          promotion_code: "discount",
          quantity: 5,
          success_url: "https://example.com/success",
          tax_id_collection: true,
          trial_from_plan: true,
        });

        expect(session).toMatchObject({
          allow_promotion_codes: true,
          automatic_tax: true,
          cancel_url: "https://example.com/cancel",
          client_reference_id: "example",
          metadata: {
            test: true,
          },
          mode: "subscription",
          payment_method_types: ["card"],
          price: "foo",
          promotion_code: "discount",
          quantity: 5,
          success_url: "https://example.com/success",
          tax_id_collection: true,
          trial_from_plan: true,
        });
      });

      it("should reject with deadline-exceeded when the extension is not responding", async () => {
        // Disable the backend to simulate the extension being unavailable
        backend.disable();

        await expect(
          createCheckoutSession(
            payments,
            { price: "foo" },
            { timeoutMillis: 10 }
          )
        ).rejects.toThrow("Timeout while waiting for session response.");
      });
    });
  });

  describe("getCurrentUserSubscription()", () => {
    let currentUser: string = "";

    describe("without user signed in", () => {
      it("rejects when fetching a subscription", async () => {
        await expect(
          getCurrentUserSubscription(payments, "sub1")
        ).rejects.toThrow(
          "Failed to determine currently signed in user. User not signed in."
        );
      });
    });

    describe("with user signed in", () => {
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
        ).rejects.toThrow(
          `No subscription found with the ID: unavailable for user: ${currentUser}`
        );
      });
    });
  });

  describe("getCurrentUserSubscriptions()", () => {
    describe("without user signed in", () => {
      it("rejects when fetching a subscription", async () => {
        await expect(getCurrentUserSubscriptions(payments)).rejects.toThrow(
          "Failed to determine currently signed in user. User not signed in."
        );
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
        const subs: Subscription[] = await getCurrentUserSubscriptions(
          payments
        );

        const expected: Subscription[] = [
          { ...subscription1, uid: currentUser },
          { ...subscription2, uid: currentUser },
          { ...subscription3, uid: currentUser },
        ];
        expect(subs).toEqual(expected);
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
        expect(subs).toEqual(expected);
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
        expect(subs).toEqual(expected);
      });
    });
  });

  describe("onCurrentUserSubscriptionUpdate()", () => {
    describe("without user signed in", () => {
      it("throws when registering a listener", async () => {
        expect(() =>
          onCurrentUserSubscriptionUpdate(
            payments,
            (snap: SubscriptionSnapshot) => {}
          )
        ).toThrow(
          "Failed to determine currently signed in user. User not signed in."
        );
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

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
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

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          subscriptions: [],
          changes: [],
          size: 0,
          empty: true,
        });
      });
    });
  });

  describe("getCurrentUserPayment()", () => {
    let currentUser: string = "";

    describe("without user signed in", () => {
      it("rejects when fetching a payment", async () => {
        await expect(getCurrentUserPayment(payments, "pay1")).rejects.toThrow(
          "Failed to determine currently signed in user. User not signed in."
        );
      });
    });

    describe("with user signed in", () => {
      beforeAll(async () => {
        currentUser = (await signInAnonymously(auth)).user.uid;
        await addUserData(currentUser);
        await addPaymentData(currentUser, rawPaymentData);
      });

      afterAll(async () => {
        await signOut(auth);
      });

      it("should return a payment when called with a valid paymentId", async () => {
        const payment: Payment = await getCurrentUserPayment(payments, "pay1");

        const expected: Payment = { ...payment1, uid: currentUser };
        expect(payment).toEqual(expected);
      });

      it("should return a fully populated payment when available", async () => {
        const payment: Payment = await getCurrentUserPayment(payments, "pay2");

        const expected: Payment = { ...payment2, uid: currentUser };
        expect(payment).toEqual(expected);
      });

      it("should reject with not-found error when the specified payment does not exist", async () => {
        await expect(
          getCurrentUserPayment(payments, "unavailable")
        ).rejects.toThrow(
          `No payment found with the ID: unavailable for user: ${currentUser}`
        );
      });
    });
  });

  describe("getCurrentUserPayments()", () => {
    describe("without user signed in", () => {
      it("rejects when fetching payments", async () => {
        await expect(getCurrentUserPayments(payments)).rejects.toThrow(
          "Failed to determine currently signed in user. User not signed in."
        );
      });
    });

    describe("with user signed in", () => {
      let currentUser: string = "";

      beforeAll(async () => {
        currentUser = (await signInAnonymously(auth)).user.uid;
        await addUserData(currentUser);
        await addPaymentData(currentUser, rawPaymentData);
      });

      afterAll(async () => {
        await signOut(auth);
      });

      it("should return all payments when called without options", async () => {
        const paymentData: Payment[] = await getCurrentUserPayments(payments);

        const expected: Payment[] = [
          { ...payment1, uid: currentUser },
          { ...payment2, uid: currentUser },
          { ...payment3, uid: currentUser },
        ];
        expect(paymentData).toEqual(expected);
      });

      it("should only return payments with the given status", async () => {
        const paymentData: Payment[] = await getCurrentUserPayments(payments, {
          status: "succeeded",
        });

        const expected: Payment[] = [{ ...payment1, uid: currentUser }];
        expect(paymentData).toEqual(expected);
      });

      it("should only return payments with the given statuses", async () => {
        const paymentData: Payment[] = await getCurrentUserPayments(payments, {
          status: ["succeeded", "requires_action"],
        });

        const expected: Payment[] = [
          { ...payment1, uid: currentUser },
          { ...payment2, uid: currentUser },
        ];
        expect(paymentData).toEqual(expected);
      });
    });
  });

  describe("onCurrentUserPaymentUpdate()", () => {
    describe("without user signed in", () => {
      it("throws when registering a listener", async () => {
        expect(() =>
          onCurrentUserPaymentUpdate(payments, (snap: PaymentSnapshot) => {})
        ).toThrow(
          "Failed to determine currently signed in user. User not signed in."
        );
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

      it("should fire an event with all existing payments", async () => {
        const events: PaymentSnapshot[] = [];

        const cancel = onCurrentUserPaymentUpdate(payments, (snapshot) => {
          events.push(snapshot);
        });
        cancelers.push(cancel);
        await until(() => events.length > 0);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          payments: [
            { ...payment1, uid: currentUser },
            { ...payment2, uid: currentUser },
            { ...payment3, uid: currentUser },
          ],
          changes: [
            {
              type: "added",
              payment: { ...payment1, uid: currentUser },
            },
            {
              type: "added",
              payment: { ...payment2, uid: currentUser },
            },
            {
              type: "added",
              payment: { ...payment3, uid: currentUser },
            },
          ],
          size: 3,
          empty: false,
        });
      });

      it("should fire an event with empty snapshot when no payments are present", async () => {
        await deletePayments(currentUser);
        const events: PaymentSnapshot[] = [];

        const cancel = onCurrentUserPaymentUpdate(payments, (snapshot) => {
          events.push(snapshot);
        });
        cancelers.push(cancel);
        await until(() => events.length > 0);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          payments: [],
          changes: [],
          size: 0,
          empty: true,
        });
      });

      it("should fire an event for each payment update", async () => {
        const events: PaymentSnapshot[] = [];

        const cancel = onCurrentUserPaymentUpdate(payments, (snapshot) => {
          events.push(snapshot);
        });
        cancelers.push(cancel);
        await until(() => events.length > 0);

        expect(events).toHaveLength(1);

        const pay2: DocumentReference = doc(
          db,
          "customers",
          currentUser,
          "payments",
          "pay2"
        );
        await updateDoc(pay2, { status: "active" });
        await until(() => events.length > 1);

        expect(events).toHaveLength(2);
        expect(events[1]).toEqual({
          payments: [
            { ...payment1, uid: currentUser },
            { ...payment2, uid: currentUser, status: "active" },
            { ...payment3, uid: currentUser },
          ],
          changes: [
            {
              type: "modified",
              payment: {
                ...payment2,
                uid: currentUser,
                status: "active",
              },
            },
          ],
          size: 3,
          empty: false,
        });

        const pay3: DocumentReference = doc(
          db,
          "customers",
          currentUser,
          "payments",
          "pay3"
        );
        await updateDoc(pay3, { status: "active" });
        await until(() => events.length > 2);

        expect(events).toHaveLength(3);
        expect(events[2]).toEqual({
          payments: [
            { ...payment1, uid: currentUser },
            { ...payment2, uid: currentUser, status: "active" },
            { ...payment3, uid: currentUser, status: "active" },
          ],
          changes: [
            {
              type: "modified",
              payment: {
                ...payment3,
                uid: currentUser,
                status: "active",
              },
            },
          ],
          size: 3,
          empty: false,
        });
      });

      it("should fire an event when a payment is created", async () => {
        const events: PaymentSnapshot[] = [];

        const cancel = onCurrentUserPaymentUpdate(payments, (snapshot) => {
          events.push(snapshot);
        });
        cancelers.push(cancel);
        await until(() => events.length > 0);

        const pay4: DocumentReference = doc(
          db,
          "customers",
          currentUser,
          "payments",
          "pay4"
        );
        await setDoc(pay4, buildPaymentDocument(rawPaymentData.pay1));
        await until(() => events.length > 1);

        expect(events).toHaveLength(2);
        expect(events[1]).toEqual({
          payments: [
            { ...payment1, uid: currentUser },
            { ...payment2, uid: currentUser },
            { ...payment3, uid: currentUser },
            { ...payment1, uid: currentUser, id: "pay4" },
          ],
          changes: [
            {
              type: "added",
              payment: { ...payment1, uid: currentUser, id: "pay4" },
            },
          ],
          size: 4,
          empty: false,
        });
      });

      it("should fire an event when a payment is deleted", async () => {
        const events: PaymentSnapshot[] = [];
        const cancel = onCurrentUserPaymentUpdate(payments, (snapshot) => {
          events.push(snapshot);
        });
        cancelers.push(cancel);
        await until(() => events.length > 0);

        const pay3: DocumentReference = doc(
          db,
          "customers",
          currentUser,
          "payments",
          "pay3"
        );
        await deleteDoc(pay3);
        await until(() => events.length > 1);

        expect(events).toHaveLength(2);
        expect(events[1]).toEqual({
          payments: [
            { ...payment1, uid: currentUser },
            { ...payment2, uid: currentUser },
          ],
          changes: [
            {
              type: "removed",
              payment: { ...payment3, uid: currentUser },
            },
          ],
          size: 2,
          empty: false,
        });
      });
    });
  });
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
  private disabled: boolean = false;

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

  public disable(): void {
    this.disabled = true;
    this.cancel();
    this.events.length = 0;
  }

  private initCreateCheckoutSessionTrigger(): Unsubscribe {
    const db: Firestore = getFirestore(this.payments.app);
    const sessions: Query = collectionGroup(db, "checkout_sessions");
    return onSnapshot(sessions, async (snap) => {
      if (this.disabled) return;
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
