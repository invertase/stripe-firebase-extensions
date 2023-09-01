const ngrok = require('ngrok');
const fs = require('fs');
const { parse, stringify } = require('envfile');

import { clearWebhooks, setupWebhooks, clearAllWebhooks } from './webhooks';
import { pathTosecretsFile, pathToenvFile } from './setupEnvironment';
import { setupEnvironment } from './setupEnvironment';

async function setEnv(key: string, value, isSecret?: boolean) {
  return new Promise((resolve, reject) => {
    /** Load Stripe key into env */
    setupEnvironment();

    const path = isSecret ? pathTosecretsFile : pathToenvFile;

    fs.readFile(path, 'utf8', function (err, data) {
      if (err) {
        return reject(err);
      }
      var result = parse(data);
      result[key] = value;

      fs.writeFile(path, stringify(result), (err) => {
        if (err) {
          return reject(err);
        }
        return resolve('Completed');
      });
    });
  });
}

export const loadStripeSecret = async () => {
  /** Set Stripe secret if provided or running in CI */
  if (process.env.STRIPE_API_KEY) {
    await setEnv('STRIPE_API_KEY', process.env.STRIPE_API_KEY, true);
  }

  /** Load Stripe key from secrets file for local development */
  if (!process.env.STRIPE_API_KEY) {
    const { STRIPE_API_KEY } = parse(
      fs.readFileSync(pathTosecretsFile, 'utf-8')
    );
    process.env.STRIPE_API_KEY = STRIPE_API_KEY;
  }
};

export const getProxyUrl = () => {
  /** Return if already set */
  if (process.env.PROXY_URL) return process.env.PROXY_URL;

  /** Load from env */
  const { PROXY_URL } = parse(fs.readFileSync(pathToenvFile, 'utf-8'));
  return PROXY_URL;
};

export const setupProxy = async () => {
  /** Load in the Stripe secret */
  await loadStripeSecret();

  /** Find the correct proxy url */
  const proxyUrl = getProxyUrl();

  /** Create a new webhook for testing */
  const webhook = await setupWebhooks(
    `${proxyUrl}/demo-project/us-central1/ext-firestore-stripe-payments-handleWebhookEvents`
  );

  /** Update the full extension configuration */
  await Promise.all([
    await setEnv('STRIPE_WEBHOOK_SECRET', webhook.secret, true),
    await setEnv('WEBHOOK_URL', webhook.url),
    await setEnv('WEBHOOK_ID', webhook.id),
    await setEnv('LOCATION', 'us-central1'),
    await setEnv('PROJECT_ID', 'demo-project'),
    await setEnv('PRODUCTS_COLLECTION', 'products'),
    await setEnv('CUSTOMERS_COLLECTION', 'customers'),
    await setEnv('SYNC_USERS_ON_CREATE', 'Sync'),
    await setEnv('DELETE_STRIPE_CUSTOMERS', 'Auto delete'),
  ]);

  /** Load additional key into env */
  setupEnvironment();

  return webhook.id;
};

export const cleanupProxy = async (webhookUrl) => {
  return clearWebhooks(webhookUrl);
};

export const cleanupAllWebhooks = async () => {
  return clearAllWebhooks();
};
