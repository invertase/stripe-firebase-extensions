import path from 'path';
import dotenv from 'dotenv';

export const pathToEnvFile = path.resolve(
  __dirname,
  '../../../_emulator/extensions/firestore-stripe-payments.env.local',
);

export const pathToSecretsFile = path.resolve(
  __dirname,
  '../../../_emulator/extensions/firestore-stripe-payments.secret.local',
);

export const setupEnvironment = () => {
  dotenv.config({
    path: pathToEnvFile,
  });
  console.log('CUSTOMERS_COLLECTION:', process.env.CUSTOMERS_COLLECTION);

  console.log('Loading secrets file from:', pathToSecretsFile);
  dotenv.config({
    path: pathToSecretsFile,
  });
  console.log('STRIPE_API_KEY exists:', !!process.env.STRIPE_API_KEY);
};
