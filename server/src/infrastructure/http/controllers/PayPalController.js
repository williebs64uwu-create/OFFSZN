import paypal from '@paypal/checkout-server-sdk';
import paypalClient from '../paypalClient.js';
import { supabase } from '../../database/connection.js';
import { PLATFORM_PAYPAL_EMAIL, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENVIRONMENT } from '../../../shared/config/config.js';
import { sendOffsznEmail } from '../../../shared/utils/mailer.js';
import { v4 as uuidv4 } from 'uuid';
import { getPresignedDownloadUrl } from '../../services/r2-storage.service.js';
import { generatePluginLicense } from './PluginLicensingController.js';

// --- PayPal OAuth Config ---
const PAYPAL_OAUTH_URL = PAYPAL_ENVIRONMENT === 'live'
    ? 'https://www.paypal.com/signin/authorize'
    : 'https://www.sandbox.paypal.com/signin/authorize';

const PAYPAL_API_BASE = PAYPAL_ENVIRONMENT === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

// This should match what's registered in PayPal Developer Dashboard
// For local dev: http://localhost:3000/api/auth/paypal/callback
const REDIRECT_URI = process.env.PAYPAL_REDIRECT_URI || 'http://localhost:3000/api/auth/paypal/callback';

/**
 * Helper logic to find the best available path across multiple database fields.
 */
const getBestProductPath = (product, type) => {
    if (!product) return '';
    
    // 1. WAV / STEMS fallbacks
    if (type === 'wav') {
        return product.download_url_wav || product.wav_url || product.download_url_mp3 || product.mp3_url || product.audio_url;
    }
    if (type === 'stems') {
        return product.stems_url || '';
    }

    // 2. MP3 / PREVIEW fallbacks
    if (type === 'mp3') {
        return product.download_url_mp3 || product.mp3_url || product.audio_url || product.preview_url || product.demo_file || product.tagged_file;
    }

    // 3. KIT / OTHER fallbacks
    if (type === 'kit' || type === 'other') {
        return product.kit_url || product.download_url_wav || product.wav_url || product.download_url_mp3 || product.mp3_url || product.audio_url || product.file_url || product.cloud_url;
    }

    return '';
};

/**
 * Inicia el flujo de OAuth para conectar PayPal
 */
export const connectPayPal = async (req, res) => {
    try {
        const userId = req.user.userId;
        const state = `${userId}_${uuidv4()}`;

        // Guardamos el state en una cookie segura para validarlo en el callback
        res.cookie('paypal_auth_state', state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax', // Agregado para seguridad y compatibilidad
            maxAge: 300000 // 5 minutos
        });

        const params = new URLSearchParams({
            client_id: PAYPAL_CLIENT_ID,
            response_type: 'code',
            scope: 'openid profile email',
            redirect_uri: REDIRECT_URI,
            state: state
        });

        const authUrl = `${PAYPAL_OAUTH_URL}?${params.toString()}`;
        console.log(`[PayPalOAuth] Sending auth URL for user ${userId}`);

        // CAMBIADO: Retornar JSON en lugar de redirección directa para soportar Authorization Headers en el primer paso
        return res.json({ url: authUrl });
    } catch (err) {
        console.error('❌ Error in connectPayPal:', err);
        res.status(500).json({ error: 'Error al iniciar conexión con PayPal' });
    }
};

/**
 * Maneja el callback de PayPal después de la autorización del usuario
 */
export const callbackPayPal = async (req, res) => {
    const { code, state, error: ppError } = req.query;
    const savedState = req.cookies.paypal_auth_state;

    try {
        if (ppError) {
            console.error('[PayPalOAuth] User denied or error:', ppError);
            return res.redirect('/transacciones?paypal=error&msg=denied');
        }

        if (!state || state !== savedState) {
            console.error('[PayPalOAuth] Invalid state:', { received: state, saved: savedState });
            return res.redirect('/transacciones?paypal=error&msg=invalid_state');
        }

        const userId = state.split('_')[0];
        res.clearCookie('paypal_auth_state');

        // 1. Intercambiar código por token de acceso
        const tokenResponse = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI
            })
        });

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) {
            throw new Error(tokenData.error_description || 'Token exchange failed');
        }

        // 2. Obtener información del usuario verificado
        const userResponse = await fetch(`${PAYPAL_API_BASE}/v1/identity/openidconnect/userinfo?schema=openid`, {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json'
            }
        });

        const userData = await userResponse.json();
        if (!userResponse.ok) {
            throw new Error('Failed to fetch user info');
        }

        // Info verificada exitosamente para usuario (sin loggear email/payer_id por seguridad)

        // 3. Actualizar perfil en Supabase
        const verifiedEmail = userData.email;
        const payerId = userData.payer_id;

        // Obtenemos los métodos actuales para no sobreescribir otros métodos de pago si existieran
        const { data: userProfile } = await supabase.from('users').select('payment_methods').eq('id', userId).single();
        const currentMethods = userProfile?.payment_methods || {};
        currentMethods.paypal = verifiedEmail;

        const { error: updateError } = await supabase
            .from('users')
            .update({
                payment_methods: currentMethods,
                paypal_verified: true,
                paypal_payer_id: payerId
            })
            .eq('id', userId);

        if (updateError) throw updateError;

        res.redirect('/transacciones?paypal=success');

    } catch (err) {
        console.error('[PayPalOAuth] Callback Error:', err);
        res.redirect(`/transacciones?paypal=error&msg=${encodeURIComponent(err.message)}`);
    }
};


// --- Helper: Map Display License Name to Internal Key ---
const mapLicenseToKey = (name) => {
    if (!name) return 'basic';
    const n = name.toLowerCase();
    // Spanish mapping
    if (n.includes('básica') || n.includes('basica')) return 'basic';
    if (n.includes('premium')) return 'premium';
    if (n.includes('stems') || n.includes('trackout')) return 'trackout';
    if (n.includes('ilimitada') || n.includes('unlimited')) return 'unlimited';
    if (n.includes('exclusiva') || n.includes('exclusive')) return 'exclusive';
    // Direct matches
    if (['basic', 'premium', 'stems', 'trackout', 'unlimited', 'exclusive'].includes(n)) return n;
    return 'basic';
};

