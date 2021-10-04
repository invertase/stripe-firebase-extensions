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

export function checkNonEmptyString(arg: unknown, message?: string): void {
  if (typeof arg !== "string" || arg === "") {
    throw new Error(message ?? "arg must be a non-empty string.");
  }
}

export function checkPositiveNumber(arg: unknown, message?: string): void {
  if (typeof arg !== "number" || isNaN(arg) || arg <= 0) {
    throw new Error(message ?? "arg must be positive number.");
  }
}