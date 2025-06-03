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
} from "firebase/firestore";
import { StripePayments, StripePaymentsError } from "./init";
import { getCurrentUser } from "./user";
import {
  checkNonEmptyArray,
  checkNonEmptyString,
  checkPositiveNumber,
} from "./utils";

/**
 * Parameters common across all session types.
 */
export interface CommonSessionCreateParams {
  /**
   * Enables user redeemable promotion codes.
   */
  allow_promotion_codes?: boolean;

  /**
   * Set to true to enable automatic taxes. Defaults to false.
   */
  automatic_tax?: boolean;

  /**
   * A unique string to reference the Checkout Session. This can be a customer ID, a cart ID,
   * or similar, and can be used to reconcile the session with your internal systems.
   */
  client_reference_id?: string;

  /**
   * The URL the customer will be directed to if they decide to cancel payment and return to
   * your website.
   */
  cancel_url?: string;

  /**
   * Set of key-value pairs that you can attach to an object. This can be useful for storing
   * additional information about the object in a structured format.
   */
  metadata?: { [key: string]: any };

  /**
   * The mode of the Checkout Session. If not specified defaults to `subscription`.
   */
  mode?: "subscription" | "payment";

  /**
   * A list of the types of payment methods (e.g., `card`) this Checkout Session can accept.
   * Defaults to `["card"]`.
   */
  payment_method_types?: PaymentMethodType[];

  /**
   * The promotion code to apply to this Session.
   */
  promotion_code?: string;

  /**
   * The URL to which Stripe should send customers when payment or setup is complete.
   */
  success_url?: string;

  /**
   * Controls tax ID collection settings for the session.
   */
  tax_id_collection?: boolean;

  /**
   * Indicates if a plan’s `trial_period_days` should be applied to the subscription. Defaults
   * to `true`.
   */
  trial_from_plan?: boolean;
}

/**
 * Supported payment methods.
 */
export type PaymentMethodType =
  | "card"
  | "acss_debit"
  | "afterpay_clearpay"
  | "alipay"
  | "bacs_debit"
  | "bancontact"
  | "boleto"
  | "eps"
  | "fpx"
  | "giropay"
  | "grabpay"
  | "ideal"
  | "klarna"
  | "oxxo"
  | "p24"
  | "sepa_debit"
  | "sofort"
  | "wechat_pay";

/**
 * Parameters for createing a session with one or more line items.
 */
export interface LineItemSessionCreateParams extends CommonSessionCreateParams {
  line_items: LineItemParams[];
}

/**
 * Parameters common across all line item types.
 */
export interface CommonLineItemParams {
  /**
   * The description for the line item, to be displayed on the Checkout page.
   */
  description?: string;

  /**
   * The quantity of the line item being purchased.
   */
  quantity?: number;
}

/**
 * Parameters for createing a line item with a Stripe price ID.
 */
export interface PriceIdLineItemParams extends CommonLineItemParams {
  /**
   * The ID of the Stripe price.
   */
  price: string;
}

/**
 * Parameters for creating a new line item.
 */
export type LineItemParams = PriceIdLineItemParams;

/**
 * Parameters for createing a session with a Stripe price ID.
 */
export interface PriceIdSessionCreateParams extends CommonSessionCreateParams {
  /**
   * The ID of the Stripe price.
   */
  price: string;

  /**
   * The quantity of the item being purchased. Defaults to 1.
   */
  quantity?: number;
}

/**
 * Parameters for creating a new session.
 */
export type SessionCreateParams =
  | LineItemSessionCreateParams
  | PriceIdSessionCreateParams;

function hasLineItems(
  params: SessionCreateParams
): params is LineItemSessionCreateParams {
  return "line_items" in params;
}

/**
 * Interface of Stripe checkout session.
 */
export interface Session {
  /**
   * The URL the customer will be directed to if they decide to cancel payment and return to
   * your website.
   */
  readonly cancel_url: string;

  /**
   * Time when the session was created as a UTC timestamp.
   */
  readonly created_at: string;

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
  readonly success_url: string;

  /**
   * The URL to the Checkout Session. Redirect the user to this URL to complete the payment.
   */
  readonly url: string;

