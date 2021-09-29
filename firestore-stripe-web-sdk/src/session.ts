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
import { Auth, getAuth } from "@firebase/auth";
import {
  addDoc,
  collection,
  CollectionReference,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  FirestoreDataConverter,
  FirestoreError,
  getFirestore,
  onSnapshot,
  QueryDocumentSnapshot,
  Timestamp,
  Unsubscribe,
} from "@firebase/firestore";
import { StripePayments, StripePaymentsError } from "./index";
import { checkNonEmptyString, checkPositiveNumber } from "./utils";

/**
 * Parameters common across all session types.
 */
export interface CommonSessionCreateParams {
  /**
   * The URL the customer will be directed to if they decide to cancel payment and return to
   * your website.
   */
  cancelUrl?: string;

  /**
   * The mode of the Checkout Session. If not specified defaults to `subscription`.
   */
  mode?: "subscription" | "payment";

  /**
   * The URL to which Stripe should send customers when payment or setup is complete.
   */
  successUrl?: string;
}

/**
 * Parameters for createing a session with a Stripe price ID.
 */
export interface PriceIdSessionCreateParams extends CommonSessionCreateParams {
  /**
   * The ID of the Stripe price.
   */
  priceId: string;

  /**
   * The quantity of the item being purchased. Defaults to 1.
   */
  quantity?: number;
}

/**
 * Parameters for creating a new session.
 */
export type SessionCreateParams = PriceIdSessionCreateParams;

/**
 * Interface of Stripe checkout session.
 */
export interface Session {
  /**
   * The URL the customer will be directed to if they decide to cancel payment and return to
   * your website.
   */
  readonly cancelUrl: string;

  /**
   * Time when the session was created as a UTC timestamp.
   */
  readonly createdAt: string;

  /**
   * Unique identifier for the session. Used to pass to `redirectToCheckout()` in Stripe.js.
   */
  readonly id: string;

  /**
   * The mode of the Checkout Session.
   */
  readonly mode: "subscription" | "payment";

  /**
   * The URL to which Stripe should send customers when payment or setup is complete.
   */
  readonly successUrl: string;

  /**
   * The URL to the Checkout Session. Redirect the user to this URL to complete the payment.
   */
  readonly url: string;

  /**
   * The ID of the Stripe price object purchased with this session.
   */
  readonly priceId?: string;

  /**
   * The quantity of item purchased. Defaults to 1.
   */
  readonly quantity?: number;
}

/**
 * Creates a new Stripe checkout session with the given parameters. Returned session contains a
 * session ID and a session URL that can be used to redirect the user to complete the checkout.
 *
 * @param payments - A valid {@link StripePayments} object.
 * @param params - Parameters of the checkout session.
 * @returns Resolves with the created Stripe Session object.
 */
export function createCheckoutSession(
  payments: StripePayments,
  params: SessionCreateParams
): Promise<Session> {
  params = checkAndUpdateParams(params);
  const dao: SessionDAO = getOrInitSessionDAO(payments);
  return dao.createCheckoutSession(params);
}

function checkAndUpdateParams(
  params: SessionCreateParams
): SessionCreateParams {
  params = { ...params };
  checkAndUpdateCommonParams(params);
  checkAndUpdatePriceIdParams(params);
  return params;
}

function checkAndUpdateCommonParams(params: SessionCreateParams) {
  if (typeof params.cancelUrl !== "undefined") {
    checkNonEmptyString(
      params.cancelUrl,
      "cancelUrl must be a non-empty string."
    );
  } else {
    params.cancelUrl = window.location.href;
  }

  params.mode ??= "subscription";
  if (typeof params.successUrl !== "undefined") {
    checkNonEmptyString(
      params.successUrl,
      "successUrl must be a non-empty string."
    );
  } else {
    params.successUrl = window.location.href;
  }
}

function checkAndUpdatePriceIdParams(params: PriceIdSessionCreateParams) {
  checkNonEmptyString(params.priceId, "priceId must be a non-empty string.");
  if (typeof params.quantity !== "undefined") {
    checkPositiveNumber(
      params.quantity,
      "quantity must be a positive integer."
    );
  }
}

