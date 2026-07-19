import 'dotenv/config';
import { sendOffsznEmail } from '../src/shared/utils/mailer.js';

async function main() {
    console.log('Probando envío de correo vía Brevo...');
    try {
        const res = await sendOffsznEmail({
            to: 'willie2008garay@gmail.com', // Enviamos a tu correo para verificar
            subject: '🧪 Prueba de Envío de Correo — OFFSZN',
            html: '<h1>¡Funciona!</h1><p>Esta es una prueba de envío desde el servidor de OFFSZN.</p>',
            fromName: 'OFFSZN Prueba'
        });
        console.log('Resultado del envío:', res);
    } catch (error) {
        console.error('Error al enviar correo:', error);
    }
}

main();
