# Firestore Stripe Payments Web SDK

This package helps you integrate your web app client with the
[`firestore-stripe-payments`](https://firebase.google.com/products/extensions/firestore-stripe-subscriptions)
extension. It abstracts out all the typical Firestore queries, and
other database interactions necessary to use the extension. Moreover, it provides type
definitions for all the common object types that are used by the extension when processing
payments.

## Features

- 🔐 **Authentication Integration**: Seamless integration with Firebase Authentication
- 🛍️ **Product Management**: List and filter products with their prices
- 💳 **Subscription Handling**: Create and manage subscriptions
- 🔄 **Real-time Updates**: Listen for subscription and payment changes
- 🎯 **Type Safety**: Full TypeScript support with comprehensive type definitions
- 🔌 **Firebase Integration**: Works with Firebase v9, v10, and v11

## API Reference

[API reference](https://github.com/stripe/stripe-firebase-extensions/blob/next/firestore-stripe-web-sdk/markdown/index.md)

## Installation

```bash
npm install @invertase/firestore-stripe-payments
```

## Example usage

### Initialize the SDK

Start by [initializing the Firebase web SDK](https://firebase.google.com/docs/web/setup)
as usual.

Then, initialize this library by passing in an `App` instance obtained from the Firebase
web SDK, and configure the library to use the same Firestore collections you configured
the extension to use.

```js
import { getApp } from "@firebase/app";
import { getStripePayments } from "@invertase/firestore-stripe-payments";

const app = getApp();
const payments = getStripePayments(app, {
  productsCollection: "products",
  customersCollection: "customers",
});
```

### List products and prices

To fetch all the active products along with their prices, call the
`getProducts()` function as follows:

```js
import { getProducts } from "@invertase/firestore-stripe-payments";

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
import { getProducts } from "@invertase/firestore-stripe-payments";

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

### Start a subscription checkout session

```js
import { createCheckoutSession } from "@invertase/firestore-stripe-payments";

const session = await createCheckoutSession(payments, {
  price: myPriceId,
});
window.location.assign(session.url);
```

Calling `createCheckoutSession()` as shown above will use the current page
(`window.location.href`) as the success and cancel URLs for the session. Instead you
can specify your own URLs as follows:

```js
import { createCheckoutSession } from "@invertase/firestore-stripe-payments";

const session = await createCheckoutSession(payments, {
  price: myPriceId,
  success_url: "https://example.com/payments/success",
  cancel_url: "https://example.com/payments/cancel",
});
window.location.assign(session.url);
```

To create a checkout session for more than one item, pass `line_items`:

```js
import { createCheckoutSession } from "@invertase/firestore-stripe-payments";

const session = await createCheckoutSession(payments, {
  line_items: [
    { price: myPriceId1 },
    { price: myPriceId2 },
  ],
});
window.location.assign(session.url);
```

### Listen for subscription updates

Once a subscription checkout session has been created, you can listen to the
Stripe subscription update events as follows:

```js
import { onCurrentUserSubscriptionUpdate } from "@invertase/firestore-stripe-payments";

onCurrentUserSubscriptionUpdate(
  payments,
  (snapshot) => {
    for (const change of snapshot.changes) {
      if (change.type === "added") {
        console.log(`New subscription added with ID: ${change.subscription.id}`);
      }
    }
  }
);
```

### Get current user's subscriptions

To fetch all subscriptions for the currently signed-in user:

```js
import { getCurrentUserSubscriptions } from "@invertase/firestore-stripe-payments";

const subscriptions = await getCurrentUserSubscriptions(payments, {
  status: "active" // Optional: filter by status
});
```

## Available Examples

The SDK comes with three example implementations to help you get started:

### 1. CommonJS Example (`/examples/cjs`)
A basic implementation using CommonJS modules and webpack:
- Simple product listing
- Basic checkout functionality
- Uses webpack for bundling
- Demonstrates CommonJS module usage

### 2. ESM Example (`/examples/esm`)
A modern implementation using ES modules and Vite:
- Product listing with prices
- Checkout functionality
- Uses Vite for fast development and building
- Demonstrates ES module usage

### 3. ESM with Subscriptions (`/examples/esm-with-subscriptions`)
A complete implementation with subscription features:
- User authentication
- Product listing with prices
- Subscription checkout
- Real-time subscription monitoring
- Active subscriptions display
- Uses Vite for development
- Demonstrates full subscription lifecycle

To run any of these examples:
1. Navigate to the example directory
2. Run `npm install`
3. Update the Firebase configuration in `src/firebase-config.js`
4. Run `npm run dev` to start the development server

## Dependencies

* Cloud Firestore (`@firebase/firestore`)
* Firebase Auth (`@firebase/auth`)
* Firebase Core (`@firebase/app`)

## Build, test, release

### Prerequisites

* Node.js 20 or higher

### Development workflows and commands

To install the dependencies, run `npm install` in the `firestore-stripe-web-sdk` directory.

Run `npm test` to run all unit and integration tests (usually takes about 15 seconds).

To build a release artifact, run `npm run build` followed by `npm pack`. The resulting tarball
can be published to NPM with `npm publish <tarball>`.

### Available Scripts

- `npm run build`: Build the library
- `npm run build:watch`: Build the library in watch mode
- `npm run dev`: Start development mode with watch
- `npm run test`: Run tests using Firebase emulators
- `npm run clean`: Clean build artifacts
- `npm run api-extractor`: Generate API documentation
- `npm run api-documenter`: Generate markdown documentation

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
