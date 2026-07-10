import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';
import { sendOffsznEmail } from '../src/shared/utils/mailer.js';

const MODE = process.argv[2] || 'dry-run'; // 'dry-run', 'test', or 'send-all'
const TEST_EMAIL = process.argv[3] || 'offszn.studio@gmail.com';

async function main() {
    console.log(`🚀 Starting Unused Trial Reminders script in [${MODE.toUpperCase()}] mode...`);
    
    // Query trials created in the last 48 hours
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    const { data: licenses, error: licError } = await supabase
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
        `)
        .eq('license_type', 'trial')
        .gte('created_at', fortyEightHoursAgo);

    if (licError) {
        console.error('❌ Error fetching licenses:', licError);
        process.exit(1);
    }

    const easyMixLicenses = licenses.filter(lic => 
        lic.plugin_name?.toLowerCase().includes('mix') && lic.users?.email
    );

    const unusedTrials = [];

    // Filter by licenses with no activation entries in database
    for (const lic of easyMixLicenses) {
        const { data: activations, error: actError } = await supabase
            .from('plugin_activations')
            .select('id')
            .eq('license_id', lic.id);

        if (actError) {
            console.error(`Error checking activations for license ${lic.id}:`, actError);
            continue;
        }

        if (!activations || activations.length === 0) {
            unusedTrials.push(lic);
        }
    }

    console.log(`📊 Found ${unusedTrials.length} users with unused Easy Mix trial keys.`);

    if (unusedTrials.length === 0) {
        console.log('✅ No unused trials to process.');
        process.exit(0);
    }

    const getEmailTemplate = (nickname, serialKey) => {
        return `
        <div style="background-color: #050505; color: #f0f0f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; text-align: center;">
            <div style="max-width: 500px; margin: 0 auto; background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 16px; padding: 32px; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 24px; font-weight: 900; color: #FFD600; letter-spacing: 2px;">OFFSZN</span>
                    <span style="font-size: 24px; font-weight: 400; color: #ffffff; letter-spacing: 1px;"> | EASY MIX</span>
                </div>

                <h2 style="color: #ffffff; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px;">¡Oye, ${nickname || 'Productor'}! 🎧</h2>
                
                <p style="color: #b3b3b3; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
                    Vimos que generaste tu Serial Key de prueba gratuita para <strong>Easy Mix</strong>, pero notamos que <strong>aún no lo has activado en tu DAW</strong>.
                </p>

                <p style="color: #b3b3b3; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
                    ¿Tuviste alguna complicación o duda para instalarlo? Queremos ayudarte para que puedas empezar a mezclar tus voces hoy mismo.
                </p>

                <!-- Box Key -->
                <div style="background: #141414; border: 1px dashed #FFD600; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
                    <p style="color: #888888; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Tu Serial Key de Prueba:</p>
                    <p style="font-family: monospace; font-size: 18px; color: #FFD600; font-weight: bold; margin: 0; letter-spacing: 1px;">${serialKey}</p>
                </div>

                <h3 style="color: #ffffff; font-size: 15px; margin-top: 0; margin-bottom: 12px;">Paso a paso para activarlo:</h3>
                <ol style="color: #b3b3b3; font-size: 14px; line-height: 1.6; padding-left: 20px; margin-bottom: 28px;">
                    <li style="margin-bottom: 8px;">Descarga el instalador de Windows directamente en <a href="https://offszn.lat/plugins/easy-mix" style="color: #FFD600; text-decoration: underline;">la Landing de Easy Mix</a>.</li>
                    <li style="margin-bottom: 8px;">Abre tu DAW (FL Studio, Ableton, Reaper, Cubase, etc.) y carga <strong>Easy Mix</strong> en cualquier canal de voz.</li>
                    <li style="margin-bottom: 8px;">Cuando el plugin te pida la licencia, pega tu **Serial Key** de arriba y presiona enter. ¡Listo!</li>
                </ol>

                <!-- CTA Button -->
                <div style="text-align: center; margin-bottom: 28px;">
                    <a href="https://offszn.lat/plugins/easy-mix" style="background-color: #FFD600; color: #000000; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 8px; display: inline-block; font-size: 15px;">
                        Ir a Descargar Easy Mix
                    </a>
                </div>

                <hr style="border: 0; border-top: 1px solid #1c1c1c; margin-bottom: 20px;">

                <p style="color: #666666; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                    Este es un correo de soporte de OFFSZN. Si tienes problemas técnicos escríbenos respondiendo a este correo.
                </p>
            </div>
        </div>
        `;
    };

    if (MODE === 'dry-run') {
        console.log('\n--- DRY RUN: Users who will receive the reminder ---');
        unusedTrials.forEach((t, i) => {
            console.log(`[${i+1}] ${t.users.nickname} (${t.users.email}) - Key: ${t.serial_key}`);
        });
        console.log('\n💡 To send a test email, run: node server/scratch/send_unused_trial_reminders.js test <email>');
        console.log('💡 To send emails to everyone, run: node server/scratch/send_unused_trial_reminders.js send-all');
        process.exit(0);
    }

    if (MODE === 'test') {
        console.log(`\n🧪 Sending test reminder to: ${TEST_EMAIL}...`);
        const sample = unusedTrials[0] || { users: { nickname: 'Tester' }, serial_key: 'EASY-TRIAL-SAMPLE-KEY' };
        const html = getEmailTemplate(sample.users.nickname, sample.serial_key);
        try {
            await sendOffsznEmail({
                to: TEST_EMAIL,
                subject: '🎧 ¿Necesitas ayuda con tu prueba de Easy Mix?',
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
        console.log(`\n✉️ Sending reminder emails to all ${unusedTrials.length} users...`);
        for (let i = 0; i < unusedTrials.length; i++) {
            const lic = unusedTrials[i];
            const email = lic.users.email;
            const nickname = lic.users.nickname || 'Productor';
            const key = lic.serial_key;

            console.log(`[${i+1}/${unusedTrials.length}] Sending to ${nickname} (${email})...`);
            
            const html = getEmailTemplate(nickname, key);
            try {
                await sendOffsznEmail({
                    to: email,
                    subject: '🎧 ¿Necesitas ayuda con tu prueba de Easy Mix?',
                    html,
                    fromName: 'Easy Mix by OFFSZN',
                    type: 'transactional'
                });
                console.log(`   ✅ Sent!`);
            } catch (err) {
                console.error(`   ❌ Error sending to ${email}:`, err.message);
            }
        }
        console.log('🎉 Done sending reminders!');
        process.exit(0);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
