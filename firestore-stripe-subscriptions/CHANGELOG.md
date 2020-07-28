## Version 0.1.3

[fix] - Apply trial days from pricing plan to the checkout session.

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
