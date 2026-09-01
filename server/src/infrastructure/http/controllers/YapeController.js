/**
 * YapeController.js
 * =================
 * Dedicated controller for Yape payments via Mercado Pago Perú.
 * Supports dynamic exchange rate (1 USD = 3.30 PEN), instant tokenization,
 * automated lifetime license generation (including Easy Mix + Easy Master 2x1 promo),
 * order recording in Supabase, and instant customer fulfillment.
 */

import fetch from 'node-fetch';
import { supabase } from '../../database/connection.js';
import { generatePluginLicense } from './PluginLicensingController.js';
import { sendOffsznEmail } from '../../../shared/utils/mailer.js';
import MetaCapiService from '../../services/MetaCapiService.js';

const PLUGIN_INFO_MAP = {
    '899': {
        name: 'Easy Mix',
        downloads: {
            win: 'https://drive.google.com/file/d/1wBErtaIXdj-CPObcaJV0fnomX9rzWVNu/view?usp=sharing',
            mac: 'https://drive.google.com/file/d/1OUMuGr4trI7M5J0JvaLc-4n5xaTyN17z/view?usp=sharing'
        }
    },
    '901': {
        name: 'Easy Mix',
        downloads: {
            win: 'https://drive.google.com/file/d/1wBErtaIXdj-CPObcaJV0fnomX9rzWVNu/view?usp=sharing',
            mac: 'https://drive.google.com/file/d/1OUMuGr4trI7M5J0JvaLc-4n5xaTyN17z/view?usp=sharing'
        }
    },
    '900': {
        name: 'Easy Master',
        downloads: {
            win: 'https://drive.google.com/file/d/1JF4oDN_beOOxnOO5ca3TLGDCEQyOeWjh/view',
            mac: 'https://drive.google.com/file/d/14Lc6-vOtEYgw7IbQcpBe7h2kIiGTrP6Q/view?usp=sharing'
        }
    },
    '902': {
        name: 'Inka Kola',
        downloads: {
            win: '/installer_output/INKA_KOLA_Setup.exe',
            mac: 'https://drive.google.com/file/d/14Lc6-vOtEYgw7IbQcpBe7h2kIiGTrP6Q/view?usp=sharing'
        }
    },
    '903': {
        name: 'Coca-Cola',
        downloads: {
            win: '/downloads/OFFSZN_COCA_COLA_Setup.exe',
            mac: 'https://drive.google.com/file/d/1741Z3uG8amQ5boK1il5Ffj136sW2WHPY/view?usp=sharing'
        }
    }
};

/**
 * GET /api/orders/yape/config
 * Exposes Public Key and fixed exchange rate to frontend.
 */
export const getYapeConfig = async (req, res) => {
    try {
        const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY || '';
        const exchangeRate = parseFloat(process.env.YAPE_EXCHANGE_RATE_PEN) || 3.30;

        return res.json({
            success: true,
            publicKey,
            exchangeRate,
            currency: 'PEN'
        });
    } catch (error) {
        console.error('[YapeConfig] Error:', error);
        return res.status(500).json({ error: 'Error obteniendo configuración de Yape' });
    }
};

/**
 * POST /api/orders/yape/charge
 * Processes the Yape charge via Mercado Pago Peru API.
 */
