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
        const licenseLabels = {
            trial:        '🎁 Prueba Gratuita (7 días)',
            subscription: '📅 Suscripción Mensual OFFSZN',
            lifetime:     '⭐ Licencia Lifetime — Acceso de por vida'
        };
        const expiryLine = expiresAt === 'never'
            ? '<p style="color:#30d158;font-weight:bold;">✅ Acceso de por vida — Sin vencimiento</p>'
            : `<p>Tu licencia vence el: <strong>${new Date(expiresAt).toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' })}</strong></p>`;

        const html = `
        <div style="background:#0d0d0d;color:#f0f0f0;font-family:sans-serif;padding:40px;border-radius:12px;max-width:520px;margin:auto;">
            <h1 style="color:#FFD600;letter-spacing:2px;">EASY MIX</h1>
            <h2 style="color:#fff;">¡Plugin Activado Exitosamente! 🎉</h2>
            <p>Tu licencia de <strong>Easy Mix by OFFSZN</strong> ha sido activada.</p>
            <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin:20px 0;">
                <p style="color:#aaa;font-size:13px;margin:0 0 6px;">Tu Serial Key:</p>
                <p style="font-family:monospace;font-size:18px;color:#FFD600;letter-spacing:1px;margin:0;">${serialKey}</p>
            </div>
            <p><strong>Tipo de licencia:</strong> ${licenseLabels[licenseType] || licenseType}</p>
            ${expiryLine}
            <hr style="border:1px solid #222;margin:24px 0;">
            <p style="font-size:13px;color:#888;">Guarda este correo. Si cambias de equipo necesitarás tu serial key para reactivar.<br>Soporte: <a href="https://offszn.lat" style="color:#FFD600;">offszn.lat</a></p>
        </div>`;

        await sendOffsznEmail({
            to,
            subject: '✅ Easy Mix Activado — Tu Serial Key de OFFSZN',
            html,
            fromName: 'Easy Mix by OFFSZN',
            type: 'transactional'
        });
        console.log('[Plugin] Activation email sent to:', to);
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
            .eq('user_id', user_id).eq('plugin_name', plugin_name).eq('license_type', 'trial').single();

        if (existingLic) {
            return res.json({ success: true, serial_key: existingLic.serial_key, expires_at: existingLic.expires_at, license_type: 'trial' });
        }

        const serialKey = `TRIAL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);
        const expiresAt = expiryDate.toISOString();

        const { data: newLic, error: licErr } = await supabase
            .from('plugin_licenses')
            .insert({ user_id, plugin_name, serial_key: serialKey, license_type: 'trial', status: 'active', expires_at: expiresAt, max_devices: 1 })
            .select('serial_key, expires_at').single();

        if (licErr) throw licErr;

        // Send welcome email if user has an email
        const { data: userData } = await supabase.from('users').select('email').eq('id', user_id).single();
        await sendActivationEmail({ to: userData?.email, serialKey, licenseType: 'trial', expiresAt });

        return res.json({ success: true, serial_key: newLic.serial_key, expires_at: newLic.expires_at, license_type: 'trial' });
    } catch (error) {
        console.error('Error en generateWebLicense:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// ─── POST /api/plugin/request-trial ───────────────────────────────────────────
export const requestTrial = async (req, res) => {
    try {
        const { hwid, device_name } = req.body;
        if (!hwid) return res.status(400).json({ error: 'Falta HWID' });

        const { data: existingAct } = await supabase
            .from('plugin_activations')
            .select('license_id, plugin_licenses!inner(*)')
            .eq('hwid', hwid).eq('plugin_licenses.license_type', 'trial').single();

        let serialKey, expiresAt;

        if (existingAct) {
            serialKey = existingAct.plugin_licenses.serial_key;
            expiresAt = existingAct.plugin_licenses.expires_at;
        } else {
            serialKey = `TRIAL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 7);
            expiresAt = expiryDate.toISOString();

            const { data: newLic, error: licErr } = await supabase
                .from('plugin_licenses')
                .insert({ serial_key: serialKey, license_type: 'trial', status: 'active', expires_at: expiresAt, max_devices: 1 })
                .select('id').single();
            if (licErr) throw licErr;

            await supabase.from('plugin_activations').insert({ license_id: newLic.id, hwid, device_name: device_name || 'Desconocido' });
        }

        const payload = `${serialKey}|${expiresAt}`;
        const signature = signPayload(payload);
        return res.json({ success: true, serial_key: serialKey, expires_at: expiresAt, license_type: 'trial', signature });
    } catch (error) {
        console.error('Error en requestTrial:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

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

        // 2. Check expiration
        if (license.expires_at && new Date(license.expires_at) < new Date()) {
            return res.status(403).json({ error: 'La licencia o prueba ha expirado.' });
        }

        // 3. Prevent Trial Abuse: one trial per HWID ever
        if (license.license_type === 'trial' && hwid !== 'device-no-hwid') {
            const { data: pastTrials, error: ptErr } = await supabase
                .from('plugin_activations')
                .select('license_id, plugin_licenses!inner(serial_key)')
                .eq('hwid', hwid)
                .eq('plugin_licenses.license_type', 'trial');
            
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

        console.log("✅ [API /activate] Success!", { serial_key, license_type: license.license_type, expires_at: expiresAtStr });
        return res.json({
            success: true,
            serial_key,
            license_type: license.license_type,   // 'trial' | 'subscription' | 'lifetime'
            expires_at: expiresAtStr,
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
        const newSerial = `EASY-FULL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
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
