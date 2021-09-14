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
import { doc, getDoc, getFirestore } from "@firebase/firestore";
import { StripePayments, StripePaymentsError } from "./init";
import { checkNonEmptyString, checkStripePayments } from "./utils";

/**
 * Interface of a Stripe Product stored in the app database.
 */
export interface Product {
  /**
   * Unique Stripe product ID.
   */
  readonly id: string;

  /**
   * Whether the product is currently available for purchase.
   */
  readonly active: boolean;

  /**
   * The product's name, meant to be displayable to the customer. Whenever this product is sold
   * via a subscription, name will show up on associated invoice line item descriptions.
   */
  readonly name: string;

  /**
   * The product's description, meant to be displayable to the customer. Use this field to
   * optionally store a long form explanation of the product being sold for your own
   * rendering purposes.
   */
  readonly description: string | null;

  /**
   * The Firebase role that will be assigned to the user if they are subscribed to this plan.
   */
  readonly role: string | null;

  /**
   * A list of up to 8 URLs of images for this product, meant to be displayable to the customer.
   */
  readonly images: string[];

  /**
   * A list of Prices for this billing product. Only populated if explicitly requested
   * during retrieval.
   */
  readonly prices: Price[];

  /**
   * A collection of additional product metadata.
   */
  readonly metadata: { [key: string]: string | number | null };

  readonly [propName: string]: any;
}

/**
 * Interface of a Stripe Price stored in the app database.
 */
export interface Price {
  readonly id: string;
  readonly productId: string;
  readonly active: boolean;
  readonly currency: string;
  readonly unitAmount: number;
  readonly description: string | null;
  readonly type: "one_time" | "recurring";
  readonly interval: "day" | "month" | "week" | "year" | null;
  readonly intervalCount: number | null;
  readonly trialPeriodDays: number | null;
  readonly [propName: string]: any;
}

/**
 * Retrieves a Stripe product from the database.
 *
 * @param payments - A valid {@link StripePayments} object.
 * @param productId - ID of the product to retrieve.
 * @returns Resolves with a Stripe Product object if found. Rejects if the specified product ID
 *  does not exist.
 */
export async function getProduct(
  payments: StripePayments,
  productId: string
): Promise<Product> {
  checkStripePayments(
    payments,
    "payments must be a valid StripePayments instance."
  );
  checkNonEmptyString(productId, "productId must be a non-empty string.");

  const dao: ProductDAO = getOrInitProductDAO(payments);
  return await dao.getProduct(productId);
}

/**
 * @internal
 */
export interface ProductDAO {
  getProduct(productId: string, options?: {includePrices?: boolean}): Promise<Product>;
}

class FirestoreProductDAO implements ProductDAO {
  constructor(
    private readonly app: FirebaseApp,
    private readonly productsCollection: string
  ) {}

  public async getProduct(productId: string): Promise<Product> {
    const firestore = getFirestore(this.app);
    const productRef = doc(firestore, this.productsCollection, productId);
    try {
      const productSnap = await getDoc(productRef);
      if (productSnap.exists()) {
        return {...productSnap.data() as Product, id: productId, prices: []};
      }

      throw new StripePaymentsError("not-found", "no such productId");
    } catch (error) {
      throw new StripePaymentsError(
        "internal",
        "error while querying Firestore",
        error
      );
    }
  }
}

const PRODUCT_DAO_KEY = "product-dao" as const;

function getOrInitProductDAO(payments: StripePayments): ProductDAO {
  let dao: ProductDAO | null = payments.getComponent<ProductDAO>(
    PRODUCT_DAO_KEY
  );
  if (!dao) {
    dao = new FirestoreProductDAO(payments.app, payments.productsCollection);
    setProductDAO(payments, dao);
  }

  return dao;
}

/**
 * @internal
 */
export function setProductDAO(payments: StripePayments, dao: ProductDAO): void {
  payments.setComponent(PRODUCT_DAO_KEY, dao);
}
