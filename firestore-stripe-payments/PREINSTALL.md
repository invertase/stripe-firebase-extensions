Use this extension as a backend for your [Stripe](https://www.stripe.com/) payments.

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

#### Additional setup

Before installing this extension, set up the following Firebase services in your Firebase project:

- [Cloud Firestore](https://firebase.google.com/docs/firestore) to store customer & subscription details.
  - Follow the steps in the [documentation](https://firebase.google.com/docs/firestore/quickstart#create) to create a Cloud Firestore database.
- [Firebase Authentication](https://firebase.google.com/docs/auth) to enable different sign-up options for your users.
  - Enable the sign-in methods in the [Firebase console](https://console.firebase.google.com/project/_/authentication/providers) that you want to offer your users.

Then, in the [Stripe Dashboard](https://dashboard.stripe.com):

- Create a new [restricted key](https://stripe.com/docs/keys#limit-access) with write access for the "Customers", "Checkout Sessions" and "Customer portal" resources, and read-only access for the "Subscriptions" and "Plans" resources.

#### Billing

This extension uses the following Firebase services which may have associated charges:

- Cloud Firestore
- Cloud Functions
- Firebase Authentication

This extension also uses the following third-party services:

- Stripe Payments ([pricing information](https://stripe.com/pricing)) 
- Stripe Billing (when using subscriptions. [pricing information](https://stripe.com/pricing#billing-pricing))

You are responsible for any costs associated with your use of these services.

#### Note from Firebase

To install this extension, your Firebase project must be on the Blaze (pay-as-you-go) plan. You will only be charged for the resources you use. Most Firebase services offer a free tier for low-volume use. [Learn more about Firebase billing.](https://firebase.google.com/pricing)

Starting August 17 2020, you will be billed a small amount (typically less than $0.10) when you install or reconfigure this extension. See the [Cloud Functions for Firebase billing FAQ](https://firebase.google.com/support/faq#expandable-15) for a detailed explanation.