export const chargeYape = async (req, res) => {
    try {
        const { token, email, phoneNumber, productId = 899, customPrice, attribution = {} } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Falta el token de autorización de Yape.' });
        }

        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Por favor ingresa un correo electrónico válido.' });
        }

        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!accessToken) {
            console.error('[YapeCharge] Error: MERCADOPAGO_ACCESS_TOKEN not set.');
            return res.status(500).json({ error: 'Pasarela de Mercado Pago no configurada en el servidor.' });
        }

        const exchangeRate = parseFloat(process.env.YAPE_EXCHANGE_RATE_PEN) || 3.30;
        const validUsdPrice = parseFloat(customPrice) || 10;
        const amountPEN = Number((validUsdPrice * exchangeRate).toFixed(2));

        const strProdId = String(productId);
        const prodInfo = PLUGIN_INFO_MAP[strProdId] || PLUGIN_INFO_MAP['899'];
        const pluginName = prodInfo.name;

        console.log(`[YapeCharge] Initiating charge: S/. ${amountPEN} PEN ($${validUsdPrice} USD @ T.C. ${exchangeRate}) for ${email} (${pluginName})`);

        // 1. Call Mercado Pago Payments API
        const mpPayload = {
            token,
            transaction_amount: amountPEN,
            description: `OFFSZN - ${pluginName} VST (Licencia Vitalicia)`,
            payment_method_id: 'yape',
            payer: {
                email: email.trim().toLowerCase()
            },
            metadata: {
                product_id: parseInt(productId, 10),
                plugin_name: pluginName,
                usd_price: validUsdPrice,
                exchange_rate: exchangeRate,
                phone_number: phoneNumber || null
            }
        };

        const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': `yape-${Date.now()}-${Math.random().toString(36).substring(7)}`
            },
            body: JSON.stringify(mpPayload)
        });

        const mpData = await mpRes.json();

        if (!mpRes.ok || mpData.status !== 'approved') {
            console.error('[YapeCharge] Payment failed or rejected by Mercado Pago:', JSON.stringify(mpData, null, 2));

            let friendlyMessage = 'No se pudo completar el pago con Yape. Verifica los datos ingresados.';
            if (mpData.status_detail === 'cc_rejected_bad_filled_security_code' || mpData.status_detail === 'bad_filled_security_code') {
                friendlyMessage = 'El código de aprobación de Yape es incorrecto o ha expirado. Genera uno nuevo en tu app de Yape e inténtalo de nuevo.';
            } else if (mpData.status_detail === 'cc_rejected_insufficient_amount') {
                friendlyMessage = 'Saldo insuficiente en tu cuenta de Yape.';
            } else if (mpData.status_detail === 'cc_rejected_call_for_authorize') {
                friendlyMessage = 'La transacción no fue autorizada por el banco. Por favor verifica tu app de Yape.';
            } else if (mpData.message) {
                friendlyMessage = `Mercado Pago: ${mpData.message}`;
            }

            return res.status(400).json({
                error: friendlyMessage,
                status: mpData.status,
                status_detail: mpData.status_detail
            });
        }

        console.log(`✅ [YapeCharge] Payment APPROVED! MP Payment ID: ${mpData.id}`);

        // 2. Generate Primary Lifetime License
        let serialKey = null;
        let bonusKey = null;

        try {
            const licResult = await generatePluginLicense({
                licenseType: 'lifetime',
                userEmail: email,
                userId: null,
                pluginName: pluginName
            });
            serialKey = licResult?.serialKey;
            console.log(`[YapeCharge] Generated Lifetime License for ${pluginName}: ${serialKey}`);
        } catch (licErr) {
            console.error('[YapeCharge] Error generating main license:', licErr);
        }

        // 3. Trigger 2x1 Promo for Easy Mix -> Easy Master bonus
        const isEasyMix = (pluginName === 'Easy Mix' || strProdId === '899' || strProdId === '901');
        if (isEasyMix) {
            try {
                console.log(`[YapeCharge] 2x1 Promo triggered! Generating free Easy Master for ${email}`);
                const bonusResult = await generatePluginLicense({
                    licenseType: 'lifetime',
                    userEmail: email,
                    userId: null,
                    pluginName: 'Easy Master'
                });
                bonusKey = bonusResult?.serialKey;
                console.log(`[YapeCharge] Generated Bonus License (Easy Master): ${bonusKey}`);
            } catch (bonusErr) {
                console.error('[YapeCharge] Error generating bonus license:', bonusErr);
            }
        }

        // 4. Record Order in Supabase
        let orderId = null;
        try {
            const { data: orderData, error: orderErr } = await supabase.from('orders').insert({
                user_id: null,
                total_price: validUsdPrice,
                amount: validUsdPrice,
                status: 'completed',
                guest_email: email,
                product_id: parseInt(productId, 10),
                payment_method: 'mercadopago_yape',
                transaction_id: `MP-YAPE-${mpData.id}`
            }).select('id').single();

            if (orderErr) {
                console.error('[YapeCharge] Supabase order insert error:', orderErr);
            } else {
                orderId = orderData?.id;
            }
        } catch (dbErr) {
            console.error('[YapeCharge] DB insert exception:', dbErr);
        }

        // 5. Track Meta Conversions API (CAPI)
        try {
            await MetaCapiService.sendEvent({
                eventName: 'Purchase',
                eventSourceUrl: req.headers.referer || 'https://offszn.lat/plugins/easy-mix',
                userData: {
                    email: email,
                    phone: phoneNumber,
                    fbc: attribution.fbc,
                    fbp: attribution.fbp,
                    ip: req.ip || req.headers['x-forwarded-for'],
                    userAgent: req.headers['user-agent']
                },
                customData: {
                    currency: 'USD',
                    value: validUsdPrice,
                    content_name: pluginName,
                    content_type: 'product',
                    content_ids: [pluginName.toLowerCase().replace(/\s+/g, '_')],
                    order_id: String(orderId || mpData.id)
                }
            });
        } catch (capiErr) {
            console.warn('[YapeCharge] Meta CAPI tracking warning:', capiErr?.message);
        }

        // 6. Send Rich Email with Licenses and Download Links
        (async () => {
            try {
                const keysHtml = `
                    <div style="background:#13111C; border:1px solid #742284; border-radius:12px; padding:20px; margin:20px 0; text-align:center;">
                        <p style="color:#a855f7; font-size:0.8rem; text-transform:uppercase; letter-spacing:2px; margin:0 0 8px; font-weight:700;">🔑 Licencia Vitalicia ${pluginName}</p>
                        <p style="font-family:monospace; font-size:1.35rem; font-weight:800; color:#ffffff; letter-spacing:2px; margin:0; word-break:break-all;">${serialKey || 'Activo en tu cuenta'}</p>
                        ${bonusKey ? `
                            <div style="margin-top:16px; padding-top:16px; border-top:1px dashed rgba(255,255,255,0.15);">
                                <p style="color:#ec4899; font-size:0.8rem; text-transform:uppercase; letter-spacing:2px; margin:0 0 8px; font-weight:700;">🎁 REGALO 2X1: Licencia Vitalicia Easy Master</p>
                                <p style="font-family:monospace; font-size:1.35rem; font-weight:800; color:#ffffff; letter-spacing:2px; margin:0; word-break:break-all;">${bonusKey}</p>
                            </div>
                        ` : ''}
                    </div>
                `;

                await sendOffsznEmail({
                    to: email,
                    subject: `🎉 ¡Tu compra de ${pluginName} con Yape está confirmada!`,
                    html: `
                        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; max-width:600px; margin:0 auto; background:#0a0a0a; color:#fff; padding:32px; border-radius:16px; border:1px solid #222;">
                            <div style="text-align:center; margin-bottom:24px;">
                                <h1 style="color:#fff; font-size:1.6rem; margin:0 0 6px; font-weight:800;">¡Pago con Yape Confirmado! 🇵🇪</h1>
                                <p style="color:#a1a1aa; font-size:0.95rem; margin:0;">Gracias por tu compra en OFFSZN.</p>
                            </div>
                            
                            ${keysHtml}

                            <div style="background:#18181b; border-radius:12px; padding:20px; margin:24px 0;">
                                <p style="color:#fff; font-size:0.9rem; font-weight:700; margin:0 0 12px;">📥 Descarga tus instaladores:</p>
                                <div style="display:flex; gap:10px;">
                                    <a href="${prodInfo.downloads.win}" style="display:inline-block; background:#742284; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:700; font-size:0.9rem; margin-right:8px;">Descargar para Windows</a>
                                    <a href="${prodInfo.downloads.mac}" style="display:inline-block; background:#27272a; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:700; font-size:0.9rem;">Descargar para Mac</a>
                                </div>
                            </div>

                            <p style="color:#71717a; font-size:0.78rem; text-align:center; margin:24px 0 0;">
                                OFFSZN • Soporte directo vía Instagram @offszn.lat o WhatsApp
                            </p>
                        </div>
                    `
                });
                console.log(`[YapeCharge] Confirmation email sent successfully to ${email}`);
            } catch (emailErr) {
                console.error('[YapeCharge] Error sending confirmation email:', emailErr);
            }
        })();

        // 7. Response to Frontend
        return res.json({
            success: true,
            status: 'approved',
            paymentId: mpData.id,
            orderId: orderId,
            pluginName: pluginName,
            amountPEN: amountPEN,
            serialKey: serialKey,
            bonusKey: bonusKey,
            downloads: prodInfo.downloads
        });

    } catch (error) {
        console.error('[YapeCharge] Critical unexpected error:', error);
        return res.status(500).json({ error: error.message || 'Error interno al procesar el pago con Yape.' });
    }
};
