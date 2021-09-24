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

import { Price, Product } from "../src/index";

export const premiumPlan: Product = {
  active: true,
  customProperty: "customValue",
  description: "Access to all our content",
  id: "premium",
  images: [],
  metadata: {
    firebaseRole: "moderator",
  },
  name: "Premium plan",
  prices: [],
  role: "moderator",
};

export const premiumPlanPrice: Price = {
  active: true,
  customProperty: "customValue",
  currency: "usd",
  description: "Test price 1",
  id: "price1",
  interval: "month",
  intervalCount: null,
  productId: "premium",
  trialPeriodDays: null,
  type: "recurring",
  unitAmount: 999,
};

export const standardPlanPrice1: Price = {
  active: true,
  currency: "usd",
  description: "Test price 1",
  id: "price1",
  interval: "month",
  intervalCount: null,
  productId: "standard",
  trialPeriodDays: null,
  type: "recurring",
  unitAmount: 899,
};

export const standardPlanPrice2: Price = {
  active: true,
  currency: "usd",
  description: "Test price 1",
  id: "price2",
  interval: "year",
  intervalCount: null,
  productId: "standard",
  trialPeriodDays: null,
  type: "recurring",
  unitAmount: 9999,
};

/**
 * An interface for raw product data stored in Firestore. Each product is saved as a separate
 * document in the `productsCollection`. Each product can have 0 or more prices stored in
 * the `prices` subcollection.
 */
export interface ProductData {
  product: Record<string, any>;
  prices: Record<string, Record<string, any>>;
}

export const rawProductData: Record<string, ProductData> = {
  premium: {
    product: {
      active: true,
      customProperty: "customValue",
      description: "Access to all our content",
      images: [],
      metadata: {
        firebaseRole: "moderator",
      },
      name: "Premium plan",
      role: "moderator",
    },
    prices: {
      price1: {
        active: true,
        customProperty: "customValue",
        currency: "usd",
        description: "Test price 1",
        interval: "month",
        interval_count: null,
        trial_period_days: null,
        type: "recurring",
        unit_amount: 999,
      },
    },
  },
  standard: {
    product: {
      active: true,
      description: "Access to only regional content",
      images: [],
      metadata: {},
      name: "Standard plan",
      role: null,
    },
    prices: {
      price1: {
        active: true,
        currency: "usd",
        description: "Test price 1",
        interval: "month",
        interval_count: null,
        trial_period_days: null,
        type: "recurring",
        unit_amount: 899,
      },
      price2: {
        active: true,
        currency: "usd",
        description: "Test price 1",
        interval: "year",
        interval_count: null,
        trial_period_days: null,
        type: "recurring",
        unit_amount: 9999,
      },
    },
  },
  economy: {
    product: {
      active: false,
      description: "Access to old content with ads",
      images: [],
      metadata: {},
      name: "Economy plan",
      role: null,
    },
    prices: {},
  },
};
