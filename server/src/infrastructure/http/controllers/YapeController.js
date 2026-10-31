/**
 * YapeController.js
 * =================
 * Dedicated controller for Yape payments via Mercado Pago Perú.
 * Supports dynamic exchange rate (1 USD = 3.30 PEN), instant tokenization,
 * automated lifetime license generation (including Easy Mix + Easy Master 2x1 promo),
 * order recording in Supabase, and instant customer fulfillment.
 */

// Uses globalThis.fetch available in Node 18+
import { supabase } from '../../database/connection.js';
import { generatePluginLicense } from './PluginLicensingController.js';
import { PLUGINS } from '../../../shared/config/pluginRegistry.js';
import { sendOffsznEmail } from '../../../shared/utils/mailer.js';
import MetaCapiService from '../../services/MetaCapiService.js';
import { getStarCouponPercent } from '../../services/starSubscriptionService.js';
import { starPrice, STAR_PRODUCT_ID } from '../../../shared/store/starPlan.js';
import { resolveYapePrice } from '../../../shared/store/yapePricing.js';

const PLUGIN_INFO_MAP = {
    '899': {
        name: 'Easy Mix',
        downloads: {
            win: 'https://drive.google.com/file/d/1FXEF4CsSlClVKTZ8lzfq7027-4Pa-Jh1/view?usp=sharing',
            mac: 'https://drive.google.com/file/d/1Wd_NgGsuc_FG6kjQOTjnF0qIodnK-iO4/view?usp=sharing'
        }
    },
    '901': {
        name: 'Easy Mix',
        downloads: {
            win: 'https://drive.google.com/file/d/1FXEF4CsSlClVKTZ8lzfq7027-4Pa-Jh1/view?usp=sharing',
            mac: 'https://drive.google.com/file/d/1Wd_NgGsuc_FG6kjQOTjnF0qIodnK-iO4/view?usp=sharing'
        }
    },
    '900': {
        name: 'Easy Master',
        downloads: {
            win: 'https://drive.google.com/file/d/1JF4oDN_beOOxnOO5ca3TLGDCEQyOeWjh/view?usp=sharing',
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
    },
    '5000': {
        name: 'Easy Pitch',
        downloads: {
            win: 'https://drive.google.com/file/d/1K58LeAnNJKUVJVKZ6kmm_xI8R9XHyQ0C/view?usp=sharing',
            mac: 'https://drive.google.com/file/d/1Say1PQ7AqdpI_10k5IT8hqgeGvpptRNW/view?usp=sharing'
        }
    },
    '905': {
        name: 'Vocal Preset',
        downloads: {
            win: 'https://drive.google.com/file/d/11Zw_4w-vWUjq3b2bImlyQjO2rzXitqLO/view?usp=sharing',
            mac: 'https://drive.google.com/file/d/1laJdmvnab56pDSN0iAIDZXmxNwAFnh03/view?usp=sharing'
        }
    },
    '5003': {
        name: 'STAR CHAIN',
        downloads: {
            win: process.env.STAR_DOWNLOAD_URL || 'https://offszn.lat/mis-compras',
            mac: '#'
        }
    },
    '5001': {
        name: 'Omni Plugin',
        downloads: {
            win: 'https://drive.google.com/file/d/179OVCmWJowkrDiwSeFpC3lqPR7Qn_1Zk/view?usp=sharing',
            mac: 'https://drive.google.com/file/d/1suMJLf1y-Y06NuLetNGojvHXBt8yzz4D/view?usp=sharing'
        }
    },
    '5002': {
        name: 'Cassette',
        downloads: {
            win: 'https://wa.me/51952467395?text=Hola,%20acabo%20de%20comprar%20Cassette%20por%20Yape%20y%20quiero%20el%20instalador',
            mac: '#'
        }
    },
    'cassette': {
        name: 'Cassette',
        downloads: {
            win: 'https://wa.me/51952467395?text=Hola,%20acabo%20de%20comprar%20Cassette%20por%20Yape%20y%20quiero%20el%20instalador',
            mac: '#'
        }
    }
};

// OFFSZN Widget: se registra con los IDs de WIDGET_PRODUCT_IDS (registro central). Sin esto, un ID de producto
// desconocido cae al mapa de Easy Mix y se emitiría la licencia equivocada.
const WIDGET_PLUGIN = PLUGINS.find((p) => p.id === 'offszn-widget');
for (const id of WIDGET_PLUGIN?.productIds || []) {
    PLUGIN_INFO_MAP[String(id)] = {
        name: 'OFFSZN Widget',
        downloads: {
            win: process.env.WIDGET_DOWNLOAD_URL || 'https://offszn.lat/mis-compras',
            mac: '#'
        }
    };
}

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
        const isPromo2x1 = Boolean(req.body.isPromo2x1 || req.body.is_promo_2x1 || String(productId) === 'promo-2x1' || (req.body.pluginName || '').toLowerCase().includes('2x1'));
        const strProdId = String(productId || '');

        // El monto lo decide el servidor: lo que mande el navegador (customPrice / customPricePEN) solo se acepta si es un precio
        // que esa página de plugin puede asignar, y los soles salen de la tabla oficial, nunca del cliente.
        let validUsdPrice;
        let amountPEN;
        if (strProdId === String(STAR_PRODUCT_ID)) {
            // STAR CHAIN (5003): 49 US$ / S/ 185, menos el cupón si es válido.
            const price = starPrice(await getStarCouponPercent(req.body.couponCode));
            validUsdPrice = price.usd;
            amountPEN = price.pen;
        } else {
            const price = resolveYapePrice({ productId: strProdId, isPromo2x1, customPrice, widgetIds: WIDGET_PLUGIN?.productIds || [] });
            if (!price.ok) {
                console.warn(`[YapeCharge] Precio rechazado: producto=${strProdId} customPrice=${customPrice} promo=${isPromo2x1}`);
                return res.status(400).json({ error: price.error });
            }
            validUsdPrice = price.usd;
            amountPEN = price.pen;
        }
        const prodInfo = PLUGIN_INFO_MAP[strProdId] || ((req.body.pluginName || '').toLowerCase().includes('cassette') ? PLUGIN_INFO_MAP['5002'] : null) || (strProdId === 'promo-2x1' ? PLUGIN_INFO_MAP['899'] : (productId ? PLUGIN_INFO_MAP['899'] : null));
        const pluginName = prodInfo ? (isPromo2x1 ? 'Promo 2x1 (Easy Mix + Easy Master)' : prodInfo.name) : (req.body.pluginName || 'Presets');

        console.log(`[YapeCharge] Initiating charge: S/. ${amountPEN} PEN ($${validUsdPrice} USD @ T.C. ${exchangeRate}) for ${email} (${pluginName}) | 2x1: ${isPromo2x1}`);

        const cleanPhone = (phoneNumber || '').trim().replace(/\D/g, '');
        const externalReference = `OFFSZN-YAPE-${productId || '899'}-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        // 1. Call Mercado Pago Payments API with full integration quality fields
        const mpPayload = {
            token,
            transaction_amount: amountPEN,
            installments: 1,
            description: prodInfo ? `OFFSZN - ${pluginName} (Licencia Vitalicia)` : `OFFSZN - ${pluginName}`,
            payment_method_id: 'yape',
            external_reference: externalReference,
            notification_url: 'https://offszn.lat/api/orders/mercadopago-webhook',
            statement_descriptor: 'OFFSZN',
            payer: {
                email: email.trim().toLowerCase(),
                ...(cleanPhone ? {
                    phone: {
                        area_code: '51',
                        number: cleanPhone
                    }
                } : {})
            },
            additional_info: {
                items: [
                    {
                        id: String(productId || '899'),
                        title: `OFFSZN - ${pluginName}`,
                        description: `Licencia vitalicia oficial de ${pluginName} para producción musical - OFFSZN`,
                        category_id: 'software',
                        quantity: 1,
                        unit_price: amountPEN
                    }
                ],
                ...(cleanPhone ? {
                    payer: {
                        phone: {
                            area_code: '51',
                            number: cleanPhone
                        }
                    }
                } : {})
            },
            metadata: {
                product_id: productId ? parseInt(productId, 10) || null : null,
                plugin_name: pluginName,
                is_promo_2x1: isPromo2x1,
                usd_price: validUsdPrice,
                exchange_rate: exchangeRate,
                phone_number: phoneNumber || null,
                external_reference: externalReference
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
            const mpHeaders = {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': `yape-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                'User-Agent': 'MercadoPago Node.js SDK/2.10.0'
            };

            if (req.body.deviceId) {
                mpHeaders['X-Meli-Session-Id'] = req.body.deviceId;
            }

            const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: mpHeaders,
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
                console.error('[YapeCharge] Supabase order insert error, attempting fallback with null product_id:', orderErr.message);
                const retry = await supabase.from('orders').insert({
                    user_id: null,
                    total_price: validUsdPrice,
                    amount: validUsdPrice,
                    status: 'completed',
                    guest_email: email,
                    product_id: null,
                    transaction_id: `MP-YAPE-${mpData.id}`
                }).select('id').single();
                if (!retry.error) {
                    orderId = retry.data?.id;
                }
            } else {
                orderId = orderData?.id;
            }
            if (orderId && parsedProductId) {
                await supabase.from('order_items').insert({
                    order_id: orderId,
                    product_id: parsedProductId,
                    price_at_purchase: validUsdPrice,
                    quantity: 1,
                    license_name: 'lifetime'
                });
                const { data: soldProd } = await supabase.from('products').select('sales_count').eq('id', parsedProductId).maybeSingle();
                if (soldProd) await supabase.from('products').update({ sales_count: (soldProd.sales_count || 0) + 1 }).eq('id', parsedProductId);
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

        // 4b. Notify Platform Owner (Willie / OFFSZN Admin)
        (async () => {
            try {
                const WILLIE_ADMIN_EMAIL = 'willie2008garay@gmail.com';
                const incomingAffiliate = (req.body.affiliate || '').toString().trim().toLowerCase();
                let affiliateInfo = null;

                if (incomingAffiliate) {
                    let commUSD = 0;
                    if (validUsdPrice >= 15) commUSD = 5.00;
                    else if (validUsdPrice >= 10) commUSD = 2.00;
                    else commUSD = Math.round(validUsdPrice * 0.20 * 100) / 100;

                    const netUSD = Math.max(0, validUsdPrice - commUSD);
                    affiliateInfo = {
                        name: incomingAffiliate.toUpperCase(),
                        commission: commUSD,
                        net: netUSD
                    };
                }

                const referralBanner = affiliateInfo ? `
                    <div style="background:#1e1b4b; border:1px solid #6366f1; border-radius:10px; padding:18px; margin:0 0 20px;">
                        <p style="color:#a5b4fc; font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; margin:0 0 6px; font-weight:700;">🎯 VENTA POR REFERIDO (YAPE)</p>
                        <p style="color:#ffffff; font-size:1.1rem; margin:0 0 10px;">Afiliado: <b style="color:#38bdf8;">${affiliateInfo.name}</b></p>
                        <div style="display:flex; gap:20px; font-size:0.95rem;">
                            <div><span style="color:#94a3b8;">Pagar a ${affiliateInfo.name}:</span> <b style="color:#f43f5e; font-size:1.1rem;">$${affiliateInfo.commission.toFixed(2)} USD</b></div>
                            <div><span style="color:#94a3b8;">Tu Neto (Willie):</span> <b style="color:#10B981; font-size:1.1rem;">$${affiliateInfo.net.toFixed(2)} USD</b></div>
                        </div>
                    </div>
                ` : '';

                const emailSubject = affiliateInfo 
                    ? `💜 [MARKETPLACE · YAPE · PLUGIN] ${pluginName} [REFERIDO: ${affiliateInfo.name}] — S/. ${amountPEN} (~$${validUsdPrice} USD)`
                    : `💜 [MARKETPLACE · YAPE · PLUGIN] ${pluginName} — S/. ${amountPEN} (~$${validUsdPrice} USD)`;

                const adminHtml = `
                    <div style="font-family: 'Segoe UI', sans-serif; padding: 30px; background: #0a0a0a; border-radius: 12px; color: #fff; max-width: 600px; border: 1px solid rgba(255,255,255,0.08);">
                        <h2 style="color: #a855f7; margin-bottom:16px;">¡Cobro Yape Exitoso en OFFSZN! ⚡</h2>
                        ${referralBanner}
                        <p style="color:#ccc; line-height:1.6;">El cliente <b>${email}</b> (Tel: <b>${phoneNumber}</b>) compró <b style="color:#fff;">${pluginName}</b> por Yape.</p>
                        <div style="background:#111827; border:1px solid #1f2937; border-radius:10px; padding:20px; margin:20px 0;">
                            <p style="color:#888; margin:0 0 8px;"><b style="color:#fff;">Monto Cobrado:</b> <span style="color:#fff; font-weight:700;">S/. ${amountPEN} (~$${validUsdPrice} USD)</span></p>
                            <p style="color:#888; margin:0 0 8px;"><b style="color:#fff;">ID Mercado Pago:</b> <span style="color:#fff; font-family:monospace;">${mpData.id}</span></p>
                            ${serialKey ? `<p style="color:#888; margin:0;"><b style="color:#ff9f0a;">Serial Key Oficial:</b> <span style="font-family:monospace; color:#fff;">${serialKey}</span></p>` : ''}
                        </div>
                        <a href="https://offszn.lat/admin" style="display:inline-block; background:#8B5CF6; color:#fff; padding:12px 26px; border-radius:8px; text-decoration:none; font-weight:700;">PANEL DE CONTROL</a>
                    </div>
                `;

                await sendOffsznEmail({
                    to: WILLIE_ADMIN_EMAIL,
                    subject: emailSubject,
                    html: adminHtml,
                    fromName: 'OFFSZN Ventas'
                });
            } catch (notifyErr) {
                console.error('[YapeCharge] Error notifying Willie admin:', notifyErr);
            }
        })();

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
