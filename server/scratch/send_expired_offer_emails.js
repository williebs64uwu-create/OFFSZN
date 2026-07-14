import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';
import { sendOffsznEmail } from '../src/shared/utils/mailer.js';

const MODE = process.argv[2] || 'dry-run'; // 'dry-run', 'test', 'send-all'
const TEST_EMAIL = process.argv[3] || 'offszn.studio@gmail.com';

async function main() {
    console.log(`🚀 Starting expired trial offer script in [${MODE.toUpperCase()}] mode...`);

    // Fetch all licenses for Easy Mix
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
        `);

    if (error) {
        console.error('❌ Error fetching licenses:', error);
        process.exit(1);
    }

    const easyMixLicenses = licenses.filter(lic => 
        lic.plugin_name?.toLowerCase().includes('mix')
    );

    const now = new Date();

    // 1. Identify users who already have a full/lifetime license (to exclude them)
    const usersWithFullLicense = new Set(
        easyMixLicenses
            .filter(lic => lic.license_type === 'lifetime' || lic.license_type === 'subscription')
            .map(lic => lic.user_id)
    );

    // 2. Identify users whose trials have expired and do NOT have a full license
    const expiredTrialUsers = easyMixLicenses.filter(lic => {
        const isTrial = lic.license_type === 'trial';
        const isExpired = lic.expires_at ? new Date(lic.expires_at) < now : false;
        const isStatusExpired = lic.status === 'expired';
        const isActuallyExpired = isExpired || isStatusExpired;
        const doesNotHaveFull = !usersWithFullLicense.has(lic.user_id);
        const hasEmail = lic.users?.email;

        return isTrial && isActuallyExpired && doesNotHaveFull && hasEmail;
    });

    // Remove duplicates (in case a user somehow has multiple expired trials)
    const uniqueUsersMap = new Map();
    expiredTrialUsers.forEach(lic => {
        if (!uniqueUsersMap.has(lic.users.email)) {
            uniqueUsersMap.set(lic.users.email, lic);
        }
    });

    const uniqueExpiredUsers = Array.from(uniqueUsersMap.values());

    console.log(`📊 Found ${uniqueExpiredUsers.length} users with expired trials and no full license.`);

    if (uniqueExpiredUsers.length === 0) {
        console.log('✅ No expired trial users to offer.');
        process.exit(0);
    }

    // Function to generate the email HTML
    const getOfferTemplate = (nickname) => {
        return `
        <!-- Preheader / Preview Text -->
        <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; color: transparent; line-height: 1px; max-width: 0px; opacity: 0;">
            el plugin puede ser tuyo en segundos...
        </div>
        <div style="background-color: #050505; color: #f0f0f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; text-align: center;">
            <div style="max-width: 500px; margin: 0 auto; background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 16px; padding: 32px; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 24px; font-weight: 900; color: #FFD600; letter-spacing: 2px;">OFFSZN</span>
                    <span style="font-size: 24px; font-weight: 400; color: #ffffff; letter-spacing: 1px;"> | EASY MIX</span>
                </div>

                <h2 style="color: #ffffff; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 16px;">¡Hola, ${nickname || 'Productor'}! 🚀</h2>
                
                <p style="color: #b3b3b3; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
                    Vimos que tu prueba gratuita de <strong>Easy Mix</strong> ha expirado. ¡Pero no queremos que dejes de mezclar tus voces con esta facilidad!
                </p>

                <p style="color: #ffffff; font-size: 16px; font-weight: bold; line-height: 1.6; margin-bottom: 24px; border-left: 4px solid #FFD600; padding-left: 12px;">
                    Consigue tu Licencia Completa (Lifetime) de Easy Mix por solo $5. Oferta válida hasta el fin del mundial 2026.
                </p>

                <!-- Benefits List -->
                <div style="background: #141414; border: 1px solid #1c1c1c; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
                    <h3 style="color: #FFD600; font-size: 14px; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">¿Qué incluye esta oferta?</h3>
                    <ul style="color: #b3b3b3; font-size: 14px; line-height: 1.6; padding-left: 20px; margin: 0;">
                        <li style="margin-bottom: 8px;"><strong>Acceso de por vida (Lifetime)</strong> sin suscripciones.</li>
                        <li style="margin-bottom: 8px;"><strong>Actualizaciones gratis</strong> para siempre.</li>
                        <li style="margin-bottom: 0;"><strong>🎁 Regalo Extra:</strong> +50 presets (Sauce Bank) listos para usar en tus voces.</li>
                    </ul>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin-bottom: 28px;">
                    <a href="https://offszn.lat/plugins/easy-mix" style="background-color: #FFD600; color: #000000; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 8px; display: inline-block; font-size: 15px; transition: background 0.2s;">
                        Conseguir Licencia por $5
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
        console.log('\n--- DRY RUN: Users who would receive the offer email ---');
        uniqueExpiredUsers.forEach((t, i) => {
            console.log(`[${i+1}] ${t.users.nickname} (${t.users.email})`);
        });
        console.log('\n💡 To send a test email, run: node server/scratch/send_expired_offer_emails.js test <email>');
        console.log('💡 To send emails to everyone, run: node server/scratch/send_expired_offer_emails.js send-all');
        process.exit(0);
    }

    if (MODE === 'test') {
        console.log(`\n🧪 Sending test offer email to: ${TEST_EMAIL}...`);
        const html = getOfferTemplate('Tester');
        try {
            await sendOffsznEmail({
                to: TEST_EMAIL,
                subject: 'tu plugin mundialista',
                html,
                fromName: 'Easy Mix by OFFSZN',
                type: 'transactional'
            });
            console.log('✅ Test offer email sent successfully!');
        } catch (e) {
            console.error('❌ Failed to send test email:', e.message);
        }
        process.exit(0);
    }

    if (MODE === 'send-all') {
        console.log(`\n✉️ Sending offer emails to all ${uniqueExpiredUsers.length} expired trial users...`);
        for (let i = 0; i < uniqueExpiredUsers.length; i++) {
            const lic = uniqueExpiredUsers[i];
            const email = lic.users.email;
            const nickname = lic.users.nickname || 'Productor';

            console.log(`[${i+1}/${uniqueExpiredUsers.length}] Sending to ${nickname} (${email})...`);
            
            const html = getOfferTemplate(nickname);
            try {
                await sendOffsznEmail({
                    to: email,
                    subject: 'tu plugin mundialista',
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
        console.log('🎉 Completed sending all offer emails!');
        process.exit(0);
    }
}

main().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
