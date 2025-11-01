require('dotenv').config();
const paypal = require('@paypal/checkout-server-sdk');

function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (process.env.PAYPAL_ENVIRONMENT === 'sandbox') {
    return new paypal.core.SandboxEnvironment(clientId, clientSecret);
  }

}

function client() {
  return new paypal.core.PayPalHttpClient(environment());
}

module.exports = { client };