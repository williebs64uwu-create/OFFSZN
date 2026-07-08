import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { sendOffsznEmail } from '../src/shared/utils/mailer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
    const userEmail = "adandavid327@gmail.com";
    const userId = "c829a01b-9bfd-47b7-9b88-862b12a3b300";
    const pluginName = "Easy Mix";

    // Generate FULL Lifetime key for 1 device
    const serialKey = `EASY-FULL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    console.log(`Generando licencia ${serialKey} para ${userEmail}...`);

    const { data: newLic, error } = await supabase
        .from('plugin_licenses')
        .insert({
            serial_key: serialKey,
            license_type: 'lifetime',
            status: 'active',
            expires_at: null,
            max_devices: 1, 
            plugin_name: pluginName,
            user_id: userId
        })
        .select('*')
        .single();

    if (error) {
        console.error("Error al insertar la licencia:", error);
        return;
    }

    console.log("Licencia insertada con éxito:", newLic);

    try {
        console.log("Enviando correo de bienvenida a", userEmail);
        
        const html = `
        <div style="background:#0d0d0d;color:#f0f0f0;font-family:sans-serif;padding:40px;border-radius:12px;max-width:520px;margin:auto;">
            <h1 style="color:#FFD600;letter-spacing:2px;">EASY MIX</h1>
            <h2 style="color:#fff;">¡Plugin Activado Exitosamente! 🎉</h2>
            <p>Tu licencia de <strong>Easy Mix by OFFSZN</strong> ha sido activada.</p>
            <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin:20px 0;">
                <p style="color:#aaa;font-size:13px;margin:0 0 6px;">Tu Serial Key:</p>
                <p style="font-family:monospace;font-size:18px;color:#FFD600;letter-spacing:1px;margin:0;">${serialKey}</p>
            </div>
            <p><strong>Tipo de licencia:</strong> ⭐ Licencia Lifetime — Acceso de por vida</p>
            <p style="color:#30d158;font-weight:bold;">✅ Acceso de por vida — Sin vencimiento (1 dispositivo)</p>
            
            <div style="background: linear-gradient(135deg, #1f1c00 0%, #332a00 100%); border: 1px solid #FFD600; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color:#FFD600; margin-top:0;">🎁 BONUS EXCLUSIVO: +50 SAUCE BANK PRESETS</h3>
                <p style="color:#ddd; font-size:14px;">Por adquirir la licencia completa de Easy Mix, te regalamos nuestra expansi&oacute;n privada con 50 presets listos para usar en tus voces.</p>
                <a href="https://drive.google.com/file/d/1t10xb_5XdNPtZ8SqGAvSIjLx3yPzNx6C/view?usp=sharing" style="display:inline-block; background:#FFD600; color:#000; font-weight:bold; text-decoration:none; padding:10px 20px; border-radius:6px; margin-top:10px;">⬇️ Descargar SAUCE BANK</a>
                <p style="color:#aaa; font-size:12px; margin-bottom:0; margin-top:10px;"><em>Instrucciones: Solo descarga el instalador, ejec&uacute;talo y los presets aparecer&aacute;n autom&aacute;ticamente en tu plugin.</em></p>
            </div>
            
            <hr style="border:1px solid #222;margin:24px 0;">
            <p style="font-size:13px;color:#888;">Guarda este correo. Si cambias de equipo necesitarás tu serial key para reactivar.<br>Soporte: <a href="https://offszn.lat" style="color:#FFD600;">offszn.lat</a></p>
        </div>`;

        await sendOffsznEmail({
            to: userEmail,
            subject: '✅ Easy Mix Activado — Tu Serial Key de OFFSZN',
            html: html,
            fromName: 'Easy Mix by OFFSZN',
            type: 'transactional'
        });
        console.log("Correo enviado con éxito.");
    } catch (mailErr) {
        console.error("Error al enviar el correo:", mailErr);
    }
}
main();
