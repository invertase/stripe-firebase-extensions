# Firestore Stripe Payments Web SDK

This package helps you integrate your web app client with the
[`firestore-stripe-payments`](https://firebase.google.com/products/extensions/firestore-stripe-subscriptions)
extension. It abstracts out all the typical Firestore queries, and
other database interactions necessary to use the extension. Moreover, it provides type
definitions for all the common object types that are used by the extension when processing
payments.

# API Reference

[API reference](https://github.com/stripe/stripe-firebase-extensions/blob/next/firestore-stripe-web-sdk/markdown/index.md)

# Example usage

## Initialize the SDK

Start by [initializing the Firebase web SDK](https://firebase.google.com/docs/web/setup)
as usual.

Then, initialize this library by passing in an `App` instance obtained from the Firebase
web SDK, and configure the library to use the same Firestore collections you configured
the extension to use.

```js
import { getApp } from "@firebase/app";
import { getStripePayments } from "@stripe/firestore-stripe-payments";

const app = getApp();
const payments = getStripePayments(app, {
  productsCollection: "products",
  customersCollection: "customers",
});
```

## List products and prices

To fetch all the active products along with their prices, call the
`getProducts()` function as follows:

```js
import { getProducts } from "@stripe/firestore-stripe-payments";

const products = await getProducts(payments, {
  includePrices: true,
  activeOnly: true,
});
for (const product of products) {
  // ...
}
```

Note that for `N` products, this results in `(1 + N)` Firestore queries. Fetching
the products without the prices only requires 1 Firestore query.

You can also specify filters and limits on the product query as follows:

```js
import { getProducts } from "@stripe/firestore-stripe-payments";

const products = await getProducts(payments, {
  includePrices: true,
  activeOnly: true,
  where: [
    ["metadata.type", "==", "books"],
    ["metadata.rating", ">=", 4],
  ],
  limit: 10,
});
for (const product of products) {
  // ...
}
```

## Start a subscription checkout session

```js
import { createCheckoutSession } from "@stripe/firestore-stripe-payments";

const session = await createCheckoutSession(payments, {
  price: myPriceId,
});
window.location.assign(session.url);
```

Calling `createCheckoutSession()` as shown above will use the current page
(`window.location.href`) as the success and cancel URLs for the session. Instead you
can specify your own URLs as follows:

```js
import { createCheckoutSession } from "@stripe/firestore-stripe-payments";

const session = await createCheckoutSession(payments, {
  price: myPriceId,
  success_url: "https://example.com/payments/success",
  cancel_url: "https://example.com/payments/cancel",
});
window.location.assign(session.url);
```

To create a checkout session for more than one item, pass `line_items`:

```js
import { createCheckoutSession } from "@stripe/firestore-stripe-payments";

const session = await createCheckoutSession(payments, {
  line_items: [
    { price: myPriceId1 },
    { price: myPriceId2 },
  ],
});
window.location.assign(session.url);
```

## Listen for subscription updates

Once a subscription checkout session has been created, you can listen to the
Stripe subscription update events as follows:

```js
import { onCurrentUserSubscriptionUpdate } from "@stripe/firestore-stripe-payments";

onCurrentUserSubscriptionUpdate(
  payments,
  (snapshot) => {
    for (const change in snapshot.changes) {
      if (change.type === "added") {
        console.log(`New subscription added with ID: ${change.subscription.id}`);
      }
    }
  }
);
```

# Dependencies

* Cloud Firestore (`@firebase/firestore`)
* Firebase Auth (`@firebase/auth`)
* Firebase Core (`@firebase/app`)

# Build, test, release

## Prerequisites

* Node.js 12 or higher
* NPM 6 or higher

## Development workflows and commands

To install the dependencies, run `npm install` in the `firestore-stripe-web-sdk` directory.

Run `npm test` to run all unit and integration tests (usually takes about 15 seconds).

To build a release artifact, run `npm run build` followed by `npm pack`. The resulting tarball
can be published to NPM with `npm publish <tarball>`.
