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

// SMTP - BREVO (No-Reply)
export const BREVO_USER = process.env.BREVO_USER;
export const BREVO_PASS = process.env.BREVO_PASS;
export const BREVO_API_KEY = process.env.BREVO_API_KEY;
export const BREVO_HOST = process.env.BREVO_HOST || 'smtp-relay.brevo.com';
export const BREVO_PORT = process.env.BREVO_PORT || 2525;

// SMTP - GMAIL (Personal)
export const GMAIL_USER = process.env.GMAIL_USER;
export const GMAIL_PASS = process.env.GMAIL_PASS;
export const GMAIL_HOST = process.env.GMAIL_HOST || 'smtp.gmail.com';
export const GMAIL_PORT = process.env.GMAIL_PORT || 465;

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
export const R2_ENDPOINT_V2 = cleanConfigValue(rawEndpointV2);
export const R2_ACCESS_KEY_ID_V2 = cleanConfigValue(process.env.R2_ACCESS_KEY_ID_V2);
export const R2_SECRET_ACCESS_KEY_V2 = cleanConfigValue(process.env.R2_SECRET_ACCESS_KEY_V2);
export const R2_BUCKET_NAME_V2 = cleanConfigValue(process.env.R2_BUCKET_NAME_V2);

// Email Octopus
export const EMAILOCTOPUS_API_KEY = process.env.EMAILOCTOPUS_API_KEY;
export const EMAILOCTOPUS_LIST_ID = process.env.EMAILOCTOPUS_LIST_ID;

// IMAGEKIT
export const IMAGEKIT_PUBLIC_KEY = cleanConfigValue(process.env.IMAGEKIT_PUBLIC_KEY);
export const IMAGEKIT_PRIVATE_KEY = cleanConfigValue(process.env.IMAGEKIT_PRIVATE_KEY);
export const IMAGEKIT_URL_ENDPOINT = cleanConfigValue(process.env.IMAGEKIT_URL_ENDPOINT);

// Storage Strategy
export const R2_CURRENT_VERSION = 'v2';
