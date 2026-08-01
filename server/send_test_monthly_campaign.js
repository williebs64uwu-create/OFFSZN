import { sendOffsznEmail } from './src/shared/utils/mailer.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function testMonthlyCampaignEmail() {
    const targetEmail = 'williebeatsyt@gmail.com';

    const sampleMixSerial = 'EASY-TRIAL-SAMPLE-KEY';
    const sampleMasterSerial = 'MASTER-TRIAL-SAMPLE-KEY';

    const driveMixUrl = 'https://drive.google.com/drive/folders/1tFzqvlfhaq8ry6e6zTZ9t87bt6qFy3sp?usp=sharing';
    const driveMasterUrl = 'https://drive.google.com/drive/folders/1FJKceftSLu-BccWVnVCAb3NIHANqvM0p?usp=sharing';

    const subject = 'Inicio de mes: te damos 3 días de prueba de Easy Mix y Easy Master';
    const previewText = 'Prueba los plugins aquí...';

    const html = `
    <span style="display:none;font-size:1px;color:#ffffff;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</span>
    <div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333; max-width: 560px; margin: 0 auto;">
        <p>Hola,</p>
        <p>Te hemos dado <strong>3 días de prueba gratis</strong> para que puedas explorar los plugins de <strong>Easy Mix</strong> y <strong>Easy Master</strong>.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 18px 0;">
            <p style="margin: 0 0 4px 0; font-weight: bold; color: #0f172a;">🎛️ Serial para Easy Mix:</p>
            <p style="font-family: monospace; font-size: 17px; font-weight: bold; color: #2563eb; margin: 0 0 10px 0;">${sampleMixSerial}</p>
            <p style="margin: 0; font-size: 14px;">Descarga aquí (Windows / Mac):<br>
            <a href="${driveMixUrl}" style="color: #2563eb; text-decoration: underline;">${driveMixUrl}</a></p>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 18px 0;">
            <p style="margin: 0 0 4px 0; font-weight: bold; color: #0f172a;">🎚️ Serial para Easy Master:</p>
            <p style="font-family: monospace; font-size: 17px; font-weight: bold; color: #2563eb; margin: 0 0 10px 0;">${sampleMasterSerial}</p>
            <p style="margin: 0; font-size: 14px;">Descarga aquí (Windows / Mac):<br>
            <a href="${driveMasterUrl}" style="color: #2563eb; text-decoration: underline;">${driveMasterUrl}</a></p>
        </div>

        <p style="font-size: 14px; color: #475569;">Para activarlos, solo abre cada plugin en tu DAW e ingresa su clave serial correspondiente.</p>
        
        <br>
        <p>- Soporte OFFSZN</p>
    </div>`;

    console.log(`Enviando correo de prueba de campaña mensual a ${targetEmail}...`);

    try {
        const res = await sendOffsznEmail({
            to: targetEmail,
            subject,
            html,
            fromName: 'Soporte OFFSZN',
            type: 'transactional'
        });
        console.log('✅ Correo de prueba de campaña mensual enviado exitosamente:', res);
    } catch (err) {
        console.error('❌ Error enviando correo de prueba:', err);
    }
}

testMonthlyCampaignEmail();
