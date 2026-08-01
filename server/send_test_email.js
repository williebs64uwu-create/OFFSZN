import { sendOffsznEmail } from './src/shared/utils/mailer.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function testEmail() {
    const targetEmail = 'williebeatsyt@gmail.com';
    const samplePlugin = 'Easy Mix';
    const sampleSerial = 'EASY-TRIAL-SAMPLE-KEY';
    const pluginSlug = 'easy-mix'; // or 'easy-master'
    const pluginUrl = `https://offszn.lat/plugins/${pluginSlug}`;

    const subject = `Tus datos de activación - ${samplePlugin}`;
    const html = `
    <div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333; max-width: 540px; margin: 0 auto;">
        <p>Hola,</p>
        <p>Aquí tienes los datos para activar tu prueba gratis de <strong>${samplePlugin}</strong>:</p>

        <p style="margin-bottom: 5px; color: #666;">Clave de Licencia (Serial Key):</p>
        <p style="font-family: monospace; font-size: 18px; font-weight: bold; color: #111; margin-top: 0;">${sampleSerial}</p>

        <p>Para activarlo, solo abre el plugin en tu DAW y pon la serial.</p>
        <p>Si aún no tienes el instalador, puedes descargarlo aquí:<br>
        <a href="${pluginUrl}" style="color: #0066cc; text-decoration: underline;">${pluginUrl}</a></p>

        <br>
        <p>- Soporte OFFSZN</p>
    </div>`;

    console.log(`Enviando correo ultra-simple de prueba a ${targetEmail}...`);

    try {
        const res = await sendOffsznEmail({
            to: targetEmail,
            subject,
            html,
            fromName: 'Soporte OFFSZN',
            type: 'transactional'
        });
        console.log('✅ Correo de prueba enviado exitosamente:', res);
    } catch (err) {
        console.error('❌ Error enviando correo de prueba:', err);
    }
}

testEmail();
