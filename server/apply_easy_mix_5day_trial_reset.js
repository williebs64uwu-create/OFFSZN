import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function runReset() {
    console.log("🚀 Iniciando actualización de licencias TRIAL de Easy Mix...");

    // 1. Calculate new expiration date: 5 days from current execution time
    const now = new Date();
    const expiryDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const newExpiresAt = expiryDate.toISOString();

    console.log(`📅 Fecha actual: ${now.toISOString()}`);
    console.log(`📅 Nueva fecha de expiración (+5 días): ${newExpiresAt}`);

    // Cutoff date: August 6, 2026 00:00:00 UTC
    const cutoffDate = new Date('2026-08-06T00:00:00.000Z');

    // 2. Query all Easy Mix trial licenses
    const { data: licenses, error: fetchErr } = await supabase
        .from('plugin_licenses')
        .select('id, serial_key, created_at, expires_at, plugin_name, license_type')
        .eq('license_type', 'trial')
        .ilike('plugin_name', '%Easy Mix%');

    if (fetchErr) {
        console.error("❌ Error al obtener licencias:", fetchErr);
        return;
    }

    // Filter strictly for created BEFORE August 6th, 2026
    const targets = licenses.filter(l => new Date(l.created_at) < cutoffDate);
    const excluded = licenses.filter(l => new Date(l.created_at) >= cutoffDate);

    console.log(`\n📊 Resumen de selección:`);
    console.log(`   - Licencias TRIAL de Easy Mix totales en DB: ${licenses.length}`);
    console.log(`   - Licencias a ACTUALIZAR (creadas ANTES del 06 de Agosto): ${targets.length}`);
    console.log(`   - Licencias EXCLUIDAS (creadas DEL 06 de Agosto en adelante): ${excluded.length}`);

    if (targets.length === 0) {
        console.log("ℹ️ No hay licencias que cumplan con el criterio.");
        return;
    }

    const targetIds = targets.map(t => t.id);

    // 3. Delete HWID activations for matching target licenses so users can activate again
    console.log("\n🧹 Borrando registros de HWID (plugin_activations) para estas licencias...");
    
    // Batch deletion to avoid request overflow
    const batchSize = 100;
    let totalActivationsDeleted = 0;

    for (let i = 0; i < targetIds.length; i += batchSize) {
        const chunk = targetIds.slice(i, i + batchSize);
        const { data: deletedChunk, error: delErr } = await supabase
            .from('plugin_activations')
            .delete()
            .in('license_id', chunk)
            .select();

        if (delErr) {
            console.error(`❌ Error al borrar activaciones en lote ${Math.floor(i / batchSize) + 1}:`, delErr);
            return;
        }

        totalActivationsDeleted += deletedChunk ? deletedChunk.length : 0;
    }

    console.log(`✅ Registros HWID / activaciones eliminados: ${totalActivationsDeleted}`);

    // 4. Update license expiration dates to +5 days and status to 'active'
    console.log("\n🔄 Actualizando fecha de expiración y estado a 'active'...");
    let totalLicensesUpdated = 0;

    for (let i = 0; i < targetIds.length; i += batchSize) {
        const chunk = targetIds.slice(i, i + batchSize);
        const { data: updatedChunk, error: updateErr } = await supabase
            .from('plugin_licenses')
            .update({
                expires_at: newExpiresAt,
                status: 'active'
            })
            .in('id', chunk)
            .select();

        if (updateErr) {
            console.error(`❌ Error al actualizar licencias en lote ${Math.floor(i / batchSize) + 1}:`, updateErr);
            return;
        }

        totalLicensesUpdated += updatedChunk ? updatedChunk.length : 0;
    }

    console.log(`\n==================================================`);
    console.log(`🎉 ¡OPERACIÓN COMPLETADA CON ÉXITO!`);
    console.log(`==================================================`);
    console.log(`✅ Licencias TRIAL de Easy Mix extendidas (5 días): ${totalLicensesUpdated}`);
    console.log(`📅 Nueva fecha de expiración: ${newExpiresAt}`);
    console.log(`🧹 Activaciones HWID eliminadas para reuso: ${totalActivationsDeleted}`);
    console.log(`🛡️ Licencias del 6 de Agosto en adelante conservadas intactas: ${excluded.length}`);
    console.log(`🛡️ Ninguna licencia FULL ni de otros plugins fue tocada.`);
    console.log(`==================================================\n`);
}

runReset().catch(console.error);
