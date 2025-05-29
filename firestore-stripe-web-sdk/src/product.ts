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
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  FirestoreDataConverter,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  Query,
  QueryConstraint,
  QueryDocumentSnapshot,
  QuerySnapshot,
  where,
  WhereFilterOp,
} from "firebase/firestore";
import { StripePayments, StripePaymentsError } from "./init";
import { checkNonEmptyString } from "./utils";

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
 * Interface of a Stripe Price object stored in the app database.
 */
export interface Price {
  /**
   * Unique Stripe price ID.
   */
  readonly id: string;

  /**
   * ID of the Stripe product to which this price is related.
   */
  readonly product: string;

  /**
   * Whether the price can be used for new purchases.
   */
  readonly active: boolean;

  /**
   * Three-letter ISO currency code.
   */
  readonly currency: string;

  /**
   * The unit amount in cents to be charged, represented as a whole integer if possible.
   */
  readonly unit_amount: number | null;

  /**
   * A brief description of the price.
   */
  readonly description: string | null;

  /**
   * One of `one_time` or `recurring` depending on whether the price is for a one-time purchase
   * or a recurring (subscription) purchase.
   */
  readonly type: "one_time" | "recurring";

  /**
   * The frequency at which a subscription is billed. One of `day`, `week`, `month` or `year`.
   */
  readonly interval: "day" | "month" | "week" | "year" | null;

  /**
   * The number of intervals (specified in the {@link Price.interval} attribute) between
   * subscription billings. For example, `interval=month` and `interval_count=3` bills every
   * 3 months.
   */
  readonly interval_count: number | null;

  /**
   * Default number of trial days when subscribing a customer to this price using
   * {@link https://stripe.com/docs/api#create_subscription-trial_from_plan | trial_from_plan}.
   */
  readonly trial_period_days: number | null;

  readonly [propName: string]: any;
}

/**
 * Optional parameters for the {@link getProduct} function.
 */
export interface GetProductOptions {
  /**
   * Set to `true` to retrieve the prices along with a product. If not set, the product is
   * returned with no prices (i.e. {@link Product.prices} field will be empty).
   */
  includePrices?: boolean;
}

/**
 * Retrieves a Stripe product from the database.
 *
 * @param payments - A valid {@link StripePayments} object.
 * @param productId - ID of the product to retrieve.
 * @param options - A set of options to customize the behavior.
 * @returns Resolves with a Stripe Product object if found. Rejects if the specified product ID
 *  does not exist.
 */
export function getProduct(
  payments: StripePayments,
  productId: string,
  options?: GetProductOptions
): Promise<Product> {
  checkNonEmptyString(productId, "productId must be a non-empty string.");
  const dao: ProductDAO = getOrInitProductDAO(payments);
  return dao.getProduct(productId).then((product: Product) => {
    if (options?.includePrices) {
      return getProductWithPrices(dao, product);
    }

    return product;
  });
}

/**
 * Optional parameters for the {@link getProducts} function.
 */
export interface GetProductsOptions {
  /**
   * Set to `true` to retrieve only the currently active set of Stripe products. If not set,
   * returns all available products. When set, the effect is same as if called with the filter
   * `["active", "==", true]`.
   */
  activeOnly?: boolean;

  /**
   * An array of optoinal filters that will be applied when querying the products from the app
   * database.
   */
  where?: WhereFilter[];

  /**
   * Set to `true` to retrieve the prices along with a product. If not set, the product is
   * returned with no prices (i.e. {@link Product.prices} field will be empty).
   */
  includePrices?: boolean;

  /**
   * Maximum number of products to return.
   */
  limit?: number;
}

export { WhereFilterOp } from "firebase/firestore";

/**
 * A filter constraint that can be applied to database queries. Consists of a field name (in
 * Firestore dotted notation), a Firestore filter operator, and a value.
 */
export type WhereFilter = [string, WhereFilterOp, any];

/**
 * Retrieves a Stripe product from the database.
 *
 * @param payments - A valid {@link StripePayments} object.
 * @param productId - ID of the product to retrieve.
 * @param options - A set of options to customize the behavior.
 * @returns Resolves with an array of Stripe Product objects. May be empty.
 */
