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

import { FirebaseApp, registerVersion } from "firebase/app";

registerVersion("firestore-stripe-payments", "__VERSION__");

/**
 * Serves as the main entry point to this library. Initializes the client SDK,
 * and returns a handle object that can be passed into other APIs.
 *
 * @param app - A FirebaseApp instance initialized by the Firebase JS SDK.
 * @param options - Configuration options for the SDK.
 * @returns An instance of the StripePayments class.
 */
export function getStripePayments(
  app: FirebaseApp,
  options: StripePaymentsOptions
): StripePayments {
  return StripePayments.create(app, options);
}

/**
 * Configuration options that indicate how the Stripe payments extension has been set up.
 */
export interface StripePaymentsOptions {
  customersCollection: string;
  productsCollection: string;
}

type Components = Record<string, unknown>;

/**
 * Holds the configuration and other state information of the SDK. An instance of this class
 * must be passed to almost all the other APIs of this library. Do not directly call the
 * constructor. Use the {@link getStripePayments} function to obtain an instance.
 */
export class StripePayments {
  private readonly components: Components = {};

  private constructor(
    readonly app: FirebaseApp,
    private readonly options: StripePaymentsOptions
  ) {}

  /**
   * @internal
   */
  static create(
    app: FirebaseApp,
    options: StripePaymentsOptions
  ): StripePayments {
    return new StripePayments(app, options);
  }

  /**
   * Name of the customers collection as configured in the extension.
   */
  get customersCollection(): string {
    return this.options.customersCollection;
  }

  /**
   * Name of the products collection as configured in the extension.
   */
  get productsCollection(): string {
    return this.options.productsCollection;
  }

  /**
   * @internal
   */
  getComponent<T>(key: string): T | null {
    let dao = this.components[key];
    if (dao) {
      return dao as T;
    }

    return null;
  }

  /**
   * @internal
   */
  setComponent<T>(key: string, dao: T) {
    this.components[key] = dao;
  }
}

/**
 * Union of possible error codes.
 */
export type StripePaymentsErrorCode =
  | "deadline-exceeded"
  | "not-found"
  | "permission-denied"
  | "unauthenticated"
  | "internal";

/**
 * An error thrown by this SDK.
 */
export class StripePaymentsError extends Error {
  constructor(
    readonly code: StripePaymentsErrorCode,
    readonly message: string,
    readonly cause?: any
  ) {
    super(message);
  }
}
