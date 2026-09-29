import { supabase } from '../../database/connection.js';

const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const REACH = ['menos-5k', '5k-25k', '25k-100k', '100k+'];
const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'mixto'];
const CONTENT = ['musica', 'tutoriales', 'ambos', 'otro'];

/**
 * POST /api/creators/apply
 */
export async function applyCreator(req, res) {
    try {
        const b = req.body || {};
        // Honeypot anti-bots: si viene lleno, respondemos ok sin guardar
        if (b.website) return res.status(200).json({ success: true });

        const row = {
            name: clip(b.name, 120),
            email: clip(b.email, 160).toLowerCase(),
            instagram: clip(b.instagram, 120),
            tiktok: clip(b.tiktok, 120),
            youtube: clip(b.youtube, 200),
            main_platform: PLATFORMS.includes(b.mainPlatform) ? b.mainPlatform : null,
            reach: REACH.includes(b.reach) ? b.reach : null,
            content_type: CONTENT.includes(b.contentType) ? b.contentType : null,
            best_post: clip(b.bestPost, 300)
        };

        if (!row.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
            return res.status(400).json({ success: false, message: 'Nombre y email válido son obligatorios' });
        }
        if (!row.instagram && !row.tiktok && !row.youtube) {
            return res.status(400).json({ success: false, message: 'Agrega al menos una red social' });
        }

        const { error } = await supabase.from('creator_applications').insert([row]);
        if (error) {
            console.error('[CreatorApplication] Insert error:', error.message, row);
            return res.status(500).json({ success: false, message: 'No se pudo guardar tu solicitud. Intenta de nuevo.' });
        }
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('[CreatorApplication] Error:', error);
        return res.status(500).json({ success: false, message: 'Error interno' });
    }
}
