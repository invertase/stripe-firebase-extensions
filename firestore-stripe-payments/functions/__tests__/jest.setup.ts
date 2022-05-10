import dotenv from 'dotenv';

const path = require('path');

(async function () {
  dotenv.config({ path: path.resolve(__dirname, 'test-params.env') });
})();
