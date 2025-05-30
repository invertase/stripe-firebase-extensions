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

import { FirebaseApp } from "firebase/app";
import {
  collection,
  CollectionReference,
  doc,
  DocumentChange,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  FirestoreDataConverter,
  FirestoreError,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  Query,
  QueryDocumentSnapshot,
  QuerySnapshot,
  Timestamp,
  where,
} from "firebase/firestore";
import { StripePayments, StripePaymentsError } from "./init";
import { getCurrentUser, getCurrentUserSync } from "./user";
import { checkNonEmptyArray, checkNonEmptyString } from "./utils";

/**
 * Interface of a Stripe Subscription stored in the app database.
 */
export interface Subscription {
  /**
   * A future date in UTC format at which the subscription will automatically get canceled.
   */
  readonly cancel_at: string | null;

  /**
   * If `true`, the subscription has been canceled by the user and will be deleted at the end
   * of the billing period.
   */
  readonly cancel_at_period_end: boolean;

  /**
   * If the subscription has been canceled, the date of that cancellation as a UTC timestamp.
   * If the subscription was canceled with {@link Subscription.cancel_at_period_end}, this field
   * will still reflect the date of the initial cancellation request, not the end of the
   * subscription period when the subscription is automatically moved to a canceled state.
   */
  readonly canceled_at: string | null;

  /**
   * The date when the subscription was created as a UTC timestamp.
   */
  readonly created: string;

  /**
   * End of the current period that the subscription has been invoiced for as a UTC timestamp.
   * At the end of the period, a new invoice will be created.
   */
  readonly current_period_end: string;

  /**
   * Start of the current period that the subscription has been invoiced for as a UTC timestamp.
   */
  readonly current_period_start: string;

  /**
   * If the subscription has ended, the date the subscription ended as a UTC timestamp.
   */
  readonly ended_at: string | null;

  /**
   * Unique Stripe subscription ID.
   */
  readonly id: string;

  /**
   * Set of extra key-value pairs attached to the subscription object.
   */
  readonly metadata: { [name: string]: string };

  /**
   * Stripe price ID associated with this subscription.
   */
  readonly price: string;

  /**
   * Array of product ID and price ID pairs. If multiple recurring prices were provided to the
   * checkout session (e.g. via `lineItems`) this array holds all recurring prices for this
   * subscription. The first element of this array always corresponds to the
   * {@link Subscription.price} and {@link Subscription.product} fields on the subscription.
   */
  readonly prices: Array<{ product: string; price: string }>;

  /**
   * Stripe product ID associated with this subscription.
   */
  readonly product: string;

  /**
   * Quantity of items purchased with this subscription.
   */
  readonly quantity: number | null;

  /**
   * The Firebae role that can be assigned to the user with this subscription.
   */
  readonly role: string | null;

  /**
   * The status of the subscription object
   */
  readonly status: SubscriptionStatus;

  /**
   * A link to the subscription in the Stripe dashboard.
   */
  readonly stripe_link: string;

  /**
   * If the subscription has a trial, the end date of that trial as a UTC timestamp.
   */
  readonly trial_end: string | null;

  /**
   * If the subscription has a trial, the start date of that trial as a UTC timestamp.
   */
  readonly trial_start: string | null;

  /**
   * Firebase Auth UID of the user that created the subscription.
   */
  readonly uid: string;

  readonly [propName: string]: any;
}

/**
 * Possible states a subscription can be in.
 */
export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "trialing"
  | "unpaid";

/**
 * Retrieves an existing Stripe subscription for the currently signed in user from the database.
 *
 * @param payments - A valid {@link StripePayments} object.
 * @param subscriptionId - ID of the subscription to retrieve.
 * @returns Resolves with a Subscription object if found. Rejects if the specified subscription ID
 *  does not exist, or if the user is not signed in.
 */
export function getCurrentUserSubscription(
  payments: StripePayments,
  subscriptionId: string
): Promise<Subscription> {
  checkNonEmptyString(
    subscriptionId,
    "subscriptionId must be a non-empty string."
  );
  return getCurrentUser(payments).then((uid: string) => {
    const dao: SubscriptionDAO = getOrInitSubscriptionDAO(payments);
    return dao.getSubscription(uid, subscriptionId);
  });
}

/**
 * Optional parameters for the {@link getCurrentUserSubscriptions} function.
 */
export interface GetSubscriptionsOptions {
  /**
   * Specify one or more subscription status values to retrieve. When set only the subscriptions
   * with the given status are returned.
   */
  status?: SubscriptionStatus | SubscriptionStatus[];
}

/**
 * Retrieves existing Stripe subscriptions for the currently signed in user from the database.
 *
 * @param payments - A valid {@link StripePayments} object.
 * @param options - A set of options to customize the behavior.
 * @returns Resolves with an array of Stripe subscriptions. May be empty.
 */
