import crypto from 'crypto';
import { supabase } from '../../database/connection.js';
import { findPluginByName, DEFAULT_PLUGIN } from '../../../shared/config/pluginRegistry.js';

// ─── ALMACENAMIENTO EN MEMORIA DE CÓDIGOS DE DISPOSITIVO (RFC 8628) ─────────────
// Map indexado por device_code y user_code con TTL de 10 minutos
const activeDeviceCodes = new Map();

// Caracteres legibles sin ambigüedad (sin 0/O, sin 1/I)
const CODE_CHARS = 'BCDFGHJKLMNPQRSTVWXYZ23456789';

function generateUserFriendlyCode() {
    let result = '';
    const bytes = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) {
        if (i === 4) result += '-';
        result += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    }
    return result;
}

// Limpieza periódica de códigos expirados cada 5 minutos
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of activeDeviceCodes.entries()) {
        if (entry.expires_at <= now) {
            activeDeviceCodes.delete(key);
        }
    }
}, 300000);

// ─── 1. POST /api/auth/device/code ─────────────────────────────────────────────
// Solicitud iniciada por el Plugin C++ / WebView al pulsar "Log in"
export const requestDeviceCode = async (req, res) => {
    try {
        const { hwid, plugin_name = 'OFFSZN Rack' } = req.body;

        if (!hwid) {
            return res.status(400).json({ success: false, error: 'Falta parámetro hwid.' });
        }

        const deviceCode = crypto.randomBytes(24).toString('hex');
        const userCode = generateUserFriendlyCode();
        const expiresInSeconds = 600; // 10 minutos
        const expiresAt = Date.now() + (expiresInSeconds * 1000);

        const entry = {
            device_code: deviceCode,
            user_code: userCode,
            hwid: String(hwid).trim(),
            plugin_name: String(plugin_name).trim(),
            status: 'authorization_pending',
            user: null,
            expires_at: expiresAt,
            created_at: Date.now()
        };

        // Indexamos por device_code y por user_code para búsqueda O(1)
        activeDeviceCodes.set(deviceCode, entry);
        activeDeviceCodes.set(userCode.replace('-', ''), entry);

        return res.status(200).json({
            success: true,
            device_code: deviceCode,
            user_code: userCode,
            verification_uri: 'https://offszn.lat/device',
            verification_uri_complete: `https://offszn.lat/device?code=${userCode}`,
            expires_in: expiresInSeconds,
            interval: 2
        });
    } catch (error) {
        console.error('[DeviceAuth] Error en requestDeviceCode:', error);
        return res.status(500).json({ success: false, error: 'Error interno al generar código de dispositivo.' });
    }
};

// ─── 2. GET /api/auth/device/check ──────────────────────────────────────────────
// Comprueba desde el navegador si un código ingresado es válido
export const checkDeviceCode = async (req, res) => {
    try {
        const rawCode = String(req.query.code || req.body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!rawCode) {
            return res.status(400).json({ success: false, error: 'Código no proporcionado.' });
        }

        const entry = activeDeviceCodes.get(rawCode);
        if (!entry || entry.expires_at <= Date.now()) {
            return res.status(404).json({ success: false, error: 'El código no existe o ya ha expirado.' });
        }

        if (entry.status === 'approved') {
            return res.status(400).json({ success: false, error: 'Este dispositivo ya ha sido confirmado.' });
        }

        return res.status(200).json({
            success: true,
            valid: true,
            user_code: entry.user_code,
            plugin_name: entry.plugin_name,
            expires_in: Math.max(0, Math.floor((entry.expires_at - Date.now()) / 1000))
        });
    } catch (error) {
        console.error('[DeviceAuth] Error en checkDeviceCode:', error);
        return res.status(500).json({ success: false, error: 'Error al verificar código.' });
    }
};

// ─── 3. POST /api/auth/device/confirm ───────────────────────────────────────────
// El usuario autenticado en la web pulsa "Confirmar"
export const confirmDevice = async (req, res) => {
    try {
        const rawCode = String(req.body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const userId = req.user?.id || req.user?.userId;
        const userEmail = req.user?.email;

        if (!rawCode) {
            return res.status(400).json({ success: false, error: 'Código no proporcionado.' });
        }

        const entry = activeDeviceCodes.get(rawCode);
        if (!entry || entry.expires_at <= Date.now()) {
            return res.status(404).json({ success: false, error: 'El código ha expirado o no es válido.' });
        }

        // Consultar detalles del usuario en Supabase si no vienen en req.user
        let finalEmail = userEmail;
        let finalNickname = 'Usuario OFFSZN';

        if (userId) {
            const { data: dbUser } = await supabase
                .from('users')
                .select('id, email, nickname, raw_user_meta_data')
                .eq('id', userId)
                .single();
            if (dbUser) {
                finalEmail = dbUser.email || finalEmail;
                finalNickname = dbUser.nickname || finalNickname;
            }
        }

        // Marcar como aprobado
        entry.status = 'approved';
        entry.user = {
            id: userId || 'web-confirmed-user',
            email: finalEmail || 'usuario@offszn.lat',
            nickname: finalNickname
        };

        return res.status(200).json({
            success: true,
            message: 'Dispositivo vinculado con éxito. Tu plugin se desbloqueará en unos segundos.'
        });
    } catch (error) {
        console.error('[DeviceAuth] Error en confirmDevice:', error);
        return res.status(500).json({ success: false, error: 'Error al confirmar vinculación.' });
    }
};

// ─── 4. POST /api/auth/device/poll ─────────────────────────────────────────────
// El Plugin sondea periódicamente cada 2 segundos con su device_code
export const pollDeviceCode = async (req, res) => {
    try {
        const { device_code, hwid } = req.body;
        if (!device_code) {
            return res.status(400).json({ success: false, error: 'Falta device_code.' });
        }

        const entry = activeDeviceCodes.get(device_code);
        if (!entry) {
            return res.status(404).json({ success: false, status: 'expired_token', error: 'Sesión expirada.' });
        }

        if (entry.expires_at <= Date.now()) {
            activeDeviceCodes.delete(device_code);
            activeDeviceCodes.delete(entry.user_code.replace('-', ''));
            return res.status(400).json({ success: false, status: 'expired_token', error: 'Código expirado.' });
        }

        if (entry.status === 'authorization_pending') {
            return res.status(200).json({
                success: true,
                status: 'authorization_pending'
            });
        }

        if (entry.status === 'approved') {
            // Calcular fecha de lease offline (30 días por defecto)
            const leaseSeconds = 30 * 86400;
            const expiresAtUnix = Math.floor(Date.now() / 1000) + leaseSeconds;

            // Limpiamos la entrada para que no pueda ser re-usada
            activeDeviceCodes.delete(device_code);
            activeDeviceCodes.delete(entry.user_code.replace('-', ''));

            return res.status(200).json({
                success: true,
                status: 'approved',
                user: entry.user,
                license: {
                    type: 'sub_active',
                    plugin_name: entry.plugin_name,
                    hwid: entry.hwid,
                    expires_at: expiresAtUnix,
                    catalog_access: true,
                    starter_free_unlocked: true
                }
            });
        }

        return res.status(400).json({ success: false, status: entry.status });
    } catch (error) {
        console.error('[DeviceAuth] Error en pollDeviceCode:', error);
        return res.status(500).json({ success: false, error: 'Error al consultar estado del dispositivo.' });
    }
};
