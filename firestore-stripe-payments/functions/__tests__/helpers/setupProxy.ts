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

export const setupProxy = async () => {
  /** Set Stripe secret if provided or running in CI */
  if (process.env.STRIPE_API_KEY) {
    await setEnv('STRIPE_API_KEY', process.env.STRIPE_API_KEY, true);
  }

  /** Load Stripe key before initialisation */
  fs.readFile(pathTosecretsFile, 'utf8', (err, data) => {
    const { STRIPE_API_KEY } = parse(data);
    process.env.STRIPE_API_KEY = STRIPE_API_KEY;
  });

  const PROXY_URL = await ngrok.connect(5001);
  const webhook = await setupWebhooks(
    `${PROXY_URL}/demo-project/us-central1/ext-firestore-stripe-payments-handleWebhookEvents`
  );

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
