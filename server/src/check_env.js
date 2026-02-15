import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server root (parent of src)
config({ path: path.resolve(__dirname, '../.env') });

console.log('--- ENV CHECK ---');
console.log('R2_ENDPOINT:', process.env.R2_ENDPOINT);
console.log('R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('--- END CHECK ---');
