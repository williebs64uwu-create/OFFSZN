import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path:path.resolve(__dirname, '../../../.env') });

export const PORT = process.env.PORT || 3000;
export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export const JWT_SECRET = process.env.JWT_SECRET; 
export const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
export const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
export const PAYPAL_ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT || 'sandbox';