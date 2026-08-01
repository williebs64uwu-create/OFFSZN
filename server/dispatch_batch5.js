import { createClient } from '@supabase/supabase-js';
import { sendOffsznEmail } from './src/shared/utils/mailer.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runBatch5() {
    console.log('=== DISPARANDO LOTE FINAL (35 CORREOS MÁS) ===\n');

    // 1. Fetch all trial licenses
    const { data: licenses, error } = await supabase
        .from('plugin_licenses')
        .select('*, plugin_activations(*), users(email)')
        .eq('license_type', 'trial')
        .or('plugin_name.ilike.%Easy Mix%,plugin_name.ilike.%Easy Master%')
        .order('created_at', { ascending: false });

    if (error) { console.error('Error al consultar DB:', error); return; }

    const now = new Date();

    // STRICT ANTI-DUPLICATION CHECK:
    // Exclude licenses whose expires_at is between 30h and 85h from now (all licenses extended today)
    const alreadyNotifiedUserEmails = new Set();
    licenses.forEach(l => {
        if (!l.expires_at) return;
        const diffHours = (new Date(l.expires_at) - now) / (1000 * 60 * 60);
        if (diffHours > 30 && diffHours <= 85) {
            let email = l.email || l.guest_email || l.users?.email;
            if (email) alreadyNotifiedUserEmails.add(email.toLowerCase().trim());
        }
    });

    console.log(`🔒 Correos ya notificados hoy a excluir estrictamente: ${alreadyNotifiedUserEmails.size}`);

    const userMap = new Map();

    for (const l of licenses) {
        let email = l.email || l.guest_email || l.users?.email;
        if (!email && l.user_id) {
            const { data: u } = await supabase.from('users').select('email').eq('id', l.user_id).single();
            email = u?.email;
        }

        if (!email) continue;
        const normEmail = email.toLowerCase().trim();

        // Strict Exclusion check
        if (alreadyNotifiedUserEmails.has(normEmail)) continue;

        const created = new Date(l.created_at);

        if (!userMap.has(normEmail)) {
            userMap.set(normEmail, {
                email: normEmail,
                userId: l.user_id || null,
                mixLic: null,
                masterLic: null,
                newestDate: created
            });
        }

        const entry = userMap.get(normEmail);
        if (created > entry.newestDate) entry.newestDate = created;

        const isMaster = l.plugin_name.toLowerCase().includes('master');
        if (isMaster) {
            if (!entry.masterLic) entry.masterLic = l;
        } else {
            if (!entry.mixLic) entry.mixLic = l;
        }
    }

    const availableUsers = Array.from(userMap.values()).sort((a, b) => b.newestDate - a.newestDate);
    const targetUsers = availableUsers.slice(0, 35);

    console.log(`📊 Total usuarios únicos disponibles (sin repetir): ${availableUsers.length}`);
    console.log(`🎯 Seleccionados exactamente los ${targetUsers.length} para completar la meta.\n`);

    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const driveMixUrl = 'https://drive.google.com/drive/folders/1tFzqvlfhaq8ry6e6zTZ9t87bt6qFy3sp?usp=sharing';
    const driveMasterUrl = 'https://drive.google.com/drive/folders/1FJKceftSLu-BccWVnVCAb3NIHANqvM0p?usp=sharing';
    const subject = 'Inicio de mes: te damos 3 días de prueba de Easy Mix y Easy Master';
    const previewText = 'Prueba los plugins aquí...';

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < targetUsers.length; i++) {
        const u = targetUsers[i];

        // 1. Ensure Mix License Key
        let mixKey = u.mixLic?.serial_key;
        if (u.mixLic) {
            await supabase.from('plugin_licenses')
                .update({ expires_at: threeDaysFromNow, status: 'active' })
                .eq('id', u.mixLic.id);
        } else {
            mixKey = `EASY-TRIAL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
            await supabase.from('plugin_licenses').insert({
                plugin_name: 'Easy Mix',
                serial_key: mixKey,
                license_type: 'trial',
                status: 'active',
                expires_at: threeDaysFromNow,
                max_devices: 1,
                user_id: u.userId,
                email: u.email
            });
        }

        // 2. Ensure Master License Key
        let masterKey = u.masterLic?.serial_key;
        if (u.masterLic) {
            await supabase.from('plugin_licenses')
                .update({ expires_at: threeDaysFromNow, status: 'active' })
                .eq('id', u.masterLic.id);
        } else {
            masterKey = `MASTER-TRIAL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
            await supabase.from('plugin_licenses').insert({
                plugin_name: 'Easy Master',
                serial_key: masterKey,
                license_type: 'trial',
                status: 'active',
                expires_at: threeDaysFromNow,
                max_devices: 1,
                user_id: u.userId,
                email: u.email
            });
        }

        // 3. Build & Send Email
        const html = `
        <span style="display:none;font-size:1px;color:#ffffff;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</span>
        <div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333; max-width: 560px; margin: 0 auto;">
            <p>Hola,</p>
            <p>Te hemos dado <strong>3 días de prueba gratis</strong> para que puedas explorar los plugins de <strong>Easy Mix</strong> y <strong>Easy Master</strong>.</p>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 18px 0;">
                <p style="margin: 0 0 4px 0; font-weight: bold; color: #0f172a;">🎛️ Serial para Easy Mix:</p>
                <p style="font-family: monospace; font-size: 17px; font-weight: bold; color: #2563eb; margin: 0 0 10px 0;">${mixKey}</p>
                <p style="margin: 0; font-size: 14px;">Descarga aquí (Windows / Mac):<br>
                <a href="${driveMixUrl}" style="color: #2563eb; text-decoration: underline;">${driveMixUrl}</a></p>
            </div>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 18px 0;">
                <p style="margin: 0 0 4px 0; font-weight: bold; color: #0f172a;">🎚️ Serial para Easy Master:</p>
                <p style="font-family: monospace; font-size: 17px; font-weight: bold; color: #2563eb; margin: 0 0 10px 0;">${masterKey}</p>
                <p style="margin: 0; font-size: 14px;">Descarga aquí (Windows / Mac):<br>
                <a href="${driveMasterUrl}" style="color: #2563eb; text-decoration: underline;">${driveMasterUrl}</a></p>
            </div>

            <p style="font-size: 14px; color: #475569;">Para activarlos, solo abre cada plugin en tu DAW e ingresa su clave serial correspondiente.</p>

            <br>
            <p>- Soporte OFFSZN</p>
        </div>`;

        console.log(`[${i + 1}/${targetUsers.length}] Procesando ${u.email} (Mix: ${mixKey} | Master: ${masterKey})...`);

        try {
            await sendOffsznEmail({
                to: u.email,
                subject,
                html,
                fromName: 'Soporte OFFSZN',
                type: 'transactional'
            });
            successCount++;
            console.log(`   ✅ Correo enviado.`);
        } catch (err) {
            failCount++;
            console.error(`   ❌ Error enviando a ${u.email}:`, err.message);
        }

        await sleep(350);
    }

    console.log(`\n========================================`);
    console.log(`🎉 LOTE DE 35 FINALIZADO`);
    console.log(`   - Éxito: ${successCount}`);
    console.log(`   - Fallidos: ${failCount}`);
    console.log(`========================================\n`);
}

runBatch5();
