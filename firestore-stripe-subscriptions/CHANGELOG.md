## Version 0.1.5 - 2020-08-20

[changed] - Only log the `stripeRole` custom claim, not the whole claim object.

[feat] - Add support for multiple prices, including one-time setup fees: (#27; #33)

In addition to recurring prices, you can add one-time prices. These will only be on the initial invoice. This is useful for adding setup fees or other one-time fees associated with a subscription. To do so you will need to pass a `line_items` array instead:

```js
const docRef = await db
  .collection("customers")
  .doc(currentUser)
  .collection("checkout_sessions")
  .add({
    line_items: [
      {
        price: "price_1HCUD4HYgolSBA35icTHEXd5", // RECURRING_PRICE_ID
        quantity: 1,
        tax_rates: ["txr_1HCjzTHYgolSBA35m0e1tJN5"],
      },
      {
        price: "price_1HEtgDHYgolSBA35LMkO3ExX", // ONE_TIME_PRICE_ID
        quantity: 1,
        tax_rates: ["txr_1HCjzTHYgolSBA35m0e1tJN5"],
      },
    ],
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  });
```

**_NOTE_**: One-time prices are only supported in combination with recurring prices! If you specify more than one recurring price in the `line_items` array, the subscription object in Cloud Firestore will list all recurring prices in the `prices` array. The `price` attribute on the subscription in Cloud Firestore will be equal to the first item in the `prices` array: `price === prices[0]`.

Note that the Stripe customer portal currently does not support changing subscriptions with multiple recurring prices. In this case the portal will only offer the option to cancel the subscription.

## Version 0.1.4

[fix] - Make sure to merge existing custom claims before setting the `stripeRole` custom claim. Previously the extensions would overwrite the user's existing custom claims.

[fix] - Corretly handle one-time (non-recurring) prices. This update adds a `type` parameter to the price document in Cloud Firestore:

```ts
/**
 * One of `one_time` or `recurring` depending on whether the price is for a one-time purchase or a recurring (subscription) purchase.
 */
type: "one_time" | "recurring";
```

[feat] - Sync the price description to Cloud Firestore.

[feat] - Add support for discounts, coupons, promotion codes:

You can create customer-facing promotion codes in the [Stripe Dashboard](https://dashboard.stripe.com/coupons/create). Refer to the [docs](https://stripe.com/docs/billing/subscriptions/discounts/codes) for a detailed guide on how to set these up.

To show the promotion code redemption box on the checkout page, set `allow_promotion_codes: true` when creating the `checkout_session` document:

```js
const docRef = await db
  .collection("${param:CUSTOMERS_COLLECTION}")
  .doc(currentUser)
  .collection("checkout_sessions")
  .add({
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl",
    allow_promotion_codes: true,
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  });
```

[feat] - Support setting tax rates when starting the subscription:

You can collect and report taxes with [Tax Rates](https://stripe.com/docs/billing/taxes/tax-rates). To apply tax rates to the subscription, you first need to create your tax rates in the [Stripe Dashboard](https://dashboard.stripe.com/tax-rates). When creating a new `checkout_sessions` document, specify the optional `tax_rates` list with [up to five](https://stripe.com/docs/billing/taxes/tax-rates#using-multiple-tax-rates) tax rate IDs:

```js
const docRef = await db
  .collection("${param:CUSTOMERS_COLLECTION}")
  .doc(currentUser)
  .collection("checkout_sessions")
  .add({
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl",
    tax_rates: ["txr_1HCjzTHYgolSBA35m0e1tJN5"],
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  });
```

## Version 0.1.3

[fix] - Apply trial days from pricing plan to the checkout session.

[feat] - Support setting metadata on the subscription:

You can optionally set a metadata object with key-value pairs when creating the checkout session. This can be useful for storing additional information about the customer's subscription. This metadata will be synced to both the Stripe subscription object (making it searchable in the Stripe Dashboard) and the subscription document in the Cloud Firestore.

```js
const docRef = await db
  .collection("customers")
  .doc(currentUser)
  .collection("checkout_sessions")
  .add({
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl",
    success_url: window.location.origin,
    cancel_url: window.location.origin,
    metadata: {
      item: "item001",
    },
  });
```

[feat] - Sync additional data from the Stripe subscription object to Cloud Firestore:

```ts
/**
 * Start of the current period that the subscription has been invoiced for.
 */
current_period_start: FirebaseFirestore.Timestamp;
/**
 * End of the current period that the subscription has been invoiced for. At the end of this period, a new invoice will be created.
 */
current_period_end: FirebaseFirestore.Timestamp;
/**
 * A date in the future at which the subscription will automatically get canceled.
 */
cancel_at: FirebaseFirestore.Timestamp | null;
/**
 * If the subscription has been canceled, the date of that cancellation. If the subscription was canceled with `cancel_at_period_end`, `canceled_at` will still reflect the date of the initial cancellation request, not the end of the subscription period when the subscription is automatically moved to a canceled state.
 */
canceled_at: FirebaseFirestore.Timestamp | null;
/**
 * If the subscription has a trial, the beginning of that trial.
 */
trial_start: FirebaseFirestore.Timestamp | null;
/**
 * If the subscription has a trial, the end of that trial.
 */
trial_end: FirebaseFirestore.Timestamp | null;
/**
 * Set of key-value pairs that you can attach to an object.
 * This can be useful for storing additional information about the object in a structured format.
 */
metadata: {
  [name: string]: string;
};
```

## Version 0.1.2

[feat] - Adds the `onUserDeleted` function which is triggered by a user being deleted in Firebase Authentication. Upon user deletion the extension will delete their customer object in Stripe which will immediately cancel all subscriptions for the user.

[feat] - Adds the `onCustomerDataDeleted` function which has the same effect as `onUserDeleted` but is triggered when the customer doc in the Cloud Firestore is deleted. This ensures compatibility with the [Delete User Data](https://firebase.google.com/products/extensions/delete-user-data) extension built by the Firebase team.

[fix] - Allow creation of a Stripe customer object without email address.
[fix] - Create Stripe customer object just in time to support users that existed before the extension was installed.

## Version 0.1.1

Version bump in preparation for public beta launch.

## Version 0.1.0

Initial release of the `firestore-stripe-subscriptions` extension.
