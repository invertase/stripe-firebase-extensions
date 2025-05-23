import { spawn } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import { setupEnvironment } from './helpers/setupEnvironment';

const execAsync = promisify(exec);

// Make stripeListenProcess available globally
declare global {
  var stripeListenProcess: any;
}

export default async function globalSetup() {
  // Load all environment variables
  setupEnvironment();

  const stripeApiKey = process.env.STRIPE_API_KEY;
  if (!stripeApiKey) {
    throw new Error('STRIPE_API_KEY is required in your secrets file');
  }

  // Kill any existing stripe listen processes
  try {
    await execAsync('pkill -f "stripe listen"');
  } catch (error) {
    // Ignore error if no process was found
  }

  return new Promise<string>((resolve, reject) => {
    // Start stripe listen in the background with API key
    global.stripeListenProcess = spawn(
      'stripe',
      [
        'listen',
        '--api-key',
        stripeApiKey,
        '--forward-to',
        'localhost:5001/firestore-stripe-payments/us-central1/stripeWebhook',
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let webhookSecret = '';
    let outputBuffer = '';

    global.stripeListenProcess.stderr.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log('Stripe:', output);
      outputBuffer += output;

      // Look for the webhook signing secret
      const secretMatch = output.match(
        /Ready! Your webhook signing secret is (whsec_\w+)/
      );
      if (secretMatch) {
        webhookSecret = secretMatch[1];
        console.log('Found webhook secret:', webhookSecret);
        // Set the webhook secret in process.env for all tests
        process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
        resolve(webhookSecret);
      }
    });

    global.stripeListenProcess.on('close', (code: number) => {
      if (code !== 0 && !webhookSecret) {
        reject(new Error(`Stripe listen process exited with code ${code}`));
      }
    });

    // Set a timeout - IMPORTANT: Resolve after timeout even without a webhook secret
    setTimeout(() => {
      if (!webhookSecret) {
        console.error(
          'Warning: Timeout waiting for stripe listen webhook secret'
        );
        console.error('Stripe output:', outputBuffer);
        // Still resolve with a dummy value so tests can proceed
        process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy_for_tests';
        resolve('whsec_dummy_for_tests');
      }
    }, 10000); // Reduced timeout to 10 seconds
  });
}