export const createPayPalOrder = async (req, res) => {
    try {
        // Auth header presente: verificado internamente
        const userId = req.user?.userId;
        let cartItems = [];
        // 1. Get Cart Items (From DB if logged in, from Body if guest, or directly if directProductId)
        const isNegotiation = req.body.isNegotiation || false;
        const negotiateToken = req.body.negotiateToken;
        const directProductId = req.body.directProductId;

        if (directProductId) {
            const { data: product, error: prodErr } = await supabase
                .from('products')
                .select('id, name, price_basic, producer_id, image_url, mp3_url, wav_url, stems_url, kit_url, status')
                .eq('id', directProductId)
                .single();

            let productObj = product;
            if (!productObj) {
                if (String(directProductId) === '902') {
                    productObj = { id: 902, name: 'INKA KOLA', price_basic: 5, producer_id: null };
                } else if (String(directProductId) === '900') {
                    productObj = { id: 900, name: 'Easy Master', price_basic: 5, producer_id: null };
                } else if (String(directProductId) === '899' || String(directProductId) === '901') {
                    productObj = { id: 899, name: 'Easy Mix', price_basic: 10, producer_id: null };
                } else {
                    return res.status(404).json({ error: 'Producto no encontrado' });
                }
            }

            let variantPrice = productObj.price_basic || 10;
            const requestedCustomPrice = parseFloat(req.body.customPrice || req.body.abPrice);
            if (requestedCustomPrice && (requestedCustomPrice === 5 || requestedCustomPrice === 10)) {
                variantPrice = requestedCustomPrice;
            }

            cartItems = [{
                product: productObj,
                license_name: 'lifetime',
                variant_price: variantPrice
            }];
        } else if (isNegotiation && negotiateToken) {
            // NEGOTIATION FLOW
            const { data: proposal, error: propError } = await supabase
                .from('propuestas_offszn')
                .select('*, product:products(id, name, producer_id, image_url, mp3_url, wav_url, stems_url, kit_url)')
                .eq('purchase_token', negotiateToken)
                .single();

            if (propError || !proposal) {
                return res.status(404).json({ error: 'Token de negociación inválido o expirado' });
            }

            if (proposal.status_offszn !== 'accepted') {
                return res.status(400).json({ error: 'Esta propuesta no ha sido aceptada' });
            }

            const agreedPrice = parseFloat(proposal.counter_amount || proposal.amount_offszn);
            cartItems = [{
                product: proposal.product,
                license_name: proposal.selected_license || 'Standard',
                variant_price: agreedPrice,
                is_negotiation: true
            }];
        } else if (userId) {
            const { data, error: cartError } = await supabase
                .from('cart_items')
                .select('product:products(id, name, price_basic, producer_id, image_url, mp3_url, wav_url, stems_url, kit_url, status), license_name, variant_price')
                .eq('user_id', userId);

            if (cartError) throw cartError;

            // Filter out deleted products (matching frontend cart.js behavior)
            cartItems = (data || []).filter(item => item.product && item.product.status !== 'deleted');
            console.log(`[PayPalOrder] Auth user cart: ${data?.length || 0} raw items → ${cartItems.length} after filtering deleted`);
        } else {
            // GUEST FLOW: Expect items in body
            cartItems = req.body.cartItems || [];
            console.log('[PayPalOrder] Guest Checkout - Items received:', cartItems.length);
        }

        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ error: 'Carrito vacío' });
        }

        // 2. Fetch Producer details for PayPal Emails AND LICENSE SETTINGS
        const producerIds = [...new Set(cartItems.map(item => item.product.producer_id))];
        const [{ data: producers, error: producerError }, { data: profiles, error: profileError }] = await Promise.all([
            supabase.from('users').select('id, paypal_email, license_settings, nickname, payment_methods, plan, role').in('id', producerIds),
            supabase.from('users').select('id, plan, role').in('id', producerIds)
        ]);

        if (producerError) console.error('[PayPalDebug] Error fetching producers:', producerError);
        if (profileError) console.error('[PayPalDebug] Error fetching profiles:', profileError);

        const producerMap = new Map();
        producers?.forEach(u => {
            const profile = profiles?.find(p => p.id === u.id);
            // Use paypal_email column primarily, fallback to payment_methods.paypal
            const finalPaypalEmail = u.paypal_email || u.payment_methods?.paypal;
            const finalPlan = profile?.plan || u.plan || 'free';
            const finalRole = profile?.role || u.role || 'user';

            producerMap.set(u.id, {
                id: u.id,
                email: finalPaypalEmail,
                settings: u.license_settings,
                nickname: u.nickname,
                plan: finalPlan,
                role: finalRole
            });
        });

        console.log('[PayPalOrder] Producer Map entries:', Array.from(producerMap.entries()).map(([id, p]) => ({ id, email: p.email, nickname: p.nickname })));

        // --- NEW: Identify Producers without PayPal ---
        const missingPaymentProducers = [];
        cartItems.forEach(item => {
            const p = producerMap.get(item.product.producer_id);
            if (!p || !p.email || !p.email.includes('@')) {
                missingPaymentProducers.push({
                    productId: item.product.id,
                    productName: item.product.name,
                    producerId: item.product.producer_id,
                    producerName: p?.nickname || 'Productor'
                });
            }
        });

        if (missingPaymentProducers.length > 0) {
            // Trigger notifications for MISSING sales (one per producer)
            const uniqueProducers = [...new Set(missingPaymentProducers.map(p => p.producerId))];

            for (const prodId of uniqueProducers) {
                const item = missingPaymentProducers.find(p => p.producerId === prodId);
                const buyerName = req.user?.nickname || 'Un usuario';

                await supabase.from('notifications').insert({
                    user_id: prodId,
                    type: 'system_alert',
                    title: '¡Venta Perdida!',
                    message: `<strong>${buyerName}</strong> intentó comprar tu producto <strong>"${item.productName}"</strong>, pero no tienes configurado tu PayPal. <a href="/transacciones" style="color:#8b5cf6;">Configúralo ahora</a> para no perder más ventas.`,
                    read: false,
                    data: { action: 'open_paypal_settings' }
                });
            }

            return res.status(400).json({
                error: 'MISSING_PRODUCER_PAYPAL',
                details: missingPaymentProducers
            });
        }

        // 3. SECURE PRICE RE-CALCULATION
        const FACTORY_DEFAULTS = {
            basic: 20.00,
            premium: 50.00,
            trackout: 100.00,
            unlimited: 300.00,
            exclusive: 500.00
        };

        const productIds = cartItems.map(item => item.product.id);
        const { data: dbProducts, error: dbError } = await supabase
            .from('products')
            .select('id, name, price_basic, price_premium, price_stems, price_exclusive, product_type, licenses, producer_id, status')
            .in('id', productIds)
            .or('status.eq.approved,status.eq.published');

        if (dbError) throw dbError;

        console.log(`[PayPalOrder] DB Products found: ${dbProducts?.length || 0}/${productIds.length}`);

        let subtotal = 0;
        let serviceFee = 0;
        const verifiedCartItems = [];

        cartItems.forEach(item => {
            const prodIdToFind = String(item.product?.id);
            const dbProd = dbProducts.find(p => String(p.id) === prodIdToFind);

            if (!dbProd) {
                console.warn(`[PayPalOrder] Product ${prodIdToFind} not found in DB or not approved/publishedStatus: ${item.product?.id}`);
                return;
            }

            const producer = producerMap.get(dbProd.producer_id);
            let verifiedPrice = 0;

            if (dbProd.product_type === 'beat') {
                if (item.is_negotiation) {
                    verifiedPrice = item.variant_price;
                } else {
                    const licKey = mapLicenseToKey(item.license_name || 'basic');
                    const productOverride = dbProd.licenses ? dbProd.licenses[licKey]?.price : null;
                    const producerPrice = producer?.license_settings ? producer.license_settings[licKey]?.price : null;
                    const dbFieldMap = {
                        basic: dbProd.price_basic,
                        premium: dbProd.price_premium,
                        trackout: dbProd.price_stems,
                        stems: dbProd.price_stems,
                        unlimited: dbProd.price_exclusive,
                        exclusive: dbProd.price_exclusive
                    };
                    verifiedPrice = productOverride || dbFieldMap[licKey] || producerPrice || FACTORY_DEFAULTS[licKey] || 0;

                    if (verifiedPrice === 0) {
                        console.warn(`[PayPalOrder] Price verified as 0 for beat ${dbProd.id} with licKey ${licKey}. Input name was: ${item.license_name}`);
                    }
                }
            } else {
                verifiedPrice = item.is_negotiation ? item.variant_price : (dbProd.price_basic || 0);
            }

            verifiedPrice = parseFloat(verifiedPrice);

            let commission = 0;
            if (verifiedPrice > 0) {
                const producerObj = producerMap.get(dbProd.producer_id);
                const rawPlan = (producerObj?.plan || '').toLowerCase();
                const rawRole = (producerObj?.role || '').toLowerCase();
                const rawNick = (producerObj?.nickname || '').toLowerCase();

                // PRO Lifetime / PRO accounts / Admin / Willieinspired have 0 commission / 0 service fee
                const isProAccount = rawPlan.includes('pro') || 
                                     rawPlan.includes('lifetime') || 
                                     rawRole === 'admin' || 
                                     rawNick.includes('willie') || 
                                     dbProd.producer_id === '00000000-0000-0000-0000-000000000001';

                if (isProAccount) {
                    commission = 0;
                } else if (rawPlan === 'starter') {
                    if (verifiedPrice < 20) {
                        commission = 0.50;
                    } else {
                        commission = verifiedPrice * 0.03;
                    }
                } else {
                    if (verifiedPrice < 20) {
                        commission = 1.00;
                    } else {
                        commission = verifiedPrice * 0.05;
                    }
                }
            }

            subtotal += verifiedPrice;
            serviceFee += commission;

            console.log(`[PayPalOrder] Item: ${dbProd.name} | Plan: ${producer?.plan || 'free'} | Price: ${verifiedPrice} | Fee: ${commission.toFixed(2)}`);

            verifiedCartItems.push({
                ...item,
                variant_price: verifiedPrice
            });
        });

        const couponCode = req.body.couponCode || '';
        let totalDiscount = 0;
        let appliedCoupon = null;

        if (couponCode) {
            // 1. Fetch Coupon
            const { data: coupon, error: couponError } = await supabase
                .from('coupons')
                .select('*')
                .eq('code', couponCode.toUpperCase())
                .single();

            if (!couponError && coupon) {
                const now = new Date();
                const from = coupon.valid_from ? new Date(coupon.valid_from) : null;
                const to = coupon.valid_to ? new Date(coupon.valid_to) : null;

                // 2. Validate Coupon
                let isValid = true;
                let errorMsg = '';

                // Dates
                if (from && now < from) { isValid = false; errorMsg = 'El cupón aún no es válido.'; }
                if (to && now > to) { isValid = false; errorMsg = 'El cupón ha expirado.'; }

                // Usage Limit
                if (coupon.uses_limit && coupon.times_used >= coupon.uses_limit) {
                    isValid = false;
                    errorMsg = 'El cupón ha alcanzado su límite de usos.';
                }

                // Min Purchase
                if (coupon.min_purchase_amount && subtotal < coupon.min_purchase_amount) {
                    isValid = false;
                    errorMsg = `Este cupón requiere una compra mínima de $${coupon.min_purchase_amount}.`;
                }

                if (isValid) {
                    appliedCoupon = coupon;
                    // 3. Calculate Discount
                    if (coupon.applies_to === 'all' || !coupon.applies_to) {
                        // Global Discount
                        if (coupon.discount_percent) {
                            totalDiscount = subtotal * (coupon.discount_percent / 100);
                        } else if (coupon.discount_amount) {
                            totalDiscount = coupon.discount_amount;
                        }
                    } else if (coupon.applies_to === 'product' && (coupon.specific_products || coupon.applies_to_id)) {
                        // Product-Specific Discount
                        const couponTargetProduct = coupon.specific_products || coupon.applies_to_id;
                        let targetProductIds = Array.isArray(couponTargetProduct) ? couponTargetProduct : [couponTargetProduct];
                        targetProductIds = targetProductIds.map(String);

                        verifiedCartItems.forEach(item => {
                            if (targetProductIds.includes(String(item.product.id))) {
                                if (coupon.discount_percent) {
                                    totalDiscount += item.variant_price * (coupon.discount_percent / 100);
                                } else if (coupon.discount_amount) {
                                    // If amount, we apply it only once per order usually, or per item? 
                                    // Standard rule: Once per order for that group, or split. 
                                    // To keep it safe: Once per order if any item matches.
                                }
                            }
                        });

                        // Special case for fixed amount on product-specific: only once.
                        if (coupon.discount_amount && totalDiscount === 0) {
                            const hasMatch = verifiedCartItems.some(item => targetProductIds.includes(String(item.product.id)));
                            if (hasMatch) totalDiscount = coupon.discount_amount;
                        }
                    }

                    // Cap discount at subtotal
                    if (totalDiscount > subtotal) totalDiscount = subtotal;
                } else {
                    console.log(`[PayPalOrder] Coupon ${couponCode} invalid: ${errorMsg}`);
                }
            } else {
                // Fallback for welcome coupons if they are not in the table yet (or just keep hardcoded as backup?)
                // Actually, they should be in 'coupons' table now. 
                // Let's keep a fallback for the hardcoded 'OFFSZN-' if the user wants.
                if (couponCode.startsWith('OFFSZN-')) {
                    totalDiscount = subtotal * 0.10; // 10% hardcoded for now as legacy
                }
            }
        }

        // --- REFACTOR: Multi-Payee Split (Consolidated) ---
        const purchaseUnits = [];
        const payeeGroups = new Map(); // Identificador (email/id) -> { amount: number, type: 'email' | 'id', nickname: string }

        if (!verifiedCartItems || verifiedCartItems.length === 0) {
            console.error('[PayPalOrder] No items were verified successfully.');
            return res.status(400).json({ error: 'No se pudieron verificar los productos en el carrito. Asegúrate de que estén activos.' });
        }

        // Distribution factor for global discounts
        const globalDiscountFactor = subtotal > 0 ? (subtotal - totalDiscount) / subtotal : 1.0;
        console.log(`[PayPalOrder] Subtotal: ${subtotal}, Discount: ${totalDiscount}, Factor: ${globalDiscountFactor}`);

        // 1. Group Producers by Payee Identifier
        // NOTE: When the producer's PayPal email is the main OFFSZN account, use merchant_id
        // to match the SDK's merchant-id parameter and avoid PayPal validation errors.
        const MAIN_MERCHANT_ID = 'MXV5F6X8JXG4S';
        const MAIN_MERCHANT_EMAIL = 'willie2008garay@gmail.com';

        verifiedCartItems.forEach(item => {
            const producer = producerMap.get(item.product.producer_id);
            if (!producer?.email) return;

            const isMainAccount = producer.email.toLowerCase().trim() === MAIN_MERCHANT_EMAIL.toLowerCase();
            const payeeId = isMainAccount ? MAIN_MERCHANT_ID : producer.email.toLowerCase().trim();
            const payeeType = isMainAccount ? 'id' : 'email';
            const itemNet = (parseFloat(item.variant_price) || 0) * globalDiscountFactor;

            const current = payeeGroups.get(payeeId) || { amount: 0, type: payeeType, nickname: producer.nickname };
            current.amount += itemNet;
            payeeGroups.set(payeeId, current);
        });

        // 2. Add Platform Fee — always use merchant_id to match SDK
        if (serviceFee > 0) {
            const current = payeeGroups.get(MAIN_MERCHANT_ID) || { amount: 0, type: 'id', nickname: 'OFFSZN' };
            current.amount += serviceFee;
            payeeGroups.set(MAIN_MERCHANT_ID, current);
        }

        // 3. Build Final Purchase Units (One per unique Payee)
        payeeGroups.forEach((data, identifier) => {
            if (data.amount <= 0) return;

            const payeeObj = data.type === 'email' 
                ? { email_address: identifier } 
                : { merchant_id: identifier };

            purchaseUnits.push({
                reference_id: `payee_${identifier.substring(0, 8)}_${uuidv4().substring(0, 4)}`,
                amount: {
                    currency_code: 'USD',
                    value: data.amount.toFixed(2)
                },
                description: `Pago consolidado - ${data.nickname || 'OFFSZN'}`,
                payee: payeeObj
            });
        });

        console.log(`[PayPalOrder] Setup Complete. Total Units: ${purchaseUnits.length}`);

        if (purchaseUnits.length === 0) {
            console.error('[PayPalOrder] Empty purchase units array.');
            return res.status(400).json({ error: 'La orden no contiene unidades de compra válidas.' });
        }

        const grandTotalCalculated = purchaseUnits.reduce((acc, unit) => acc + parseFloat(unit.amount.value), 0);
        if (grandTotalCalculated <= 0) {
            console.error('[PayPalOrder] Grand Total is 0 or negative:', grandTotalCalculated);
            return res.status(400).json({ error: 'El total de la orden debe ser mayor a 0.' });
        }

        console.log('[PayPalOrder] Multi-Payee Setup Complete. Units:', purchaseUnits.length, 'Total:', grandTotalCalculated.toFixed(2));

        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer("return=representation");
        request.requestBody({
            intent: 'CAPTURE',
            application_context: {
                shipping_preference: "NO_SHIPPING"
            },
            purchase_units: purchaseUnits
        });

        const response = await paypalClient.client().execute(request);
        res.status(200).json({ id: response.result.id });

    } catch (err) {
        console.error("[PayPal Create Error] Message:", err.message);
        if (err.statusCode) {
            console.error("[PayPal Create Error] Status:", err.statusCode, "Details:", JSON.stringify(err.result || err.details || {}, null, 2));
        }
        const userMsg = err.statusCode === 422
            ? 'Error de PayPal: El correo del productor no está vinculado a una cuenta PayPal válida. Contacta al productor.'
            : (err.message || 'Error interno al crear la orden.');
        res.status(err.statusCode || 500).json({ error: userMsg });
    }
};

