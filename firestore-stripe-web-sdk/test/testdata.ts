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

import { Timestamp } from "@firebase/firestore";
import { Price, Product, Subscription } from "../src/index";

export const economyPlan: Product = {
  active: false,
  description: "Access to old content with ads",
  id: "economy",
  images: [],
  metadata: {},
  name: "Economy plan",
  prices: [],
  role: null,
};

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

export const standardPlan: Product = {
  active: true,
  description: "Access to only regional content",
  id: "standard",
  images: [],
  metadata: {},
  name: "Standard plan",
  prices: [],
  role: null,
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

export interface SubscriptionData {
  uid: string;
  subscriptions: Record<string, Record<string, any>>;
}

export const subscription1: Subscription = {
  cancelAt: null,
  cancelAtPeriodEnd: true,
  canceledAt: null,
  created: "Wed, 29 Sep 2021 21:46:20 GMT",
  currentPeriodEnd: "Mon, 28 Mar 2022 21:46:20 GMT",
  currentPeriodStart: "Wed, 29 Sep 2021 21:46:20 GMT",
  endedAt: null,
  id: "sub1",
  metadata: {},
  priceId: "price1",
  prices: [
    {
      productId: "premium",
      priceId: "price1",
    },
  ],
  productId: "premium",
  quantity: null,
  role: null,
  status: "active",
  stripeLink: "https://example.stripe.com/subscriptions/sub1",
  trialEnd: null,
  trialStart: null,
  uid: "dynamic",
};

export const subscription2: Subscription = {
  cancelAt: "Tue, 28 Sep 2021 21:46:20 GMT",
  cancelAtPeriodEnd: true,
  canceledAt: "Tue, 28 Sep 2021 21:46:20 GMT",
  created: "Wed, 29 Sep 2021 21:46:20 GMT",
  currentPeriodEnd: "Mon, 28 Mar 2022 21:46:20 GMT",
  currentPeriodStart: "Wed, 29 Sep 2021 21:46:20 GMT",
  endedAt: "Tue, 28 Sep 2021 21:46:20 GMT",
  id: "sub2",
  metadata: {
    key: "value",
  },
  priceId: "price1",
  prices: [
    {
      productId: "standard",
      priceId: "price1",
    },
  ],
  productId: "standard",
  quantity: 1,
  role: "moderator",
  status: "active",
  stripeLink: "https://example.stripe.com/subscriptions/sub1",
  trialEnd: "Tue, 28 Sep 2021 21:46:20 GMT",
  trialStart: "Tue, 28 Sep 2021 21:46:20 GMT",
  uid: "dynamic",
};

export const rawSubscriptionData: Record<string, Record<string, any>> = {
  sub1: {
    cancel_at: null,
    cancel_at_period_end: true,
    canceled_at: null,
    created: Timestamp.fromMillis(1632951980066),
    current_period_end: Timestamp.fromMillis(1648503980066),
    current_period_start: Timestamp.fromMillis(1632951980066),
    ended_at: null,
    metadata: {},
    product: "premium",
    price: "price1",
    prices: [{ product: "premium", price: "price1" }],
    quantity: null,
    role: null,
    status: "active",
    stripeLink: "https://example.stripe.com/subscriptions/sub1",
    trial_end: null,
    trial_start: null,
  },
  sub2: {
    cancel_at: Timestamp.fromMillis(1632865580066),
    cancel_at_period_end: true,
    created: Timestamp.fromMillis(1632951980066),
    canceled_at: Timestamp.fromMillis(1632865580066),
    current_period_end: Timestamp.fromMillis(1648503980066),
    current_period_start: Timestamp.fromMillis(1632951980066),
    ended_at: Timestamp.fromMillis(1632865580066),
    metadata: {
      key: "value",
    },
    product: "standard",
    price: "price1",
    prices: [{ product: "standard", price: "price1" }],
    quantity: 1,
    role: "moderator",
    status: "active",
    stripeLink: "https://example.stripe.com/subscriptions/sub1",
    trial_end: Timestamp.fromMillis(1632865580066),
    trial_start: Timestamp.fromMillis(1632865580066),
  },
};