  /**
   * Enables user redeemable promotion codes.
   */
  readonly allow_promotion_codes?: boolean;

  /**
   * Indicates whether automatic tax is enabled for the session
   */
  readonly automatic_tax?: boolean;

  /**
   * A unique string to reference the Checkout Session. This can be a customer ID, a cart ID,
   * or similar, and can be used to reconcile the session with your internal systems.
   */
  readonly client_reference_id?: string;

  /**
   * The array of line items purchased with this session. A session is guaranteed to contain either
   * {@link Session.line_items} or {@link Session.price}.
   */
  readonly line_items?: LineItem[];

  /**
   * Set of key-value pairs that you can attach to an object. This can be useful for storing
   * additional information about the object in a structured format.
   */
  readonly metadata?: { [key: string]: any };

  /**
   * A list of the types of payment methods (e.g., `card`) this Checkout Session can accept.
   * Defaults to `["card"]`.
   */
  readonly payment_method_types?: PaymentMethodType[];

  /**
   * The ID of the Stripe price object purchased with this session. A session is guaranteed to
   * contain either {@link Session.line_items} or {@link Session.price}.
   */
  readonly price?: string;

  /**
   * The promotion code to apply to this Session.
   */
  readonly promotion_code?: string;

  /**
   * The quantity of item purchased. Defaults to 1.
   */
  readonly quantity?: number;

  /**
   * Controls tax ID collection settings for the session.
   */
  readonly tax_id_collection?: boolean;

  /**
   * Indicates if a plan’s `trial_period_days` should be applied to the subscription. Defaults
   * to `true`.
   */
  readonly trial_from_plan?: boolean;
}

/**
 * Interface of a Stripe line item associated with a checkout session. A line item represents
 * an individual item purchased using the session.
 */
export interface LineItem {
  /**
   * The amount to be collected per unit of the line item.
   */
  amount?: number;

  /**
   * Three-letter {@link https://www.iso.org/iso-4217-currency-codes.html | ISO currency code},
   * in lowercase. Must be a {@link https://stripe.com/docs/currencies | supported currency}.
   */
  currency?: string;

  /**
   * The description for the line item, to be displayed on the Checkout page.
   */
  description?: string;

  /**
   * The name for the item to be displayed on the Checkout page.
   */
  name?: string;

  /**
   * The ID of the Stripe price.
   */
  price?: string;

  /**
   * The quantity of the line item being purchased.
   */
  quantity?: number;
}

export const CREATE_SESSION_TIMEOUT_MILLIS = 30 * 1000;

/**
 * Optional settings for the {@link createCheckoutSession} function.
 */
export interface CreateCheckoutSessionOptions {
  /**
   * Time to wait (in milliseconds) until the session is created and acknowledged by  Stripe.
   * If not specified, defaults to {@link CREATE_SESSION_TIMEOUT_MILLIS}.
   */
  timeoutMillis?: number;
}

/**
 * Creates a new Stripe checkout session with the given parameters. Returned session contains a
 * session ID and a session URL that can be used to redirect the user to complete the checkout.
 * User must be currently signed in with Firebase Auth to call this API. If a timeout occurs
 * while waiting for the session to be created and acknowledged by Stripe, rejects with a
 * `deadline-exceeded` error. Default timeout duration is {@link CREATE_SESSION_TIMEOUT_MILLIS}.
 *
 * @param payments - A valid {@link StripePayments} object.
 * @param params - Parameters of the checkout session.
 * @param options - Optional settings to customize the behavior.
 * @returns Resolves with the created Stripe Session object.
 */
export function createCheckoutSession(
  payments: StripePayments,
  params: SessionCreateParams,
  options?: CreateCheckoutSessionOptions
): Promise<Session> {
  params = { ...params };
  checkAndUpdateCommonParams(params);
  if (hasLineItems(params)) {
    checkLineItemParams(params);
  } else {
    checkPriceIdParams(params);
  }

  const timeoutMillis: number = getTimeoutMillis(options?.timeoutMillis);
  return getCurrentUser(payments).then((uid: string) => {
    const dao: SessionDAO = getOrInitSessionDAO(payments);
    return dao.createCheckoutSession(uid, params, timeoutMillis);
  });
}

