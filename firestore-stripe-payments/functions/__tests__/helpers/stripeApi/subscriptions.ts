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

  /** create payment method */
  const paymentMethod = await stripe.paymentMethods.create({
    type: 'card',
    card: {
      number: '4242424242424242',
      exp_month: 5,
      exp_year: new Date().getFullYear() + 1,
      cvc: '314',
    },
  });

  /** attach payment method to customer */
  await stripe.paymentMethods.attach(paymentMethod.id, { customer });
  await stripe.customers.update(customer, {
    invoice_settings: { default_payment_method: paymentMethod.id },
  });

  /** Create a product */
  const subscription: Subscription = await stripe.subscriptions.create({
    customer,
    items: [{ price: price.id }],
    payment_settings: {
      payment_method_types: ['card'],
    },
  });

  return Promise.resolve(subscription);
};
