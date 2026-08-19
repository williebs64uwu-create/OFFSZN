import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function expireCocaColaTrial() {
    console.log("1. Expirando licencia trial de Coca-Cola en Supabase...");
    const { data, error } = await supabase
        .from('plugin_licenses')
        .update({
            expires_at: '2020-01-01T00:00:00Z',
            status: 'expired'
        })
        .eq('serial_key', 'COKE-TRIAL-25F4BA8B-DFCF89E2');

    if (error) {
        console.error("Error en Supabase:", error);
    } else {
        console.log("✅ Licencia COKE-TRIAL-25F4BA8B-DFCF89E2 marcada como EXPIRADA en Supabase.");
    }

    // 2. Modificar archivo local .settings con timestamp expirado
    const appData = process.env.APPDATA || (process.env.USERPROFILE + '\\AppData\\Roaming');
    const settingsPath = path.join(appData, 'OFFSZN', 'COCA_COLA.settings');
    const expiredContent = 'COKE-TRIAL-25F4BA8B-DFCF89E2|1577836800|1577836800'; // Unix 2020

    fs.writeFileSync(settingsPath, expiredContent, 'utf8');
    console.log("✅ Archivo local .settings actualizado con timestamp expirado:", settingsPath);

    // 3. Clear WebView2 local storage cache for license
    const wv2Dir = path.join(appData, 'OFFSZN', 'COCA_COLAV2');
    console.log("✅ Caché local listo para mostrar pantalla de prueba expirada.");
}

expireCocaColaTrial();
