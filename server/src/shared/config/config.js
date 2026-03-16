import { config } from 'dotenv';
import e from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../../../.env') });

export const PORT = process.env.PORT || 3000;
export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
export const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
export const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
export const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
export const PAYPAL_ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
export const PLATFORM_PAYPAL_EMAIL = process.env.PLATFORM_PAYPAL_EMAIL || 'willie2008garay@gmail.com';

export const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
export const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
export const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
export const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

// SMTP / NODEMAILER
export const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
export const SMTP_PORT = process.env.SMTP_PORT || 465;
export const EMAIL_USER = process.env.EMAIL_USER;
export const EMAIL_PASS = process.env.EMAIL_PASS; // App Password goes here

export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// Helper to clean environment variables (strips accidental prefixes/whitespace)
const cleanConfigValue = (val) => {
    if (!val || typeof val !== 'string') return val;
    return val.replace(/^[A-Z0-9_]+:\s*/, '').trim();
};

// CLOUDFLARE R2
export const R2_ENDPOINT = cleanConfigValue(process.env.R2_ENDPOINT);
export const R2_ACCESS_KEY_ID = cleanConfigValue(process.env.R2_ACCESS_KEY_ID);
export const R2_SECRET_ACCESS_KEY = cleanConfigValue(process.env.R2_SECRET_ACCESS_KEY);
export const R2_BUCKET_NAME = cleanConfigValue(process.env.R2_BUCKET_NAME) || 'offszn-storage';
export const R2_SECURE_BUCKET_NAME = cleanConfigValue(process.env.R2_SECURE_BUCKET_NAME) || 'secure-products';
export const R2_TOKEN = cleanConfigValue(process.env.R2_TOKEN);

// CLOUDFLARE R2 V2 (New Account)
const rawEndpointV2 = process.env.R2_ENDPOINT_V2;
export const R2_ENDPOINT_V2 = cleanConfigValue(rawEndpointV2) || 'https://42fc23b11a6c329b76b2babc20afcbf7.r2.cloudflarestorage.com';
export const R2_ACCESS_KEY_ID_V2 = cleanConfigValue(process.env.R2_ACCESS_KEY_ID_V2) || '090fc361ac3433dfeacd5b062dc37e69';
export const R2_SECRET_ACCESS_KEY_V2 = cleanConfigValue(process.env.R2_SECRET_ACCESS_KEY_V2) || '82e3f0be0d50bd786b61ab36cfbc0f1d9dde953e2575672f3d20b62e8571dd6f';
export const R2_BUCKET_NAME_V2 = cleanConfigValue(process.env.R2_BUCKET_NAME_V2) || 'offsznlatbucket';

// Email Octopus
export const EMAILOCTOPUS_API_KEY = process.env.EMAILOCTOPUS_API_KEY;
export const EMAILOCTOPUS_LIST_ID = process.env.EMAILOCTOPUS_LIST_ID;

// Storage Strategy
export const R2_CURRENT_VERSION = 'v2';
