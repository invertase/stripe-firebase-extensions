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
import { Auth, getAuth } from "firebase/auth";
import { StripePayments, StripePaymentsError } from "./init";

/**
 * Internal API for retrieving the currently signed in user. Rejects with "unauthenticated" if
 * the user is not signed in. Exposed for internal use.
 *
 * @internal
 */
export function getCurrentUser(payments: StripePayments): Promise<string> {
  try {
    const uid: string = getCurrentUserSync(payments);
    return Promise.resolve(uid);
  } catch (err: unknown) {
    return Promise.reject(err);
  }
}

/**
 * Internal API for retrieving the currently signed in user. Throws "unauthenticated" if
 * the user is not signed in. Exposed for internal use.
 *
 * @internal
 */
export function getCurrentUserSync(payments: StripePayments): string {
  const dao: UserDAO = getOrInitUserDAO(payments);
  return dao.getCurrentUser();
}

/**
 * Internal interface for introspecting the current user's login session. Exposed for testing.
 *
 * @internal
 */
export interface UserDAO {
  getCurrentUser(): string;
}

class FirebaseAuthUserDAO implements UserDAO {
  private readonly auth: Auth;

  constructor(app: FirebaseApp) {
    this.auth = getAuth(app);
  }

  public getCurrentUser(): string {
    const currentUser: string | undefined = this.auth.currentUser?.uid;
    if (!currentUser) {
      throw new StripePaymentsError(
        "unauthenticated",
        "Failed to determine currently signed in user. User not signed in."
      );
    }

    return currentUser;
  }
}

const USER_DAO_KEY = "user-dao" as const;

function getOrInitUserDAO(payments: StripePayments): UserDAO {
  let dao: UserDAO | null = payments.getComponent<UserDAO>(USER_DAO_KEY);
  if (!dao) {
    dao = new FirebaseAuthUserDAO(payments.app);
    setUserDAO(payments, dao);
  }

  return dao;
}

/**
 * Internal API for registering a {@link UserDAO} instance with {@link StripePayments}.
 * Exported for testing.
 *
 * @internal
 */
export function setUserDAO(payments: StripePayments, dao: UserDAO): void {
  payments.setComponent(USER_DAO_KEY, dao);
}
