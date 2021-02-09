### See it in action

Before you proceed, make sure you have the following Firebase services set up:

- [Cloud Firestore](https://firebase.google.com/docs/firestore) to store invoice information and optionally invoice status.
    - Follow the steps in the [documentation](https://firebase.google.com/docs/firestore/quickstart#create) to create a Cloud Firestore database.
- [Optional] [Firebase Authentication](https://firebase.google.com/docs/auth) to optionally manage email and customer data.
    - Enable the sign-in methods in the [Firebase console](https://console.firebase.google.com/project/_/authentication/providers) that you want to offer your users.

To test out the extension:

1. Go to your [Cloud Firestore dashboard](https://console.firebase.google.com/project/${param:PROJECT_ID}/firestore/data) in the Firebase console.

1. If it doesn't already exist, create the collection you specified during installation: `${param:INVOICES_COLLECTION}`

1. Test the invoicing functionality by adding a document to your collection, for example:

```js
{
  email: "customer@example.com",
  items: [{
      amount: 1999,
      currency: "usd",
      quantity: 2, // Optional, defaults to 1.
      description: "my super cool item"
  },
  {
      amount: 540,
      currency: "usd",
      description: "shipping cost"
  }]
}
```

1. Look in your [Stripe dashboard](https://dashboard.stripe.com/test/invoices) for a record of the test invoice.

**Note:** Stripe only sends an email to your customer when the extension is using Stripe's live mode but not when using test mode. If you configured your extension with a test mode API key, you'll need to [reconfigure](https://console.firebase.google.com/project/${param:PROJECT_ID}/extensions/instances/${param:EXT_INSTANCE_ID}?tab=config) your installed extension with your [live mode key](https://dashboard.stripe.com/apikeys) before actually using the extension for customer invoicing.

### Using this extension

#### Create an invoice

An invoice requires either an email address or a [Firebase Authentication](https://firebase.google.com/docs/auth) user ID. The payment due is represented as a list of items. You can also optionally include a due date.

- **`email`** or **`uid`**: Either `email` or `uid` is required to send the invoice.

  - `email`: (_plaintext string_) email address of the customer
  - `uid`: (_string_) Firebase Authentication user ID that has an associated email address

- **`items`**: An array of items (each one is a map) that are included in the invoice. Each item must include an `amount` (_number_), `currency` (_string_), and `description` (_string_). It can optionally include an array of [`tax_rates`](https://stripe.com/docs/api/invoiceitems/create#create_invoiceitem-tax_rates) (_string, optional_).
- **`quantity`**: An optional `quantity` (_number_) parameter can be provided. If omitted the quantity will default to `1`.

  ```js
  {
    items: [
      {
        amount: 999,
        currency: 'usd',
        quantity: 2,
        description: 'one shirt, size medium',
      },
    ]
  }
  ```

**Note:** Stripe supports [135+ currencies](https://stripe.com/docs/currencies) and requires the amount to be in the currency’s small unit (for example, for USD, `999` is equivalent to \$9.99).

- **`daysUntilDue`**: (_number, optional_) The number of days a customer has to pay the invoice before it's closed. This value defaults to `${param:DAYS_UNTIL_DUE_DEFAULT}`, but you can override the default value by providing a value in the invoice document.

Here are some example documents to represent an invoice:

```js
{
  email: "customer@example.com",
  items: [{
      amount: 1999,
      currency: "usd",
      description: "my super cool item"
  },
  {
      amount: 540,
      currency: "usd",
      description: "shipping cost"
  }]
}
```

or

```js
{
  uid: "APkKkSLsT6cjxsCqYMh3Gi0TZtl5",
  items: [{
      amount: 1999,
      currency: "usd",
      description: "my super cool item"
  }],
  daysUntilDue: 2
}
```

- **`default_tax_rates`**: (_string, optional_) An array of [tax rates](https://stripe.com/docs/billing/taxes/tax-rates) that should be applied to all invoice items.

```js
{
  email: "testr@test.de",
  default_tax_rates: ["txr_1HCkCjHYgolSBA35vh6cyHB5"],
  items: [
    {
      amount: 1099,
      currency: "usd",
      description: "item 1",
      tax_rates: ["txr_1HCshzHYgolSBA35WkPjzOOi"],
    },
    {
      amount: 1250,
      currency: "usd",
      description: "item 2",
    },
  ],
}
```

- **`transfer_data`**: (_object, optional_) A [`transfer_data`](https://stripe.com/docs/api/invoices/create#create_invoice-transfer_data) object to send funds to a connected account upon successful payment.

```js
{
  transfer_data: {
    destination: "acct_1234",
    amount: 2114,
  },
  email: "testr@test.de",
  items: [
    {
      amount: 1099,
      currency: "usd",
      description: "item 1",
    },
    {
      amount: 1250,
      currency: "usd",
      description: "item 2",
    },
  ],
}
```

You can use a Firebase SDK to add an invoice document to [Cloud Firestore.](https://firebase.google.com/docs/firestore/quickstart#set_up_your_development_environment) Here's an example using the Firebase Node.js SDK:

```js
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

db.collection('${param:INVOICES_COLLECTION}')
  .add({
    email: 'customer@example.com',
    items: [
      {
        amount: 1000, // $10.00
        currency: 'usd',
        quantity: 2, // Optional, defaults to 1.
        description: 'Cool hat',
      },
    ],
  })
  .then((newInvoiceRef) =>
    console.log(`added a new invoice at path ${newInvoiceRef.path}`)
  );
```

Always add an invoice document from your server -- this ensures that your customer cannot directly manipulate the invoice values, especially for an item's `amount`.

#### Update Cloud Firestore security rules

**Creating Invoices**: You should prevent client access to the \${param:INVOICES_COLLECTION} collection to avoid potential abuse (you don't want users to send arbitrary emails from your company's address!).

You can use security rules to restrict write access (`allow write: if false;`) to your invoices collection so that new invoices can only be added by a trusted server.

In addition, you can use security rules to validate the data of each new invoice.

**Reading invoices**: It's important to ensure that one customer can't read another customer's invoicing information. You can use security rules to restrict read access for an invoice document to its associated customer by checking the `email` or `uid` field against `request.auth.uid` or `request.auth.token.email`.

#### Use your extension with Stripe's live mode

When you're ready to use your extension in live mode, make sure you've done each of the following:

- Customize the colors and logo of your invoice in the [branding settings](https://dashboard.stripe.com/settings/branding) of the Stripe dashboard.

- Configure your installed extension to use your [Stripe live mode API key](https://dashboard.stripe.com/apikeys).
  If you initially configured your extension to use a test mode key, then [reconfigure](https://console.firebase.google.com/project/${param:PROJECT_ID}/extensions/instances/${param:EXT_INSTANCE_ID}?tab=config) your extension's `Stripe API key` parameter to be your live mode key.

- _(Optional)_ Set up a Stripe webhook to add and update invoice status information to your Cloud Firestore documents. Learn more about this optional feature in the section below.

  **Note:** Setting up a Stripe webhook requires you to [reconfigure](https://console.firebase.google.com/project/${param:PROJECT_ID}/extensions/instances/${param:EXT_INSTANCE_ID}?tab=config) your extension with the webhook's signing secret. More details about this process are below.

#### _(Optional)_ Update Cloud Firestore documents with invoice statuses

You can set up a webhook that updates each Cloud Firestore document with the status of its associated invoice (called the [invoice lifecycle](https://stripe.com/docs/billing/subscriptions/overview#invoice-lifecycle)). The webhook creates invoice-status fields in the document, then it updates the fields whenever the invoice's status updates in the Stripe dashboard (for example, with `paid`, `uncollectable`, etc.). You can then query Cloud Firestore for this status to use in your app, company dashboards, etc.

Here's how to set up the webhook and configure your extension to use it:

1. Configure your webhook:

   1. Go to the [Stripe dashboard.](https://dashboard.stripe.com/webhooks)

   1. Use the URL of your extension's function as the endpoint URL. Here's your function's URL: `${function:updateInvoice.url}`

   1. Select all the invoice events.

1. Using the Firebase console or Firebase CLI, [reconfigure](https://console.firebase.google.com/project/${param:PROJECT_ID}/extensions/instances/${param:EXT_INSTANCE_ID}?tab=config) your extension with your webhook’s signing secret (such as, `whsec_12345678`). Enter the value in the parameter called `Stripe webhook secret`.

The webhook fires whenever the invoice's status updates in the Stripe dashboard. The first time the webhook fires, it finds the relevant document in Cloud Firestore, then creates two fields: `stripeInvoiceStatus` and `lastStripeEvent`. If the webhook fires subsequent times for the same invoice, it will update those same fields.

- `lastStripeEvent` is the webhook event type (for example `invoice.payment_succeeded`).

- `stripeInvoiceStatus` is the relevant end status (for example, `paid`).

Read more about Stripe’s invoicing workflow and the possible values for these two fields in the [Stripe documentation](https://stripe.com/docs/billing/invoices/workflow#invoice-status-transition-endpoints-and-webhooks). Note that for this extension, if the event type is `invoice.payment_failed`, its end status will be set to `payment_failed`.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.

Access the [Stripe dashboard](https://dashboard.stripe.com/) to manage all aspects of your Stripe account.

Enjoy and please submit any feedback and feature requests on [GitHub](https://github.com/stripe/stripe-firebase-extensions/issues/new/choose)!