export function getProducts(
  payments: StripePayments,
  options?: GetProductsOptions
): Promise<Product[]> {
  const dao: ProductDAO = getOrInitProductDAO(payments);
  const { includePrices, ...rest } = options ?? {};
  return dao.getProducts(rest).then((products: Product[]) => {
    if (includePrices) {
      const productsWithPrices: Promise<Product>[] = products.map(
        (product: Product) => getProductWithPrices(dao, product)
      );
      return Promise.all(productsWithPrices);
    }

    return products;
  });
}

async function getProductWithPrices(
  dao: ProductDAO,
  product: Product
): Promise<Product> {
  const prices: Price[] = await dao.getPrices(product.id);
  return { ...product, prices };
}

/**
 * Retrieves a Stripe price from the database.
 *
 * @param payments - A valid {@link StripePayments} object.
 * @param productId - ID of the product to which the price belongs.
 * @param priceId - ID of the price to retrieve.
 * @returns Resolves with a Stripe Price object if found. Rejects if the specified
 *   product ID or the price ID does not exist.
 */
export function getPrice(
  payments: StripePayments,
  productId: string,
  priceId: string
): Promise<Price> {
  checkNonEmptyString(productId, "productId must be a non-empty string.");
  checkNonEmptyString(priceId, "priceId must be a non-empty string.");
  const dao: ProductDAO = getOrInitProductDAO(payments);
  return dao.getPrice(productId, priceId);
}

/**
 * Retrieves all Stripe prices associated with the specified product.
 *
 * @param payments - A valid {@link StripePayments} object.
 * @param productId - ID of the product to which the prices belong.
 * @returns Resolves with an array of Stripe Price objects. Rejects if the specified
 *   product ID does not exist. If the product exists, but doesn't have any prices, resolves
 *   with the empty array.
 */
export function getPrices(
  payments: StripePayments,
  productId: string
): Promise<Price[]> {
  checkNonEmptyString(productId, "productId must be a non-empty string.");
  const dao: ProductDAO = getOrInitProductDAO(payments);
  return dao.getPrices(productId, { assertProduct: true });
}

/**
 * Internal interface for all database interactions pertaining to Stripe products. Exported
 * for testing.
 *
 * @internal
 */
export interface ProductDAO {
  getProduct(productId: string): Promise<Product>;
  getProducts(options?: {
    activeOnly?: boolean;
    where?: WhereFilter[];
    limit?: number;
  }): Promise<Product[]>;
  getPrice(productId: string, priceId: string): Promise<Price>;
  getPrices(
    productId: string,
    options?: { assertProduct?: boolean }
  ): Promise<Price[]>;
}

const PRODUCT_CONVERTER: FirestoreDataConverter<Product> = {
  toFirestore: () => {
    throw new Error("Not implemented for readonly Product type.");
  },
  fromFirestore: (snapshot: QueryDocumentSnapshot): Product => {
    return {
      ...(snapshot.data() as Product),
      id: snapshot.id,
      prices: [],
    };
  },
};

const PRICE_CONVERTER: FirestoreDataConverter<Price> = {
  toFirestore: () => {
    throw new Error("Not implemented for readonly Price type.");
  },
  fromFirestore: (snapshot: QueryDocumentSnapshot): Price => {
    const data: DocumentData = snapshot.data();
    return {
      ...(data as Price),
      id: snapshot.id,
      product: snapshot.ref.parent.parent!.id,
    };
  },
};

class FirestoreProductDAO implements ProductDAO {
  private readonly firestore: Firestore;

  constructor(app: FirebaseApp, private readonly productsCollection: string) {
    this.firestore = getFirestore(app);
  }

  public async getProduct(productId: string): Promise<Product> {
    const snap: QueryDocumentSnapshot<Product> =
      await this.getProductSnapshotIfExists(productId);
    return snap.data();
  }

  public async getProducts(options?: {
    activeOnly?: boolean;
    where?: WhereFilter[];
    limit?: number;
  }): Promise<Product[]> {
    const querySnap: QuerySnapshot<Product> = await this.getProductSnapshots(
      options
    );
    const products: Product[] = [];
    querySnap.forEach((snap: QueryDocumentSnapshot<Product>) => {
      products.push(snap.data());
    });

    return products;
  }

