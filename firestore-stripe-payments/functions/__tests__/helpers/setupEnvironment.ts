const path = require('path');

export const pathToenvFile = path.resolve(
  __dirname,
  '../../../_emulator/extensions/firestore-stripe-payments.env.local'
);

export const pathTosecretsFile = path.resolve(
  __dirname,
  '../../../_emulator/extensions/firestore-stripe-payments.secret.local'
);

export const setupEnvironment = () => {
  require('dotenv').config({
    path: pathToenvFile,
  });

  require('dotenv').config({
    path: pathTosecretsFile,
  });
};