export function getCurrentUserSubscriptions(
  payments: StripePayments,
  options?: GetSubscriptionsOptions
): Promise<Subscription[]> {
  const queryOptions: { status?: SubscriptionStatus[] } = {};
  if (typeof options?.status !== "undefined") {
    queryOptions.status = getStatusAsArray(options.status);
  }

  return getCurrentUser(payments).then((uid: string) => {
    const dao: SubscriptionDAO = getOrInitSubscriptionDAO(payments);
    return dao.getSubscriptions(uid, queryOptions);
  });
}

/**
 * Different types of changes that may occur on a subscription object.
 */
export type SubscriptionChangeType = "added" | "modified" | "removed";

/**
 * Represents the current state of a set of subscriptions owned by a user.
 */
export interface SubscriptionSnapshot {
  /**
   * A list of all currently available subscriptions ordered by the subscription ID. Empty
   * if no subscriptions are available.
   */
  subscriptions: Subscription[];

  /**
   * The list of changes in the subscriptions since the last snapshot.
   */
  changes: Array<{
    type: SubscriptionChangeType;
    subscription: Subscription;
  }>;

  /**
   * Number of currently available subscriptions. This is same as the length of the
   * `subscriptions` array in the snapshot.
   */
  size: number;

  /**
   * True if there are no subscriptions available. False whenever at least one subscription is
   * present. When True, the `subscriptions` array is empty, and the `size` is 0.
   */
  empty: boolean;
}

/**
 * Registers a listener to receive subscription update events for the currently signed in
 * user. If the user is not signed in throws an `unauthenticated` error, and no listener is
 * registered.
 *
 * Upon successful registration, the `onUpdate` callback will fire once with
 * the current state of all the subscriptions. From then onwards, each update to a subscription
 * will fire the `onUpdate` callback with the latest state of the subscriptions.
 *
 * @param payments - A valid {@link StripePayments} object.
 * @param onUpdate - A callback that will fire whenever the current user's subscriptions
 *   are updated.
 * @param onError - A callback that will fire whenever an error occurs while listening to
 *   subscription updates.
 * @returns A function that can be called to cancel and unregister the listener.
 */
export function onCurrentUserSubscriptionUpdate(
  payments: StripePayments,
  onUpdate: (snapshot: SubscriptionSnapshot) => void,
  onError?: (error: StripePaymentsError) => void
): () => void {
  const uid: string = getCurrentUserSync(payments);
  const dao: SubscriptionDAO = getOrInitSubscriptionDAO(payments);
  return dao.onSubscriptionUpdate(uid, onUpdate, onError);
}

function getStatusAsArray(
  status: SubscriptionStatus | SubscriptionStatus[]
): SubscriptionStatus[] {
  if (typeof status === "string") {
    return [status];
  }

  checkNonEmptyArray(status, "status must be a non-empty array.");
  return status;
}

/**
 * Internal interface for all database interactions pertaining to Stripe subscriptions. Exported
 * for testing.
 *
 * @internal
 */
export interface SubscriptionDAO {
  getSubscription(uid: string, subscriptionId: string): Promise<Subscription>;
  getSubscriptions(
    uid: string,
    options?: { status?: SubscriptionStatus[] }
  ): Promise<Subscription[]>;
  onSubscriptionUpdate(
    uid: string,
    onUpdate: (snapshot: SubscriptionSnapshot) => void,
    onError?: (error: StripePaymentsError) => void
  ): () => void;
}

const SUBSCRIPTION_CONVERTER: FirestoreDataConverter<Subscription> = {
  toFirestore: () => {
    throw new Error("Not implemented for readonly Subscription type.");
  },
  fromFirestore: (snapshot: QueryDocumentSnapshot): Subscription => {
    const data: DocumentData = snapshot.data();
    const refs: DocumentReference[] = data.prices;
    const prices: Array<{ product: string; price: string }> = refs.map(
      (priceRef: DocumentReference) => {
        return {
          product: priceRef.parent.parent!.id,
          price: priceRef.id,
        };
      }
    );

    return {
      cancel_at: toNullableUTCDateString(data.cancel_at),
      cancel_at_period_end: data.cancel_at_period_end,
      canceled_at: toNullableUTCDateString(data.canceled_at),
      created: toUTCDateString(data.created),
      current_period_start: toUTCDateString(data.current_period_start),
      current_period_end: toUTCDateString(data.current_period_end),
      ended_at: toNullableUTCDateString(data.ended_at),
      id: snapshot.id,
      metadata: data.metadata ?? {},
      price: (data.price as DocumentReference).id,
      prices,
      product: (data.product as DocumentReference).id,
      quantity: data.quantity ?? null,
      role: data.role ?? null,
      status: data.status,
      stripe_link: data.stripeLink,
      trial_end: toNullableUTCDateString(data.trial_end),
      trial_start: toNullableUTCDateString(data.trial_start),
      uid: snapshot.ref.parent.parent!.id,
    };
  },
};

const SUBSCRIPTIONS_COLLECTION = "subscriptions" as const;