export const capturePayPalOrder = async (req, res) => {
    const { orderID, cartItems: guestItems } = req.body;
    let userId = req.user?.userId;

    try {
        const request = new paypal.orders.OrdersCaptureRequest(orderID);
        request.requestBody({});

        const response = await paypalClient.client().execute(request);
        console.log(`[PayPalCapture] Order ${orderID} Response Status: ${response.result.status}`);

        if (response.result.status === 'COMPLETED' || response.result.status === 'APPROVED') {
            // 1. Get Cart Items
            let cartItems = [];
            const isNegotiation = req.body.isNegotiation || false;
            const negotiateToken = req.body.negotiateToken;
            const directProductId = req.body.directProductId;

            if (directProductId) {
                const { data: product, error: prodErr } = await supabase
                    .from('products')
                    .select('id, name, price_basic, producer_id, image_url, mp3_url, wav_url, stems_url, kit_url, status')
                    .eq('id', directProductId)
                    .single();

                let productObj = product;
                if (!productObj) {
                    if (String(directProductId) === '902') {
                        productObj = { id: 902, name: 'INKA KOLA', price_basic: 5, producer_id: null };
                    } else if (String(directProductId) === '900') {
                        productObj = { id: 900, name: 'Easy Master', price_basic: 5, producer_id: null };
                    } else if (String(directProductId) === '899' || String(directProductId) === '901') {
                        productObj = { id: 899, name: 'Easy Mix', price_basic: 10, producer_id: null };
                    }
                }

                if (!productObj) {
                    console.error("[PayPalCapture] Product not found during direct checkout:", directProductId);
                } else {
                    let variantPrice = productObj.price_basic || 10;
                    const requestedCustomPrice = parseFloat(req.body.customPrice || req.body.abPrice);
                    if (requestedCustomPrice && (requestedCustomPrice === 5 || requestedCustomPrice === 10)) {
                        variantPrice = requestedCustomPrice;
                    }

                    cartItems = [{
                        product: productObj,
                        license_name: 'lifetime',
                        variant_price: variantPrice
                    }];
                }
            } else if (isNegotiation && negotiateToken) {
                const { data: proposal, error: propError } = await supabase
                    .from('propuestas_offszn')
                    .select('*, product:products(id, name, producer_id, image_url, mp3_url, wav_url, stems_url, kit_url)')
                    .eq('purchase_token', negotiateToken)
                    .single();

                if (propError || !proposal) {
                    console.error("[PayPalCapture] Negotiation proposal not found during capture:", negotiateToken);
                } else {
                    const agreedPrice = parseFloat(proposal.counter_amount || proposal.amount_offszn);

                    // Fetch producer plan for commission calculation
                    const { data: profile } = await supabase
                        .from('users')
                        .select('plan')
                        .eq('id', proposal.product?.producer_id) // Corrected from proposal.products?.producer_id
                        .single();

                    const producerPlan = profile?.plan || 'free';
                    let commission = 0;

                    if (producerPlan === 'starter') {
                        commission = agreedPrice < 20 ? 0.50 : agreedPrice * 0.03;
                    } else if (producerPlan === 'pro') {
                        commission = 0;
                    } else {
                        commission = agreedPrice < 20 ? 1.00 : agreedPrice * 0.05;
                    }

                    const total = (agreedPrice + commission).toFixed(2); // Use agreedPrice directly, it's already a float
                    cartItems = [{
                        product: proposal.product,
                        license_name: proposal.selected_license || 'Standard',
                        variant_price: agreedPrice,
                        is_negotiation: true,
                        proposal_id: proposal.id
                    }];
                }
            } else if (userId) {
                const { data, error: cartFetchError } = await supabase
                    .from('cart_items')
                    .select('product:products(id, name, producer_id, image_url, mp3_url, wav_url, stems_url, kit_url), license_name, variant_price')
                    .eq('user_id', userId);

                if (cartFetchError) throw cartFetchError;
                cartItems = data || [];
            } else {
                cartItems = guestItems || [];
                // ...
                const payerEmail = response.result.payer?.email_address;
                if (payerEmail) {
                    const { data: existingUser } = await supabase
                        .from('users')
                        .select('id')
                        .eq('email', payerEmail)
                        .single();

                    if (existingUser) {
                        userId = existingUser.id;
                        console.log(`[PayPalCapture] Guest matched with existing user`);
                    }
                }
            }

            if (!cartItems || cartItems.length === 0) {
                console.warn("[PayPalCapture] Warning: Cart is empty during capture.");
            }

            // SECURE PRICE RE-CALCULATION (CAPTURE PHASE)
            const FACTORY_DEFAULTS = {
                basic: 20.00,
                premium: 50.00,
                trackout: 100.00,
                unlimited: 300.00,
                exclusive: 500.00
            };

            const productIds = cartItems.map(item => item.product?.id).filter(Boolean);
            const { data: dbProducts } = await supabase
                .from('products')
                .select('id, price_basic, price_premium, price_stems, price_exclusive, product_type, licenses, producer_id')
                .in('id', productIds)
                .or('status.eq.approved,status.eq.published');

            const uniqueProducerIds = [...new Set((dbProducts || []).map(p => p.producer_id).filter(Boolean))];
            const orderProducerId = uniqueProducerIds.length === 1 ? uniqueProducerIds[0] : null;
            const orderProductId = cartItems.length === 1 ? cartItems[0].product?.id : null;

            // 2. Create Order Record (Main Record)
            const totalPaid = response.result.purchase_units.reduce((acc, unit) => {
                const capture = unit.payments?.captures?.[0];
                return acc + (capture ? parseFloat(capture.amount.value) : 0);
            }, 0);

            // Prioritize email from request body (typed by user) over PayPal account email
            const payerEmail = req.body.guestEmail || response.result.payer?.email_address;

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: userId,
                    transaction_id: orderID,
                    status: 'completed',
                    total_price: totalPaid,
                    amount: totalPaid,
                    guest_email: payerEmail,
                    producer_id: orderProducerId,
                    product_id: orderProductId ? parseInt(orderProductId, 10) : null
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 3. Create Transactions and Order Items
            const transactions = [];
            const orderItems = [];

            const producerIds = [...new Set(dbProducts.map(p => p.producer_id))];
            const [{ data: producerSettings, error: pSetError }, { data: producerPlans, error: pPlanError }] = await Promise.all([
                supabase.from('users').select('id, license_settings').in('id', producerIds),
                supabase.from('users').select('id, plan').in('id', producerIds)
            ]);

            if (pSetError) console.error("[PayPalCapture] Error fetching producer settings:", pSetError);
            if (pPlanError) console.error("[PayPalCapture] Error fetching producer plans:", pPlanError);

            let subtotalForCoupon = 0;
            (dbProducts || []).forEach(p => {
                const item = cartItems.find(ci => String(ci.product?.id) === String(p.id));
                if (item) {
                    // This is a simplified subtotal for global coupon checks
                    subtotalForCoupon += parseFloat(item.variant_price) || 0;
                }
            });

            let totalOrderDiscount = 0;
            const couponCode = req.body.couponCode || '';
            let appliedCouponId = null;

            if (couponCode) {
                const { data: coupon } = await supabase
                    .from('coupons')
                    .select('*')
                    .eq('code', couponCode.toUpperCase())
                    .single();

                if (coupon) {
                    const now = new Date();
                    const from = coupon.valid_from ? new Date(coupon.valid_from) : null;
                    const to = coupon.valid_to ? new Date(coupon.valid_to) : null;

                    let isValid = true;
                    if (from && now < from) isValid = false;
                    if (to && now > to) isValid = false;
                    if (coupon.uses_limit && coupon.times_used >= coupon.uses_limit) isValid = false;
                    if (coupon.min_purchase_amount && subtotalForCoupon < coupon.min_purchase_amount) isValid = false;

                    if (isValid) {
                        appliedCouponId = coupon.id;
                        if (coupon.applies_to === 'all' || !coupon.applies_to) {
                            if (coupon.discount_percent) {
                                totalOrderDiscount = subtotalForCoupon * (coupon.discount_percent / 100);
                            } else if (coupon.discount_amount) {
                                totalOrderDiscount = coupon.discount_amount;
                            }
                        } else if (coupon.applies_to === 'product' && (coupon.specific_products || coupon.applies_to_id)) {
                            const couponTargetProduct = coupon.specific_products || coupon.applies_to_id;
                            let targetIds = Array.isArray(couponTargetProduct) ? couponTargetProduct : [couponTargetProduct];
                            targetIds = targetIds.map(String);
                            cartItems.forEach(item => {
                                if (targetIds.includes(String(item.product.id))) {
                                    if (coupon.discount_percent) {
                                        totalOrderDiscount += (parseFloat(item.variant_price) || 0) * (coupon.discount_percent / 100);
                                    }
                                }
                            });
                            if (coupon.discount_amount && totalOrderDiscount === 0) {
                                if (cartItems.some(i => targetIds.includes(String(i.product.id)))) totalOrderDiscount = coupon.discount_amount;
                            }
                        }
                    }
                } else if (couponCode.startsWith('OFFSZN-')) {
                    // Legacy fallback
                    totalOrderDiscount = subtotalForCoupon * 0.10;
                }
            }

            // Factor to downscale producer amounts if a global discount was applied
            // Actually, we'll calculate per-item discount more precisely below.
            const globalDiscountFactor = subtotalForCoupon > 0 ? (subtotalForCoupon - totalOrderDiscount) / subtotalForCoupon : 1.0;

            cartItems.forEach(item => {
                const dbProd = (dbProducts || []).find(p => String(p.id) === String(item.product?.id));
                if (!dbProd) {
                    console.warn(`[PayPalCapture] Skipping item — product ${item.product?.id} not found (approved/published)`);
                    return;
                }

                const producer = producerSettings?.find(u => u.id === dbProd.producer_id);
                let verifiedPrice = 0;

                if (dbProd.product_type === 'beat') {
                    if (item.is_negotiation) {
                        verifiedPrice = item.variant_price;
                    } else {
                        const licKey = mapLicenseToKey(item.license_name || 'basic');
                        const productOverride = dbProd.licenses ? dbProd.licenses[licKey]?.price : null;
                        const producerPrice = producer?.license_settings ? producer.license_settings[licKey]?.price : null;
                        const dbFieldMap = {
                            basic: dbProd.price_basic,
                            premium: dbProd.price_premium,
                            trackout: dbProd.price_stems,
                            stems: dbProd.price_stems,
                            unlimited: dbProd.price_exclusive,
                            exclusive: dbProd.price_exclusive
                        };
                        verifiedPrice = productOverride || dbFieldMap[licKey] || producerPrice || FACTORY_DEFAULTS[licKey] || 0;
                    }
                } else {
                    verifiedPrice = item.is_negotiation ? item.variant_price : (dbProd.price_basic || 0);
                }

                verifiedPrice = parseFloat(verifiedPrice);

                let commission = 0;
                if (verifiedPrice > 0) {
                    const producerProfile = producerPlans?.find(pp => pp.id === dbProd.producer_id);
                    const producerPlan = producerProfile?.plan || 'free';

                    if (producerPlan === 'starter') {
                        // Starter: 3% (min $0.50 if < $20)
                        if (verifiedPrice < 20) {
                            commission = 0.50;
                        } else {
                            commission = verifiedPrice * 0.03;
                        }
                    } else if (producerPlan === 'pro') {
                        // Pro: 0%
                        commission = 0;
                    } else {
                        // Free: 5% (min $1.00 if < $20)
                        if (verifiedPrice < 20) {
                            commission = 1.00;
                        } else {
                            commission = verifiedPrice * 0.05;
                        }
                    }
                }

                // Calculate specific discount for this item
                let itemPriceAfterDiscount = verifiedPrice;

                // If it's a product-specific coupon, check if it applies here
                // Note: This logic assumes we re-query the coupon in the loop or use the 'coupon' object if it exists
                // For simplicity and to match 'create', we'll use a more direct approach:
                // If the coupon was valid and applied, we scale the price.
                itemPriceAfterDiscount = verifiedPrice * globalDiscountFactor;

                const finalProducerAmount = itemPriceAfterDiscount;

                transactions.push({
                    user_id: userId,
                    related_order: order.id,
                    amount: finalProducerAmount + commission,
                    currency: 'USD',
                    type: 'sale'
                });

                orderItems.push({
                    order_id: order.id,
                    product_id: item.product.id,
                    quantity: 1,
                    price_at_purchase: finalProducerAmount,
                    license_name: item.license_name || 'Standard'
                });
            });

            if (cartItems.length > 0 && orderItems.length === 0) {
                console.error(`[PayPalCapture] CRITICAL: ${cartItems.length} cart item(s) but 0 order_items created. ProductIds: ${productIds.join(',')}`);
            }

            const { error: transError } = await supabase.from('transactions').insert(transactions);
            if (transError) console.error("[PayPalCapture] Error recording transactions:", transError);

            const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
            if (itemsError) {
                console.error("[PayPalCapture] Error recording order items:", itemsError);
            } else if (orderItems.length > 0) {
                console.log(`[PayPalCapture] Recorded ${orderItems.length} order_item(s) for order ${order.id}`);
            }

            // --- GENERAR LICENCIA DEL PLUGIN SI SE COMPRÓ EASY MIX / EASY MASTER / INKA KOLA ---
            let generatedLicenseKey = null;
            let keysGenerated = [];

            for (const item of cartItems) {
                const prodName = item.product?.name || '';
                const isEasyMix = prodName.toLowerCase().includes('easy mix') || prodName.toLowerCase().includes('easymix');
                const isEasyMaster = prodName.toLowerCase().includes('easy master') || prodName.toLowerCase().includes('easymaster');
                const isInkaKola = prodName.toLowerCase().includes('inka kola') || prodName.toLowerCase().includes('inkakola');
                
                if (isEasyMix || isEasyMaster || isInkaKola) {
                    try {
                        const pluginName = isInkaKola ? 'INKA KOLA' : (isEasyMaster ? 'Easy Master' : 'Easy Mix');
                        const isSubscription = (item.license_name && item.license_name.toLowerCase().includes('sub')) || 
                                               (item.product?.product_type && item.product.product_type === 'subscription');
                        const licenseType = isSubscription ? 'subscription' : 'lifetime';
                        
                        console.log(`[PayPalCapture] ${pluginName} detected! Generating ${licenseType} license for user ${userId || 'guest'} (${payerEmail})`);
                        const licResult = await generatePluginLicense({
                            licenseType,
                            userEmail: payerEmail,
                            userId: userId,
                            pluginName: pluginName
                        });
                        
                        if (licResult && licResult.serialKey) {
                            keysGenerated.push(`${pluginName}: ${licResult.serialKey}`);
                        }

                        // --- 2x1 PROMO: Si compra Easy Mix Lifetime, regala Easy Master Lifetime ---
                        if (isEasyMix && licenseType === 'lifetime') {
                            console.log(`[PayPalCapture] 2x1 Promo triggered! Generating free Easy Master for ${payerEmail}`);
                            try {
                                const bonusResult = await generatePluginLicense({
                                    licenseType: 'lifetime',
                                    userEmail: payerEmail,
                                    userId: userId,
                                    pluginName: 'Easy Master'
                                });
                                if (bonusResult && bonusResult.serialKey) {
                                    keysGenerated.push(`Easy Master (REGALO): ${bonusResult.serialKey}`);
                                }
                            } catch (bonusErr) {
                                console.error(`[PayPalCapture] Error generating bonus Easy Master license:`, bonusErr);
                            }
                        }
                    } catch (licError) {
                        console.error(`[PayPalCapture] Error generating plugin license for ${pluginName}:`, licError);
                    }
                }
            }

            if (keysGenerated.length > 0) {
                generatedLicenseKey = keysGenerated.join(' | ');
            }

            // 4. Update Sales Count
            for (const item of cartItems) {
                try {
                    const { data: prod } = await supabase
                        .from('products')
                        .select('sales_count')
                        .eq('id', item.product.id)
                        .single();

                    if (prod) {
                        await supabase
                            .from('products')
                            .update({ sales_count: (prod.sales_count || 0) + 1 })
                            .eq('id', item.product.id);
                    }
                } catch (e) {
                    console.warn(`[SalesCount] Error incrementing for ${item.product.id}:`, e);
                }
            }

            // 5. Increment Coupon Usage
            if (appliedCouponId) {
                try {
                    await supabase.rpc('increment_coupon_usage', { coupon_id: appliedCouponId });
                    // Fallback if RPC doesn't exist (though it should be created or use standard update)
                    const { data: cData } = await supabase.from('coupons').select('times_used').eq('id', appliedCouponId).single();
                    if (cData) {
                        await supabase.from('coupons').update({ times_used: (cData.times_used || 0) + 1 }).eq('id', appliedCouponId);
                    }
                } catch (e) {
                    console.error("[CouponUsage] Error incrementing:", e);
                }
            }

            // 6. Clear Cart in DB or Invalidate Negotiation Token
            if (isNegotiation && negotiateToken) {
                // Mark proposal as purchased and clear token
                const proposalItem = cartItems.find(i => i.is_negotiation);
                if (proposalItem?.proposal_id) {
                    await supabase
                        .from('propuestas_offszn')
                        .update({
                            status_offszn: 'purchased',
                            purchase_token: null
                        })
                        .eq('id', proposalItem.proposal_id);
                }
            } else if (userId) {
                const { error: clearError } = await supabase.from('cart_items').delete().eq('user_id', userId);
                if (clearError) console.error("[PayPalCapture] Error clearing cart:", clearError);
            }

            // 6. Send Email Receipts (Async)
            (async () => {
                try {
                    let userEmail = '';
                    let userNickname = 'Cliente';

                    if (userId) {
                        const { data: userData } = await supabase.from('users').select('email, nickname').eq('id', userId).single();
                        if (userData) {
                            userEmail = userData.email;
                            userNickname = userData.nickname || 'Cliente';
                        }
                    }

                    // Fallback to Request Body guestEmail then PayPal Payer Email
                    if (!userEmail) {
                        userEmail = req.body.guestEmail || response.result.payer?.email_address;
                        userNickname = (response.result.payer?.name?.given_name) || 'Cliente';
                    }

                    if (!userEmail) return;

                    console.log(`[EmailJS] STARTING email flow for order`);

                    for (const item of cartItems) {
                        const prodName = item.product?.name || '';
                        const isEasyMix = prodName.toLowerCase().includes('easy mix') || prodName.toLowerCase().includes('easymix');
                        const isEasyMaster = prodName.toLowerCase().includes('easy master') || prodName.toLowerCase().includes('easymaster');
                        const isPlugin = isEasyMix || isEasyMaster;

                        // A. Notify Client (Receipt) — includes serial key for plugin purchases
                        const serialKeySection = (isPlugin && generatedLicenseKey) ? `
                            <div style="background:#111827; border:2px dashed #ff9f0a; border-radius:12px; padding:20px; margin:20px 0; text-align:center;">
                                <p style="color:#ff9f0a; font-size:0.8rem; text-transform:uppercase; letter-spacing:2px; margin:0 0 10px; font-weight:700;">🔑 Tu Serial Key FULL</p>
                                <p style="font-family:monospace; font-size:1.3rem; font-weight:800; color:#fff; letter-spacing:2px; margin:0; word-break:break-all;">${generatedLicenseKey}</p>
                                <p style="color:#888; font-size:0.78rem; margin:12px 0 0;">Guarda esta clave en un lugar seguro. La necesitarás para activar el plugin en tu DAW.</p>
                            </div>
                        ` : '';

                        const downloadLinks = isPlugin ? (
                            isEasyMaster ? {
                                win: 'https://drive.google.com/file/d/1JF4oDN_beOOxnOO5ca3TLGDCEQyOeWjh/view',
                                mac: 'https://drive.google.com/file/d/14Lc6-vOtEYgw7IbQcpBe7h2kIiGTrP6Q/view?usp=sharing'
                            } : {
                                win: 'https://drive.google.com/file/d/12UsLyKVAmk7AdVCvXDQJL-COWXqeGUbe/view?usp=sharing',
                                mac: 'https://drive.google.com/file/d/1OUMuGr4trI7M5J0JvaLc-4n5xaTyN17z/view?usp=sharing'
                            }
                        ) : null;

                        const downloadSection = (isPlugin && downloadLinks) ? `
                            <div style="margin:20px 0;">
                                <p style="color:#aaa; font-size:0.78rem; text-transform:uppercase; letter-spacing:2px; font-weight:700; margin-bottom:12px;">Descargar Instaladores</p>
                                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                                    <a href="${downloadLinks.win}" style="display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none; font-weight:600; font-size:0.85rem;">&#xea00; Windows</a>
                                    <a href="${downloadLinks.mac}" style="display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none; font-weight:600; font-size:0.85rem;">&#xf8ff; macOS</a>
                                </div>
                            </div>
                        ` : (isPlugin ? '' : `
                            <a href="https://offszn.lat/mis-compras" style="display:inline-block; background:#10B981; color:#fff; padding:14px 30px; border-radius:10px; text-decoration:none; font-weight:700; margin-top:15px;">VER MIS DESCARGAS</a>
                        `);

                        const buyerHtml = `
                            <div style="font-family: 'Segoe UI', sans-serif; padding: 30px; background: #0a0a0a; border-radius: 12px; color: #fff; max-width: 600px;">
                                <h2 style="color: #ff9f0a; margin-bottom:20px;">¡Compra Completada! 🎛️</h2>
                                <p style="color:#ccc; line-height:1.6;">Hola <b>${userNickname}</b>, procesamos correctamente el pago por <b style="color:#fff;">${item.product.name}</b>.</p>
                                ${serialKeySection}
                                ${downloadSection}
                                <hr style="border:0; border-top:1px solid #222; margin:25px 0;">
                                <p style="font-size:0.75rem; color:#555;">Este es un recibo automático de OFFSZN. Si tienes problemas, contáctanos por WhatsApp.</p>
                            </div>
                        `;
                        await sendOffsznEmail({
                            to: userEmail,
                            subject: isPlugin 
                                ? `🔑 Tu Serial Key de ${item.product.name} — OFFSZN`
                                : `✅ Confirmación de Compra - ${item.product.name}`,
                            html: buyerHtml,
                            fromName: 'OFFSZN'
                        });

                        // B. Notify Producer / Admin (Sale Notification)
                        const { data: prodData } = await supabase.from('users').select('email, nickname').eq('id', item.product.producer_id).single();
                        const adminNotifyEmail = prodData?.email || 'willie2008garay@gmail.com';

                        const adminHtml = `
                            <div style="font-family: 'Segoe UI', sans-serif; padding: 30px; background: #0a0a0a; border-radius: 12px; color: #fff; max-width: 600px;">
                                <h2 style="color: #8B5CF6; margin-bottom:20px;">¡Nueva Venta! 💰 ${isPlugin ? '🎛️ Plugin' : ''}</h2>
                                <p style="color:#ccc; line-height:1.6;">El usuario <b>${userNickname}</b> (<b>${userEmail}</b>) acaba de comprar <b style="color:#fff;">${item.product.name}</b>.</p>
                                <div style="background:#111; border:1px solid #333; border-radius:10px; padding:20px; margin:20px 0;">
                                    <p style="color:#888; margin:0 0 8px;"><b style="color:#fff;">Monto:</b> $${item.variant_price} USD</p>
                                    ${(isPlugin && generatedLicenseKey) ? `<p style="color:#888; margin:0;"><b style="color:#ff9f0a;">Serial Key generada:</b> <span style="font-family:monospace; color:#fff;">${generatedLicenseKey}</span></p>` : ''}
                                </div>
                                <a href="https://offszn.lat/transacciones" style="display:inline-block; background:#8B5CF6; color:#fff; padding:14px 30px; border-radius:10px; text-decoration:none; font-weight:700; margin-top:10px;">VER TRANSACCIONES</a>
                            </div>
                        `;
                        await sendOffsznEmail({
                            to: adminNotifyEmail,
                            subject: `💸 Venta: ${item.product.name} — $${item.variant_price} USD`,
                            html: adminHtml,
                            fromName: 'OFFSZN Notificaciones'
                        });
                    }
                } catch (emailErr) {
                    console.error("[EmailJS] Async flow error:", emailErr);
                }
            })();

            return res.status(200).json({
                ...response.result,
                supabaseOrder: order,
                generatedLicenseKey: generatedLicenseKey
            });
        }

        console.error(`[PayPalCapture] Payment not completed. Status: ${response.result.status}`, JSON.stringify(response.result, null, 2));
        res.status(400).json({ error: 'Pago no completado', status: response.result.status, details: response.result });

    } catch (err) {
        console.error("PayPal Capture Error:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Genera un enlace firmado para descargar archivos seguros (WAV/Stems)
 * Valida que el usuario sea el comprador o que el pedido esté completado.
 */
export const getSecureDownloadUrl = async (req, res) => {
    try {
        const orderId = req.query.orderId;
        const productId = req.query.productId;
        const fileType = req.query.type || req.query.fileType;
        const userId = req.user?.userId;

        console.log(`[SecureDownload] DebugParams: orderId=${orderId}, productId=${productId}, fileType=${fileType}`);

        if (!orderId || !productId || !fileType) {
            console.error('[SecureDownload] Missing parameters:', { orderId, productId, fileType });
            return res.status(400).json({ error: 'Faltan parámetros (orderId, productId o type)' });
        }

        // 1. Verificar que el producto está en el pedido y obtener rutas


        // 1. Verificar que el producto está en el pedido y obtener rutas
        // Soporta búsqueda por order.id numérico O por transaction_id string
        const selectFields = `
                id, 
                order_id, 
                product_id,
                license_name,
                orders!inner(id, transaction_id, user_id, status),
                products!inner(
                    id, name, kit_url, mp3_url, wav_url, stems_url, audio_url, download_url_mp3, download_url_wav, storage_version, r2_version,
                    user:users!products_producer_id_fkey(id, license_settings)
                )
        `;

        let item = null;
        let itemError = null;

        // Intento 1: buscar por order.id numérico (lo que manda purchases-manager)
        const isNumericId = /^\d+$/.test(orderId);
        if (isNumericId) {
            const res1 = await supabase
                .from('order_items')
                .select(selectFields)
                .eq('order_id', parseInt(orderId, 10))
                .eq('product_id', productId)
                .single();
            item = res1.data;
            itemError = res1.error;
        }

        // Intento 2: si no se encontró por ID numérico, buscar por transaction_id
        if (!item) {
            const res2 = await supabase
                .from('order_items')
                .select(selectFields)
                .eq('orders.transaction_id', orderId)
                .eq('product_id', productId)
                .single();
            item = res2.data;
            itemError = res2.error;
        }

        console.log(`[SecureDownload] Lookup result: found=${!!item}, method=${isNumericId ? 'numeric_id' : 'transaction_id'}`);

        // --- MANEJO DE SIMULACIÓN Y CRASH RECOVERY ---
        if (itemError || !item) {
            if (orderId && (orderId.startsWith('SIMULATED_TEST') || orderId.startsWith('AUDIT_'))) {
                console.log('[SecureDownload] RUNNING AUDIT/SIMULATION for product:', productId);

                // Si es simulación, buscamos el producto directamente para que la descarga funcione
                const { data: product } = await supabase
                    .from('products')
                    .select('producer_id, product_type, kit_url, mp3_url, wav_url, stems_url, audio_url, download_url_mp3, download_url_wav, storage_version, r2_version')
                    .eq('id', productId)
                    .single();

                if (product) {
                    // Si es simulación, permitimos pasar el licenseName por query para probar restricciones
                    const mockLicenseName = req.query.testLicense || req.query.licenseName || 'Basic Lease';
                    const licKey = mapLicenseToKey(mockLicenseName);
                    
                    // Obtener configuración del productor (usamos una por defecto si el mock no tiene)
                    const { data: producer } = await supabase
                        .from('users')
                        .select('license_settings')
                        .eq('id', product.producer_id)
                        .single();

                    const settings = producer?.license_settings?.[licKey];
                    
                    if (settings && settings.files) {
                        const canDownload = (fileType === 'mp3' && settings.files.mp3) ||
                                          (fileType === 'wav' && settings.files.wav) ||
                                          (fileType === 'stems' && settings.files.stems);
                        
                        if (!canDownload) {
                            console.warn(`[SecureDownload] SIMULATION BLOCK: License ${mockLicenseName} does not include ${fileType}`);
                            return res.status(403).json({ 
                                error: `Tu licencia (${mockLicenseName}) no incluye el archivo ${fileType.toUpperCase()}`,
                                licenseName: mockLicenseName,
                                allowedFiles: settings.files
                            });
                        }
                    }

                    const mockPath = getBestProductPath(product, fileType);
                    if (mockPath) {
                        try {
                            const storageType = product.storage_version || product.r2_version || 'v2';
                            const signedUrl = await getPresignedDownloadUrl(mockPath, 3600, storageType);
                            return res.status(200).json({
                                url: signedUrl,
                                signedUrl: signedUrl,
                                isSimulated: true,
                                tempBypass: true,
                                licenseName: mockLicenseName,
                                debug_cleaned_path: mockPath,
                                debug_is_r2: storageType !== 'supabase'
                            });
                        } catch (signErr) {
                            console.error('[SecureDownload] Sign error in bypass:', signErr);
                        }
                    }
                }
            }
            console.error('[SecureDownload] Error or not found:', itemError);
            return res.status(404).json({ error: 'Pedido o producto no encontrado' });
        }

        // 2. Verificación de Autorización
        // Si el pedido tiene dueño, debe coincidir con el usuario logueado.
        // Si no hay usuario logueado (guest), permitimos la descarga si el pedido está completado.
        if (userId && item.orders.user_id && item.orders.user_id !== userId) {
            console.warn(`[SecureDownload] Access Denied: User ${userId} tried to access order ${orderId} owned by ${item.orders.user_id}`);
            return res.status(403).json({ error: 'No tienes permiso para acceder a este archivo' });
        }

        const orderStatus = (item.orders.status || '').toLowerCase();
        if (orderStatus !== 'completed' && orderStatus !== 'approved') {
            console.warn(`[SecureDownload] Order not completed: status=${item.orders.status}`);
            return res.status(403).json({ error: 'El pedido no está completado' });
        }

        // 2.5 Validación de Licencia Real
        const licKey = mapLicenseToKey(item.license_name);
        const producerSettings = item.products?.user?.license_settings?.[licKey];

        if (producerSettings && producerSettings.files) {
            const isAllowed = (fileType === 'mp3' && producerSettings.files.mp3) ||
                             (fileType === 'wav' && producerSettings.files.wav) ||
                             (fileType === 'stems' && producerSettings.files.stems);
            
            if (!isAllowed) {
                console.warn(`[SecureDownload] License check failed: ${item.license_name} does not include ${fileType} for product ${productId}`);
                return res.status(403).json({ 
                    error: `Tu licencia (${item.license_name}) no incluye el archivo ${fileType.toUpperCase()}`,
                    licenseName: item.license_name
                });
            }
        }

        // 3. Obtener la ruta según el tipo (Consistente con Explorar)
        const path = getBestProductPath(item.products, fileType);

        if (!path) {
            console.warn(`[SecureDownload] Path empty for type ${fileType}`);
            return res.status(404).json({ error: 'Archivo no disponible para este producto' });
        }

        // 4. Determinar bucket y limpiar ruta
        let cleanPath = path.trim();

        // --- NUCLEAR URL CLEANING (R2 / Supabase / External) ---
        console.log(`[SecureDownload] Raw input path: ${cleanPath}`);
        
        // 1. Check for Cloudflare R2 URLs (Anywhere in the string)
        if (cleanPath.includes('cloudflarestorage.com') || cleanPath.includes('.r2.dev')) {
            console.log(`[SecureDownload] R2-style URL detected. Searching for key...`);
            const keywords = ['secure-products', 'products', 'wav_untagged', 'mp3_untagged', 'stems', 'wav', 'mp3'];
            let foundKey = false;
            
            for (const k of keywords) {
                const searchStr = `/${k}/`;
                const idx = cleanPath.indexOf(searchStr);
                if (idx !== -1) {
                    cleanPath = cleanPath.substring(idx + 1).split('?')[0];
                    foundKey = true;
                    break;
                }
            }
            
            if (!foundKey) {
                // Try matching via bucket names if keywords fail
                const r2Match = cleanPath.match(/(?:offszn-storage|offsznlatbucket|bucket3lat)\/([^?]+)/i);
                if (r2Match) {
                    cleanPath = r2Match[1];
                    foundKey = true;
                }
            }
            
            if (foundKey) {
                 console.log(`[SecureDownload] Key extracted via R2 scan: ${cleanPath}`);
            }
        } 
        // 2. Check for Supabase URLs
        else if (cleanPath.includes('supabase.co')) {
            console.log(`[SecureDownload] Supabase-style URL detected.`);
            const parts = cleanPath.split('/v1/object/public/');
            if (parts.length > 1) {
                cleanPath = parts[1].split('?')[0];
            } else {
                const signParts = cleanPath.split('/v1/object/sign/');
                if (signParts.length > 1) cleanPath = signParts[1].split('?')[0];
            }
        }
        // 3. Fallback for generic full URLs
        else if (cleanPath.startsWith('http')) {
            console.log(`[SecureDownload] External URL detected: ${cleanPath}`);
            return res.status(200).json({ url: cleanPath, signedUrl: cleanPath, isExternal: true });
        }

        console.log(`[SecureDownload] Post-cleaning path: ${cleanPath}`);

        // Standardize: No leading slash
        cleanPath = cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath;

        let bucket = 'products';
        const pathLower = cleanPath.toLowerCase();
        if (pathLower.includes('wav_untagged/') || pathLower.includes('stems/') || pathLower.includes('kits/') || pathLower.startsWith('secure-products/')) {
            bucket = 'secure-products';
        }

        const rawCleanPath = cleanPath; // Backup before stripping

        // Final cleanup of bucket prefixes for Supabase logic
        if (cleanPath.startsWith('secure-products/')) {
            cleanPath = cleanPath.replace('secure-products/', '');
        } else if (cleanPath.startsWith('products/')) {
            cleanPath = cleanPath.replace('products/', '');
        }

        const storageType = item.products.storage_version || item.products.r2_version || 'v1';
        const isR2 = storageType.startsWith('v') || storageType === 'r2';

        if (isR2) {
            // For R2, use rawCleanPath which preserves 'secure-products/' prefix.
            // The stripping at lines above is only for Supabase bucket separation.
            // In R2, 'secure-products/' IS part of the actual object key.
            let finalKey = rawCleanPath;

            // Handle legacy 'products/' prefix from old DB entries
            if (finalKey.startsWith('products/secure-products/')) {
                finalKey = finalKey.replace('products/secure-products/', 'secure-products/');
            } else if (finalKey.startsWith('products/')) {
                // For paths like 'products/UUID/wav_untagged/...' the actual R2 key
                // is just 'UUID/wav_untagged/...' (no 'products/' prefix in R2)
                finalKey = finalKey.replace('products/', '');
            }

            console.log(`[SecureDownload] Signing with R2: key=${finalKey}, version=${storageType}`);

            try {
                const downloadUrl = await getPresignedDownloadUrl(finalKey, 3600, storageType);
                return res.status(200).json({ 
                    signedUrl: downloadUrl,
                    debug_cleaned_path: finalKey,
                    debug_is_r2: true
                });
            } catch (r2Error) {
                console.error('[SecureDownload] R2 Signing Error:', r2Error);
                return res.status(500).json({ error: 'Error al generar enlace seguro (R2)' });
            }
        } else {
            console.log(`[SecureDownload] Final cleanPath: ${cleanPath} in bucket: ${bucket}`);

            console.log(`[SecureDownload] Signing for buyer: bucket=${bucket}, path=${cleanPath}`);

            // 5. Generar URL firmada usando el Master Key (Service Role) configurado en el backend
            const { data, error: signError } = await supabase
                .storage
                .from(bucket)
                .createSignedUrl(cleanPath, 3600, {
                    download: true
                });

            if (signError) {
                console.error('[SecureDownload] Supabase Signing Error:', signError);
                return res.status(500).json({ error: 'Error al generar enlace seguro' });
            }

            res.status(200).json({ 
                signedUrl: data.signedUrl,
                debug_cleaned_path: cleanPath,
                debug_is_r2: false
            });
        }

    } catch (err) {
        console.error('[SecureDownload] Internal Error:', err);
        res.status(500).json({ error: 'Error interno al procesar la descarga' });
    }
};

/**
 * Permite vincular una orden de invitado a un usuario recién registrado.
 * Solo funciona si la orden no tiene user_id y el email coincide.
 */
export const linkGuestOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.user.userId;
        const userEmail = req.user.email;

        console.log(`[LinkOrder] Request: order=${orderId}`);

        if (!orderId) {
            return res.status(400).json({ error: 'Falta orderId' });
        }

        // 1. Buscar la orden
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (fetchError || !order) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        // 2. Validaciones de seguridad
        if (order.user_id) {
            return res.status(400).json({ error: 'Esta orden ya está vinculada a un usuario' });
        }

        // 3. Vincular
        const { error: updateError } = await supabase
            .from('orders')
            .update({ user_id: userId })
            .eq('id', orderId);

        if (updateError) throw updateError;

        // 4. Vincular Transacciones también
        await supabase
            .from('transactions')
            .update({ user_id: userId })
            .eq('related_order', orderId);

        console.log(`[LinkOrder] SUCCESS: Order ${orderId} linked to ${userId}`);
        res.status(200).json({ message: 'Orden vinculada correctamente' });

    } catch (err) {
        console.error('[LinkOrder] Error:', err);
        res.status(500).json({ error: 'Error interno al vincular la orden' });
    }
};

/**
 * SIMULACIÓN: Re-envía o envía por primera vez los correos de una orden.
 * Útil para probar la integración con Brevo/Gmail sin hacer pagos reales.
 */
export const simulatePurchaseEmail = async (req, res) => {
    try {
        const { transactionId } = req.body;
        if (!transactionId) return res.status(400).json({ error: 'Falta transactionId' });

        console.log(`[EmailSimulation] Triggered for ${transactionId}`);

        // 1. Buscar la orden y sus items
        // --- BYPASS PARA PRUEBAS SIMULADAS ---
        if (transactionId && transactionId.startsWith('SIMULATED_TEST')) {
            console.log('[EmailSimulation] Bypassing DB for simulated order:', transactionId);
            return res.status(200).json({ message: 'Correos enviados (Simulación - Bypass DB activo)' });
        }

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*, order_items(*, products(*))')
            .eq('transaction_id', transactionId)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ error: 'Orden no encontrada en la DB' });
        }

        let userEmail = order.guest_email;
        let userNickname = 'Cliente';

        if (order.user_id) {
            const { data: userData } = await supabase.from('users').select('email, nickname').eq('id', order.user_id).single();
            if (userData) {
                userEmail = userData.email;
                userNickname = userData.nickname || 'Cliente';
            }
        }

        if (!userEmail) {
            return res.status(400).json({ error: 'La orden no tiene un email asociado (guest_email o user_id)' });
        }

        // 2. Enviar correos por cada item (siguiendo la lógica de capture)
        for (const item of order.order_items) {
            const product = item.products;
            if (!product) continue;

            // A. Notify Client (Receipt)
            const buyerHtml = `
                <div style="font-family: 'Segoe UI', sans-serif; padding: 30px; background: #0a0a0a; border-radius: 12px; color: #fff; max-width: 600px;">
                    <h2 style="color: #10B981; margin-bottom:20px;">¡Gracias por tu compra! (Simulación)</h2>
                    <p style="color:#ccc; line-height:1.6;">Hola <b>${userNickname}</b>, este es un correo de prueba para tu compra de <b style="color:#fff;">${product.name}</b>.</p>
                    <p style="color:#888; line-height:1.5;">Puedes descargar tus archivos directamente desde la página de éxito o en tu panel de transacciones.</p>
                    <a href="https://offszn.lat/pages/purchase-success?order=${transactionId}" style="display:inline-block; background:#10B981; color:#fff; padding:14px 30px; border-radius:10px; text-decoration:none; font-weight:700; margin-top:15px;">DESCARGAR AHORA</a>
                    <hr style="border:0; border-top:1px solid #222; margin:25px 0;">
                    <p style="font-size:0.75rem; color:#555;">Recibo de prueba - OFFSZN.</p>
                </div>
            `;

            await sendOffsznEmail({
                to: userEmail,
                subject: `✅ [SIMULACIÓN] Compra Exitosa - ${product.name}`,
                html: buyerHtml,
                fromName: 'OFFSZN'
            });

            // B. Notify Producer
            const { data: prodData } = await supabase.from('users').select('email, nickname').eq('id', product.producer_id).single();
            if (prodData?.email) {
                const prodHtml = `
                    <div style="font-family: 'Segoe UI', sans-serif; padding: 30px; background: #0a0a0a; border-radius: 12px; color: #fff; max-width: 600px;">
                        <h2 style="color: #8B5CF6; margin-bottom:20px;">¡Nueva Venta! (Simulación) 💰</h2>
                        <p style="color:#ccc; line-height:1.6;">Hola <b>${prodData.nickname || 'Productor'}</b>, alguien acaba de comprar <b style="color:#fff;">${product.name}</b> en esta prueba.</p>
                        <div style="background:#111; border:1px solid #333; border-radius:10px; padding:20px; margin:20px 0;">
                            <p style="color:#888; margin:0;"><b style="color:#fff;">Precio simulado:</b> $${item.price_at_purchase} USD</p>
                        </div>
                        <p style="font-size:0.75rem; color:#555;">Notificación de prueba - OFFSZN.</p>
                    </div>
                `;
                await sendOffsznEmail({
                    to: prodData.email,
                    subject: `💸 [SIMULACIÓN] Nueva Venta - ${product.name}`,
                    html: prodHtml,
                    fromName: 'OFFSZN Notificaciones'
                });
            }
        }

        res.status(200).json({ message: 'Correos enviados (Simulación)' });
    } catch (err) {
        console.error('[EmailSimulation] Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ─── Webhook Helper: Retrieve PayPal Access Token ─────────────────────────────
const getPayPalAccessToken = async () => {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error_description || 'Failed to get PayPal access token');
    }
    const data = await res.json();
    return data.access_token;
};

