# Run Payments with Stripe

**Author**: Invertase (**[https://invertase.io](https://invertase.io)**)

**Description**: Controls access to paid content by syncing your one-time and recurring payments with Firebase Authentication.



**Details**: Use this extension as a backend for your [Stripe](https://www.stripe.com/) payments.

The extension supports multiple use cases:

- Process one-time payments with [Stripe Checkout](https://stripe.com/docs/payments/checkout) on the web.
- Create subscriptions for your users and manage access control via Firebase Authentication.
- Process payments & set up payment methods with the mobile payment sheet on [Android](https://stripe.com/docs/payments/accept-a-payment?platform=android&ui=payment-sheet), [iOS](https://stripe.com/docs/payments/accept-a-payment?platform=ios&ui=payment-sheet), or with [React Native](https://stripe.com/docs/payments/accept-a-payment?platform=react-native&ui=payment-sheet).

#### Subscription payments with Stripe Checkout

Users can sign-up for your digital goods and paid content with Stripe Checkout and manage their subscriptions with the Stripe customer portal.

This extension syncs customers' subscription status with your Cloud Firestore and adds custom claims using Firebase Authentication for convenient access control in your application.

The design for Stripe Checkout and the customer portal can be customized in your Stripe Dashboard [branding settings](https://dashboard.stripe.com/settings/branding). See this example which is customized to match the Firebase color scheme:

![Stripe Checkout Page](https://storage.googleapis.com/stripe-subscriptions-firebase-screenshots/firebase-stripe-subs-checkout.png)
![Stripe Customer Portal](https://storage.googleapis.com/stripe-subscriptions-firebase-screenshots/firebase-stripe-subs-customer-portal.png)

#### Recommended usage

If you're building on the web platform, you can use this extension for any of your payment use cases. 

If you're developing native mobile applications and you're selling digital products or services within your app, (e.g. subscriptions, in-game currencies, game levels, access to premium content, or unlocking a full version), you must use the app store's in-app purchase APIs. See [Apple's](https://developer.apple.com/app-store/review/guidelines/#payments) and [Google's](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en&ref_topic=9857752) guidelines for more information. 

For all other scenarios you can use the [stripe-android](https://github.com/stripe/stripe-android), [stripe-ios](https://github.com/stripe/stripe-ios), [stripe-react-native](https://github.com/stripe/stripe-react-native), or [flutter_stripe](https://github.com/flutter-stripe/flutter_stripe) SDKs.

#### Client SDK

You can use the [`@stripe/firestore-stripe-payments`](https://github.com/stripe/stripe-firebase-extensions/blob/next/firestore-stripe-web-sdk/README.md)
JavaScript package to easily access this extension from web clients. This client SDK provides
TypeScript type definitions and high-level convenience APIs for most common operations client
applications would want to implement using the extension.

Use a package manager like NPM to install the above package, and use it in conjunction with
the Firebase Web SDK.

### Events

This extension emits events, which allows you to listen to and run custom logic at different trigger points during the functioning of the extension. For example you can listen to events when a product has been added via the `product.created` event, or whenever a payment has succeeded through the `invoice.payment_succeeded` event.

#### Additional setup

Before installing this extension, set up the following Firebase services in your Firebase project:

- [Cloud Firestore](https://firebase.google.com/docs/firestore) to store customer & subscription details.
  - Follow the steps in the [documentation](https://firebase.google.com/docs/firestore/quickstart#create) to create a Cloud Firestore database.
- [Firebase Authentication](https://firebase.google.com/docs/auth) to enable different sign-up options for your users.
  - Enable the sign-in methods in the [Firebase console](https://console.firebase.google.com/project/_/authentication/providers) that you want to offer your users.

Then, in the [Stripe Dashboard](https://dashboard.stripe.com):

- Create a new [restricted key](https://stripe.com/docs/keys#limit-access) with write access for the "Customers", "Checkout Sessions" and "Customer portal" resources, and read-only access for the "Subscriptions" and "Prices" resources.

#### Installing via Firebase CLI 

When installing via the CLI, be sure to pin the version. 

```
firebase ext:install invertase/firestore-stripe-payments --project=projectId_or_alias
Alternatively for local source:
firebase ext:install . --project=projectId_or_alias
```

The current version can be found in [extension.yaml](extension.yaml). 

#### Using webhooks locally

If you wish to test the webhooks **locally**, use the following command to configure the extension:

```
firebase ext:configure firestore-stripe-payments --local
```

Be sure to configure your test mode [API Key](https://stripe.com/docs/keys) and webhook [signing secret](https://stripe.com/docs/webhooks/signatures#:~:text=Before%20you%20can%20verify%20signatures,secret%20key%20for%20each%20endpoint.) when prompted. 

Start the firebase emulator with:

```
firebase emulators:start --project=projectId_or_alias
```

Find the functions path associated with the stripe extension, typically it looks like this:

- `http://192.0.0.1:5001/{projectId}/{region}/ext-firestore-stripe-payments-handleWebhookEvents`

- You can tunnel your local endpoint using a tool like [ngrok](https://ngrok.com/). In this case you will tunnel the localhost domain and port `http://127.0.01:5001`. Replace `127.0.0.1:5001` with your tunnel url. The end result would look something like:

```
https://1234-1234-1234.ngrok.io/{projectId}/{region}/ext-firestore-stripe-payments-handleWebhookEvents
```

- Configure your test mode stripe [webhook endpoint](https://stripe.com/docs/webhooks) with the url you just constructed. 

- Your local webhooks are now set up. 


#### Billing

This extension uses the following Firebase services which may have associated charges:

- Cloud Firestore
- Cloud Functions
- Cloud Secret Manager
- Firebase Authentication
- If you enable events [Eventarc fees apply](https://cloud.google.com/eventarc/pricing).

This extension also uses the following third-party services:

- Stripe Payments ([pricing information](https://stripe.com/pricing))
- Stripe Billing (when using subscriptions. [pricing information](https://stripe.com/pricing#billing-pricing))

You are responsible for any costs associated with your use of these services.

#### Note from Firebase

To install this extension, your Firebase project must be on the Blaze (pay-as-you-go) plan. You will only be charged for the resources you use. Most Firebase services offer a free tier for low-volume use. [Learn more about Firebase billing.](https://firebase.google.com/pricing)

Starting August 17 2020, you will be billed a small amount (typically less than $0.10) when you install or reconfigure this extension. See the [Cloud Functions for Firebase billing FAQ](https://firebase.google.com/support/faq#expandable-15) for a detailed explanation.



**Configuration Parameters:**

* Cloud Functions deployment location: Where do you want to deploy the functions created for this extension? You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* Products and pricing plans collection: What is the path to the Cloud Firestore collection where the extension should store Stripe pricing plans?

* Customer details and subscriptions collection: What is the path to the Cloud Firestore collection where the extension should store Stripe customer details? This can be the location of an existing user collection, the extension will not overwrite your existing data but rather merge the Stripe data into your existing `uid` docs.

* Stripe configuration collection: What is the path to the Cloud Firestore collection where the extension should store Stripe configuration?

* Sync new users to Stripe customers and Cloud Firestore: Do you want to automatically sync new users to customer objects in Stripe? If set to 'Sync', the extension will create a new customer object in Stripe and add a new doc to the customer collection in Firestore when a new user signs up via Firebase Authentication. If set to 'Do not sync' (default), the extension will create the customer object "on the fly" with the first checkout session creation.

* Automatically delete Stripe customer objects: Do you want to automatically delete customer objects in Stripe? When a user is deleted in Firebase Authentication or in Cloud Firestore and set to 'Auto delete' the extension will delete their customer object in Stripe which will immediately cancel all subscriptions for the user.

* Stripe API key with restricted access: What is your Stripe API key? We recommend creating a new [restricted key](https://stripe.com/docs/keys#limit-access) with write access only for the "Customers", "Checkout Sessions" and "Customer portal" resources. And read-only access for the "Subscriptions" and "Prices" resources.

* Stripe webhook secret: This is your signing secret for a Stripe-registered webhook. This webhook can only be registered after installation. Leave this value untouched during installation, then follow the postinstall instructions for registering your webhook and configuring this value.

* Minimum instances for createCheckoutSession function: Set the minimum number of function instances that should be always be available to create Checkout Sessions. This number can be adjusted to reduce cold starts and increase the responsiveness of Checkout Session creation requests. Suggested values are 0 or 1. Please note this setting will likely incur billing costss, see the [Firebase documentation](https://firebase.google.com/docs/functions/manage-functions#reduce_the_number_of_cold_starts) for more information.



**Cloud Functions:**

* **createCustomer:** Creates a Stripe customer object when a new user signs up.

* **createCheckoutSession:** Creates a Checkout session to collect the customer's payment details.

* **createPortalLink:** Creates links to the customer portal for the user to manage their payment & subscription details.

* **handleWebhookEvents:** Handles Stripe webhook events to keep subscription statuses in sync and update custom claims.

* **onUserDeleted:** Deletes the Stripe customer object and cancels all their subscriptions when the user is deleted in Firebase Authentication.

* **onCustomerDataDeleted:** Deletes the Stripe customer object and cancels all their subscriptions when the customer doc in Cloud Firestore is deleted.



**Access Required**:



This extension will operate with the following project IAM roles:

* firebaseauth.admin (Reason: Allows the extension to set custom claims for users.)

* datastore.user (Reason: Allows the extension to store customers & subscriptions in Cloud Firestore.)
