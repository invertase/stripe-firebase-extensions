const ngrok = require('ngrok');
const fs = require('fs');
const path = require('path');

const pathToenvFile = path.resolve(__dirname, '../test-params.env');

require('dotenv').config({
  path: path.resolve(pathToenvFile),
});
const { parse, stringify } = require('envfile');

import { clearWebhooks, setupWebhooks } from './webhooks';

async function setEnv(key, value) {
  return new Promise((resolve, reject) => {
    fs.readFile(pathToenvFile, 'utf8', function (err, data) {
      if (err) {
        return reject(err);
      }
      var result = parse(data);
      result[key] = value;

      fs.writeFile(pathToenvFile, stringify(result), (err) => {
        if (err) {
          return reject(err);
        }
        return resolve('Completed');
      });
    });
  });
}

export const setupProxy = async () => {
  if (process.env.STRIPE_API_KEY) {
    await setEnv('STRIPE_API_KEY', process.env.STRIPE_API_KEY);
  }

  const PROXY_URL = await ngrok.connect(5001);
  const webhook = await setupWebhooks(
    `${PROXY_URL}/demo-project/us-central1/handleWebhookEvents`
  );

  await Promise.all([
    await setEnv('STRIPE_WEBHOOK_SECRET', webhook.secret),
    await setEnv('WEBHOOK_URL', webhook.url),
    await setEnv('WEBHOOK_ID', webhook.id),
    await setEnv('LOCATION', 'us-central1'),
    await setEnv('PROJECT_ID', 'demo-project'),
    await setEnv('PRODUCTS_COLLECTION', 'products'),
    await setEnv('CUSTOMERS_COLLECTION', 'customers'),
    await setEnv('SYNC_USERS_ON_CREATE', 'Sync'),
    await setEnv('DELETE_STRIPE_CUSTOMERS', 'Auto delete'),
  ]);

  return webhook.id;
};

export const cleanupProxy = async (webhookUrl) => {
  return clearWebhooks(webhookUrl);
};
