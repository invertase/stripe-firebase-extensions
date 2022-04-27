import config from '../../../lib/config';
const stripe = require('stripe')(config.stripeSecretKey);

export const findCustomer = async (id) => {
  return stripe.customers.retrieve(id);
};
