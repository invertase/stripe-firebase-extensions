### Version 0.2.5 - 2023-12-21

[fix] - upgraded the resources to node 18 [#583]

## Version 0.2.4 - 2023-10-08

[fix] - updated extension icons

[fix] - updated external services to correct pricing uri configuration (#360)

[feat] - added new secret param type for ext config

[feat] - add Warsaw Cloud Function Location

[fix] - Only one of email or uid.

[feat] - Add support for invoiceItem quantity. (#2)

## Version 0.2.3 - 2023-08-21
[chore] Updated naming and upgraded to node18

[fix] Updated icons

[fix] updated appinfo versioning

## Version 0.2.2 - 2023-08-14
This extension has been formally transferred to Invertase. See the updated README for more details.

## Version 0.2.1 - 2022-08-24
[chore] Added `package-lock.json` to version control to prevent installation issues. [#426]

## Version 0.2.0 - 2022-04-26

[feat] - Add `invoice.paid`, `invoice.updated` to permitted webhook events list. #356

## Version 0.1.6 - 2021-02-11

[feat] - Add `stripeInvoiceUrl` to the invoice object in Cloud Firestore. #132

[feat] - Support invoices in various different currencies for the same email address. Note that this will create a separate customer object for each currency but with the same email address.

[feat] - Add support for [`default_tax_rates`](https://stripe.com/docs/api/invoices/create#create_invoice-default_tax_rates) for the invoice and [`tax_rates`](https://stripe.com/docs/api/invoiceitems/create#create_invoiceitem-tax_rates) for the invoice items. Read more details about how to use tax rates in the [Stripe docs](https://stripe.com/docs/billing/taxes/tax-rates). #118

```js
await firestore
  .collection("invoices")
  .doc()
  .set({
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
  });
```

[feat] - Add support for [`transfer_data`](https://stripe.com/docs/api/invoices/create#create_invoice-transfer_data) to send funds to a connected account upon successful payment.

```js
await firestore
  .collection("invoices")
  .doc()
  .set({
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
  });
```

## Version 0.1.5 - 2020-11-19

[fixed] - Prevent users from specifying both email address and uid, only either one is allowed.

## Version 0.1.4

[fixed] - Add validation for Firestore collection param (#31)
[changed] - Improved documentation (#30)

## Version 0.1.3

[feat] - Add support for an optional `quantity` (_number_) parameter on objects in the `items` array, e.g.

```js
{
  email: "customer@example.com",
  items: [{
    amount: 1999,
    currency: "usd",
    quantity: 2,
    description: "my super cool item"
  },
  {
    amount: 540,
    currency: "usd",
    description: "shipping cost"
  }]
}
```

If omitted, quantity defaults to `1`.

## Version 0.1.2

[change] - Extension has been renamed to `firestore-stripe-invoices`.

## Version 0.1.1

[fixed] - Fixed idempotency key collision for invoice item creation which was causing errors for invoices with more than one item.

## Version 0.1.0

Initial release of the `firestore-invoice-stripe` extension.
