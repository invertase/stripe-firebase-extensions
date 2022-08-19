const concurrently = require('concurrently');

import { setupProxy, cleanupProxy } from './helpers/setupProxy';

(async () => {
  const proxyId = await setupProxy();

  /* clean stripe webhook on exit */
  process.on('SIGINT', () => {
    cleanupProxy(proxyId).then(() => {
      console.log('Removed webhook ', proxyId);
      process.exit(0);
    });
  });

  await concurrently([
    {
      command: 'npx kill-port 5001, npx kill-port 8080',
      name: 'Ready ports',
    },
  ]);

  await concurrently(
    [
      {
        command: 'npm run start:emulator',
        name: 'emulator',
      },
      {
        command: 'sh ../runTestsWatch.sh',
        name: 'testing',
      },
    ],
    {}
  );
})();
