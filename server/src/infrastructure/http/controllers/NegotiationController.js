import nodemailer from 'nodemailer';
import { supabase } from '../../database/connection.js';
import { EMAIL_USER, EMAIL_PASS, SMTP_HOST, SMTP_PORT } from '../../../shared/config/config.js';

/**
 * Handles the negotiation proposal and sends email notifications.
 */
export const submitNegotiation = async (req, res) => {
    const { productId, producerId, amount, email, userId } = req.body;

    if (!productId || !producerId || !amount || !email) {
        return res.status(400).json({ error: 'Faltan datos requeridos (productId, producerId, amount, email)' });
    }

    try {
        // 1. Save to Supabase (Double check or re-insert if client didn't)
        // Note: The client already re-inserts, so here we just handle the EMAIL.
        // But for consistency and "doing things right", we could re-verify here.

        // 2. Fetch Producer Email
        const { data: producer, error: prodError } = await supabase
            .from('users')
            .select('nickname, payment_methods')
            .eq('id', producerId)
            .single();

        if (prodError || !producer) {
            console.error('[Negotiation] Producer not found:', prodError);
            return res.status(404).json({ error: 'Productor no encontrado' });
        }

        const producerEmail = producer.payment_methods?.paypal || producer.payment_methods?.email;
        if (!producerEmail) {
            console.warn('[Negotiation] Producer has no email configured for notifications.');
        }

        // 3. Fetch Product details
        const { data: product } = await supabase
            .from('products')
            .select('name')
            .eq('id', productId)
            .single();

        // 4. Setup Nodemailer
        if (!EMAIL_USER || !EMAIL_PASS) {
            console.error('[SMTP] Missing EMAIL_USER or EMAIL_PASS environment variables.');
            return res.status(500).json({ error: 'Error de configuración de correo en el servidor.' });
        }

        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_PORT == 465, // true for 465, false for other ports
            auth: {
                user: EMAIL_USER,
                pass: EMAIL_PASS,
            },
        });

        // 5. Build Emails
        const productName = product?.name || 'Producto';
        const producerName = producer.nickname || 'Productor';

        // A. Email to Producer
        const producerMailOptions = {
            from: `"OFFSZN Notifications" <${EMAIL_USER}>`,
            to: producerEmail || EMAIL_USER, // Fallback to admin if no producer email
            subject: `🔥 Nueva oferta recibida: ${productName}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #A020F0;">¡Hola ${producerName}!</h2>
                    <p>Has recibido una nueva propuesta de negociación por tu producto <b>${productName}</b>.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p><b>Oferta:</b> $${amount} USD</p>
                    <p><b>Email del interesado:</b> ${email}</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p>Puedes contactar al interesado directamente para cerrar el trato o enviarles un Cupón de Descuento personalizado.</p>
                    <br>
                    <p style="font-size: 0.8rem; color: #888;">Este es un mensaje automático de OFFSZN.</p>
                </div>
            `,
        };

        // B. Email to Buyer
        const buyerMailOptions = {
            from: `"OFFSZN" <${EMAIL_USER}>`,
            to: email,
            subject: `Tu propuesta para "${productName}" ha sido enviada`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #A020F0;">¡Propuesta enviada!</h2>
                    <p>Hemos enviado tu oferta de <b>$${amount} USD</b> por <b>${productName}</b> a ${producerName}.</p>
                    <p>El productor se pondrá en contacto contigo pronto si acepta la propuesta.</p>
                    <br>
                    <p>¡Gracias por usar OFFSZN!</p>
                </div>
            `,
        };

        // Send both
        await Promise.all([
            transporter.sendMail(producerMailOptions),
            transporter.sendMail(buyerMailOptions)
        ]);

        console.log(`[Negotiation] Success: Notification emails sent for ${productName}`);
        return res.status(200).json({ success: true, message: 'Propuesta procesada y correos enviados.' });

    } catch (err) {
        console.error('[Negotiation] Error in submitNegotiation:', err);
        return res.status(500).json({ error: 'Error interno al procesar la negociación.' });
    }
};

/**
 * Handles the producer's response to an offer (Accept, Reject, Counter).
 * Sends emails to the buyer notifying them of the decision.
 */
export const respondNegotiation = async (req, res) => {
    const { proposalId, status, counterAmount } = req.body;

    if (!proposalId || !status) {
        return res.status(400).json({ error: 'Faltan datos (proposalId, status)' });
    }

    try {
        // 1. Fetch Proposal Details
        const { data: proposal, error: propError } = await supabase
            .from('propuestas_offszn')
            .select('*, products(name), users!producer_id(nickname, payment_methods)')
            .eq('id', proposalId)
            .single();

        if (propError || !proposal) {
            console.error('[Negotiation] Proposal not found:', propError);
            return res.status(404).json({ error: 'Propuesta no encontrada' });
        }

        const buyerEmail = proposal.email_offszn;
        const productName = proposal.products?.name || 'Producto';
        const producerName = proposal.users?.nickname || 'Productor';
        const finalAmount = counterAmount || proposal.counter_amount || proposal.amount_offszn;

        // 2. Setup Nodemailer
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_PORT == 465,
            auth: {
                user: EMAIL_USER,
                pass: EMAIL_PASS,
            },
        });

        // 3. Build Email Content based on Status
        let subject = '';
        let html = '';

        if (status === 'accepted') {
            subject = `✅ ¡Oferta aceptada! Tu propuesta para "${productName}" fue aprobada`;
            html = `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
                    <h2 style="color: #10B981;">¡Buenas noticias!</h2>
                    <p>El productor <b>${producerName}</b> ha aceptado tu oferta de <b>$${proposal.amount_offszn} USD</b> por <b>${productName}</b>.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p>Para completar la compra, contacta directamente al productor o espera a que se genere un link de pago personalizado (funcionalidad en desarrollo).</p>
                    <p><b>Productor:</b> ${producerName}</p>
                    <p><b>Email de contacto:</b> ${proposal.users?.payment_methods?.paypal || proposal.users?.payment_methods?.email || 'N/A'}</p>
                    <br>
                    <p>¡Gracias por usar OFFSZN!</p>
                </div>
            `;
        } else if (status === 'rejected') {
            subject = `Aviso: Tu propuesta para "${productName}" no fue aceptada`;
            html = `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
                    <h2 style="color: #EF4444;">Lo sentimos</h2>
                    <p>Tu propuesta de <b>$${proposal.amount_offszn} USD</b> por <b>${productName}</b> no ha sido aceptada en esta ocasión.</p>
                    <p>¡No te desanimes! Siempre puedes intentar con una oferta diferente o adquirir el producto a su precio regular.</p>
                    <br>
                    <p>Atentamente, el equipo de OFFSZN.</p>
                </div>
            `;
        } else if (status === 'countered') {
            subject = `⚡ Nueva contra-oferta de ${producerName} por "${productName}"`;
            html = `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
                    <h2 style="color: #8B5CF6;">¡Tienes una contra-oferta!</h2>
                    <p>El productor <b>${producerName}</b> te propone un nuevo precio de <b>$${counterAmount} USD</b> por <b>${productName}</b>.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p>¿Qué te parece? Puedes responder directamente a este correo o entrar a la plataforma para continuar la negociación.</p>
                    <br>
                    <p>¡Sigue creando con OFFSZN!</p>
                </div>
            `;
        }

        // 4. Send Email
        if (subject && html) {
            await transporter.sendMail({
                from: `"OFFSZN" <${EMAIL_USER}>`,
                to: buyerEmail,
                subject: subject,
                html: html,
            });
            console.log(`[Negotiation] Response email sent to ${buyerEmail} for status: ${status}`);
        }

        return res.status(200).json({ success: true, message: 'Respuesta enviada correctamente.' });

    } catch (err) {
        console.error('[Negotiation] Error in respondNegotiation:', err);
        return res.status(500).json({ error: 'Error interno al procesar la respuesta.' });
    }
};
