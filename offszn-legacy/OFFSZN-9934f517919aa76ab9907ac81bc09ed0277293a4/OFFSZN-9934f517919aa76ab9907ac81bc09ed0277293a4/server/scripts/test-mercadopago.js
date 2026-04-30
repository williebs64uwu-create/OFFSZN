import dotenv from 'dotenv';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
console.log("Using Token:", token?.substring(0, 10) + "...");

const client = new MercadoPagoConfig({ accessToken: token });
const preference = new Preference(client);

const body = {
    items: [
        {
            id: 'test-plan',
            title: 'Test Plan OFFSZN',
            quantity: 1,
            unit_price: 19.00,
            currency_id: 'PEN'
        }
    ],
    purpose: 'wallet_purchase', // Important for Bricks
};

try {
    console.log("Creating preference...");
    const result = await preference.create({ body });
    console.log("✅ Preference Created Successfully!");
    console.log("ID:", result.id);
    console.log("Init Point:", result.init_point);
} catch (error) {
    console.error("❌ Error creating preference:");
    console.error(JSON.stringify(error, null, 2));
}
