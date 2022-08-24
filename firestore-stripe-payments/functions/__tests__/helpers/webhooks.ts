export const setupWebhooks = async (url) => {
  const stripe = require('stripe')(process.env.STRIPE_API_KEY);

  /** cleanup any existing webhooks (if over 6 remaining?) */

  const currentWebhooks = await stripe.webhookEndpoints.list({ limit: 100 });

  if (currentWebhooks.data.length > 6) {
    await Promise.all(
      currentWebhooks.data.map((webhook) => {
        return stripe.webhookEndpoints.del(webhook.id);
      })
    );
  }

  console.log(`removed ${currentWebhooks.data.length} webhooks`);

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
