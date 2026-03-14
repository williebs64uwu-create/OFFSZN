
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
        env[key] = value;
    }
});

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    console.error('Missing Supabase credentials in .env');
    console.log('Available keys:', Object.keys(env));
    process.exit(1);
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

async function checkPulsar() {
    console.log('Searching for Pulsar 200...');
    const { data, error } = await supabase
        .from('products')
        .select('id, name, image_url, r2_version')
        .ilike('name', '%Pulsar 200%');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Results:', JSON.stringify(data, null, 2));
}

checkPulsar();
