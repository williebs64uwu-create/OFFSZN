// Crea una licencia FULL (de por vida) de Orb para ti y la imprime.  Uso:  node create_orb_key.js [dispositivos]
// Necesita server/.env con SUPABASE_URL y SUPABASE_SERVICE_KEY (los mismos que usa create_full_key.js).
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.env') });
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_KEY en server/.env'); process.exit(1); }
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const hex = () => crypto.randomBytes(4).toString('hex').toUpperCase();
const serialKey = `ORB-FULL-${hex()}-${hex()}`;
const { error } = await supabase.from('plugin_licenses').insert({
    plugin_name: 'Orb', serial_key: serialKey, license_type: 'lifetime', status: 'active', expires_at: null, max_devices: Number(process.argv[2]) || 3,
});
if (error) { console.error('No se pudo crear la licencia:', error.message); process.exit(1); }
console.log('Licencia FULL de Orb:', serialKey);
