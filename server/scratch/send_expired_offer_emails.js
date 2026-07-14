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
        <div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333;">
            <p>Hola ${nickname || 'Productor'},</p>
            <p>Vimos que tu prueba gratuita de Easy Mix ha expirado, pero no queremos que dejes de mezclar tus voces de forma facil.</p>
            <p>Consigue tu Licencia Completa (Lifetime) de Easy Mix por solo $5. Esta oferta especial estara disponible hasta el fin del mundial 2026.</p>
            <p>La licencia te da acceso de por vida sin suscripciones, actualizaciones gratis para siempre y el pack extra de presets (Sauce Bank) listos para usar en tus voces.</p>
            <p>Puedes conseguir la licencia de por vida por $5 en el siguiente enlace:</p>
            <p><a href="https://offszn.lat/plugins/easy-mix" style="color: #0066cc; font-weight: bold; text-decoration: underline;">https://offszn.lat/plugins/easy-mix</a></p>
            <br>
            <p>Que tengas un buen dia,</p>
            <p>Soporte de OFFSZN</p>
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
