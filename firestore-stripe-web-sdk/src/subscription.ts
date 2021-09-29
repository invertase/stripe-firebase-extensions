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

import { FirebaseApp } from "@firebase/app";
import {
  doc,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  FirestoreDataConverter,
  getDoc,
  getFirestore,
  QueryDocumentSnapshot,
  Timestamp,
} from "@firebase/firestore";
import { StripePaymentsError } from ".";
import { StripePayments } from "./init";
import { getCurrentUser } from "./user";
import { checkNonEmptyString } from "./utils";

export interface Subscription {
  readonly id: string;
  readonly uid: string;
  readonly metadata: { [name: string]: string };
  readonly stripeLink: string;
  readonly role: string | null;
  readonly quantity: number | null;
  readonly productId: string;
  readonly priceId: string;
  readonly prices: Array<{ productId: string; priceId: string }>;
  readonly status: SubscriptionState;
  readonly cancelAtPeriodEnd: boolean;
  readonly created: string;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
  readonly endedAt: string | null;
  readonly cancelAt: string | null;
  readonly canceledAt: string | null;
  readonly trialStart: string | null;
  readonly trialEnd: string | null;
  readonly [propName: string]: any;
}

export type SubscriptionState =
  | "active"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "trialing"
  | "unpaid";

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
 * Internal interface for all database interactions pertaining to Stripe subscriptions. Exported
 * for testing.
 *
 * @internal
 */
export interface SubscriptionDAO {
  getSubscription(uid: string, subscriptionId: string): Promise<Subscription>;
}

const SUBSCRIPTION_CONVERTER: FirestoreDataConverter<Subscription> = {
  toFirestore: () => {
    throw new Error("Not implemented for readonly Subscription type.");
  },
  fromFirestore: (snapshot: QueryDocumentSnapshot): Subscription => {
    const data: DocumentData = snapshot.data();
    const refs: DocumentReference[] = data.prices;
    const prices: Array<{ productId: string; priceId: string }> = refs.map(
      (priceRef: DocumentReference) => {
        return {
          productId: priceRef.parent.parent!.id,
          priceId: priceRef.id,
        };
      }
    );

    return {
      cancelAt: toNullableUTCDateString(data.cancel_at),
      cancelAtPeriodEnd: data.cancel_at_period_end,
      canceledAt: toNullableUTCDateString(data.canceled_at),
      created: toUTCDateString(data.created),
      currentPeriodStart: toUTCDateString(data.current_period_start),
      currentPeriodEnd: toUTCDateString(data.current_period_end),
      endedAt: toNullableUTCDateString(data.ended_at),
      id: snapshot.id,
      metadata: data.metadata ?? {},
      priceId: (data.price as DocumentReference).id,
      prices,
      productId: (data.product as DocumentReference).id,
      quantity: data.quantity ?? null,
      role: data.role ?? null,
      status: data.status,
      stripeLink: data.stripeLink,
      trialEnd: toNullableUTCDateString(data.trial_end),
      trialStart: toNullableUTCDateString(data.trial_start),
      uid: snapshot.ref.parent.parent!.id,
    };
  },
};

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

  private async getSubscriptionSnapshotIfExists(
    uid: string,
    subscriptionId: string
  ): Promise<QueryDocumentSnapshot<Subscription>> {
    const subscriptionRef: DocumentReference<Subscription> = doc(
      this.firestore,
      this.customersCollection,
      uid,
      "subscriptions",
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
