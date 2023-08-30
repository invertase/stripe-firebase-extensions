export const setupWebhooks = async (url) => {
  const stripe = require('stripe')(process.env.STRIPE_API_KEY);

  const webhook = await stripe.webhookEndpoints.create({
    url,
    enabled_events: [
      'product.created',
      'product.updated',
      'product.deleted',
      'price.created',
      'price.updated',
      'price.deleted',
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'payment_intent.processing',
      'payment_intent.succeeded',
      'payment_intent.canceled',
      'payment_intent.payment_failed',
      'tax_rate.created',
      'tax_rate.updated',
      'invoice.paid',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'invoice.upcoming',
      'invoice.marked_uncollectible',
      'invoice.payment_action_required',
    ],
  });

  return webhook;
};

export const clearWebhooks = async (id) => {
  const stripe = require('stripe')(process.env.STRIPE_API_KEY);

  return stripe.webhookEndpoints.del(process.env.WEBHOOK_ID);
};

export const clearAllWebhooks = async () => {
  console.log('Step 1 >>>>>');
  const stripe = require('stripe')(process.env.STRIPE_API_KEY);

  console.log('Step 2 >>>>>');
  const webhooks = await stripe.webhookEndpoints.list();

  console.log('Step 3 >>>>>');

  /** Log how weekbhooks have been found */
  console.log('Found webhooks: ', webhooks.data.length);

  for await (const webhook of webhooks.data) {
    console.log('Deleting webhook: ', webhook.id);
    await stripe.webhookEndpoints.del(webhook.id);
  }

  return Promise.resolve();
};
