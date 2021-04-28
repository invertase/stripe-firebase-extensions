## Version 0.1.12 - 2021-04-29

[feat] Sync customer email address to Cloud Firestore. (#157)

[feat] Add support for one-time payment mode. (#39; #133; #151; #164)

You can now create Checkout Sessions for one-time payments when referencing a one-time price ID. One-time payments will be synced to Cloud Firestore into a payments collection for the relevant customer doc if you update your webhook handler in the Stripe dashboard to include the following events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `payment_intent.processing`.

To create a Checkout Session ID for a one-time payment, pass `mode: 'payment` to the Checkout Session doc creation:

```js
const docRef = await db
  .collection("customers")
  .doc(currentUser.uid)
  .collection("checkout_sessions")
  .add({
    mode: "payment",
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl", // One-time price created in Stripe
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  });
```

[feat] Add support for shipping address collection. (#26)

To collect a shipping address from your customer during checkout, you need to create a `shipping_countries` doc in your `products` collection. This doc needs to have a field called `allowed_countries` which needs to be an array. In this array, add the country codes for the countries that you ship to. You can find a list of supported countries [here](https://stripe.com/docs/api/checkout/sessions/create#create_checkout_session-shipping_address_collection-allowed_countries).

Secondly, you need to add `collect_shipping_address: true` to the Checkout Session doc creation:

```js
const docRef = await db
  .collection("customers")
  .doc(currentUser.uid)
  .collection("checkout_sessions")
  .add({
    collect_shipping_address: true,
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl",
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  });
```

[Fix] Merge product and price data instead of overwriting. This allows you to add additional data to your product and price docs in Cloud Firestore. Note: this means when you remove metadata keys from your products in Stripe, they won't be removed in Cloud Firestore. (#169; #152)

[Fix] Stripe customer object deletion is now a configuration option which defaults to not deleting customer objects in Stripe. (#160)

## Version 0.1.11 - 2021-02-25

[fix] Fix an issue where metered billing subscriptions were not synced to Cloud Firestore. (#138)

[feat] Sync subscription items to Cloud Firestore. (#140)

[feat] Allow setting of [`client_reference_id`](https://stripe.com/docs/api/checkout/sessions/create#create_checkout_session-client_reference_id) on the checkout session doc. (#143)

## Version 0.1.10 - 2021-02-11

[feat] Set [promotion codes](https://stripe.com/docs/billing/subscriptions/discounts/codes) programmatically. **_NOTE_**: anyone with access to a promotion code ID would be able to apply it to their checkout session. Therefore make sure to limit your promotion codes and archive any codes you don't want to offer anymore. (#107)

```js
const docRef = await db
  .collection("customers")
  .doc(currentUser.uid)
  .collection("checkout_sessions")
  .add({
    promotion_code: "promo_1HCrfVHYgolSBA35b1q98MNk",
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl",
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  });
```

[feat] Add `locale` override for `checkout_sessions`: (#131)

```js
const docRef = await db
  .collection("customers")
  .doc(currentUser.uid)
  .collection("checkout_sessions")
  .add({
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl",
    success_url: window.location.origin,
    cancel_url: window.location.origin,
    locale: "de",
  });
```

[feat] Sync invoices with Cloud Firestore. You can now sync the full Stripe invoice objects to an `invoices` subcollection on their corresponding subscription doc by listening to the relevant invoices webhook events (`invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`, `invoice.upcoming`, `invoice.marked_uncollectible`, `invoice.payment_action_required`). Only select the
events that you want to be notified about. You can then [listen to changes](https://firebase.google.com/docs/functions/firestore-events#writing-triggered_functions) on the invoices objects in Cloud Firestore: (#124)

```js
const functions = require("firebase-functions");

exports.myFunction = functions.firestore
  .document("customers/{uid}/subscriptions/{subsId}/invoices/{docId}")
  .onWrite((change, context) => {
    /* ... */
  });
```

## Version 0.1.9 - 2021-01-14

[feat] - Support all billing pricing models.

_*IMPORTANT*_: For tiered pricing plans to be synced correctly, you need to update the permissions of your restricted key to include read permissions for subscription plans!

## Version 0.1.8 - 2020-11-19

[feat] - Sync tax rates from your Stripe account to Cloud Firestore. Tax Rates are added to a `tax_rates` sub-collection on a `tax_rates` doc in your products collection:

```js
const taxRates = await db
  .collection("products")
  .doc("tax_rates")
  .collection("tax_rates")
  .get();
```

[feat] - Sync product and price metadata from Stripe to Cloud Firestore. To allow for [ordering and limiting](https://firebase.google.com/docs/firestore/query-data/order-limit-data) when querying product data, the metadata has been flattened to the Cloud Firestore docs with the `stripe_metadata_` prefix. E.g. adding `index:0` to your product metadata in Stripe will be available as `stripe_metadata_index` on your product doc in Cloud Firestore. This allows you to for example order products based on this index:

```js
db.collection("products")
  .where("active", "==", true)
  .orderBy("stripe_metadata_index")
  .get()
  .then(function (querySnapshot) {
    // [...]
  });
```

[feat] - The extension now defaults to collecting the customer's billing address during checkout and sets it as the address on the Stripe customer object. If you don't want to collect it, you can pass `billing_address_collection: auto` to the checkout session doc creation.

[change] - The extension now adds a product doc reference to the subscription doc in addition to the price doc reference for easier access of the product data for a given subscription.

## Version 0.1.7 - 2020-10-22

[change] - Additional configuration and **change of default behaviour**: you can now disable the automatic sync of new users to Stripe customers and Cloud Firestore, and the default behaviour has been changed to "on the fly" creation of customer objects. (#66; #51; #76)

[feat] - Add support for subscriptions not created via Checkout, e.g. via the Stripe Dashboard or directly via the API. (#43)

Previously, only subscriptions created via Stripe Checkout were synced to Cloud Firestore. By additionally listening to the `customer.subscription.created` event, the extension now also captures subscriptions created via the Stripe Dashboard or directly via the API. For this to work, Firebase Authentication users need to be synced with Stripe customer objects and the customers collection in Cloud Firestore (new configuration added in version `0.1.7`).

[docs] - Add snippet on importing Stripe.js as an ES module when using a build toolchain for your client application (e.g. Angular, React, TypeScript, etc.) to `POSTINSTALL.md`. (#74)

## Version 0.1.6 - 2020-09-10

[fix] - If there is an error during checkout session creation attach the error message to the Cloud Firestore doc so the client can know that an error happened (#57)

```js
const docRef = await db
  .collection("customers")
  .doc(currentUser)
  .collection("checkout_sessions")
  .add({
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl",
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  });
// Wait for the CheckoutSession to get attached by the extension.
docRef.onSnapshot((snap) => {
  const { error, sessionId } = snap.data();
  if (error) {
    // Show an error to your customer and
    // inspect your Cloud Function logs in the Firebase console.
    alert(`An error occured: ${error.message}`);
  }
  if (sessionId) {
    // We have a session, let's redirect to Checkout.
    const stripe = Stripe("pk_test_1234");
    stripe.redirectToCheckout({ sessionId });
  }
});
```

[feat] - Add the ability to disable the trial to be applied to a subscription by setting `trial_from_plan: false`. (#52)

```js
const docRef = await db
  .collection("customers")
  .doc(currentUser)
  .collection("checkout_sessions")
  .add({
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl",
    trial_from_plan: false,
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  });
```

## Version 0.1.5 - 2020-08-20

[change] - Only log the `stripeRole` custom claim, not the whole claim object.

[fix] - Fix security rules example in `POSTINSTALL.md`. (#47)

[fix] - Supply email address to Stripe customer creation also for existing Firebase users. (#42)

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

[feat] - Add support for dynamic tax rates: (#115)

```js
const docRef = await db
  .collection("customers")
  .doc(currentUser)
  .collection("checkout_sessions")
  .add({
    line_items: [
      {
        price: "price_1HCUD4HYgolSBA35icTHEXd5",
        quantity: 1,
        dynamic_tax_rates: ["txr_1IJJtvHYgolSBA35ITTBOaew"],
      },
    ],
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  });
```

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
  .collection("customers")
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
  .collection("customers")
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
