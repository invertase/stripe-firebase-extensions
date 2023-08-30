const concurrently = require('concurrently');

import {
  setupProxy,
  cleanupProxy,
  cleanupAllWebhooks,
} from './helpers/setupProxy';

(async () => {
  console.log('Starting tests...');

  /** Clear all webhooks with ngrok.io,
   * useful for clearing any failed ci testing
   */
  console.log('Clearing webhooks...');
  // await cleanupAllWebhooks();

  const proxyId = await setupProxy();

  const { result } = await concurrently(
    [
      {
        command: 'npm run exec:emulator',
        name: 'testing',
      },
    ],
    {}
  );

  await result.then(async () => {
    await cleanupProxy(proxyId);
    console.log('Removed webhook ', proxyId);
    process.exit(0);
  });
})();
