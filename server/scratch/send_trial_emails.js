import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';
import { sendOffsznEmail } from '../src/shared/utils/mailer.js';

const MODE = process.argv[2] || 'dry-run'; // 'dry-run', 'test', or 'send-all'
const TEST_EMAIL = process.argv[3] || 'offszn.studio@gmail.com';

async function main() {
    console.log(`🚀 starting script in [${MODE.toUpperCase()}] mode...`);
    
    const { data: licenses, error } = await supabase
        .from('plugin_licenses')
        .select(`
            id,
            plugin_name,
            serial_key,
            license_type,
            status,
            expires_at,
            created_at,
            user_id,
            users (
                email,
                nickname
            )
        `);

    if (error) {
        console.error('❌ Error querying database:', error);
        process.exit(1);
    }

    const now = new Date();
    const activeTrials = licenses.filter(lic => {
        const isEasyMix = lic.plugin_name?.toLowerCase().includes('mix');
        const isTrial = lic.license_type === 'trial';
        const isNotExpired = lic.expires_at ? new Date(lic.expires_at) > now : true;
        const isActive = lic.status === 'active';
        const hasEmail = lic.users?.email;
        return isEasyMix && isTrial && isNotExpired && isActive && hasEmail;
    });

    console.log(`📊 Found ${activeTrials.length} active, unexpired trials for Easy Mix.`);

    if (activeTrials.length === 0) {
        console.log('✅ No active trials to process.');
        process.exit(0);
    }

    // Function to generate the email HTML
    const getEmailTemplate = (nickname, serialKey, expiresAt) => {
        return `
        <div style="background-color: #050505; color: #f0f0f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; text-align: center;">
            <div style="max-width: 500px; margin: 0 auto; background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 16px; padding: 32px; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 24px; font-weight: 900; color: #FFD600; letter-spacing: 2px;">OFFSZN</span>
                    <span style="font-size: 24px; font-weight: 400; color: #ffffff; letter-spacing: 1px;"> | EASY MIX</span>
                </div>

                <h2 style="color: #ffffff; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px;">¡Hola, ${nickname || 'Productor'}! 🚀</h2>
                
                <p style="color: #b3b3b3; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
                    Queremos recordarte que tienes una prueba gratis activa de Easy Mix el plugin para mezclar voces de forma fácil en segundos.
                </p>

                <!-- Box Key -->
                <div style="background: #141414; border: 1px dashed #FFD600; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
                    <p style="color: #888888; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Tu Serial Key de Prueba:</p>
                    <p style="font-family: monospace; font-size: 18px; color: #FFD600; font-weight: bold; margin: 0; letter-spacing: 1px;">${serialKey}</p>
                </div>

                <h3 style="color: #ffffff; font-size: 15px; margin-top: 0; margin-bottom: 12px;">¿Cómo usarlo?</h3>
                <ol style="color: #b3b3b3; font-size: 14px; line-height: 1.6; padding-left: 20px; margin-bottom: 28px;">
                    <li style="margin-bottom: 8px;">Descarga e instala el plugin.</li>
                    <li style="margin-bottom: 8px;">Abre tu DAW preferido (FL Studio, Ableton, Logic, etc.) e inserta <strong>Easy Mix</strong> en tu canal de voz.</li>
                    <li style="margin-bottom: 8px;">Introduce tu <strong>Serial Key</strong> de arriba cuando el plugin te lo solicite y ¡listo!</li>
                </ol>

                <!-- CTA Button -->
                <div style="text-align: center; margin-bottom: 28px;">
                    <a href="https://offszn.lat/plugins/easy-mix" style="background-color: #FFD600; color: #000000; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 8px; display: inline-block; font-size: 15px; transition: background 0.2s;">
                        Ir a Descargar Easy Mix
                    </a>
                </div>

                <hr style="border: 0; border-top: 1px solid #1c1c1c; margin-bottom: 20px;">

                <p style="color: #666666; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                    Este es un correo automático de OFFSZN. Si tienes dudas o necesitas soporte, contáctanos en <a href="https://offszn.lat" style="color: #FFD600; text-decoration: none;">offszn.lat</a>.
                </p>
            </div>
        </div>
        `;
    };

    if (MODE === 'dry-run') {
        console.log('\n--- DRY RUN: Users who would receive the email ---');
        activeTrials.forEach((t, i) => {
            console.log(`[${i+1}] ${t.users.nickname} (${t.users.email}) - Key: ${t.serial_key} (Exp: ${t.expires_at})`);
        });
        console.log('\n💡 To send a test email, run: node server/scratch/send_trial_emails.js test <email>');
        console.log('💡 To send emails to everyone, run: node server/scratch/send_trial_emails.js send-all');
        process.exit(0);
    }

    if (MODE === 'test') {
        console.log(`\n🧪 Sending test email to: ${TEST_EMAIL}...`);
        const sampleLic = activeTrials[0];
        const html = getEmailTemplate(sampleLic.users.nickname || 'Tester', sampleLic.serial_key, sampleLic.expires_at);
        try {
            await sendOffsznEmail({
                to: TEST_EMAIL,
                subject: '🎁 Recordatorio: Tu prueba activa de Easy Mix',
                html,
                fromName: 'Easy Mix by OFFSZN',
                type: 'transactional'
            });
            console.log('✅ Test email sent successfully!');
        } catch (e) {
            console.error('❌ Failed to send test email:', e.message);
        }
        process.exit(0);
    }

    if (MODE === 'send-all') {
        console.log(`\n✉️ Sending emails to all ${activeTrials.length} active trial users...`);
        for (let i = 0; i < activeTrials.length; i++) {
            const lic = activeTrials[i];
            const email = lic.users.email;
            const nickname = lic.users.nickname || 'Productor';
            const key = lic.serial_key;
            const expiry = lic.expires_at;

            console.log(`[${i+1}/${activeTrials.length}] Sending to ${nickname} (${email})...`);
            
            const html = getEmailTemplate(nickname, key, expiry);
            try {
                await sendOffsznEmail({
                    to: email,
                    subject: '🎁 Recordatorio: Tu prueba activa de Easy Mix',
                    html,
                    fromName: 'Easy Mix by OFFSZN',
                    type: 'transactional'
                });
                console.log(`   ✅ Sent!`);
            } catch (err) {
                console.error(`   ❌ Error sending to ${email}:`, err.message);
            }
            // Small delay to prevent rate limit
            await new Promise(r => setTimeout(r, 1000));
        }
        console.log('🎉 Completed sending all emails!');
        process.exit(0);
    }
}

main().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
