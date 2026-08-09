import { supabase } from '../../database/connection.js';
import crypto from 'crypto';
import { sendOffsznEmail } from '../../../shared/utils/mailer.js';

// ─── Signing helpers ───────────────────────────────────────────────────────────
function getPrivateKey() {
    const keyString = process.env.PLUGIN_PRIVATE_KEY;
    if (!keyString) return null;
    try {
        return crypto.createPrivateKey({
            key: Buffer.from(keyString.trim(), 'base64'),
            format: 'der',
            type: 'pkcs8'
        });
    } catch(e) {
        console.warn('[Plugin] Could not load PLUGIN_PRIVATE_KEY:', e.message);
        return null;
    }
}

function signPayload(payload) {
    const privateKey = getPrivateKey();
    if (!privateKey) return 'no-signature';
    const signature = crypto.sign(null, Buffer.from(payload, 'utf8'), privateKey);
    return signature.toString('hex');
}

// ─── Email: Bienvenida de Activación ──────────────────────────────────────────
async function sendActivationEmail({ to, serialKey, licenseType, expiresAt }) {
    if (!to) return; // No email, skip silently
    try {
        const isTrial = licenseType === 'trial';
        const greeting = isTrial ? 'Aquí tienes los datos de tu prueba!' : 'Felicidades por tu compra!';
        const typeLabel = isTrial ? 'TRIAL' : 'FULL';

        // Auto-detect plugin name from serial prefix
        const upperSerial = (serialKey || '').toUpperCase();
        const isMaster = upperSerial.startsWith('MASTER');
        const isInka   = upperSerial.startsWith('INKA');
        const pluginName = isInka ? 'Inka Kola' : (isMaster ? 'Easy Master' : 'Easy Mix');

        const html = `
        <div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333;">
            <p>${greeting}</p>
            <p>Aquí están los datos para activar tu plugin <strong>${pluginName}</strong>:</p>
            <p>1- SERIAL KEY : <strong>${serialKey}</strong></p>
            <p>2- TIPO DE LICENCIA: <strong>${typeLabel}</strong></p>
            <br>
            <p>¡Que tengas un buen día!</p>
            <p>- Soporte de OFFSZN</p>
        </div>`;

        await sendOffsznEmail({
            to,
            subject: `Tus datos de activacion - ${pluginName}`,
            html,
            fromName: 'Soporte OFFSZN',
            type: 'transactional'
        });
        console.log(`[Plugin] Activation email for ${pluginName} sent to:`, to);
    } catch (e) {
        console.warn('[Plugin] Could not send activation email:', e.message);
        // Non-fatal — don't fail the activation
    }
}

