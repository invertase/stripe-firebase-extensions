import { faker } from '@faker-js/faker';
import config from '../../../lib/config';
import { Product, Subscription } from '../../../src/interfaces';

const stripe = require('stripe')(config.stripeSecretKey);

export const createRandomSubscription = async (
  customer
): Promise<Subscription> => {
  const name = faker.commerce.product();

  /** create a product */
  const product: Product = await stripe.products.create({
    name,
    description: `Description for ${name}`,
  });

  /** create a price */
  const price = await stripe.prices.create({
    unit_amount: 1000,
    currency: 'gbp',
    recurring: { interval: 'month' },
    product: product.id,
  });

  /** Attach the test PaymentMethod to the customer */
  const attachedPaymentMethod = await stripe.paymentMethods.attach(
    'pm_card_visa',
    { customer: customer }
  );

  /** Update the customer's default PaymentMethod */
  await stripe.customers.update(customer, {
    invoice_settings: { default_payment_method: attachedPaymentMethod.id },
  });

  /** Create a subscription */
  const subscription: Subscription = await stripe.subscriptions.create({
    customer: customer,
    items: [{ price: price.id }],
  });

  return Promise.resolve(subscription);
};
