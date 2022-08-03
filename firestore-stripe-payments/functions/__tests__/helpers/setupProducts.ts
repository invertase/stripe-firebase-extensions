import { faker } from '@faker-js/faker';
import config from '../../lib/config';
import { Product, Subscription } from '../../src/interfaces';

const stripe = require('stripe')(config.stripeSecretKey);

export const generateRecurringPrice = async () => {
  const name = faker.commerce.product();
  const product = await stripe.products.create({
    name,
    description: `Description for ${name}`,
  });

  const price = await stripe.prices.create({
    unit_amount: 1000,
    currency: 'gbp',
    recurring: { interval: 'month' },
    product: product.id,
  });

  return price;
};

export const createRandomProduct = async (): Promise<Product> => {
  const name = faker.commerce.product();
  const product: Product = await stripe.products.create({
    name,
    description: `Description for ${name}`,
  });

  return Promise.resolve(product);
};

export const updateProduct = async (id, update): Promise<Product> => {
  const product: Product = await stripe.products.update(id, {
    ...update,
  });

  return Promise.resolve(product);
};
