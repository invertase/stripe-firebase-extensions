export default async function globalTeardown() {
  // Skip Stripe setup for non-integration tests
  if (process.env.INTEGRATION_TEST !== 'true') {
    console.log('Skipping Stripe setup for unit tests');
    return;
  }
  if (global.stripeListenProcess) {
    global.stripeListenProcess.kill();
    global.stripeListenProcess = null;
  }
}
