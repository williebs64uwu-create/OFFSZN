import { createClient } from '@supabase/supabase-js';
import { sendOffsznEmail } from './src/shared/utils/mailer.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function sendBulkEmails() {
    console.log('=== DISPARANDO CORREOS DE TRIALS EXTENDIDOS ===\n');

    const { data: licenses, error } = await supabase
        .from('plugin_licenses')
        .select('*, plugin_activations(*), users(email)')
        .eq('license_type', 'trial')
        .or('plugin_name.ilike.%Easy Mix%,plugin_name.ilike.%Easy Master%')
        .order('created_at', { ascending: false });

    if (error) { console.error('Error al consultar DB:', error); return; }

    const now = new Date();
    const targets = [];

    for (const l of licenses) {
        if (!l.expires_at) continue;
        const exp = new Date(l.expires_at);
        const diffHours = (exp - now) / (1000 * 60 * 60);

        let email = l.email || l.guest_email || l.users?.email;
        if (!email && l.user_id) {
            const { data: u } = await supabase.from('users').select('email').eq('id', l.user_id).single();
            email = u?.email;
        }

        // Check if it belongs to the extended groups (2 days or 3 days from now)
        const isExtended = diffHours > 24 && diffHours <= 76;

        if (isExtended && email) {
            targets.push({
                id: l.id,
                pluginName: l.plugin_name.includes('Master') || l.plugin_name.includes('MASTER') ? 'Easy Master' : 'Easy Mix',
                serialKey: l.serial_key,
                email
            });
        }
    }

    console.log(`🎯 Total correos a enviar: ${targets.length}\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < targets.length; i++) {
        const item = targets[i];
        const pluginSlug = item.pluginName === 'Easy Master' ? 'easy-master' : 'easy-mix';
        const pluginUrl = `https://offszn.lat/plugins/${pluginSlug}`;

        const subject = `${item.pluginName} está listo para que lo uses gratis`;
        const previewText = `Prueba el plugin de forma gratis ahora`;

        const html = `
        <span style="display:none;font-size:1px;color:#ffffff;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</span>
        <div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333; max-width: 540px; margin: 0 auto;">
            <p>Hola,</p>
            <p>Aquí tienes los datos para activar tu prueba gratis de <strong>${item.pluginName}</strong>:</p>

            <p style="margin-bottom: 5px; color: #666;">Clave de Licencia (Serial Key):</p>
            <p style="font-family: monospace; font-size: 18px; font-weight: bold; color: #111; margin-top: 0;">${item.serialKey}</p>

            <p>Para activarlo, solo abre el plugin en tu DAW y pon la serial.</p>
            <p>Si aún no tienes el instalador, puedes descargarlo aquí:<br>
            <a href="${pluginUrl}" style="color: #0066cc; text-decoration: underline;">${pluginUrl}</a></p>

            <br>
            <p>- Soporte OFFSZN</p>
        </div>`;

        console.log(`[${i + 1}/${targets.length}] Enviando a ${item.email} (${item.pluginName} | ${item.serialKey})...`);

        try {
            await sendOffsznEmail({
                to: item.email,
                subject,
                html,
                fromName: 'Soporte OFFSZN',
                type: 'transactional'
            });
            successCount++;
            console.log(`   ✅ Enviado.`);
        } catch (err) {
            failCount++;
            console.error(`   ❌ Error al enviar a ${item.email}:`, err.message);
        }

        // Wait 300ms between emails
        await sleep(300);
    }

    console.log(`\n========================================`);
    console.log(`🎉 ENVÍO COMPLETADO`);
    console.log(`   - Éxito: ${successCount}`);
    console.log(`   - Fallidos: ${failCount}`);
    console.log(`========================================\n`);
}

sendBulkEmails();
