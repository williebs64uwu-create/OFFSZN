import 'dotenv/config';
import { sendOffsznEmail } from '../src/shared/utils/mailer.js';

async function main() {
    const toEmail = 'mikeflowrap89@hotmail.com';
    const serialKey = 'MASTER-SUB-35AD7DD5-2038501D';
    const pluginName = 'Easy Master';

    console.log(`Re-enviando correo con serial key a ${toEmail}...`);

    const serialKeySection = `
        <div style="background:#111827; border:2px dashed #ff9f0a; border-radius:12px; padding:20px; margin:20px 0; text-align:center;">
            <p style="color:#ff9f0a; font-size:0.8rem; text-transform:uppercase; letter-spacing:2px; margin:0 0 10px; font-weight:700;">🔑 Tu Serial Key FULL</p>
            <p style="font-family:monospace; font-size:1.3rem; font-weight:800; color:#fff; letter-spacing:2px; margin:0; word-break:break-all;">${serialKey}</p>
            <p style="color:#888; font-size:0.78rem; margin:12px 0 0;">Guarda esta clave en un lugar seguro. La necesitarás para activar el plugin en tu DAW.</p>
        </div>
    `;

    const downloadSection = `
        <div style="margin:20px 0;">
            <p style="color:#aaa; font-size:0.78rem; text-transform:uppercase; letter-spacing:2px; font-weight:700; margin-bottom:12px;">Descargar Instaladores</p>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <a href="https://drive.google.com/file/d/1JF4oDN_beOOxnOO5ca3TLGDCEQyOeWjh/view" style="display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none; font-weight:600; font-size:0.85rem;">Windows</a>
                <a href="https://drive.google.com/file/d/14Lc6-vOtEYgw7IbQcpBe7h2kIiGTrP6Q/view?usp=sharing" style="display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none; font-weight:600; font-size:0.85rem;">macOS</a>
            </div>
        </div>
    `;

    const buyerHtml = `
        <div style="font-family: 'Segoe UI', sans-serif; padding: 30px; background: #0a0a0a; border-radius: 12px; color: #fff; max-width: 600px;">
            <h2 style="color: #ff9f0a; margin-bottom:20px;">¡Compra Completada! 🎛️</h2>
            <p style="color:#ccc; line-height:1.6;">Hola <b>mike</b>, procesamos correctamente el pago por <b style="color:#fff;">${pluginName}</b>.</p>
            ${serialKeySection}
            ${downloadSection}
            <hr style="border:0; border-top:1px solid #222; margin:25px 0;">
            <p style="font-size:0.75rem; color:#555;">Este es un recibo automático de OFFSZN. Si tienes problemas, contáctanos por WhatsApp.</p>
        </div>
    `;

    try {
        const res = await sendOffsznEmail({
            to: toEmail,
            subject: `🔑 Tu Serial Key de ${pluginName} — OFFSZN`,
            html: buyerHtml,
            fromName: 'OFFSZN'
        });
        console.log('Correo enviado con éxito:', res);
    } catch (err) {
        console.error('Error al enviar:', err);
    }
}

main();
