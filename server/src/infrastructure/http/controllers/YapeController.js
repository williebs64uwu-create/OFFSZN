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
        const amountPEN = req.body.customPricePEN ? Number(parseFloat(req.body.customPricePEN).toFixed(2)) : Number((validUsdPrice * exchangeRate).toFixed(2));

        const isPromo2x1 = Boolean(req.body.isPromo2x1 || req.body.is_promo_2x1 || String(productId) === 'promo-2x1' || (req.body.pluginName || '').toLowerCase().includes('2x1'));
        const strProdId = String(productId || '');
        const prodInfo = PLUGIN_INFO_MAP[strProdId] || (strProdId === 'promo-2x1' ? PLUGIN_INFO_MAP['899'] : (productId ? PLUGIN_INFO_MAP['899'] : null));
        const pluginName = prodInfo ? (isPromo2x1 ? 'Promo 2x1 (Easy Mix + Easy Master)' : prodInfo.name) : (req.body.pluginName || 'Presets');

        console.log(`[YapeCharge] Initiating charge: S/. ${amountPEN} PEN ($${validUsdPrice} USD @ T.C. ${exchangeRate}) for ${email} (${pluginName}) | 2x1: ${isPromo2x1}`);

        // 1. Call Mercado Pago Payments API
        const mpPayload = {
            token,
            transaction_amount: amountPEN,
            installments: 1,
            description: prodInfo ? `OFFSZN - ${pluginName} (Licencia Vitalicia)` : `OFFSZN - ${pluginName}`,
            payment_method_id: 'yape',
            payer: {
                email: email.trim().toLowerCase()
            },
            metadata: {
                product_id: productId ? parseInt(productId, 10) || null : null,
                plugin_name: pluginName,
                is_promo_2x1: isPromo2x1,
                usd_price: validUsdPrice,
                exchange_rate: exchangeRate,
                phone_number: phoneNumber || null
            }
        };

        let mpData;
        
        // If it's a sandbox simulation test token
        if (token.startsWith('TEST_YAPE_') && accessToken.startsWith('TEST-')) {
            console.log(`🧪 [YapeCharge] Running in Sandbox Simulation Mode for test token: ${token}`);
            mpData = {
                id: `TEST_MP_${Date.now()}`,
                status: 'approved',
                status_detail: 'accredited',
                transaction_amount: amountPEN
            };
        } else {
            const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': `yape-${Date.now()}-${Math.random().toString(36).substring(7)}`
                },
                body: JSON.stringify(mpPayload)
            });

            mpData = await mpRes.json();

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
        }

        console.log(`✅ [YapeCharge] Payment APPROVED! MP Payment ID: ${mpData.id}`);

        // 2. Generate Plugin Licenses (if applicable)
        let serialKey = null;
        let bonusSerialKey = null;

        if (prodInfo) {
            try {
                const primaryPluginToGen = (pluginName.includes('Promo 2x1') || isPromo2x1) ? 'Easy Mix' : prodInfo.name;
                const licResult = await generatePluginLicense({
                    licenseType: 'lifetime',
                    userEmail: email,
                    userId: null,
                    pluginName: primaryPluginToGen
                });
                serialKey = licResult?.serialKey;
                console.log(`[YapeCharge] Generated Lifetime License for ${primaryPluginToGen}: ${serialKey}`);

                // --- 2x1 PROMO: Únicamente si es compra explícita de Promo 2x1 ---
                if (isPromo2x1 && primaryPluginToGen === 'Easy Mix') {
                    console.log(`[YapeCharge] 2x1 Promo triggered! Generating free Easy Master for ${email}`);
                    const bonusResult = await generatePluginLicense({
                        licenseType: 'lifetime',
                        userEmail: email,
                        userId: null,
                        pluginName: 'Easy Master'
                    });
                    bonusSerialKey = bonusResult?.serialKey;
                }
            } catch (licErr) {
                console.error('[YapeCharge] Error generating license:', licErr);
            }
        }

        // 3. Record Order in Supabase
        let orderId = null;
        try {
            const parsedProductId = productId ? parseInt(productId, 10) || null : null;
            const { data: orderData, error: orderErr } = await supabase.from('orders').insert({
                user_id: null,
                total_price: validUsdPrice,
                amount: validUsdPrice,
                status: 'completed',
                guest_email: email,
                product_id: parsedProductId,
                transaction_id: `MP-YAPE-${mpData.id}`
            }).select('id').single();

            if (orderErr) {
                console.error('[YapeCharge] Supabase order insert error:', orderErr);
            } else {
                orderId = orderData?.id;
                if (orderId && parsedProductId) {
                    await supabase.from('order_items').insert({
                        order_id: orderId,
                        product_id: parsedProductId,
                        price_at_purchase: validUsdPrice,
                        quantity: 1,
                        license_name: 'lifetime'
                    });
                }
            }
        } catch (dbErr) {
            console.error('[YapeCharge] DB insert exception:', dbErr);
        }

        // 4. Track Meta Conversions API (CAPI)
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

        // 5. Response to Frontend
        return res.json({
            success: true,
            status: 'approved',
            paymentId: mpData.id,
            orderId: orderId,
            pluginName: pluginName,
            isPromo2x1: isPromo2x1,
            amountPEN: amountPEN,
            serialKey: serialKey,
            bonusSerialKey: bonusSerialKey,
            downloads: prodInfo ? prodInfo.downloads : null
        });

    } catch (error) {
        console.error('[YapeCharge] Critical unexpected error:', error);
        return res.status(500).json({ error: error.message || 'Error interno al procesar el pago con Yape.' });
    }
};
