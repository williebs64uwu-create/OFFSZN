import 'dotenv/config';
import { generatePluginLicense } from '../src/infrastructure/http/controllers/PluginLicensingController.js';

async function main() {
    const email = 'williebeatsyt@gmail.com';
    try {
        console.log(`Sending test activation email to ${email} for Easy Mix...`);
        const result = await generatePluginLicense({
            licenseType: 'lifetime',
            userEmail: email,
            pluginName: 'Easy Mix'
        });
        console.log('\n✅ Success!');
        console.log(`   Generated Serial: ${result.serialKey}`);
        console.log(`   Email sent to:     ${email}`);
    } catch (err) {
        console.error('❌ Error sending test email:', err);
    }
}

main();