  public async getPrice(productId: string, priceId: string): Promise<Price> {
    const snap: QueryDocumentSnapshot<Price> =
      await this.getPriceSnapshotIfExists(productId, priceId);
    return snap.data();
  }

  public async getPrices(
    productId: string,
    options?: { assertProduct?: boolean | undefined }
  ): Promise<Price[]> {
    if (options?.assertProduct) {
      await this.getProductSnapshotIfExists(productId);
    }

    const querySnap: QuerySnapshot<Price> = await this.getPriceSnapshots(
      productId
    );
    const prices: Price[] = [];
    querySnap.forEach((snap: QueryDocumentSnapshot<Price>) => {
      prices.push(snap.data());
    });

    return prices;
  }

  private async getProductSnapshotIfExists(
    productId: string
  ): Promise<QueryDocumentSnapshot<Product>> {
    const productRef: DocumentReference<Product> = doc(
      this.firestore,
      this.productsCollection,
      productId
    ).withConverter(PRODUCT_CONVERTER);
    const snapshot: DocumentSnapshot<Product> = await this.queryFirestore(() =>
      getDoc(productRef)
    );
    if (!snapshot.exists()) {
      throw new StripePaymentsError(
        "not-found",
        `No product found with the ID: ${productId}`
      );
    }

    return snapshot;
  }

  private async getProductSnapshots(options?: {
    activeOnly?: boolean;
    where?: WhereFilter[];
    limit?: number;
  }): Promise<QuerySnapshot<Product>> {
    let productsQuery: Query<Product> = collection(
      this.firestore,
      this.productsCollection
    ).withConverter(PRODUCT_CONVERTER);
    const constraints: QueryConstraint[] = [];
    if (options?.activeOnly) {
      constraints.push(where("active", "==", true));
    }

    if (options?.where) {
      for (const filter of options.where) {
        constraints.push(where(...filter));
      }
    }

    if (typeof options?.limit !== "undefined") {
      constraints.push(limit(options.limit));
    }

    return await this.queryFirestore(() => {
      if (constraints.length > 0) {
        productsQuery = query(productsQuery, ...constraints);
      }

      return getDocs(productsQuery);
    });
  }

  private async getPriceSnapshotIfExists(
    productId: string,
    priceId: string
  ): Promise<QueryDocumentSnapshot<Price>> {
    const priceRef: DocumentReference<Price> = doc(
      this.firestore,
      this.productsCollection,
      productId,
      "prices",
      priceId
    ).withConverter(PRICE_CONVERTER);
    const snapshot: DocumentSnapshot<Price> = await this.queryFirestore(() =>
      getDoc(priceRef)
    );
    if (!snapshot.exists()) {
      throw new StripePaymentsError(
        "not-found",
        `No price found with the product ID: ${productId} and price ID: ${priceId}`
      );
    }

    return snapshot;
  }

  private async getPriceSnapshots(
    productId: string
  ): Promise<QuerySnapshot<Price>> {
    const pricesCollection: CollectionReference<Price> = collection(
      this.firestore,
      this.productsCollection,
      productId,
      "prices"
    ).withConverter(PRICE_CONVERTER);
    return await this.queryFirestore(() => getDocs(pricesCollection));
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

const PRODUCT_DAO_KEY = "product-dao" as const;

function getOrInitProductDAO(payments: StripePayments): ProductDAO {
  let dao: ProductDAO | null =
    payments.getComponent<ProductDAO>(PRODUCT_DAO_KEY);
  if (!dao) {
    dao = new FirestoreProductDAO(payments.app, payments.productsCollection);
    setProductDAO(payments, dao);
  }

  return dao;
}

/**
 * Internal API for registering a {@link ProductDAO} instance with {@link StripePayments}. Exported
 * for testing.
 *
 * @internal
 */
export function setProductDAO(payments: StripePayments, dao: ProductDAO): void {
  payments.setComponent(PRODUCT_DAO_KEY, dao);
}
