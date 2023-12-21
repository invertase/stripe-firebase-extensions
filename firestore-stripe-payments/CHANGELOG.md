### Version 0.3.8 - 2023-12-21

[fix] - upgraded resources `onUserDeleted` & `onCustomerDataDeleted` to node 18 [#583]

### Version 0.3.7 - 2023-12-21

[fix] - upgraded the resources to node 18 [#583]

## Version 0.3.6 - 2023-10-08

[feat] - Support `payment_method_collection` parameter

[feat] - create Stripe customer on-the-fly in createPortalLink

[feat] - added mobile subscription payments

[fix] - updated extension icons

[feat] - createPortalLink auth tweaks

[fix] - added subscription payments prices, test and refactor included

[fix] - `minInstances` parameter expects number

[feat] - Allow configuring min instances for createCheckoutSession

[fix] - added env stripe key check on test setup

[feat] - upgraded to the new emulator suite

[feat] - added stripe extension events

[feat] - Add parameter to enable phone number collection

[feat] - Add parameters to enable expired Checkout Session recovery

[feat] - Add `setup_future_usage` parameter for one-time payment flows

## 0.3.5 - 2023-08-14
[chore] Updated naming and upgraded to node18

[fix] Updated icons

[fix] updated appinfo versioning

## 0.3.4 - 2023-08-14
This extension has been formally transferred to Invertase. See the updated README for more details.

## Version 0.3.3 - 2023-03-20
[fix] Address issue where `insertInvoiceRecord` function fails. [#511]

## Version 0.3.2 - 2022-11-30
[chore] Added support for `us-west1` as a deployable region for Firebase functions. [#464]

## Version 0.3.1 - 2022-08-24
[chore] Added `package-lock.json` to version control to prevent installation issues. [#426]

## Version 0.3.0 - 2022-08-23
[feat] Allow configurable minimum instances for `createCheckoutSession` function. [#375]

[feat] Throw an `unauthenticated` Firebase error from `creatPortalLink` function. [#420]

[feat] Add Price object IDs from invoice line items for subscription payments to payments Firestore collection. [#393]

## Version 0.2.7 - 2022-05-10
[chore] Updated package-lock.json that was causing install errors.

## Version 0.2.6 - 2022-05-10
[feat] Added Stripe extension events. This extension emits events, which allows you to listen to and run custom logic at different trigger points during the functioning of the extension. For example you can listen to events when a product has been added via the `product.created` event, or whenever a payment has succeeded through the `invoice.payment_succeeded` event. (#386)

## Version 0.2.5 - 2022-04-20
[feat] Add parameter to enable phone number collection. (#371)

[feat] Add parameters to enable expired Checkout Session recovery. (#350)

[feat] Add `setup_future_usage` parameter for one-time payment flows. (#347)

[feat] Use dynamic parameter reference in README. (#336)

## Version 0.2.4 - 2021-12-22

[feat] Add support to bring phone numbers saved on Firebase users into Stripe when creating a checkout session for a subscription. (#251)

## Version 0.2.3 - 2021-11-29

[feat] Manage payment methods in the Dashboard: setting `payment_method_types` is now optional. By default, all payment methods enabled in your Stripe Dashboard will be presented on the Stripe Checkout page. (#246)

## Version 0.2.2 - 2021-11-09

[RENAME] The extension has been renamed from `firestore-stripe-subscriptions` to `firestore-stripe-payments` to better reflect the support for both one time, and recurring payments.

[feat] Add support for setting [`shipping_rates`](https://stripe.com/docs/payments/checkout/shipping) in the `checkout_sessions` doc. (#241)

[feat] Add support for mobile clients for both payment and setup mode:

#### One-time payments

To create a one time payment in your mobile application, create a new doc in your `${param:CUSTOMERS_COLLECTION}/{uid}/checkout_sessions` collection with the following parameters:

- client: 'mobile'
- mode: 'payment'
- amount: [{payment amount}](https://stripe.com/docs/api/payment_intents/object#payment_intent_object-amount)
- currency: [{currency code}](https://stripe.com/docs/api/payment_intents/object#payment_intent_object-currency)

Then listen for the extension to append `paymentIntentClientSecret`, `ephemeralKeySecret`, and `customer` to the doc and use these to [integrate the mobile payment sheet](https://stripe.com/docs/payments/accept-a-payment?platform=ios&ui=payment-sheet#integrate-payment-sheet).

#### Set up a payment method for future usage

You can collect a payment method from your customer to charge it at a later point in time. To do so create a new doc in your `${param:CUSTOMERS_COLLECTION}/{uid}/checkout_sessions` collection with the following parameters:

- client: 'mobile'
- mode: 'setup'

Then listen for the extension to append `setupIntentClientSecret`, `ephemeralKeySecret`, and `customer` to the doc and use these to [integrate the mobile payment sheet](https://stripe.com/docs/payments/accept-a-payment?platform=ios&ui=payment-sheet#integrate-payment-sheet).

## Version 0.1.15 - 2021-08-26

[feat] Programmatically set locale for customer portal session. (#131)

[feat] Optionally set ID for a customer portal [configuration](https://stripe.com/docs/api/customer_portal/configuration) (#234)

```js
const functionRef = firebase
  .app()
  .functions(functionLocation)
  .httpsCallable("ext-firestore-stripe-payments-createPortalLink");
const { data } = await functionRef({
  returnUrl: window.location.origin,
  locale: "auto", // Optional, defaults to "auto"
  configuration: "bpc_1JSEAKHYgolSBA358VNoc2Hs", // Optional ID of a portal configuration: https://stripe.com/docs/api/customer_portal/configuration
});
window.location.assign(data.url);
```

[feat] Support setting of [`customer_update` object](https://stripe.com/docs/api/checkout/sessions/create#create_checkout_session-customer_update) on checkout session doc creation (#219)

## Version 0.1.14 - 2021-07-08

[feat] Automatic tax calculation with [Stripe Tax](https://stripe.com/tax)

Stripe Tax lets you calculate and collect sales tax, VAT, and GST.

1. Request access: https://stripe.com/tax#request-access
2. Set up Stripe Tax in the Dashboard: https://stripe.com/docs/tax/set-up
3. Enable automatic tax calculation when creating your `checkout_sessions` docs:

```js
const docRef = await db
  .collection("customers")
  .doc(currentUser.uid)
  .collection("checkout_sessions")
  .add({
    automatic_tax: true, // Automatically calculate tax based on the customer's address
    tax_id_collection: true, // Collect the customer's tax ID (important for B2B transactions)
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl",
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  });
```

[feat] Redirect to Stripe Checkout via URL instead of Stripe.js (#212)

Stripe Checkout now returns a URL which means Stripe.js is no longer needed to redirect to checkout:

```js
const docRef = await db
  .collection("${param:CUSTOMERS_COLLECTION}")
  .doc(currentUser.uid)
  .collection("checkout_sessions")
  .add({
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl",
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  });
// Wait for the CheckoutSession to get attached by the extension
docRef.onSnapshot((snap) => {
  const { error, url } = snap.data();
  if (error) {
    // Show an error to your customer and
    // inspect your Cloud Function logs in the Firebase console.
    alert(`An error occured: ${error.message}`);
  }
  if (url) {
    // We have a Stripe Checkout URL, let's redirect.
    window.location.assign(url);
  }
});
```

[fix] Add checkout session metadata to one time payments (#203)

## Version 0.1.13 - 2021-06-17

[fix] Add a `prices` and an `items` array to the one-time payment docs in the `payments` collection. The `prices` array holds Firestore references for the prices that make up this payment, and the `items` array includes the full line items of the Stripe Checkout session.

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

 - Add snippet on importing Stripe.js as an ES module when using a build toolchain for your client application (e.g. Angular, React, TypeScript, etc.) to `POSTINSTALL.md`. (#74)

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

You can create customer-facing promotion codes in the [Stripe Dashboard](https://dashboard.stripe.com/coupons/create). Refer to the (https://stripe.com/docs/billing/subscriptions/discounts/codes) for a detailed guide on how to set these up.

To show the promotion code redemption box on the checkout page, set `allow_promotion_codes: true` when creating the `checkout_sessions` document:

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
