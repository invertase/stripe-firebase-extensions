import path from 'path';
import dotenv from 'dotenv';

export const pathToenvFile = path.resolve(
  __dirname,
  '../../../_emulator/extensions/firestore-stripe-payments.env.local'
);

export const pathTosecretsFile = path.resolve(
  __dirname,
  '../../../_emulator/extensions/firestore-stripe-payments.secret.local'
);

export const setupEnvironment = () => {
  dotenv.config({
    path: pathToenvFile,
  });
  console.log('CUSTOMERS_COLLECTION:', process.env.CUSTOMERS_COLLECTION);

  console.log('Loading secrets file from:', pathTosecretsFile);
  dotenv.config({
    path: pathTosecretsFile,
  });
  console.log('STRIPE_API_KEY exists:', !!process.env.STRIPE_API_KEY);
};
