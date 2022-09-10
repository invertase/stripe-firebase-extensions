import concurrently from 'concurrently';

(async () => {
  const { result } = await concurrently(
    [
      {
        command: 'npm run exec:emulator:watch',
        name: 'testing',
      },
    ],
    {}
  );
})();
