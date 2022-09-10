const concurrently = require('concurrently');

(async () => {
  const { result } = await concurrently(
    [
      {
        command: 'npm run exec:emulator',
        name: 'testing',
      },
    ],
    {}
  );
})();
