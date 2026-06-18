import 'dotenv/config';
import { supabase } from './src/infrastructure/database/connection.js';

async function expireTrial() {
    const { data, error } = await supabase
        .from('plugin_licenses')
        .update({ 
            expires_at: new Date(Date.now() - 100000).toISOString(),
            status: 'expired'
        })
        .eq('serial_key', 'TRIAL-5DE90ED2-47BF8C58');

    if (error) {
        console.error("Error expiring:", error);
    } else {
        console.log("Licencia expirada con éxito!");
    }
    process.exit(0);
}

expireTrial();
