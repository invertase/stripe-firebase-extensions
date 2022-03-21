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
      console.log(result);
      fs.writeFile(pathToenvFile, stringify(result), (err) => {
        if (err) {
          return reject(err);
        }
        console.log('File Saved');
        return resolve('Completed');
      });
    });
  });
}

export const setupProxy = async () => {
  const PROXY_URL = await ngrok.connect(5001);
  const webhook = await setupWebhooks(
    `${PROXY_URL}/extensions-testing/us-central1/handleWebhookEvents`
  );

  await setEnv('STRIPE_WEBHOOK_SECRET', webhook.secret);
  await setEnv('WEBHOOK_URL', webhook.url);
  await setEnv('WEBHOOK_ID', webhook.id);

  console.log('Done!', webhook.url);

  return webhook.id;
};

export const cleanupProxy = async (webhookUrl) => {
  await clearWebhooks(webhookUrl);
  return ngrok.kill();
};
