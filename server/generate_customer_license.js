import { generatePluginLicense } from './src/infrastructure/http/controllers/PluginLicensingController.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const args = process.argv.slice(2);
const email = args[0];
const licenseType = args[1] || 'lifetime'; // 'lifetime' or 'subscription'
const pluginName = args[2] || 'Easy Mix';

if (!email) {
    console.error("❌ Error: Debes especificar el email del comprador.");
    console.log("\nUso:");
    console.log("  node generate_customer_license.js <email> [lifetime|subscription] [Easy Mix]");
    console.log("\nEjemplo:");
    console.log("  node generate_customer_license.js cliente@gmail.com lifetime \"Easy Mix\"");
    process.exit(1);
}

async function run() {
    try {
        console.log(`\n🔑 Generando licencia para: ${email}`);
        console.log(`   Tipo de licencia: ${licenseType}`);
        console.log(`   Producto:         ${pluginName}\n`);
        
        const result = await generatePluginLicense({
            licenseType,
            userEmail: email,
            pluginName
        });
        
        console.log("✅ ¡Licencia generada exitosamente!");
        console.log(`   🔑 Serial Key: ${result.serialKey}`);
        console.log(`   📧 Correo de activación enviado a: ${email}`);
        process.exit(0);
    } catch (error) {
        console.error("❌ Error al generar la licencia:", error);
        process.exit(1);
    }
}

run();