function toNullableUTCDateString(timestamp: Timestamp | null): string | null {
  if (timestamp === null) {
    return null;
  }

  return toUTCDateString(timestamp);
}

function toUTCDateString(timestamp: Timestamp): string {
  return timestamp.toDate().toUTCString();
}

class FirestoreSubscriptionDAO implements SubscriptionDAO {
  private readonly firestore: Firestore;

  constructor(app: FirebaseApp, private readonly customersCollection: string) {
    this.firestore = getFirestore(app);
  }

  public async getSubscription(
    uid: string,
    subscriptionId: string
  ): Promise<Subscription> {
    const snap: QueryDocumentSnapshot<Subscription> =
      await this.getSubscriptionSnapshotIfExists(uid, subscriptionId);
    return snap.data();
  }

  public async getSubscriptions(
    uid: string,
    options?: { status?: SubscriptionStatus[] }
  ): Promise<Subscription[]> {
    const querySnap: QuerySnapshot<Subscription> =
      await this.getSubscriptionSnapshots(uid, options?.status);
    const subscriptions: Subscription[] = [];
    querySnap.forEach((snap: QueryDocumentSnapshot<Subscription>) => {
      subscriptions.push(snap.data());
    });

    return subscriptions;
  }

  public onSubscriptionUpdate(
    uid: string,
    onUpdate: (snapshot: SubscriptionSnapshot) => void,
    onError?: (error: StripePaymentsError) => void
  ): () => void {
    const subscriptions: CollectionReference<Subscription> = collection(
      this.firestore,
      this.customersCollection,
      uid,
      SUBSCRIPTIONS_COLLECTION
    ).withConverter(SUBSCRIPTION_CONVERTER);
    return onSnapshot(
      subscriptions,
      (querySnap: QuerySnapshot<Subscription>) => {
        const snapshot: SubscriptionSnapshot = {
          subscriptions: [],
          changes: [],
          size: querySnap.size,
          empty: querySnap.empty,
        };
        querySnap.forEach((snap: QueryDocumentSnapshot<Subscription>) => {
          snapshot.subscriptions.push(snap.data());
        });
        querySnap
          .docChanges()
          .forEach((change: DocumentChange<Subscription>) => {
            snapshot.changes.push({
              type: change.type,
              subscription: change.doc.data(),
            });
          });

        onUpdate(snapshot);
      },
      (err: FirestoreError) => {
        if (onError) {
          const arg: StripePaymentsError = new StripePaymentsError(
            "internal",
            `Error while listening to database updates: ${err.message}`,
            err
          );
          onError(arg);
        }
      }
    );
  }

  private async getSubscriptionSnapshotIfExists(
    uid: string,
    subscriptionId: string
  ): Promise<QueryDocumentSnapshot<Subscription>> {
    const subscriptionRef: DocumentReference<Subscription> = doc(
      this.firestore,
      this.customersCollection,
      uid,
      SUBSCRIPTIONS_COLLECTION,
      subscriptionId
    ).withConverter(SUBSCRIPTION_CONVERTER);
    const snapshot: DocumentSnapshot<Subscription> = await this.queryFirestore(
      () => getDoc(subscriptionRef)
    );
    if (!snapshot.exists()) {
      throw new StripePaymentsError(
        "not-found",
        `No subscription found with the ID: ${subscriptionId} for user: ${uid}`
      );
    }

    return snapshot;
  }

  private async getSubscriptionSnapshots(
    uid: string,
    status?: SubscriptionStatus[]
  ): Promise<QuerySnapshot<Subscription>> {
    let subscriptionsQuery: Query<Subscription> = collection(
      this.firestore,
      this.customersCollection,
      uid,
      SUBSCRIPTIONS_COLLECTION
    ).withConverter(SUBSCRIPTION_CONVERTER);
    if (status) {
      subscriptionsQuery = query(
        subscriptionsQuery,
        where("status", "in", status)
      );
    }

    return await this.queryFirestore(() => getDocs(subscriptionsQuery));
  }

  private async queryFirestore<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw new StripePaymentsError(
        "internal",
        "Unexpected error while querying Firestore",
        error
      );
    }
  }
}

const SUBSCRIPTION_DAO_KEY = "subscription-dao" as const;

function getOrInitSubscriptionDAO(payments: StripePayments): SubscriptionDAO {
  let dao: SubscriptionDAO | null =
    payments.getComponent<SubscriptionDAO>(SUBSCRIPTION_DAO_KEY);
  if (!dao) {
    dao = new FirestoreSubscriptionDAO(
      payments.app,
      payments.customersCollection
    );
    setSubscriptionDAO(payments, dao);
  }

  return dao;
}

/**
 * Internal API for registering a {@link SubscriptionDAO} instance with {@link StripePayments}.
 * Exported for testing.
 *
 * @internal
 */
export function setSubscriptionDAO(
  payments: StripePayments,
  dao: SubscriptionDAO
): void {
  payments.setComponent(SUBSCRIPTION_DAO_KEY, dao);
}
