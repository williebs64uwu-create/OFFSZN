import paypal from '@paypal/checkout-server-sdk';
import { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENVIRONMENT } from '../../../shared/config/config.js';

function environment() {
    const clientId = PAYPAL_CLIENT_ID;
    const clientSecret = PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
         console.error("ERROR: Faltan credenciales de PayPal en la configuración.");
         throw new Error("Configuración de servidor incompleta para pagos.");
    }

    if (PAYPAL_ENVIRONMENT === 'sandbox') {
        return new paypal.core.SandboxEnvironment(clientId, clientSecret);
    } else {
        console.warn("ADVERTENCIA: Usando entorno Sandbox de PayPal.");
        return new paypal.core.SandboxEnvironment(clientId, clientSecret);
    }
}

export const client = () => {
    return new paypal.core.PayPalHttpClient(environment());
};
