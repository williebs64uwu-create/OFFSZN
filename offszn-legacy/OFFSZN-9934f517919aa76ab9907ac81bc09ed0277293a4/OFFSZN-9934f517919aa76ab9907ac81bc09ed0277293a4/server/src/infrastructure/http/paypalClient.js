import paypal from '@paypal/checkout-server-sdk';
import { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENVIRONMENT } from '../../shared/config/config.js';

function environment() {
    if (PAYPAL_ENVIRONMENT === 'live') {
        return new paypal.core.LiveEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
    }
    return new paypal.core.SandboxEnvironment(PAYPAL_CLIENT_ID || 'sb', PAYPAL_CLIENT_SECRET || 'sb');
}

function client() {
    return new paypal.core.PayPalHttpClient(environment());
}

export default { client };