export interface SessionDAO {
  createCheckoutSession(params: SessionCreateParams): Promise<Session>;
}

type Mutable<T> = { -readonly [P in keyof T]: T[P] };
type MutableSession = Mutable<Partial<Session>>;

class FirestoreSessionDAO implements SessionDAO {
  private readonly auth: Auth;
  private readonly firestore: Firestore;

  constructor(app: FirebaseApp, private readonly customersCollection: string) {
    this.auth = getAuth(app);
    this.firestore = getFirestore(app);
  }

  public async createCheckoutSession(
    params: SessionCreateParams
  ): Promise<Session> {
    const currentUser: string | undefined = this.auth.currentUser?.uid;
    if (!currentUser) {
      throw new StripePaymentsError(
        "unauthenticated",
        "Failed to determine currently signed in user. User not signed in."
      );
    }

    const sessions: CollectionReference<MutableSession> = collection(
      this.firestore,
      this.customersCollection,
      currentUser,
      "checkout_sessions"
    ).withConverter(SESSION_CONVERTER);
    try {
      const doc: DocumentReference<MutableSession> = await addDoc(
        sessions,
        params
      );
      return await this.waitForSessionId(doc);
    } catch (err) {
      throw new StripePaymentsError(
        "internal",
        "Error while querying Firestore.",
        err
      );
    }
  }

  private waitForSessionId(
    doc: DocumentReference<MutableSession>
  ): Promise<Session> {
    let cancel: Unsubscribe;
    return new Promise<Session>((resolve, reject) => {
      cancel = onSnapshot(
        doc,
        (snap: DocumentSnapshot<MutableSession>) => {
          const session: MutableSession | undefined = snap.data();
          if (hasSessionId(session)) {
            resolve(session);
          }
        },
        (err: FirestoreError) => {
          reject(err);
        }
      );
    }).finally(() => cancel());
  }
}

function hasSessionId(session: MutableSession | undefined): session is Session {
  return !!session && "id" in session;
}

const SESSION_CONVERTER: FirestoreDataConverter<MutableSession> = {
  toFirestore: (session: MutableSession): DocumentData => {
    const data: DocumentData = {
      cancel_url: session.cancelUrl,
      mode: session.mode,
      price: session.priceId,
      success_url: session.successUrl,
    };

    if (typeof session.quantity !== "undefined") {
      data.quantity = session.quantity;
    }

    return data;
  },
  fromFirestore: (snapshot: QueryDocumentSnapshot): MutableSession => {
    const data: DocumentData = snapshot.data();
    const session: Partial<Mutable<Session>> = {
      cancelUrl: data.cancel_url,
      mode: data.mode,
      priceId: data.price,
      successUrl: data.success_url,
    };

    if (typeof data.created !== "undefined") {
      session.createdAt = toUTCDateString(data.created);
    }

    if (typeof data.quantity !== "undefined") {
      session.quantity = data.quantity;
    }

    if (typeof data.sessionId !== "undefined") {
      session.id = data.sessionId;
    }

    if (typeof data.url !== "undefined") {
      session.url = data.url;
    }

    return session;
  },
};

function toUTCDateString(timestamp: Timestamp): string {
  return timestamp.toDate().toUTCString();
}

const SESSION_DAO_KEY = "checkout-session-dao" as const;

function getOrInitSessionDAO(payments: StripePayments): SessionDAO {
  let dao: SessionDAO | null =
    payments.getComponent<SessionDAO>(SESSION_DAO_KEY);
  if (!dao) {
    dao = new FirestoreSessionDAO(payments.app, payments.customersCollection);
    setSessionDAO(payments, dao);
  }

  return dao;
}

/**
 * Internal API for registering a {@link SessionDAO} instance with {@link StripePayments}.
 * Exported for testing.
 *
 * @internal
 */
export function setSessionDAO(payments: StripePayments, dao: SessionDAO): void {
  payments.setComponent(SESSION_DAO_KEY, dao);
}
