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

import { Timestamp } from "firebase/firestore";
import { Payment, Price, Product, Subscription } from "../src/index";

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
  interval_count: null,
  product: "premium",
  trial_period_days: null,
  type: "recurring",
  unit_amount: 999,
};

export const standardPlanPrice1: Price = {
  active: true,
  currency: "usd",
  description: "Test price 1",
  id: "price1",
  interval: "month",
  interval_count: null,
  product: "standard",
  trial_period_days: null,
  type: "recurring",
  unit_amount: 899,
};

export const standardPlanPrice2: Price = {
  active: true,
  currency: "usd",
  description: "Test price 1",
  id: "price2",
  interval: "year",
  interval_count: null,
  product: "standard",
  trial_period_days: null,
  type: "recurring",
  unit_amount: 9999,
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

export const subscription1: Subscription = {
  cancel_at: null,
  cancel_at_period_end: true,
  canceled_at: null,
  created: "Wed, 29 Sep 2021 21:46:20 GMT",
  current_period_end: "Mon, 28 Mar 2022 21:46:20 GMT",
  current_period_start: "Wed, 29 Sep 2021 21:46:20 GMT",
  ended_at: null,
  id: "sub1",
  metadata: {},
  price: "price1",
  prices: [
    {
      product: "premium",
      price: "price1",
    },
  ],
  product: "premium",
  quantity: null,
  role: null,
  status: "active",
  stripe_link: "https://example.stripe.com/subscriptions/sub1",
  trial_end: null,
  trial_start: null,
  uid: "dynamic",
};

export const subscription2: Subscription = {
  cancel_at: "Tue, 28 Sep 2021 21:46:20 GMT",
  cancel_at_period_end: true,
  canceled_at: "Tue, 28 Sep 2021 21:46:20 GMT",
  created: "Wed, 29 Sep 2021 21:46:20 GMT",
  current_period_end: "Mon, 28 Mar 2022 21:46:20 GMT",
  current_period_start: "Wed, 29 Sep 2021 21:46:20 GMT",
  ended_at: "Tue, 28 Sep 2021 21:46:20 GMT",
  id: "sub2",
  metadata: {
    key: "value",
  },
  price: "price1",
  prices: [
    {
      product: "standard",
      price: "price1",
    },
  ],
  product: "standard",
  quantity: 1,
  role: "moderator",
  status: "incomplete",
  stripe_link: "https://example.stripe.com/subscriptions/sub2",
  trial_end: "Tue, 28 Sep 2021 21:46:20 GMT",
  trial_start: "Tue, 28 Sep 2021 21:46:20 GMT",
  uid: "dynamic",
};

export const subscription3: Subscription = {
  cancel_at: null,
  cancel_at_period_end: true,
  canceled_at: null,
  created: "Wed, 29 Sep 2021 21:46:20 GMT",
  current_period_end: "Mon, 28 Mar 2022 21:46:20 GMT",
  current_period_start: "Wed, 29 Sep 2021 21:46:20 GMT",
  ended_at: null,
  id: "sub3",
  metadata: {},
  price: "price1",
  prices: [
    {
      product: "premium",
      price: "price1",
    },
  ],
  product: "premium",
  quantity: null,
  role: null,
  status: "canceled",
  stripe_link: "https://example.stripe.com/subscriptions/sub3",
  trial_end: null,
  trial_start: null,
  uid: "dynamic",
};

export type SubscriptionData = Record<string, Record<string, any>>;
export type PaymentData = Record<string, Record<string, any>>;

export const rawSubscriptionData: SubscriptionData = {
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
    status: "incomplete",
    stripeLink: "https://example.stripe.com/subscriptions/sub2",
    trial_end: Timestamp.fromMillis(1632865580066),
    trial_start: Timestamp.fromMillis(1632865580066),
  },
  sub3: {
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
    status: "canceled",
    stripeLink: "https://example.stripe.com/subscriptions/sub3",
    trial_end: null,
    trial_start: null,
  },
};

export const rawPaymentData: PaymentData = {
  pay1: {
    amount: 999,
    amount_capturable: 0,
    amount_received: 0,
    created: 1632951980,
    currency: "USD",
    customer: null,
    description: null,
    invoice: null,
    metadata: {},
    payment_method_types: ["card"],
    prices: [
      {
        product: "premium",
        price: "price1",
      },
    ],
    product: "premium",
    status: "succeeded",
  },
  pay2: {
    amount: 999,
    amount_capturable: 0,
    amount_received: 0,
    created: 1632951980,
    currency: "USD",
    customer: "alice",
    description: "Test description",
    invoice: "invoice2",
    metadata: {},
    payment_method_types: ["card"],
    prices: [
      {
        product: "premium",
        price: "price1",
      },
    ],
    product: "premium",
    status: "requires_action",
  },
  pay3: {
    amount: 999,
    amount_capturable: 0,
    amount_received: 0,
    created: 1632951980,
    currency: "USD",
    customer: "alice",
    description: "Test description",
    invoice: "invoice3",
    metadata: {},
    payment_method_types: ["card"],
    prices: [
      {
        product: "premium",
        price: "price1",
      },
    ],
    product: "premium",
    status: "processing",
  },
};

export const payment1: Payment = {
  amount: 999,
  amount_capturable: 0,
  amount_received: 0,
  created: "Wed, 29 Sep 2021 21:46:20 GMT",
  currency: "USD",
  customer: null,
  description: null,
  id: "pay1",
  invoice: null,
  metadata: {},
  payment_method_types: ["card"],
  prices: [
    {
      product: "premium",
      price: "price1",
    },
  ],
  status: "succeeded",
  uid: "dynamic",
};

export const payment2: Payment = {
  amount: 999,
  amount_capturable: 0,
  amount_received: 0,
  created: "Wed, 29 Sep 2021 21:46:20 GMT",
  currency: "USD",
  customer: "alice",
  description: "Test description",
  id: "pay2",
  invoice: "invoice2",
  metadata: {},
  payment_method_types: ["card"],
  prices: [
    {
      product: "premium",
      price: "price1",
    },
  ],
  status: "requires_action",
  uid: "dynamic",
};

export const payment3: Payment = {
  amount: 999,
  amount_capturable: 0,
  amount_received: 0,
  created: "Wed, 29 Sep 2021 21:46:20 GMT",
  currency: "USD",
  customer: "alice",
  description: "Test description",
  id: "pay3",
  invoice: "invoice3",
  metadata: {},
  payment_method_types: ["card"],
  prices: [
    {
      product: "premium",
      price: "price1",
    },
  ],
  status: "processing",
  uid: "dynamic",
};
