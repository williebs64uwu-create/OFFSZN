import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';
import { sendOffsznEmail } from '../src/shared/utils/mailer.js';

const MODE = process.argv[2] || 'dry-run'; // 'dry-run', 'test', 'send-all'
const TEST_EMAIL = process.argv[3] || 'offszn.studio@gmail.com';

async function main() {
    console.log(`🚀 Starting unactivated trial reminder script in [${MODE.toUpperCase()}] mode...`);

    const nowISO = new Date().toISOString();

    // 1. Fetch all licenses for Easy Mix
    const { data: licenses, error } = await supabase
        .from('plugin_licenses')
        .select(`
            id,
            plugin_name,
            serial_key,
            license_type,
            status,
            expires_at,
            user_id,
            users (
                email,
                nickname
            )
        `)
        .eq('plugin_name', 'Easy Mix');

    if (error) {
        console.error('❌ Error fetching licenses:', error);
        process.exit(1);
    }

    // 2. Fetch all activations
    const { data: activations, error: actErr } = await supabase
        .from('plugin_activations')
        .select('license_id');

    if (actErr) {
        console.error('❌ Error fetching activations:', actErr);
        process.exit(1);
    }

    // Convert activations to Set for fast lookup
    const activatedLicenseIds = new Set(activations.map(act => act.license_id));

    // 3. Identify users who already have a full/lifetime license (to exclude them from receiving reminders)
    const usersWithFullLicense = new Set(
        licenses
            .filter(lic => (lic.license_type === 'lifetime' || lic.license_type === 'subscription') && lic.user_id)
            .map(lic => lic.user_id)
    );

    // Also collect emails of users with full license to be 100% sure we don't spam them
    const emailsWithFullLicense = new Set(
        licenses
            .filter(lic => (lic.license_type === 'lifetime' || lic.license_type === 'subscription') && lic.users?.email)
            .map(lic => lic.users.email.toLowerCase())
    );

    // 4. Identify users with active, unexpired trials that have 0 activations, and no full license
    const targetTrialUsers = licenses.filter(lic => {
        const isTrial = lic.license_type === 'trial';
        const isVigente = lic.expires_at ? new Date(lic.expires_at) > new Date() : false;
        const hasNotActivated = !activatedLicenseIds.has(lic.id);
        const hasEmail = lic.users?.email;
        
        const doesNotHaveFullById = !usersWithFullLicense.has(lic.user_id);
        const doesNotHaveFullByEmail = hasEmail ? !emailsWithFullLicense.has(lic.users.email.toLowerCase()) : true;

        return isTrial && isVigente && hasNotActivated && hasEmail && doesNotHaveFullById && doesNotHaveFullByEmail;
    });

    // Remove duplicates by email
    const uniqueTargetsMap = new Map();
    targetTrialUsers.forEach(lic => {
        const email = lic.users.email.toLowerCase();
        if (!uniqueTargetsMap.has(email)) {
            uniqueTargetsMap.set(email, lic);
        }
    });

    const uniqueTargets = Array.from(uniqueTargetsMap.values());

    console.log(`📊 Found ${uniqueTargets.length} users with active unexpired trials that haven't activated in DAW and have no full license.`);

    if (uniqueTargets.length === 0) {
        console.log('✅ No target users found for reminder.');
        process.exit(0);
    }

    // Function to generate the email HTML (Arial, plain text, no emojis)
    const getReminderTemplate = (nickname, serialKey, expiresAt) => {
        const expDate = new Date(expiresAt).toLocaleString('es-ES', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
        <!-- Preheader / Preview Text -->
        <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; color: transparent; line-height: 1px; max-width: 0px; opacity: 0;">
            tu clave de prueba gratuita sigue vigente...
        </div>
        <div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333;">
            <p>Hola ${nickname || 'Productor'},</p>
            
            <p>Vimos que solicitaste tu prueba gratuita de Easy Mix en la web, pero aún no la has activado dentro de tu DAW (FL Studio, Ableton, Logic, etc.).</p>
            
            <p>Queremos asegurarnos de que no tengas ningún problema para instalarlo o probarlo.</p>
            
            <p>Tu clave de prueba de 24 horas es:<br>
            <strong>${serialKey}</strong></p>
            
            <p>Expira el: ${expDate}</p>
            
            <p>Puedes descargar el instalador directamente desde Google Drive en el siguiente enlace:</p>
            <p>
                • <strong>Para Windows</strong>: <a href="https://drive.google.com/file/d/1WfaTrrbuaxymcFhnHGjmrump_rG-LGUW/view?usp=sharing" style="color: #0066cc; text-decoration: underline;">Descargar VST3</a><br>
                • <strong>Para macOS</strong>: <a href="https://drive.google.com/file/d/1o1q0Ca5eghr1CJmtxmOw52MgEXi_wKl9/view?usp=sharing" style="color: #0066cc; text-decoration: underline;">Descargar AU/VST3</a>
            </p>
            
            <p>Si tienes cualquier duda con la instalación o activación, puedes responder a este correo o escribirnos directamente a nuestro WhatsApp de soporte aquí:</p>
            <p><a href="https://wa.me/51993525005?text=Hola!%20Tengo%20dudas%20con%20la%20activacion%20de%20Easy%20Mix" style="color: #0066cc; font-weight: bold; text-decoration: underline;">Escribir a Soporte por WhatsApp</a></p>
            
            <br>
            <p>Un saludo,</p>
            <p>Equipo de OFFSZN</p>
        </div>
        `;
    };

    if (MODE === 'dry-run') {
        console.log('\n--- DRY RUN: Users who would receive the reminder email ---');
        uniqueTargets.forEach((t, i) => {
            console.log(`[${i+1}] ${t.users.nickname} (${t.users.email}) - Key: ${t.serial_key} - Expires: ${t.expires_at}`);
        });
        console.log('\n💡 To send a test email, run: node server/scratch/send_trial_unactivated_reminder.js test <email>');
        console.log('💡 To send emails to everyone, run: node server/scratch/send_trial_unactivated_reminder.js send-all');
        process.exit(0);
    }

    if (MODE === 'test') {
        console.log(`\n🧪 Sending test reminder email to: ${TEST_EMAIL}...`);
        const html = getReminderTemplate('Tester', 'EASY-TRIAL-TEST-KEY', new Date(Date.now() + 24 * 3600 * 1000).toISOString());
        try {
            await sendOffsznEmail({
                to: TEST_EMAIL,
                subject: '¿problemas con la activación de Easy Mix?',
                html,
                fromName: 'Easy Mix by OFFSZN',
                type: 'transactional'
            });
            console.log('✅ Test reminder email sent successfully!');
        } catch (e) {
            console.error('❌ Failed to send test email:', e.message);
        }
        process.exit(0);
    }

    if (MODE === 'send-all') {
        console.log(`\n✉️ Sending reminder emails to all ${uniqueTargets.length} users...`);
        for (let i = 0; i < uniqueTargets.length; i++) {
            const lic = uniqueTargets[i];
            const email = lic.users.email;
            const nickname = lic.users.nickname || 'Productor';

            console.log(`[${i+1}/${uniqueTargets.length}] Sending to ${nickname} (${email})...`);
            
            const html = getReminderTemplate(nickname, lic.serial_key, lic.expires_at);
            try {
                await sendOffsznEmail({
                    to: email,
                    subject: '¿problemas con la activación de Easy Mix?',
                    html,
                    fromName: 'Easy Mix by OFFSZN',
                    type: 'transactional'
                });
                console.log(`   ✅ Sent!`);
            } catch (err) {
                console.error(`   ❌ Error sending to ${email}:`, err.message);
            }
            // Small delay to prevent SMTP rate limit
            await new Promise(r => setTimeout(r, 1000));
        }
        console.log('\n🎉 All reminder emails have been processed!');
        process.exit(0);
    }
}

main().catch(err => {
    console.error('Unhandled error:', err);
});
