# Firestore Stripe Payments Web SDK

An experimental web SDK that simplifies integrating the firestore-stripe-payments
extension into web applications. Web app developers can use this library in their
client applications. A bundler like Webpack is recommended.

# Dependencies

* Cloud Firestore (`@firebase/firestore`)
* Firebase Auth (`@firebase/auth`)
* Firebase Core (`@firebase/app`)

# Example usage

Initialize the SDK with a Firebase App instance:

```js
import { getApp } from "@firebase/app";
import { getStripePayments } from "@stripe/firestore-stripe-payments";

const app = getApp();
const payments = getStripePayments(app, {
  productsCollection: "products",
  customersCollection: "customers",
});
```

List products and prices:

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

Start a checkout session:

```js
import { createCheckoutSession } from "@stripe/firestore-stripe-payments";

const session = await createCheckoutSession(payments, {
  price: myPriceId,
});
window.location.assign(session.url);
```

Listen for subscription updates:

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

# Build, test, release

## Prerequisites

* Node.js 12 or higher
* NPM 6 or higher

## Development workflows and commands

To install the dependencies, run `npm install` in the `firestore-stripe-web-sdk` directory.

Run `npm test` to run all unit and integration tests (usually takes about 15 seconds).

To build a release artifact, run `npm run build` followed by `npm pack`. The resulting tarball
can be published to NPM with `npm publish <tarball>`.