// ─── GET /api/plugin/generate-web ─────────────────────────────────────────────
export const generateWebLicense = async (req, res) => {
    try {
        const { plugin_name } = req.body;
        const user_id = req.user?.id;
        if (!user_id) return res.status(401).json({ error: 'No autorizado' });
        if (!plugin_name) return res.status(400).json({ error: 'Falta plugin_name' });

        const { data: existingLic } = await supabase
            .from('plugin_licenses').select('*')
            .eq('user_id', user_id).eq('plugin_name', plugin_name).eq('license_type', 'lifetime').maybeSingle();

        if (existingLic) {
            return res.json({ success: true, serial_key: existingLic.serial_key, expires_at: existingLic.expires_at, license_type: 'lifetime' });
        }

        const isInkaPlugin = (plugin_name === 'INKA KOLA' || plugin_name === 'Inka Kola');
        const isMasterPlugin = (plugin_name === 'EASY MASTER' || plugin_name === 'Easy Master');
        const basePrefix = isInkaPlugin ? 'INKA' : (isMasterPlugin ? 'MASTER' : 'EASY');
        const serialKey = `${basePrefix}-FULL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const expiresAt = null;

        const { data: newLic, error: licErr } = await supabase
            .from('plugin_licenses')
            .insert({ user_id, plugin_name, serial_key: serialKey, license_type: 'lifetime', status: 'active', expires_at: expiresAt, max_devices: 3 })
            .select('serial_key, expires_at').single();

        if (licErr) throw licErr;

        // Send welcome email if user has an email
        const { data: userData } = await supabase.from('users').select('email').eq('id', user_id).single();
        await sendActivationEmail({ to: userData?.email, serialKey, licenseType: 'lifetime', expiresAt });

        return res.json({ success: true, serial_key: newLic.serial_key, expires_at: newLic.expires_at, license_type: 'lifetime' });
    } catch (error) {
        console.error('Error en generateWebLicense:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// ─── POST /api/plugin/generate-trial-web ──────────────────────────────────────
export const generateTrialWebLicense = async (req, res) => {
    try {
        const { plugin_name } = req.body;
        const user_id = req.user?.id;
        if (!user_id) return res.status(401).json({ error: 'No autorizado' });
        if (!plugin_name) return res.status(400).json({ error: 'Falta plugin_name' });

        // Check if user already has a trial for this plugin
        const { data: existingLic } = await supabase
            .from('plugin_licenses')
            .select('*')
            .eq('user_id', user_id)
            .eq('plugin_name', plugin_name)
            .eq('license_type', 'trial')
            .maybeSingle();

        if (existingLic) {
            return res.json({ success: true, serial_key: existingLic.serial_key, expires_at: existingLic.expires_at, license_type: 'trial' });
        }

        // Create new trial key
        const isMaster = (plugin_name === 'EASY MASTER' || plugin_name === 'Easy Master');
        const isInka   = (plugin_name === 'INKA KOLA'   || plugin_name === 'Inka Kola');
        const basePrefix = isInka ? 'INKA' : (isMaster ? 'MASTER' : 'EASY');
        const serialKey = `${basePrefix}-TRIAL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const expiryDate = new Date();
        const trialDays = isInka ? 7 : 3;
        expiryDate.setDate(expiryDate.getDate() + trialDays); // 7 days for INKA KOLA, 3 days for Master & Mix
        const expiresAt = expiryDate.toISOString();

        const { data: newLic, error: licErr } = await supabase
            .from('plugin_licenses')
            .insert({
                user_id,
                plugin_name,
                serial_key: serialKey,
                license_type: 'trial',
                status: 'active',
                expires_at: expiresAt,
                max_devices: 1
            })
            .select('serial_key, expires_at').single();

        if (licErr) throw licErr;

        return res.json({ success: true, serial_key: newLic.serial_key, expires_at: newLic.expires_at, license_type: 'trial' });
    } catch (error) {
        console.error('Error en generateTrialWebLicense:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};


// ─── POST /api/plugin/request-trial ───────────────────────────────────────────
export const requestTrial = async (req, res) => {
    try {
        const { hwid, device_name, plugin_name } = req.body;
        const activePluginName = plugin_name || 'Easy Mix';
        if (!hwid) return res.status(400).json({ error: 'Falta HWID' });

        // ── 1. Check if this HWID ALREADY has a trial (past or present) ──────
        // Strict: ONE trial per machine, ever. No re-trials.
        const { data: existingAct } = await supabase
            .from('plugin_activations')
            .select('license_id, plugin_licenses!inner(serial_key, expires_at, license_type, plugin_name)')
            .eq('hwid', hwid)
            .eq('plugin_licenses.license_type', 'trial')
            .eq('plugin_licenses.plugin_name', activePluginName)
            .limit(1)
            .maybeSingle();

        if (existingAct) {
            // Return their existing trial (even if expired — they used their one trial)
            const lic = existingAct.plugin_licenses;
            const now = new Date();
            const expiry = lic.expires_at ? new Date(lic.expires_at) : null;

            if (expiry && expiry < now) {
                // Trial expired → tell them to buy
                return res.status(403).json({
                    error: `Tu periodo de prueba gratuito ha expirado. Adquiere una licencia en offszn.lat/plugins para seguir usando ${activePluginName}.`,
                    trial_expired: true
                });
            }

            // Trial still valid → return same key
            const payload = `${lic.serial_key}|${lic.expires_at}`;
            const signature = signPayload(payload);
            return res.json({ success: true, serial_key: lic.serial_key, expires_at: lic.expires_at, license_type: 'trial', signature });
        }

        // ── 2. No previous trial → create one ────────────────────────────────
        const isMaster = (activePluginName === 'EASY MASTER' || activePluginName === 'Easy Master');
        const basePrefix = isMaster ? 'MASTER' : 'EASY';
        const serialKey = `${basePrefix}-TRIAL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const expiryDate = new Date();
        const trialDays = 3;
        expiryDate.setDate(expiryDate.getDate() + trialDays); // 3 days for Easy Master & Easy Mix
        const expiresAt = expiryDate.toISOString();

        const { data: newLic, error: licErr } = await supabase
            .from('plugin_licenses')
            .insert({ serial_key: serialKey, license_type: 'trial', status: 'active', expires_at: expiresAt, max_devices: 1, plugin_name: activePluginName })
            .select('id').single();
        if (licErr) throw licErr;

        await supabase.from('plugin_activations').insert({ license_id: newLic.id, hwid, device_name: device_name || 'Desconocido' });

        console.log(`[Trial] New trial created for hwid: ${hwid}, key: ${serialKey}`);
        const payload = `${serialKey}|${expiresAt}`;
        const signature = signPayload(payload);
        return res.json({ success: true, serial_key: serialKey, expires_at: expiresAt, license_type: 'trial', signature });
    } catch (error) {
        console.error('Error en requestTrial:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// ─── Helper: Generate plugin license after purchase ────────────────────────────
// Called internally from PayPalController after a successful plugin purchase.
export async function generatePluginLicense({ licenseType, userEmail, userId, pluginName = 'Easy Mix' }) {
    const isInka = (pluginName === 'INKA KOLA' || pluginName === 'Inka Kola');
    const isMaster = (pluginName === 'EASY MASTER' || pluginName === 'Easy Master');
    let basePrefix = isInka ? 'INKA' : (isMaster ? 'MASTER' : 'EASY');
    const prefix = licenseType === 'subscription' ? `${basePrefix}-SUB` : `${basePrefix}-FULL`;
    const serialKey = `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    let expiresAt = null;
    if (licenseType === 'subscription') {
        // Monthly: expires in 35 days (gives 5-day grace period)
        const d = new Date();
        d.setDate(d.getDate() + 35);
        expiresAt = d.toISOString();
    }

    const { data: newLic, error } = await supabase
        .from('plugin_licenses')
        .insert({
            serial_key: serialKey,
            license_type: licenseType === 'subscription' ? 'subscription' : 'lifetime',
            status: 'active',
            expires_at: expiresAt,
            max_devices: licenseType === 'subscription' ? 1 : 2,
            plugin_name: pluginName,
            user_id: userId || null
        })
        .select('id').single();

    if (error) throw error;

    // Send email with serial key
    await sendActivationEmail({
        to: userEmail,
        serialKey,
        licenseType: licenseType === 'subscription' ? 'subscription' : 'lifetime',
        expiresAt: expiresAt || 'never'
    });

    console.log(`[Plugin License] Generated ${serialKey} for ${userEmail} (${licenseType})`);
    return { serialKey, expiresAt, licenseId: newLic.id };
}

// ─── POST /api/plugin/activate ────────────────────────────────────────────────
export const activateSerial = async (req, res) => {
    console.log("➡️ [API /activate] Request body received:", req.body);
    try {
        const { serial_key, device_name, user_email } = req.body;
        // hwid is optional — if not provided or null, use a generic fallback
        const hwid = req.body.hwid || 'device-no-hwid';
        if (!serial_key) {
            return res.status(400).json({ error: 'Falta serial key' });
        }

        // 1. Find license
        const { data: license, error: licErr } = await supabase
            .from('plugin_licenses').select('*').eq('serial_key', serial_key).single();

        if (licErr || !license) return res.status(404).json({ error: 'Licencia no encontrada o inválida.' });
        if (license.status !== 'active') return res.status(403).json({ error: 'Esta licencia está inactiva o suspendida.' });

        // ── Validation: Match Plugin product (Inka Kola vs Easy Master vs Easy Mix) ──
        const upperSerial = (serial_key || '').toUpperCase();
        const requestedPlugin = (req.body.plugin_name || '').toLowerCase();
        const registeredPlugin = (license.plugin_name || '').toLowerCase();

        const isInkaKey = upperSerial.startsWith('INKA') || registeredPlugin.includes('inka');
        const isMasterKey = upperSerial.startsWith('MASTER') || registeredPlugin.includes('master');
        const isMixKey = (upperSerial.startsWith('EASY-') && !upperSerial.startsWith('EASY-MASTER')) || (registeredPlugin.includes('mix') && !registeredPlugin.includes('master'));

        const isInkaReq = requestedPlugin.includes('inka');
        const isMasterReq = requestedPlugin.includes('master');
        const isMixReq = requestedPlugin.includes('mix') && !requestedPlugin.includes('master');

        if (isInkaReq && !isInkaKey) {
            return res.status(403).json({ error: 'Esta licencia no pertenece a Inka Kola.' });
        }
        if (isMasterReq && !isMasterKey) {
            return res.status(403).json({ error: 'Esta licencia no pertenece a Easy Master.' });
        }
        if (isMixReq && !isMixKey) {
            return res.status(403).json({ error: 'Esta licencia no pertenece a Easy Mix.' });
        }
        if (isInkaKey && !isInkaReq && requestedPlugin.length > 0) {
            return res.status(403).json({ error: 'Esta licencia es exclusiva para Inka Kola y no sirve para otros plugins.' });
        }

        // 2. Check expiration
        if (license.expires_at && new Date(license.expires_at) < new Date()) {
            return res.status(403).json({ error: 'La licencia o prueba ha expirado.' });
        }

        // 3. Prevent Trial Abuse: one trial per HWID ever per plugin
        if (license.license_type === 'trial' && hwid !== 'device-no-hwid') {
            const { data: pastTrials, error: ptErr } = await supabase
                .from('plugin_activations')
                .select('license_id, plugin_licenses!inner(serial_key, plugin_name)')
                .eq('hwid', hwid)
                .eq('plugin_licenses.license_type', 'trial')
                .eq('plugin_licenses.plugin_name', license.plugin_name);
            
            if (!ptErr && pastTrials && pastTrials.length > 0) {
                // If they have past trials, they can only re-activate the exact same trial key
                const sameKeyExists = pastTrials.some(pt => pt.plugin_licenses.serial_key === serial_key);
                if (!sameKeyExists) {
                    return res.status(403).json({ error: 'Este equipo ya utilizó una prueba gratuita anteriormente.' });
                }
            }
        }

        // 4. Count activations — use max_devices from DB (default 1)
        const maxDevices = license.max_devices || 1;
        const { data: activations, error: actErr } = await supabase
            .from('plugin_activations').select('*').eq('license_id', license.id);
        if (actErr) throw actErr;

        const isAlreadyActivated = activations.some(a => a.hwid === hwid);
        const isFirstActivation = activations.length === 0;

        if (!isAlreadyActivated) {
            if (activations.length >= maxDevices) {
                return res.status(403).json({ error: `Límite de dispositivos alcanzado (Max: ${maxDevices}). Revoca un dispositivo para activar este.` });
            }
            await supabase.from('plugin_activations').insert({ license_id: license.id, hwid, device_name: device_name || 'Desconocido' });
            console.log("📝 [API /activate] New device registered:", hwid);

            // Send welcome email on first activation
            if (isFirstActivation) {
                const expiresAtStr = license.expires_at ? license.expires_at : 'never';
                // Try to get email: from request, or from linked user
                let toEmail = user_email;
                if (!toEmail && license.user_id) {
                    const { data: u } = await supabase.from('users').select('email').eq('id', license.user_id).single();
                    toEmail = u?.email;
                }
                await sendActivationEmail({ to: toEmail, serialKey: serial_key, licenseType: license.license_type, expiresAt: expiresAtStr });
            }
        } else {
            console.log("ℹ️ [API /activate] Device already activated:", hwid);
        }

        const expiresAtStr = license.expires_at ? new Date(license.expires_at).toISOString() : 'never';
        const payload = `${serial_key}|${expiresAtStr}`;
        const signature = signPayload(payload);

        let daysRemaining = null;
        if (license.license_type === 'trial' && license.expires_at) {
            const ms = new Date(license.expires_at) - new Date();
            daysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
        }

        console.log("✅ [API /activate] Success!", { serial_key, license_type: license.license_type, expires_at: expiresAtStr, days_remaining: daysRemaining });
        return res.json({
            success: true,
            serial_key,
            license_type: license.license_type,   // 'trial' | 'subscription' | 'lifetime'
            expires_at: expiresAtStr,
            days_remaining: daysRemaining,
            remaining_days: daysRemaining,
            signature
        });
    } catch (error) {
        console.error('💥 [API /activate] Fatal Error:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// ─── POST /api/plugin/admin/reset-license ─────────────────────────────────────
// Admin-only: Deletes an existing license + all its activations,
// then generates a fresh FULL lifetime key.
// Body: { admin_key: "...", serial_key: "EASY-FULL-...", plugin_name: "Easy Mix" }
export const adminResetLicense = async (req, res) => {
    try {
        const { admin_key, serial_key, plugin_name } = req.body;

        // Simple shared-secret auth — set PLUGIN_ADMIN_KEY in Render env vars
        const expectedKey = process.env.PLUGIN_ADMIN_KEY || 'offszn-admin-2026';
        if (admin_key !== expectedKey) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (!serial_key) {
            return res.status(400).json({ error: 'Falta serial_key' });
        }

        // 1. Find the old license
        const { data: oldLicense } = await supabase
            .from('plugin_licenses').select('id, serial_key').eq('serial_key', serial_key).single();

        if (oldLicense) {
            // 2. Delete all device activations for this license
            const { error: delActErr } = await supabase
                .from('plugin_activations').delete().eq('license_id', oldLicense.id);
            if (delActErr) console.warn('[Admin] Error deleting activations:', delActErr.message);

            // 3. Delete the license itself
            const { error: delLicErr } = await supabase
                .from('plugin_licenses').delete().eq('id', oldLicense.id);
            if (delLicErr) console.warn('[Admin] Error deleting license:', delLicErr.message);

            console.log(`🗑️ [Admin] Deleted license ${serial_key} and all its activations`);
        } else {
            console.log(`ℹ️ [Admin] License ${serial_key} not found — will just generate a new one`);
        }

        // 4. Generate a new FULL lifetime key
        const isInkaReset = (plugin_name === 'INKA KOLA' || plugin_name === 'Inka Kola');
        const isMasterReset = (plugin_name === 'EASY MASTER' || plugin_name === 'Easy Master');
        let basePrefix = isInkaReset ? 'INKA' : (isMasterReset ? 'MASTER' : 'EASY');
        const newSerial = `${basePrefix}-FULL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const { data: newLic, error: insertErr } = await supabase
            .from('plugin_licenses')
            .insert({
                serial_key: newSerial,
                license_type: 'lifetime',
                status: 'active',
                expires_at: null,
                max_devices: 3,
                plugin_name: plugin_name || 'Easy Mix'
            })
            .select('*').single();

        if (insertErr) throw insertErr;

        console.log(`✅ [Admin] New FULL license created: ${newSerial}`);

        return res.json({
            success: true,
            old_serial_deleted: serial_key,
            new_serial_key: newSerial,
            license_type: 'lifetime',
            expires_at: 'never',
            max_devices: 3
        });
    } catch (error) {
        console.error('💥 [Admin] Reset License Error:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// ─── POST /api/plugin/admin/delete-license ─────────────────────────────────────
// Admin-only: Deletes a license by serial_key (no replacement generated).
// Body: { admin_key: "...", serial_key: "INKA-FULL-..." }
export const adminDeleteLicense = async (req, res) => {
    try {
        const { admin_key, serial_key } = req.body;
        const expectedKey = process.env.PLUGIN_ADMIN_KEY || 'offszn-admin-2026';
        if (admin_key !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });
        if (!serial_key) return res.status(400).json({ error: 'Falta serial_key' });

        const { data: lic } = await supabase.from('plugin_licenses').select('id').eq('serial_key', serial_key).single();
        if (lic) {
            await supabase.from('plugin_activations').delete().eq('license_id', lic.id);
            await supabase.from('plugin_licenses').delete().eq('id', lic.id);
            console.log(`🗑️ [Admin] Deleted license ${serial_key}`);
        }
        return res.json({ success: true, deleted: serial_key });
    } catch (error) {
        console.error('💥 [Admin] Delete License Error:', error);
        res.status(500).json({ error: 'Error interno.' });
    }
};

// ─── GET /api/plugin/admin/ab-stats ──────────────────────────────────────────
// Admin-only: Returns real-time A/B Testing sales & revenue stats ($5 vs $10)
export const adminGetABStats = async (req, res) => {
    try {
        const adminKey = req.query.admin_key || req.headers['x-admin-key'];
        const expectedKey = process.env.PLUGIN_ADMIN_KEY || 'offszn-admin-2026';
        if (adminKey !== expectedKey) return res.status(403).json({ error: 'Unauthorized' });

        const { data: orderItems, error: itemsErr } = await supabase
            .from('order_items')
            .select(`
                id,
                price_at_purchase,
                created_at,
                order_id,
                orders ( id, total_price, status, created_at, guest_email, user_id ),
                products ( id, name )
            `)
            .in('product_id', [899, 900, 902])
            .order('created_at', { ascending: false });

        if (itemsErr) throw itemsErr;

        const stats = {
            easy_mix: { name: 'Easy Mix', count_5: 0, rev_5: 0, count_10: 0, rev_10: 0, total_sales: 0, total_rev: 0 },
            easy_master: { name: 'Easy Master', count_5: 0, rev_5: 0, count_10: 0, rev_10: 0, total_sales: 0, total_rev: 0 },
            inka_kola: { name: 'Inka Kola', count_5: 0, rev_5: 0, count_10: 0, rev_10: 0, total_sales: 0, total_rev: 0 },
            global: { count_5: 0, rev_5: 0, count_10: 0, rev_10: 0, total_sales: 0, total_rev: 0 }
        };

        const recentPurchases = [];

        (orderItems || []).forEach(item => {
            const prodName = item.products?.name || (item.product_id === 902 ? 'Inka Kola' : (item.product_id === 900 ? 'Easy Master' : 'Easy Mix'));
            let key = 'easy_mix';
            if (prodName.toLowerCase().includes('master')) key = 'easy_master';
            if (prodName.toLowerCase().includes('inka')) key = 'inka_kola';

            const price = parseFloat(item.price_at_purchase || item.orders?.total_price || 0);

            if (price === 5) {
                stats[key].count_5++;
                stats[key].rev_5 += 5;
                stats.global.count_5++;
                stats.global.rev_5 += 5;
            } else if (price === 10) {
                stats[key].count_10++;
                stats[key].rev_10 += 10;
                stats.global.count_10++;
                stats.global.rev_10 += 10;
            }

            stats[key].total_sales++;
            stats[key].total_rev += price;
            stats.global.total_sales++;
            stats.global.total_rev += price;

            recentPurchases.push({
                date: item.created_at || item.orders?.created_at,
                plugin: stats[key].name,
                price: price,
                buyer: item.orders?.guest_email || 'Registrado'
            });
        });

        return res.json({
            success: true,
            summary: stats,
            recent: recentPurchases.slice(0, 15)
        });
    } catch (error) {
        console.error('💥 [Admin AB Stats] Error:', error);
        res.status(500).json({ error: 'Error al consultar métricas A/B.' });
    }
};