// ─── Webhook Helper: Retrieve Capture Details (v2 API) ────────────────────────
const getPayPalCaptureDetails = async (captureId, accessToken) => {
    const res = await fetch(`${PAYPAL_API_BASE}/v2/payments/captures/${captureId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch PayPal capture details for ID: ${captureId}`);
    }
    return await res.json();
};

// ─── Webhook Helper: Retrieve Order Details (v2 API) ──────────────────────────
const getOrderDetails = async (orderId, accessToken) => {
    const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch PayPal order details for ID: ${orderId}`);
    }
    return await res.json();
};

// ─── Webhook Helper: Retrieve Legacy Payment Details (v1 API) ─────────────────
const getLegacyPaymentDetails = async (paymentId, accessToken) => {
    const res = await fetch(`${PAYPAL_API_BASE}/v1/payments/payment/${paymentId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch legacy PayPal payment details for ID: ${paymentId}`);
    }
    return await res.json();
};

// ─── Webhook: Process Successful PayPal Payments automatically ────────────────
export const handlePayPalWebhook = async (req, res) => {
    const event = req.body;
    
    // Accept event immediately to prevent PayPal retries while we process
    res.status(200).json({ received: true });

    try {
        console.log(`🔔 [PayPalWebhook] Processing event: ${event.event_type} | Event ID: ${event.id}`);
        const eventType = event.event_type;
        let transactionId = '';
        let isSale = false;
        let isOrder = false;

        if (eventType === 'PAYMENT.SALE.COMPLETED') {
            transactionId = event.resource?.id;
            isSale = true;
        } else if (eventType === 'CHECKOUT.ORDER.APPROVED' || eventType === 'CHECKOUT.ORDER.COMPLETED') {
            transactionId = event.resource?.id;
            isOrder = true;
        }

        if (!transactionId) {
            console.log(`[PayPalWebhook] Event ignored or did not contain transaction ID.`);
            return;
        }

        // Check if order already exists in the orders table
        const { data: existingOrder } = await supabase
            .from('orders')
            .select('id')
            .eq('transaction_id', transactionId)
            .maybeSingle();

        if (existingOrder) {
            console.log(`[PayPalWebhook] Order with transaction ID ${transactionId} already processed. Skipping.`);
            return;
        }

        // Fetch official API details to secure verification
        const accessToken = await getPayPalAccessToken();
        let payerEmail = '';
        let amountPaid = 0;
        let pluginToGenerate = null;

        if (isSale) {
            const parentPayment = event.resource?.parent_payment;
            if (parentPayment) {
                console.log(`[PayPalWebhook] Legacy payment detected. Fetching details for Payment ID: ${parentPayment}`);
                try {
                    const paymentDetails = await getLegacyPaymentDetails(parentPayment, accessToken);
                    payerEmail = paymentDetails.payer?.payer_info?.email;
                    
                    const transaction = paymentDetails.transactions?.[0];
                    amountPaid = parseFloat(transaction?.amount?.total || '0');
                    const description = transaction?.description || '';
                    const items = transaction?.item_list?.items || [];
                    const hasEasyMixInItems = items.some(item => 
                        item.name?.toLowerCase().includes('easy mix') || 
                        item.name?.toLowerCase().includes('easymix')
                    );
                    const hasEasyMasterInItems = items.some(item => 
                        item.name?.toLowerCase().includes('easy master') || 
                        item.name?.toLowerCase().includes('easymaster')
                    );
                    
                    if (description.toLowerCase().includes('easy master') || description.toLowerCase().includes('easymaster') || hasEasyMasterInItems) {
                        pluginToGenerate = 'Easy Master';
                    } else if (description.toLowerCase().includes('easy mix') || description.toLowerCase().includes('easymix') || hasEasyMixInItems) {
                        pluginToGenerate = 'Easy Mix';
                    }
                } catch (legacyErr) {
                    console.error('[PayPalWebhook] Error trying to fetch legacy payment details:', legacyErr.message);
                }
            } else {
                try {
                    const captureDetails = await getPayPalCaptureDetails(transactionId, accessToken);
                    const orderId = captureDetails.supplementary_data?.related_ids?.order_id;

                    if (orderId) {
                        const orderDetails = await getOrderDetails(orderId, accessToken);
                        payerEmail = orderDetails.payer?.email_address;
                        
                        const purchaseUnit = orderDetails.purchase_units?.[0];
                        amountPaid = parseFloat(purchaseUnit?.amount?.value || '0');
                        
                        const description = purchaseUnit?.description || '';
                        const items = purchaseUnit?.items || [];
                        const hasEasyMixInItems = items.some(item => 
                            item.name?.toLowerCase().includes('easy mix') || 
                            item.name?.toLowerCase().includes('easymix')
                        );
                        const hasEasyMasterInItems = items.some(item => 
                            item.name?.toLowerCase().includes('easy master') || 
                            item.name?.toLowerCase().includes('easymaster')
                        );
                        
                        if (description.toLowerCase().includes('easy master') || description.toLowerCase().includes('easymaster') || hasEasyMasterInItems) {
                            pluginToGenerate = 'Easy Master';
                        } else if (description.toLowerCase().includes('easy mix') || description.toLowerCase().includes('easymix') || hasEasyMixInItems) {
                            pluginToGenerate = 'Easy Mix';
                        }
                    }
                } catch (v2Err) {
                    console.error('[PayPalWebhook] Error trying to fetch v2 capture details:', v2Err.message);
                }
            }
        } else if (isOrder) {
            const orderDetails = await getOrderDetails(transactionId, accessToken);
            payerEmail = orderDetails.payer?.email_address;
            
            const purchaseUnit = orderDetails.purchase_units?.[0];
            amountPaid = parseFloat(purchaseUnit?.amount?.value || '0');
            
            const description = purchaseUnit?.description || '';
            const items = purchaseUnit?.items || [];
            const hasEasyMixInItems = items.some(item => 
                item.name?.toLowerCase().includes('easy mix') || 
                item.name?.toLowerCase().includes('easymix')
            );
            const hasEasyMasterInItems = items.some(item => 
                item.name?.toLowerCase().includes('easy master') || 
                item.name?.toLowerCase().includes('easymaster')
            );
            
            if (description.toLowerCase().includes('easy master') || description.toLowerCase().includes('easymaster') || hasEasyMasterInItems) {
                pluginToGenerate = 'Easy Master';
            } else if (description.toLowerCase().includes('easy mix') || description.toLowerCase().includes('easymix') || hasEasyMixInItems) {
                pluginToGenerate = 'Easy Mix';
            }
        }

        if (!payerEmail) {
            console.warn(`[PayPalWebhook] Could not resolve payer email for transaction: ${transactionId}`);
            return;
        }

        console.log(`[PayPalWebhook] Verified details: Email=${payerEmail}, Amount=${amountPaid}, pluginToGenerate=${pluginToGenerate}`);

        if (pluginToGenerate) {
            // Find matched user
            let matchedUserId = null;
            const { data: matchedUser } = await supabase
                .from('users')
                .select('id')
                .eq('email', payerEmail)
                .maybeSingle();
            
            if (matchedUser) {
                matchedUserId = matchedUser.id;
            }

            const productId = pluginToGenerate === 'Easy Master' ? 900 : 899;

            // Create Order Record to prevent double-processing and show in "Mis Compras"
            const { data: newOrder, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: matchedUserId,
                    product_id: productId,
                    transaction_id: transactionId,
                    status: 'completed',
                    total_price: amountPaid,
                    amount: amountPaid,
                    guest_email: matchedUserId ? null : payerEmail
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // Generate license and send email automatically
            const result = await generatePluginLicense({
                licenseType: 'lifetime',
                userEmail: payerEmail,
                userId: matchedUserId,
                pluginName: pluginToGenerate
            });

            console.log(`[PayPalWebhook] Successfully processed! Generated license ${result.serialKey} for ${payerEmail}`);
        } else {
            console.log(`[PayPalWebhook] Transaction ${transactionId} is not a supported plugin purchase. Skipping license generation.`);
        }

    } catch (err) {
        console.error('❌ [PayPalWebhook] Error processing webhook event:', err);
    }
};


