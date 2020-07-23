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
