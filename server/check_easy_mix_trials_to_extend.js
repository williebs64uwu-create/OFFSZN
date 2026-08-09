import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function inspectEasyMixTrials() {
    console.log("🔍 Consultando licencias de la base de datos...");

    // 1. Fetch all Easy Mix licenses (to verify what plugin_names and types exist)
    const { data: allEasyMix, error: err1 } = await supabase
        .from('plugin_licenses')
        .select('*, plugin_activations(*)')
        .ilike('plugin_name', '%Easy Mix%');

    if (err1) {
        console.error("❌ Error querying licenses:", err1);
        return;
    }

    console.log(`📌 Total licencias encontradas para 'Easy Mix' (de todo tipo): ${allEasyMix.length}`);

    // Filter strictly for trial licenses
    const trialLicenses = allEasyMix.filter(l => l.license_type === 'trial');
    const fullLicenses = allEasyMix.filter(l => l.license_type !== 'trial');

    console.log(`   - Licencias FULL/Lifetime/Sub (NO se tocarán): ${fullLicenses.length}`);
    console.log(`   - Licencias TRIAL totales: ${trialLicenses.length}`);

    // Cutoff date: August 6th, 2026 00:00:00 UTC (or local time)
    const cutoffDate = new Date('2026-08-06T00:00:00.000Z');

    // Matching: Created BEFORE Aug 6, 2026
    const matchingTrials = trialLicenses.filter(l => new Date(l.created_at) < cutoffDate);
    // Excluded: Created ON OR AFTER Aug 6, 2026
    const excludedTrials = trialLicenses.filter(l => new Date(l.created_at) >= cutoffDate);

    console.log(`\n🎯 TRIALs creadas ANTES del 6 de agosto (SERÁN ACTUALIZADAS A 5 DÍAS Y SE BORRARÁ HWID): ${matchingTrials.length}`);
    console.log(`🚫 TRIALs creadas del 6 de agosto EN ADELANTE (EXCLUIDAS, NO SE TOCAN): ${excludedTrials.length}`);

    let activationsCount = 0;
    matchingTrials.forEach(l => {
        if (l.plugin_activations && l.plugin_activations.length > 0) {
            activationsCount += l.plugin_activations.length;
        }
    });

    console.log(`\n📱 Total de activaciones/HWID asociadas a las ${matchingTrials.length} licencias a actualizar: ${activationsCount}`);

    console.log("\n--- PRIMERAS 10 LICENCIAS A ACTUALIZAR (MUESTRA) ---");
    matchingTrials.slice(0, 10).forEach((l, idx) => {
        const actInfo = l.plugin_activations?.map(a => a.hwid).join(', ') || 'Sin HWID';
        console.log(`[${idx + 1}] Key: ${l.serial_key} | Plugin: ${l.plugin_name} | Creada: ${l.created_at} | Expira: ${l.expires_at} | HWID: ${actInfo}`);
    });

    if (excludedTrials.length > 0) {
        console.log("\n--- LICENCIAS EXCLUIDAS (CREADAS DEL 6 DE AGOSTO EN ADELANTE) ---");
        excludedTrials.forEach((l, idx) => {
            console.log(`[${idx + 1}] Key: ${l.serial_key} | Creada: ${l.created_at}`);
        });
    }
}

inspectEasyMixTrials();
