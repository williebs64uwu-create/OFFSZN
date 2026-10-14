import { supabase } from './src/infrastructure/database/connection.js';
import { sendOffsznEmail } from './src/shared/utils/mailer.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function main() {
    const targetEmail = 'vhg.torres.8147@gmail.com';
    const userId = '7938e3e8-938e-474d-85ca-0969261e8362';
    const serialKey = 'EASY-TRIAL-C6905D71-80230BD8';

    console.log('1. Limpiando licencias y activaciones trial anteriores del usuario...');
    const { data: oldTrials, error: oldErr } = await supabase
        .from('plugin_licenses')
        .select('id, serial_key')
        .eq('user_id', userId)
        .neq('serial_key', serialKey);

    if (oldTrials && oldTrials.length > 0) {
        for (const ot of oldTrials) {
            console.log(`Borrando activaciones y trial viejo: ${ot.serial_key} (${ot.id})`);
            await supabase.from('plugin_activations').delete().eq('license_id', ot.id);
            await supabase.from('plugin_licenses').delete().eq('id', ot.id);
        }
    }

    console.log('2. Asignando nueva licencia a su usuario con max_devices: 5...');
    const { data: updatedLic, error: updateErr } = await supabase
        .from('plugin_licenses')
        .update({
            user_id: userId,
            max_devices: 5,
            status: 'active'
        })
        .eq('serial_key', serialKey)
        .select('*')
        .single();

    if (updateErr) {
        console.error('Error al actualizar licencia:', updateErr);
        process.exit(1);
    }
    console.log('✅ Licencia asignada correctamente:', {
        serial: updatedLic.serial_key,
        user_id: updatedLic.user_id,
        max_devices: updatedLic.max_devices,
        status: updatedLic.status
    });

    console.log('3. Enviando correo vía Brevo API...');
    const pluginName = 'Easy Mix';
    const pluginUrl = 'https://offszn.lat/plugins/easy-mix';
    const subject = 'Tus datos de activación - Easy Mix (Trial 3 Días)';
    const html = `
    <div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #111827; margin-top: 0; font-size: 22px;">¡Aquí tienes tu prueba de Easy Mix!</h2>
        <p>Hola <strong>zomvic</strong>,</p>
        <p>Te hemos asignado una nueva clave de prueba gratuita de <strong>3 días</strong> para <strong>Easy Mix</strong> sin restricciones de dispositivo:</p>

        <div style="background: #f8fafc; padding: 18px 20px; border-radius: 8px; margin: 24px 0; border: 1px dashed #cbd5e1; text-align: center;">
            <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Clave de Licencia (Serial Key)</p>
            <p style="margin: 0; font-family: monospace; font-size: 22px; font-weight: bold; color: #0f172a; letter-spacing: 1px;">${serialKey}</p>
        </div>

        <p><strong>Pasos para activar:</strong></p>
        <ol style="padding-left: 20px; color: #334155; line-height: 1.8;">
            <li>Abre tu DAW (FL Studio, Ableton, Logic Pro, etc.) e inserta <strong>Easy Mix</strong>.</li>
            <li>En la ventana de activación, pega tu serial <code>${serialKey}</code>.</li>
            <li>Haz clic en <strong>Activar</strong>. Tu prueba de 3 días comenzará a contar desde esta primera activación.</li>
        </ol>

        <p style="font-size: 14px; color: #64748b; margin-top: 20px;">
            Si necesitas descargar nuevamente el instalador de Easy Mix, puedes hacerlo directamente desde:<br>
            <a href="${pluginUrl}" style="color: #2563eb; text-decoration: underline; font-weight: 500;">${pluginUrl}</a>
        </p>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0 20px 0;">
        <p style="margin: 0; font-size: 13px; color: #94a3b8; text-align: center;">Soporte OFFSZN · offszn.lat</p>
    </div>`;

    const emailRes = await sendOffsznEmail({
        to: targetEmail,
        subject,
        html,
        fromName: 'Soporte OFFSZN',
        type: 'transactional'
    });

    console.log('✅ Correo enviado exitosamente con Brevo API:', emailRes);
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
