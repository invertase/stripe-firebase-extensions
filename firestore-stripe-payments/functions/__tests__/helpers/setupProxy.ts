const ngrok = require('ngrok');
const fs = require('fs').promises;
const { parse, stringify } = require('envfile');

import { clearWebhooks, setupWebhooks, clearAllWebhooks } from './webhooks';
import { pathTosecretsFile, pathToenvFile } from './setupEnvironment';
import { setupEnvironment } from './setupEnvironment';

async function setEnv(key: string, value, isSecret?: boolean) {
  /** Load Stripe key into env */
  setupEnvironment();

  const path = isSecret ? pathTosecretsFile : pathToenvFile;

  const data = await fs.readFile(path, 'utf8');

  var result = parse(data);
  result[key] = value;

  await fs.writeFile(path, stringify(result));
}

export const setupProxy = async () => {
  /** Set Stripe secret and webhooks if provided or running in CI */
  if (process.env.STRIPE_API_KEY) {
    await setEnv('STRIPE_API_KEY', process.env.STRIPE_API_KEY, true);
    await setEnv(
      'STRIPE_WEBHOOK_SECRET',
      process.env.STRIPE_WEBHOOK_SECRET,
      true
    );
    await setEnv('WEBHOOK_URL', process.env.STRIPE_API_KEY);
  }

  /** Load Stripe key before initialisation */
  const secretsEnv = await fs.readFile(pathTosecretsFile, 'utf8');
  const paramsEnv = await fs.readFile(pathToenvFile, 'utf8');
  const { STRIPE_API_KEY, STRIPE_WEBHOOK_SECRET } = parse(secretsEnv);
  const { WEBHOOK_URL } = parse(paramsEnv);

  /** Set configurable params */
  process.env.STRIPE_API_KEY = STRIPE_API_KEY;
  process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;
  process.env.WEBHOOK_URL = WEBHOOK_URL;

  console.log(
    'process.env.STRIPE_WEBHOOK_SECRET',
    process.env.STRIPE_WEBHOOK_SECRET
  );

  await Promise.all([
    await setEnv('STRIPE_API_KEY', STRIPE_API_KEY, true),
    await setEnv('STRIPE_WEBHOOK_SECRET', STRIPE_WEBHOOK_SECRET, true),
    await setEnv('WEBHOOK_URL', WEBHOOK_URL),
    // await setEnv('WEBHOOK_ID', webhook.id),
    await setEnv('LOCATION', 'us-central1'),
    await setEnv('PROJECT_ID', 'demo-project'),
    await setEnv('PRODUCTS_COLLECTION', 'products'),
    await setEnv('CUSTOMERS_COLLECTION', 'customers'),
    await setEnv('SYNC_USERS_ON_CREATE', 'Sync'),
    await setEnv('DELETE_STRIPE_CUSTOMERS', 'Auto delete'),
  ]);

  /** Load additional key into env */
  setupEnvironment();

  // return webhook.id;

  return;
};

export const cleanupProxy = async (webhookUrl) => {
  return clearWebhooks(webhookUrl);
};

export const cleanupAllWebhooks = async () => {
  return clearAllWebhooks();
};
