### Client SDK

You can use the [`@invertase/firestore-stripe-payments`](https://github.com/invertase/stripe-firebase-extensions/blob/next/firestore-stripe-web-sdk/README.md)
JavaScript package to easily access this extension from web clients. This client SDK provides
TypeScript type definitions and high-level convenience APIs for most common operations client
applications would want to implement using the extension.

Use a package manager like NPM to install the above package, and use it in conjunction with
the Firebase Web SDK.

### Configuring the extension

Before you proceed, make sure you have the following Firebase services set up:

- [Cloud Firestore](https://firebase.google.com/docs/firestore) to store customer & subscription details.
  - Follow the steps in the [documentation](https://firebase.google.com/docs/firestore/quickstart#create) to create a Cloud Firestore database.
- [Firebase Authentication](https://firebase.google.com/docs/auth) to enable different sign-up options for your users.
  - Enable the sign-in methods in the [Firebase console](https://console.firebase.google.com/project/_/authentication/providers) that you want to offer your users.

#### Set your Cloud Firestore security rules

It is crucial to limit data access to authenticated users only and for users to only be able to see their own information. For product and pricing information it is important to disable write access for client applications. Use the rules below to restrict access as recommended in your project's [Cloud Firestore rules](https://console.firebase.google.com/project/${param:PROJECT_ID}/firestore/rules):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /${param:CUSTOMERS_COLLECTION}/{uid} {
      allow read: if request.auth.uid == uid;

      match /checkout_sessions/{id} {
        allow read, write: if request.auth.uid == uid;
      }
      match /subscriptions/{id} {
        allow read: if request.auth.uid == uid;
      }
      match /payments/{id} {
        allow read: if request.auth.uid == uid;
      }
    }

    match /${param:PRODUCTS_COLLECTION}/{id} {
      allow read: if true;

      match /prices/{id} {
        allow read: if true;
      }

      match /tax_rates/{id} {
        allow read: if true;
      }
    }
  }
}
```

#### Configure Stripe webhooks

You need to set up a webhook that synchronizes relevant details from Stripe with your Cloud Firestore. This includes product and pricing data from the Stripe Dashboard, as well as customer's subscription details.

Here's how to set up the webhook and configure your extension to use it:

1. Configure your webhook:

   1. Go to the [Stripe dashboard.](https://dashboard.stripe.com/webhooks)

   2. Use the URL of your extension's function as the endpoint URL. Here's your function's URL: `${function:handleWebhookEvents.url}`

   3. Select the following events:

   - `product.created`
   - `product.updated`
   - `product.deleted`
   - `price.created`
   - `price.updated`
   - `price.deleted`
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.processing`
   - `payment_intent.succeeded`
   - `payment_intent.canceled`
   - `payment_intent.payment_failed`
   - `tax_rate.created` (optional)
   - `tax_rate.updated` (optional)
   - `invoice.paid` (optional, will sync invoices to Cloud Firestore)
   - `invoice.payment_succeeded` (optional, will sync invoices to Cloud Firestore)
   - `invoice.payment_failed` (optional, will sync invoices to Cloud Firestore)
   - `invoice.upcoming` (optional, will sync invoices to Cloud Firestore)
   - `invoice.marked_uncollectible` (optional, will sync invoices to Cloud Firestore)
   - `invoice.payment_action_required` (optional, will sync invoices to Cloud Firestore)

2. Using the Firebase console or Firebase CLI, [reconfigure](https://console.firebase.google.com/project/${param:PROJECT_ID}/extensions/instances/${param:EXT_INSTANCE_ID}?tab=config) your extension with your webhook's signing secret (such as, `whsec_12345678`). Enter the value in the parameter called `Stripe webhook secret`. Make sure you scroll back to the top of the Extension configuration page and click 'Save' otherwise your Stripe webhook secret will not be saved.

#### Create product and pricing information (only required when building on the web platform)

For Stripe to automatically bill your users for recurring payments, you need to create your product and pricing information in the [Stripe Dashboard](https://dashboard.stripe.com/test/products). When you create or update your product and price information in the Stripe Dashboard these details are automatically synced with your Cloud Firestore, as long as the webhook is configured correctly as described above.

The extension currently supports pricing plans that bill a predefined amount at a specific interval. More complex plans (e.g. different pricing tiers or seats) are not yet supported. If you'd like to see support for these, please open a [feature request issue](https://github.com/stripe/stripe-firebase-extensions/issues/new/choose) with details about your business model and pricing plans.

For example, this extension works well for business models with different access level tiers, e.g.:

- Product 1: Basic membership
  - Price 1: 10 USD per month
  - Price 2: 100 USD per year
  - Price 3: 8 GBP per month
  - Price 4: 80 GBP per year
  - [...]: additional currency and interval combinations
- Product 2: Premium membership
  - Price 1: 20 USD per month
  - Price 2: 200 USD per year
  - Price 3: 16 GBP per month
  - Price 4: 160 GBP per year
  - [...]: additional currency and interval combinations

#### Assign custom claim roles to products (only used for subscriptions)

If you want users to get assigned a [custom claim role](https://firebase.google.com/docs/auth/admin/custom-claims) to give them access to certain data when subscribed to a specific product, you can set a `firebaseRole` metadata value on the Stripe product ([see screenshot](https://www.gstatic.com/mobilesdk/200710_mobilesdk/ext_stripe_subscription_post_install.png)).

The value you set for `firebaseRole` (e.g. "premium" in the screenshot above) will be set as a custom claim `stripeRole` on the user. This allows you to [set specific security access rules](https://firebase.googleblog.com/2019/03/firebase-security-rules-admin-sdk-tips.html) based on the user's roles, or [limit access to certain pages](https://firebase.google.com/docs/auth/admin/custom-claims#access_custom_claims_on_the_client). For example if you have one `basic` role and one `premium` role you could add the following to your Cloud Firestore rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function hasBasicSubs() {
      return request.auth.token.stripeRole == "basic";
    }

    function hasPremiumSubs() {
      return request.auth.token.stripeRole == "premium";
    }

    match /content-basic/{doc} {
      allow read: if hasBasicSubs() || hasPremiumSubs();
    }
    match /content-premium/{doc} {
      allow read: if hasPremiumSubs();
    }
  }
}
```

Alternatively you can validate their role client-side with the JavaScript SDK. When doing so you need to make sure to force-refresh the user token:

```js
import { getAuth } from 'firebase/auth';

async function getCustomClaimRole() {
  const auth = getAuth();
  await auth.currentUser?.getIdToken(true);
  const decodedToken = await auth.currentUser?.getIdTokenResult();
  return decodedToken?.claims.stripeRole;
}
```

#### Configure the Stripe customer portal (only used for subscriptions)

1. Set your custom branding in the [settings](https://dashboard.stripe.com/settings/branding).
2. Configure the Customer Portal [settings](https://dashboard.stripe.com/test/settings/billing/portal).
3. Toggle on "Allow customers to update their payment methods".
4. Toggle on "Allow customers to update subscriptions".
5. Toggle on "Allow customers to cancel subscriptions".
6. Add the products and prices that you want to allow customer to switch between.
7. Set up the required business information and links.

### Using the extension

Once you've configured the extension you can add payments and access control to your websites and mobile apps fully client-side with the corresponding Firebase SDKs. You can experience a subscriptions demo application at [https://stripe-subs-ext.web.app](https://stripe-subs-ext.web.app/) and find the demo source code on [GitHub](https://github.com/stripe-samples/firebase-subscription-payments);

#### Sign-up users with Firebase Authentication

The quickest way to sign-up new users is by using the [FirebaseUI library](https://firebase.google.com/docs/auth/web/firebaseui). Follow the steps outlined in the official docs. When configuring the extension you can choose to 'Sync' new users to Stripe. If set to 'Sync', the extension listens to new users signing up and then automatically creates a Stripe customer object and a customer record in your Cloud Firestore. If set to 'Do not sync' (default), the extension will create the customer object "on the fly" with the first checkout session creation.

#### List available products and prices

Products and pricing information are normal collections and docs in your Cloud Firestore and can be queried as such:

```js
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const db = getFirestore();

const productsQuery = query(
  collection(db, "${param:PRODUCTS_COLLECTION}"),
  where("active", "==", true)
);

const querySnapshot = await getDocs(productsQuery);
querySnapshot.forEach(async (doc) => {
  console.log(doc.id, " => ", doc.data());
  const priceSnap = await getDocs(collection(doc.ref, "prices"));
  priceSnap.forEach((priceDoc) => {
    console.log(priceDoc.id, " => ", priceDoc.data());
  });
});
```

### One-time payments on the web

You can create Checkout Sessions for one-time payments when referencing a one-time price ID. One-time payments will be synced to Cloud Firestore into a payments collection for the relevant customer doc if you update your webhook handler in the Stripe dashboard to include the following events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `payment_intent.processing`.

To create a Checkout Session ID for a one-time payment, pass `mode: 'payment'` to the Checkout Session doc creation:

```js
import { collection, doc, addDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const db = getFirestore();

const docRef = await addDoc(
  collection(
    db,
    "${param:CUSTOMERS_COLLECTION}",
    currentUser.uid,
    "checkout_sessions"
  ),
  {
    mode: "payment",
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl", // One-time price created in Stripe
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  }
);
```

### Mobile payments (with the mobile payment sheet on iOS and Android)

#### One-time payments

To create a one time payment in your mobile application, create a new doc in your `${param:CUSTOMERS_COLLECTION}/{uid}/checkout_sessions` collection with the following parameters:

- client: 'mobile'
- mode: 'payment'
- amount: [{payment amount}](https://stripe.com/docs/api/payment_intents/object#payment_intent_object-amount)
- currency: [{currency code}](https://stripe.com/docs/api/payment_intents/object#payment_intent_object-currency)

Then listen for the extension to append `paymentIntentClientSecret`, `ephemeralKeySecret`, and `customer` to the doc and use these to [integrate the mobile payment sheet](https://stripe.com/docs/payments/accept-a-payment?platform=ios&ui=payment-sheet).

#### Set up a payment method for future usage

You can collect a payment method from your customer to charge it at a later point in time. To do so create a new doc in your `${param:CUSTOMERS_COLLECTION}/{uid}/checkout_sessions` collection with the following parameters:

- client: 'mobile'
- mode: 'setup'

Then listen for the extension to append `setupIntentClientSecret`, `ephemeralKeySecret`, and `customer` to the doc and use these to [integrate the mobile payment sheet](https://stripe.com/docs/payments/accept-a-payment?platform=ios&ui=payment-sheet).

### Subscription payments (web only)

#### Start a subscription with Stripe Checkout

To subscribe the user to a specific pricing plan, create a new doc in the `checkout_sessions` collection for the user. The extension will update the doc with a Stripe Checkout session ID which you then use to redirect the user to the checkout page.

```js
import { collection, doc, addDoc, onSnapshot } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const db = getFirestore();

const docRef = await addDoc(
  collection(
    db,
    "${param:CUSTOMERS_COLLECTION}",
    currentUser.uid,
    "checkout_sessions"
  ),
  {
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl",
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  }
);

// Wait for the CheckoutSession to get attached by the extension
onSnapshot(docRef, (snap) => {
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

#### Handling trials

You can specify subscription trial period when creating the checkout session by using the `trial_period_days` parameter. Refer to the [docs](https://stripe.com/docs/payments/checkout/free-trials) for a detailed guide on free trials and how to set them up.

```js
import { collection, doc, addDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const db = getFirestore();

const docRef = await addDoc(
  collection(
    db,
    "${param:CUSTOMERS_COLLECTION}",
    currentUser.uid,
    "checkout_sessions"
  ),
  {
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl",
    trial_period_days: 7,
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  }
);
```

#### Applying discount, coupon, promotion codes

You can create customer-facing promotion codes in the [Stripe Dashboard](https://dashboard.stripe.com/coupons/create). Refer to the [docs](https://stripe.com/docs/billing/subscriptions/discounts/codes) for a detailed guide on how to set these up.

In order for the promotion code redemption box to show up on the checkout page, set `allow_promotion_codes: true` when creating the `checkout_sessions` document:

```js
import { collection, doc, addDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const db = getFirestore();

const docRef = await addDoc(
  collection(
    db,
    "${param:CUSTOMERS_COLLECTION}",
    currentUser.uid,
    "checkout_sessions"
  ),
  {
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl",
    allow_promotion_codes: true,
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  }
);
```

#### Applying promotion codes programmatically

You can set a [promotion code](https://stripe.com/docs/billing/subscriptions/discounts/codes) to be applied to the checkout session without the customer needing to input it.

**_NOTE_**: anyone with access to a promotion code ID would be able to apply it to their checkout session. Therefore make sure to limit your promotion codes and archive any codes you don't want to offer anymore.

```js
import { collection, doc, addDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const db = getFirestore();

const docRef = await addDoc(
  collection(
    db,
    "${param:CUSTOMERS_COLLECTION}",
    currentUser.uid,
    "checkout_sessions"
  ),
  {
    promotion_code: "promo_1HCrfVHYgolSBA35b1q98MNk",
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl",
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  }
);
```

#### Automatic tax calculation with [Stripe Tax](https://stripe.com/tax)

Stripe Tax lets you calculate and collect sales tax, VAT, and GST. Know where to register, automatically collect the right amount of tax, and access the reports you need to file returns.

1. Request access: https://stripe.com/tax#request-access
2. Set up Stripe Tax in the Dashboard: https://stripe.com/docs/tax/set-up
3. Enable automatic tax calculation when creating your `checkout_sessions` docs:

```js
import { collection, doc, addDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const db = getFirestore();

const docRef = await addDoc(
  collection(
    db,
    "${param:CUSTOMERS_COLLECTION}",
    currentUser.uid,
    "checkout_sessions"
  ),
  {
    automatic_tax: true, // Automatically calculate tax based on the customer's address
    tax_id_collection: true, // Collect the customer's tax ID (important for B2B transactions)
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl",
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  }
);
```

#### Applying tax rates dynamically

Stripe Checkout supports applying the correct tax rate for customers in US, GB, AU, and all countries in the EU. With [dynamic tax rates](https://stripe.com/docs/billing/subscriptions/taxes#adding-tax-rates-to-checkout), you create tax rates for different regions (e.g., a 20% VAT tax rate for customers in the UK and a 7.25% sales tax rate for customers in California, US) and Stripe attempts to match your customer's location to one of those tax rates.

```js
import { collection, doc, addDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const db = getFirestore();

const docRef = await addDoc(
  collection(
    db,
    "${param:CUSTOMERS_COLLECTION}",
    currentUser.uid,
    "checkout_sessions"
  ),
  {
    line_items: [
      {
        price: "price_1HCUD4HYgolSBA35icTHEXd5",
        quantity: 1,
        dynamic_tax_rates: [
          "txr_1IJJtvHYgolSBA35ITTBOaew",
          "txr_1Hlsk0HYgolSBA35rlraUVWO",
          "txr_1HCshzHYgolSBA35WkPjzOOi",
        ],
      },
    ],
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  }
);
```

#### Applying static tax rates

You can collect and report taxes with [Tax Rates](https://stripe.com/docs/billing/taxes/tax-rates). To apply tax rates to the subscription, you first need to create your tax rates in the [Stripe Dashboard](https://dashboard.stripe.com/tax-rates). When creating a new `checkout_sessions` document, specify the optional `tax_rates` list with [up to five](https://stripe.com/docs/billing/taxes/tax-rates#using-multiple-tax-rates) tax rate IDs:

```js
import { collection, doc, addDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const db = getFirestore();

const docRef = await addDoc(
  collection(
    db,
    "${param:CUSTOMERS_COLLECTION}",
    currentUser.uid,
    "checkout_sessions"
  ),
  {
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl",
    tax_rates: ["txr_1HCjzTHYgolSBA35m0e1tJN5"],
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  }
);
```

#### Collecting a shipping address during checkout

To collect a shipping address from your customer during checkout, you need to create a `shipping_countries` doc in your `products` collection. This doc needs to have a field called `allowed_countries` which needs to be an array. In this array, add the country codes for the countries that you ship to. You can find a list of supported countries [here](https://stripe.com/docs/api/checkout/sessions/create#create_checkout_session-shipping_address_collection-allowed_countries).

Secondly, you need to add `collect_shipping_address: true` to the Checkout Session doc creation:

```js
import { collection, doc, addDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const db = getFirestore();

const docRef = await addDoc(
  collection(
    db,
    "${param:CUSTOMERS_COLLECTION}",
    currentUser.uid,
    "checkout_sessions"
  ),
  {
    collect_shipping_address: true,
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl",
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  }
);
```

#### Setting metadata on the subscription

You can optionally set a metadata object with key-value pairs when creating the checkout session. This can be useful for storing additional information about the customer's subscription. This metadata will be synced to both the Stripe subscription object (making it searchable in the Stripe Dashboard) and the subscription document in the Cloud Firestore.

```js
import { collection, doc, addDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const db = getFirestore();

const docRef = await addDoc(
  collection(
    db,
    "${param:CUSTOMERS_COLLECTION}",
    currentUser.uid,
    "checkout_sessions"
  ),
  {
    price: "price_1GqIC8HYgolSBA35zoTTN2Zl",
    success_url: window.location.origin,
    cancel_url: window.location.origin,
    metadata: {
      item: "item001",
    },
  }
);
```

#### Adding multiple prices, including one-time setup fees

In addition to recurring prices, you can add one-time prices. These will only be on the initial invoice. This is useful for adding setup fees or other one-time fees associated with a subscription. To do so you will need to pass a `line_items` array instead:

```js
import { collection, doc, addDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const db = getFirestore();

const docRef = await addDoc(
  collection(
    db,
    "${param:CUSTOMERS_COLLECTION}",
    currentUser.uid,
    "checkout_sessions"
  ),
  {
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
  }
);
```

**_NOTE_**: If you specify more than one recurring price in the `line_items` array, the subscription object in Cloud Firestore will list all recurring prices in the `prices` array. The `price` attribute on the subscription in Cloud Firestore will be equal to the first item in the `prices` array: `price === prices[0]`.

Note that the Stripe customer portal currently does not support changing subscriptions with multiple recurring prices. In this case the portal will only offer the option to cancel the subscription.

#### Start a subscription via the Stripe Dashboard or API

Since version `0.1.7` the extension also syncs subscriptions that were not created via Stripe Checkout, e.g. via the [Stripe Dashboard](https://support.stripe.com/questions/create-update-and-schedule-subscriptions) or [via Elements and the API](https://stripe.com/docs/billing/subscriptions/fixed-price).

In order for this to work, Firebase Authentication users need to be synced with Stripe customer objects and the customers collection in Cloud Firestore (new configuration added in version `0.1.7`).

#### Get the customer's subscription

Subscription details are synced to the `subscriptions` sub-collection in the user's corresponding customer doc.

```js
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const db = getFirestore();

const subscriptionsQuery = query(
  collection(db, "${param:CUSTOMERS_COLLECTION}", currentUser.uid, "subscriptions"),
  where("status", "in", ["trialing", "active"])
);

onSnapshot(subscriptionsQuery, (snapshot) => {
  // In this implementation we only expect one active or trialing subscription to exist.
  const doc = snapshot.docs[0];
  console.log(doc.id, " => ", doc.data());
});
```

#### Redirect to the customer portal

Once a customer is subscribed you should show them a button to access the customer portal to view their invoices and manage their payment & subscription details. When the user clicks that button, call the `createPortalLink` function to get a portal link for them, then redirect them.

```js
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const createPortalLink = httpsCallable(functions, 'ext-${param:EXT_INSTANCE_ID}-createPortalLink');

const { data } = await createPortalLink({
  returnUrl: window.location.origin,
  locale: "auto", // Optional, defaults to "auto"
  configuration: "bpc_1JSEAKHYgolSBA358VNoc2Hs", // Optional ID of a portal configuration: https://stripe.com/docs/api/customer_portal/configuration
});
window.location.assign(data.url);
```

#### Delete User Data

You have the option to automatically delete customer objects in Stripe by setting the deletion option in the configuration to "Auto delete". In that case, when a user is deleted in Firebase Authentication, the extension will delete their customer object in Stripe which will immediately cancel all subscriptions for the user.

The extension will not delete any data from Cloud Firestore. Should you wish to delete the customer data from Cloud Firestore, you can use the [Delete User Data](https://firebase.google.com/products/extensions/delete-user-data) extension built by the Firebase team.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.

Access the [Stripe dashboard](https://dashboard.stripe.com/) to manage all aspects of your Stripe account.

Enjoy and please submit any feedback and feature requests on [GitHub](https://github.com/stripe/stripe-firebase-extensions/issues/new/choose)!
