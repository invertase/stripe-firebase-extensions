import config from '../../lib/config';
const stripe = require('stripe')(config.stripeSecretKey);

export const cleanupCustomers = async (): Promise<void> => {
  const { data: customers } = await stripe.customers.list({ limit: 100 });

  console.log('Cleaning customer records....');

  for (let customer of customers) {
    await stripe.customers.del(customer.id);
  }

  return Promise.resolve();
};
