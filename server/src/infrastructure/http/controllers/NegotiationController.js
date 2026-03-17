import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { supabase } from '../../database/connection.js';
import { EMAIL_USER, EMAIL_PASS, SMTP_HOST, SMTP_PORT } from '../../../shared/config/config.js';

// ============================================
// HELPER: Create Nodemailer Transporter
// ============================================
function createTransporter() {
    if (!EMAIL_USER || !EMAIL_PASS) {
        throw new Error('Missing EMAIL_USER or EMAIL_PASS environment variables.');
    }
    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT == 465,
        auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    });
}

// Truncate product name for notifications (max 30 chars)
function truncateName(name, max = 30) {
    if (!name) return 'Producto';
    return name.length > max ? name.substring(0, max) + '...' : name;
}

/**
 * Handles the negotiation proposal and sends email notifications.
 */
export const submitNegotiation = async (req, res) => {
    const { productId, producerId, amount, email, userId } = req.body;

    if (!productId || !producerId || !amount || !email) {
        return res.status(400).json({ error: 'Faltan datos requeridos (productId, producerId, amount, email)' });
    }

    try {
        // 1. Fetch Producer Email
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

        // 2. Fetch Product details
        const { data: product } = await supabase
            .from('products')
            .select('name')
            .eq('id', productId)
            .single();

        // 3. Setup Nodemailer
        const transporter = createTransporter();

        // 4. Build Emails
        const productName = product?.name || 'Producto';
        const producerName = producer.nickname || 'Productor';

        // A. Email to Producer
        const producerMailOptions = {
            from: `"OFFSZN Notifications" <${EMAIL_USER}>`,
            to: producerEmail || EMAIL_USER,
            subject: `🔥 Nueva oferta recibida: ${productName}`,
            html: `
                <div style="font-family: 'Segoe UI', sans-serif; padding: 30px; background: #0a0a0a; border-radius: 12px; color: #fff; max-width: 600px;">

                    <h2 style="color: #8B5CF6; margin-bottom:20px;">¡Hola ${producerName}!</h2>
                    <p style="color:#ccc; line-height:1.6;">Has recibido una nueva propuesta de negociación por tu producto <b style="color:#fff;">${productName}</b>.</p>
                    <div style="background:#111; border:1px solid #222; border-radius:10px; padding:20px; margin:20px 0;">
                        <p style="color:#888; margin:0 0 8px;"><b style="color:#fff;">Oferta:</b> $${amount} USD</p>
                        <p style="color:#888; margin:0;"><b style="color:#fff;">Email del interesado:</b> ${email}</p>
                    </div>
                    <p style="color:#888; line-height:1.5;">Puedes aceptar, rechazar o enviar una contra-oferta desde tu panel de negociaciones.</p>
                    <a href="https://offszn.lat/cuenta/negociar" style="display:inline-block; background:#8B5CF6; color:#fff; padding:14px 30px; border-radius:10px; text-decoration:none; font-weight:700; margin-top:15px;">VER PROPUESTAS</a>
                    <hr style="border:0; border-top:1px solid #222; margin:25px 0;">
                    <p style="font-size:0.75rem; color:#555;">Este es un mensaje automático de OFFSZN. ¿Tienes algún problema? Responde a este correo.</p>
                </div>
            `,
        };

        // B. Email to Buyer
        const buyerMailOptions = {
            from: `"OFFSZN" <${EMAIL_USER}>`,
            to: email,
            subject: `Tu propuesta para "${productName}" ha sido enviada`,
            html: `
                <div style="font-family: 'Segoe UI', sans-serif; padding: 30px; background: #0a0a0a; border-radius: 12px; color: #fff; max-width: 600px;">

                    <h2 style="color: #8B5CF6;">¡Propuesta enviada!</h2>
                    <p style="color:#ccc; line-height:1.6;">Hemos enviado tu oferta de <b style="color:#fff;">$${amount} USD</b> por <b style="color:#fff;">${productName}</b> a ${producerName}.</p>
                    <p style="color:#888; line-height:1.5;">El productor revisará tu propuesta y recibirás un correo con la respuesta. Puedes ver el estado de tus propuestas en tu panel de negociaciones.</p>
                    <a href="https://offszn.lat/cuenta/negociar" style="display:inline-block; background:#8B5CF6; color:#fff; padding:14px 30px; border-radius:10px; text-decoration:none; font-weight:700; margin-top:15px;">VER MIS PROPUESTAS</a>
                    <hr style="border:0; border-top:1px solid #222; margin:25px 0;">
                    <p style="font-size:0.75rem; color:#555;">¿Tienes algún problema? Escríbenos a ${EMAIL_USER}</p>
                </div>
            `,
        };

        // Send both
        await Promise.all([
            transporter.sendMail(producerMailOptions),
            transporter.sendMail(buyerMailOptions)
        ]);

        // 5. Insert in-app notification for producer
        const truncatedProduct = truncateName(productName, 25);
        await supabase.from('notifications').insert([{
            user_id: producerId,
            type: 'negotiate_offer',
            message: `<strong>${email}</strong> mandó una oferta de <strong>$${parseFloat(amount).toFixed(2)}</strong> a tu producto <strong>"${truncatedProduct}"</strong>.`,
            data: { product_id: productId, amount: parseFloat(amount), buyer_email: email },
            read: false
        }]);

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
            .select('*, products(name, id, public_slug, product_type)')
            .eq('id', proposalId)
            .single();

        if (propError || !proposal) {
            console.error('[Negotiation] Proposal not found:', propError);
            return res.status(404).json({ error: 'Propuesta no encontrada' });
        }

        // 1.5. Fetch Producer Details
        const { data: producer, error: prodError } = await supabase
            .from('users')
            .select('nickname, payment_methods')
            .eq('id', proposal.producer_id)
            .single();

        const buyerEmail = proposal.email_offszn;
        const productName = proposal.products?.name || 'Producto';
        const producerName = producer?.nickname || 'Productor';
        const finalAmount = counterAmount || proposal.counter_amount || proposal.amount_offszn;

        // 1.6. Validate counter-offer is not same as original
        if (status === 'countered' && counterAmount) {
            const originalAmount = parseFloat(proposal.amount_offszn);
            const counterNum = parseFloat(counterAmount);
            if (counterNum === originalAmount) {
                return res.status(400).json({ error: 'La contra-oferta no puede ser igual al monto original.' });
            }
        }

        // 2. Setup Nodemailer
        const transporter = createTransporter();

        // 2.5. If accepted, generate purchase token
        let purchaseToken = null;
        if (status === 'accepted') {
            purchaseToken = crypto.randomUUID();
            await supabase
                .from('propuestas_offszn')
                .update({ purchase_token: purchaseToken })
                .eq('id', proposalId);
        }

        // 3. Build Email Content based on Status
        let subject = '';
        let html = '';

        if (status === 'accepted') {
            const purchaseUrl = `https://offszn.lat/cuenta/negociar`;
            subject = `✅ ¡Oferta aceptada! Tu propuesta para "${productName}" fue aprobada`;
            html = `
                <div style="font-family: 'Segoe UI', sans-serif; padding: 30px; background: #0a0a0a; border-radius: 12px; color: #fff; max-width: 600px;">

                    <h2 style="color: #10B981;">¡Buenas noticias!</h2>
                    <p style="color:#ccc; line-height:1.6;">El productor <b style="color:#fff;">${producerName}</b> ha aceptado tu oferta de <b style="color:#fff;">$${proposal.amount_offszn} USD</b> por <b style="color:#fff;">${productName}</b>.</p>
                    
                    <div style="background:#111; border:1px solid #10B981; border-radius:10px; padding:20px; margin:20px 0; text-align:center;">
                        <p style="color:#10B981; font-weight:800; font-size:1.1rem; margin:0 0 5px;">PRECIO ACORDADO</p>
                        <p style="color:#fff; font-size:2rem; font-weight:800; margin:0;">$${finalAmount} USD</p>
                        <p style="color:#888; font-size:0.8rem; margin-top:5px;">Exclusivo para tu cuenta</p>
                    </div>

                    <p style="color:#888; line-height:1.5;">Ya puedes comprar este producto al precio acordado desde tu panel de propuestas.</p>
                    
                    <a href="${purchaseUrl}" style="display:block; background:#10B981; color:#fff; padding:16px 30px; border-radius:10px; text-decoration:none; font-weight:800; margin-top:15px; text-align:center; font-size:1rem;">COMPRAR AHORA — $${finalAmount}</a>
                    
                    <hr style="border:0; border-top:1px solid #222; margin:25px 0;">
                    <p style="font-size:0.75rem; color:#555;">Este precio es exclusivo para tu cuenta y correo electrónico. ¿Tienes algún problema? Escríbenos a ${EMAIL_USER}</p>
                </div>
            `;
        } else if (status === 'rejected') {
            subject = `Aviso: Tu propuesta para "${productName}" no fue aceptada`;
            html = `
                <div style="font-family: 'Segoe UI', sans-serif; padding: 30px; background: #0a0a0a; border-radius: 12px; color: #fff; max-width: 600px;">

                    <h2 style="color: #EF4444;">Lo sentimos</h2>
                    <p style="color:#ccc; line-height:1.6;">Tu propuesta de <b style="color:#fff;">$${proposal.amount_offszn} USD</b> por <b style="color:#fff;">${productName}</b> no ha sido aceptada en esta ocasión.</p>
                    <p style="color:#888; line-height:1.5;">¡No te desanimes! Siempre puedes intentar con una oferta diferente o adquirir el producto a su precio regular.</p>
                    <hr style="border:0; border-top:1px solid #222; margin:25px 0;">
                    <p style="font-size:0.75rem; color:#555;">¿Tienes algún problema? Escríbenos a ${EMAIL_USER}</p>
                </div>
            `;
        } else if (status === 'countered') {
            subject = `⚡ Nueva contra-oferta de ${producerName} por "${productName}"`;
            html = `
                <div style="font-family: 'Segoe UI', sans-serif; padding: 30px; background: #0a0a0a; border-radius: 12px; color: #fff; max-width: 600px;">

                    <h2 style="color: #8B5CF6;">¡Tienes una contra-oferta!</h2>
                    <p style="color:#ccc; line-height:1.6;">El productor <b style="color:#fff;">${producerName}</b> te propone un nuevo precio de <b style="color:#fff;">$${counterAmount} USD</b> por <b style="color:#fff;">${productName}</b>.</p>
                    <div style="background:#111; border:1px solid #8B5CF6; border-radius:10px; padding:20px; margin:20px 0; text-align:center;">
                        <p style="color:#8B5CF6; font-weight:800; margin:0 0 5px;">CONTRA-OFERTA</p>
                        <p style="color:#fff; font-size:1.5rem; font-weight:800; margin:0;">$${counterAmount} USD</p>
                    </div>
                    <p style="color:#888; line-height:1.5;">Puedes aceptar esta contra-oferta o continuar la negociación desde tu panel.</p>
                    <a href="https://offszn.lat/cuenta/negociar" style="display:inline-block; background:#8B5CF6; color:#fff; padding:14px 30px; border-radius:10px; text-decoration:none; font-weight:700; margin-top:15px;">VER NEGOCIACIÓN</a>
                    <hr style="border:0; border-top:1px solid #222; margin:25px 0;">
                    <p style="font-size:0.75rem; color:#555;">¿Tienes algún problema? Escríbenos a ${EMAIL_USER}</p>
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
            console.log(`[Negotiation] Response email sent for status: ${status}`);
        }

        // 5. Insert in-app notification for buyer
        const truncatedProduct = truncateName(productName);
        // Find buyer user_id from email
        const { data: buyerUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', buyerEmail)
            .single();

        if (buyerUser?.id) {
            let notifMessage = '';
            const truncatedProduct = truncateName(productName, 25);
            const amountStr = `<strong>$${parseFloat(finalAmount).toFixed(2)}</strong>`;

            if (status === 'accepted') {
                notifMessage = `<strong>${producerName}</strong> aceptó tu oferta de ${amountStr} por <strong>"${truncatedProduct}"</strong>. ¡Ya puedes comprar!`;
            } else if (status === 'rejected') {
                notifMessage = `<strong>${producerName}</strong> rechazó tu oferta por <strong>"${truncatedProduct}"</strong>.`;
            } else if (status === 'countered') {
                notifMessage = `<strong>${producerName}</strong> te mandó una contraoferta de ${amountStr} por <strong>"${truncatedProduct}"</strong>.`;
            }

            if (notifMessage) {
                await supabase.from('notifications').insert([{
                    user_id: buyerUser.id,
                    type: status === 'accepted' ? 'negotiate_accepted' : status === 'rejected' ? 'negotiate_rejected' : 'negotiate_counter',
                    message: notifMessage,
                    data: { product_id: proposal.products?.id, proposal_id: proposalId, amount: parseFloat(finalAmount) },
                    read: false
                }]);
            }
        }

        return res.status(200).json({ success: true, message: 'Respuesta enviada correctamente.' });

    } catch (err) {
        console.error('[Negotiation] Error in respondNegotiation:', err);
        return res.status(500).json({ error: 'Error interno al procesar la respuesta.' });
    }
};

// ============================================
// PURCHASE TOKEN: Generate
// ============================================
export const generatePurchaseToken = async (req, res) => {
    const { proposalId } = req.body;
    const userId = req.user?.userId;
    const userEmail = req.user?.email;

    if (!proposalId) {
        return res.status(400).json({ error: 'Falta proposalId' });
    }

    try {
        // 1. Fetch proposal
        const { data: proposal, error } = await supabase
            .from('propuestas_offszn')
            .select('*, products(id, name, price_basic, image_url, public_slug, product_type)')
            .eq('id', proposalId)
            .single();

        if (error || !proposal) {
            return res.status(404).json({ error: 'Propuesta no encontrada' });
        }

        // 2. Validate ownership (email must match)
        if (proposal.email_offszn !== userEmail) {
            return res.status(403).json({ error: 'No tienes permisos para esta propuesta' });
        }

        // 3. Validate status
        if (proposal.status_offszn !== 'accepted') {
            return res.status(400).json({ error: 'Esta propuesta no ha sido aceptada' });
        }

        // 4. Reuse existing token or generate new one
        let token = proposal.purchase_token;
        if (!token) {
            token = crypto.randomUUID();
            await supabase
                .from('propuestas_offszn')
                .update({ purchase_token: token })
                .eq('id', proposalId);
        }

        const agreedPrice = proposal.counter_amount || proposal.amount_offszn;

        return res.status(200).json({
            success: true,
            token,
            productId: proposal.product_id,
            productName: proposal.products?.name,
            productImage: proposal.products?.image_url,
            productSlug: proposal.products?.public_slug,
            productType: proposal.products?.product_type,
            licenseName: proposal.selected_license || 'Standard',
            agreedPrice: parseFloat(agreedPrice),
            originalPrice: proposal.products?.price_basic
        });

    } catch (err) {
        console.error('[Negotiation] Error generating purchase token:', err);
        return res.status(500).json({ error: 'Error interno' });
    }
};

// ============================================
// PURCHASE TOKEN: Validate (for Checkout)
// ============================================
export const validatePurchaseToken = async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).json({ error: 'Falta token' });
    }

    try {
        const { data: proposal, error } = await supabase
            .from('propuestas_offszn')
            .select('*, products(id, name, price_basic, image_url, public_slug, product_type, producer_id)')
            .eq('purchase_token', token)
            .single();

        if (error || !proposal) {
            return res.status(404).json({ error: 'Token inválido o expirado' });
        }

        if (proposal.status_offszn !== 'accepted') {
            return res.status(400).json({ error: 'Esta propuesta ya no es válida' });
        }

        const agreedPrice = proposal.counter_amount || proposal.amount_offszn;

        // Fetch producer plan for commission display and paypal email for checkout
        const { data: profile } = await supabase
            .from('profiles')
            .select('plan')
            .eq('id', proposal.products?.producer_id)
            .single();

        const { data: producer } = await supabase
            .from('users')
            .select('payment_methods')
            .eq('id', proposal.products?.producer_id)
            .single();

        return res.status(200).json({
            valid: true,
            proposalId: proposal.id,
            productId: proposal.product_id,
            productName: proposal.products?.name,
            productImage: proposal.products?.image_url,
            productType: proposal.products?.product_type,
            producerId: proposal.products?.producer_id,
            licenseName: proposal.selected_license || 'Standard',
            agreedPrice: parseFloat(agreedPrice),
            originalPrice: proposal.products?.price_basic,
            buyerEmail: proposal.email_offszn,
            producerPlan: profile?.plan || 'free',
            producerPaypalEmail: producer?.payment_methods?.paypal || null
        });

    } catch (err) {
        console.error('[Negotiation] Error validating purchase token:', err);
        return res.status(500).json({ error: 'Error interno' });
    }
};

// ============================================
// REPORT: Producer reports an issue
// ============================================
export const reportIssue = async (req, res) => {
    const { proposalId, reason, description } = req.body;
    const userId = req.user?.userId;

    if (!proposalId || !reason) {
        return res.status(400).json({ error: 'Faltan datos (proposalId, reason)' });
    }

    try {
        // 1. Fetch proposal + producer info
        const { data: proposal, error } = await supabase
            .from('propuestas_offszn')
            .select('*, products(name)')
            .eq('id', proposalId)
            .single();

        if (error || !proposal) {
            return res.status(404).json({ error: 'Propuesta no encontrada' });
        }

        // Verify that the reporter is the producer
        if (proposal.producer_id !== userId) {
            return res.status(403).json({ error: 'No tienes permisos para reportar esta propuesta' });
        }

        const { data: producer } = await supabase
            .from('users')
            .select('nickname, payment_methods')
            .eq('id', userId)
            .single();

        const producerEmail = producer?.payment_methods?.paypal || producer?.payment_methods?.email;
        const productName = proposal.products?.name || 'Producto';
        const producerName = producer?.nickname || 'Productor';

        // 2. Send report email to OFFSZN Admin
        const transporter = createTransporter();

        const adminMail = {
            from: `"OFFSZN Reports" <${EMAIL_USER}>`,
            to: EMAIL_USER,
            subject: `⚠️ Reporte de Negociación — ${producerName}`,
            html: `
                <div style="font-family: 'Segoe UI', sans-serif; padding: 30px; background: #0a0a0a; border-radius: 12px; color: #fff; max-width: 600px;">
                    <h2 style="color: #EF4444;">⚠️ Reporte de Problema</h2>
                    <div style="background:#111; border:1px solid #333; border-radius:10px; padding:20px; margin:20px 0;">
                        <p style="color:#888; margin:5px 0;"><b style="color:#fff;">Productor:</b> ${producerName} (${producerEmail || 'N/A'})</p>
                        <p style="color:#888; margin:5px 0;"><b style="color:#fff;">Producto:</b> ${productName}</p>
                        <p style="color:#888; margin:5px 0;"><b style="color:#fff;">Propuesta ID:</b> ${proposalId}</p>
                        <p style="color:#888; margin:5px 0;"><b style="color:#fff;">Email del comprador:</b> ${proposal.email_offszn}</p>
                        <p style="color:#888; margin:5px 0;"><b style="color:#fff;">Monto ofrecido:</b> $${proposal.amount_offszn}</p>
                        <hr style="border:0; border-top:1px solid #333; margin:15px 0;">
                        <p style="color:#EF4444; margin:5px 0;"><b>Motivo:</b> ${reason}</p>
                        ${description ? `<p style="color:#ccc; margin:5px 0;"><b style="color:#fff;">Descripción:</b> ${description}</p>` : ''}
                    </div>
                </div>
            `,
        };

        // 3. Confirmation email to producer
        const producerConfirmation = {
            from: `"OFFSZN Soporte" <${EMAIL_USER}>`,
            to: producerEmail || EMAIL_USER,
            subject: `Hemos recibido tu reporte — "${productName}"`,
            html: `
                <div style="font-family: 'Segoe UI', sans-serif; padding: 30px; background: #0a0a0a; border-radius: 12px; color: #fff; max-width: 600px;">

                    <h2 style="color: #8B5CF6;">Hemos recibido tu reporte</h2>
                    <p style="color:#ccc; line-height:1.6;">Hola ${producerName}, hemos recibido tu reporte sobre la negociación del producto <b style="color:#fff;">${productName}</b>.</p>
                    <div style="background:#111; border:1px solid #222; border-radius:10px; padding:20px; margin:20px 0;">
                        <p style="color:#888; margin:5px 0;"><b style="color:#fff;">Motivo:</b> ${reason}</p>
                        ${description ? `<p style="color:#888; margin:5px 0;"><b style="color:#fff;">Descripción:</b> ${description}</p>` : ''}
                    </div>
                    <p style="color:#888; line-height:1.5;">Nuestro equipo revisará tu caso y te responderemos a este mismo correo en las próximas 24-48 horas.</p>
                    <hr style="border:0; border-top:1px solid #222; margin:25px 0;">
                    <p style="font-size:0.75rem; color:#555;">Si necesitas agregar más información, responde a este correo directamente.</p>
                </div>
            `,
        };

        await Promise.all([
            transporter.sendMail(adminMail),
            transporter.sendMail(producerConfirmation)
        ]);

        console.log(`[Negotiation] Report submitted by ${producerName} for proposal ${proposalId}`);
        return res.status(200).json({ success: true, message: 'Reporte enviado. Revisaremos tu caso pronto.' });

    } catch (err) {
        console.error('[Negotiation] Error in reportIssue:', err);
        return res.status(500).json({ error: 'Error interno al enviar el reporte.' });
    }
};
