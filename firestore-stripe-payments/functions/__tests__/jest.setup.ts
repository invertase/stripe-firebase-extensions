(async function () {
  // Skip Stripe setup for non-integration tests
  if (process.env.INTEGRATION_TEST !== 'true') {
    console.log('Skipping Stripe setup for unit tests');
    return;
  }
  try {
    // Verify critical environment variables are set
    if (!process.env.CUSTOMERS_COLLECTION) {
      throw new Error('CUSTOMERS_COLLECTION environment variable is not set');
    }
    if (!process.env.PROJECT_ID) {
      throw new Error('PROJECT_ID environment variable is not set');
    }
  } catch (error) {
    console.error('Failed to setup test environment:', error);
    process.exit(1);
  }
})();
