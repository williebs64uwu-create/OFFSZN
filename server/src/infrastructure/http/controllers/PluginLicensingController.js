import { supabase } from '../../database/connection.js';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// Re-construct the private key object from the hex string stored in .env
// We need to parse the private key from the environment.
// Actually, earlier we stored it as a DER hex or similar. Let's assume process.env.PLUGIN_PRIVATE_KEY exists.

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

export const generateWebLicense = async (req, res) => {
    try {
        const { plugin_name } = req.body;
        const user_id = req.user?.id; // Assuming authenticateTokenMiddleware is used

        if (!user_id) return res.status(401).json({ error: 'No autorizado' });
        if (!plugin_name) return res.status(400).json({ error: 'Falta plugin_name' });

        // 1. Check if user already has a trial for this plugin
        const { data: existingLic } = await supabase
            .from('plugin_licenses')
            .select('*')
            .eq('user_id', user_id)
            .eq('plugin_name', plugin_name)
            .eq('license_type', 'trial')
            .single();

        if (existingLic) {
            return res.json({ success: true, serial_key: existingLic.serial_key, expires_at: existingLic.expires_at });
        }

        // 2. Generate new serial key
        const serialKey = `TRIAL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        
        // 3. 7 days expiration
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);
        const expiresAt = expiryDate.toISOString();

        // 4. Insert license
        const { data: newLic, error: licErr } = await supabase
            .from('plugin_licenses')
            .insert({
                user_id: user_id,
                plugin_name: plugin_name,
                serial_key: serialKey,
                license_type: 'trial',
                status: 'active',
                expires_at: expiresAt
            })
            .select('serial_key, expires_at')
            .single();

        if (licErr) throw licErr;

        return res.json({ success: true, serial_key: newLic.serial_key, expires_at: newLic.expires_at });
    } catch (error) {
        console.error('Error en generateWebLicense:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

export const requestTrial = async (req, res) => {
    try {
        const { hwid, device_name } = req.body;
        if (!hwid) return res.status(400).json({ error: 'Falta HWID' });

        // 1. Check if hwid already activated a trial
        const { data: existingAct } = await supabase
            .from('plugin_activations')
            .select('license_id, plugin_licenses!inner(*)')
            .eq('hwid', hwid)
            .eq('plugin_licenses.license_type', 'trial')
            .single();

        let serialKey;
        let expiresAt;

        if (existingAct) {
            // Already has a trial, return existing
            serialKey = existingAct.plugin_licenses.serial_key;
            expiresAt = existingAct.plugin_licenses.expires_at;
        } else {
            // Create new trial
            serialKey = `TRIAL-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
            // Trial expires in 7 days
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 7);
            expiresAt = expiryDate.toISOString();

            // Insert license
            const { data: newLic, error: licErr } = await supabase
                .from('plugin_licenses')
                .insert({
                    serial_key: serialKey,
                    license_type: 'trial',
                    expires_at: expiresAt
                })
                .select('id')
                .single();

            if (licErr) throw licErr;

            // Insert activation
            await supabase
                .from('plugin_activations')
                .insert({
                    license_id: newLic.id,
                    hwid: hwid,
                    device_name: device_name || 'Desconocido'
                });
        }

        // Sign the payload: HWID + Serial + Expires
        // To keep it simple: "serialKey|expiresAt"
        const payload = `${serialKey}|${expiresAt}`;
        const signature = signPayload(payload);

        return res.json({
            success: true,
            serial_key: serialKey,
            expires_at: expiresAt,
            signature: signature
        });
    } catch (error) {
        console.error('Error en requestTrial:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

export const activateSerial = async (req, res) => {
    console.log("➡️ [API /activate] Request body received:", req.body);
    try {
        const { serial_key, hwid, device_name } = req.body;
        if (!serial_key || !hwid) {
            console.log("⚠️ [API /activate] Missing serial_key or hwid in body:", { serial_key, hwid });
            return res.status(400).json({ error: 'Falta serial o hwid' });
        }

        // 1. Find license
        const { data: license, error: licErr } = await supabase
            .from('plugin_licenses')
            .select('*')
            .eq('serial_key', serial_key)
            .single();

        if (licErr || !license) {
            console.log("❌ [API /activate] License not found or error:", { serial_key, error: licErr?.message });
            return res.status(404).json({ error: 'Licencia no encontrada o inválida.' });
        }

        if (license.status !== 'active') {
            console.log("❌ [API /activate] License inactive:", { serial_key, status: license.status });
            return res.status(403).json({ error: 'Esta licencia está inactiva o suspendida.' });
        }

        // 2. Check Expiration
        if (license.expires_at) {
            if (new Date(license.expires_at) < new Date()) {
                console.log("❌ [API /activate] License expired:", { serial_key, expires_at: license.expires_at });
                return res.status(403).json({ error: 'La licencia o prueba ha expirado.' });
            }
        }

        // 3. Count Activations
        const { data: activations, error: actErr } = await supabase
            .from('plugin_activations')
            .select('*')
            .eq('license_id', license.id);

        if (actErr) {
            console.error("❌ [API /activate] Activations query error:", actErr);
            throw actErr;
        }

        const maxActivations = license.license_type === 'subscription' ? 2 : (license.license_type === 'lifetime' ? 1 : 1);
        
        // Is this device already activated?
        const isAlreadyActivated = activations.some(a => a.hwid === hwid);

        if (!isAlreadyActivated) {
            if (activations.length >= maxActivations) {
                console.log("❌ [API /activate] Activations limit reached:", { serial_key, activeCount: activations.length, max: maxActivations });
                return res.status(403).json({ error: `Límite de dispositivos alcanzado (Max: ${maxActivations}). Revoca un dispositivo para activar este.` });
            }

            // Register new activation
            await supabase
                .from('plugin_activations')
                .insert({
                    license_id: license.id,
                    hwid: hwid,
                    device_name: device_name || 'Desconocido'
                });
            console.log("📝 [API /activate] New activation registered for hwid:", hwid);
        } else {
            console.log("ℹ️ [API /activate] Device already activated:", hwid);
        }

        const expiresAtStr = license.expires_at ? new Date(license.expires_at).toISOString() : 'never';
        const payload = `${serial_key}|${expiresAtStr}`;
        const signature = signPayload(payload);

        console.log("✅ [API /activate] Success! Returning payload:", { serial_key, expires_at: expiresAtStr });
        return res.json({
            success: true,
            serial_key: serial_key,
            expires_at: expiresAtStr,
            signature: signature
        });
    } catch (error) {
        console.error('💥 [API /activate] Fatal Error:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};
