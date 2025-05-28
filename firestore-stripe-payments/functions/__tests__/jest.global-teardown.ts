export default async function globalTeardown() {
  // Skip Stripe cleanup for non-integration tests
  if (process.env.INTEGRATION_TEST !== 'true') {
    return;
  }

  if (global.stripeListenProcess) {
    global.stripeListenProcess.kill();
    global.stripeListenProcess = null;
  }
}
