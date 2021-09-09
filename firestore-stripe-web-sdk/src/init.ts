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

import { FirebaseApp } from "@firebase/app";

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
  return new StripePayments(app);
}

/**
 * Configuration options that indicate how the Stripe payments extension has been set up.
 */
export interface StripePaymentsOptions {
  customersCollection: string;
  productsCollection: string;
}

/**
 * Holds the configuration and other state information of the SDK. An instance of this class
 * must be passed to almost all the other APIs of this library. Do not directly call the
 * constructor. Use the {@link getStripePayments} function to obtain an instance.
 */
export class StripePayments {
  constructor(readonly app: FirebaseApp) {}
}