function checkAndUpdateCommonParams(params: SessionCreateParams): void {
  if (typeof params.cancel_url !== "undefined") {
    checkNonEmptyString(
      params.cancel_url,
      "cancel_url must be a non-empty string."
    );
  } else {
    params.cancel_url = window.location.href;
  }

  params.mode ??= "subscription";
  if (typeof params.success_url !== "undefined") {
    checkNonEmptyString(
      params.success_url,
      "success_url must be a non-empty string."
    );
  } else {
    params.success_url = window.location.href;
  }
}

function checkLineItemParams(params: LineItemSessionCreateParams): void {
  checkNonEmptyArray(
    params.line_items,
    "line_items must be a non-empty array."
  );
}

function checkPriceIdParams(params: PriceIdSessionCreateParams): void {
  checkNonEmptyString(params.price, "price must be a non-empty string.");
  if (typeof params.quantity !== "undefined") {
    checkPositiveNumber(
      params.quantity,
      "quantity must be a positive integer."
    );
  }
}

function getTimeoutMillis(timeoutMillis: number | undefined): number {
  if (typeof timeoutMillis !== "undefined") {
    checkPositiveNumber(
      timeoutMillis,
      "timeoutMillis must be a positive number."
    );
    return timeoutMillis;
  }

  return CREATE_SESSION_TIMEOUT_MILLIS;
}

/**
 * Internal interface for all database interactions pertaining to Stripe sessions. Exported
 * for testing.
 *
 * @internal
 */
export interface SessionDAO {
  createCheckoutSession(
    uid: string,
    params: SessionCreateParams,
    timeoutMillis: number
  ): Promise<Session>;
}

class FirestoreSessionDAO implements SessionDAO {
  private readonly firestore: Firestore;

  constructor(app: FirebaseApp, private readonly customersCollection: string) {
    this.firestore = getFirestore(app);
  }

  public async createCheckoutSession(
    uid: string,
    params: SessionCreateParams,
    timeoutMillis: number
  ): Promise<Session> {
    const doc: DocumentReference = await this.addSessionDoc(uid, params);
    return this.waitForSessionId(doc, timeoutMillis);
  }

  private async addSessionDoc(
    uid: string,
    params: SessionCreateParams
  ): Promise<DocumentReference> {
    const sessions: CollectionReference = collection(
      this.firestore,
      this.customersCollection,
      uid,
      "checkout_sessions"
    );
    try {
      return await addDoc(sessions, params);
    } catch (err) {
      throw new StripePaymentsError(
        "internal",
        "Error while querying Firestore.",
        err
      );
    }
  }

  private waitForSessionId(
    doc: DocumentReference,
    timeoutMillis: number
  ): Promise<Session> {
    let cancel: Unsubscribe;
    return new Promise<Session>((resolve, reject) => {
      const timeout: ReturnType<typeof setTimeout> = setTimeout(() => {
        reject(
          new StripePaymentsError(
            "deadline-exceeded",
            "Timeout while waiting for session response."
          )
        );
      }, timeoutMillis);
      cancel = onSnapshot(
        doc.withConverter(SESSION_CONVERTER),
        (snap: DocumentSnapshot<PartialSession>) => {
          const session: PartialSession | undefined = snap.data();
          if (hasSessionId(session)) {
            clearTimeout(timeout);
            resolve(session);
          }
        },
        (err: FirestoreError) => {
          clearTimeout(timeout);
          reject(
            new StripePaymentsError(
              "internal",
              "Error while querying Firestore.",
              err
            )
          );
        }
      );
    }).finally(() => cancel());
  }
}

type PartialSession = Partial<Session>;

function hasSessionId(session: PartialSession | undefined): session is Session {
  return typeof session?.id !== "undefined";
}

const SESSION_CONVERTER: FirestoreDataConverter<PartialSession> = {
  toFirestore: (): DocumentData => {
    throw new Error("Not implemented for readonly Session type.");
  },
  fromFirestore: (snapshot: QueryDocumentSnapshot): PartialSession => {
    const { created, sessionId, ...rest } = snapshot.data();
    if (typeof sessionId !== "undefined") {
      return {
        ...(rest as Session),
        id: sessionId,
        created_at: toUTCDateString(created),
      };
    }

    return { ...(rest as Session) };
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
