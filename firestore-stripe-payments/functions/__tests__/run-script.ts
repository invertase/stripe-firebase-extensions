const concurrently = require('concurrently');

import { setupProxy, cleanupProxy } from './helpers/setupProxy';

(async () => {
  const proxyId = await setupProxy();

  await concurrently([
    {
      command: 'npx kill-port 5001 && npx kill-port 8080 && kill-port 9099',
      name: 'Ready ports',
    },
  ]);

  const { result } = await concurrently(
    [
      {
        command: 'npm run test:ci',
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
