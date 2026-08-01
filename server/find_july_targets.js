import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function findJulyTargets() {
    const { data: licenses, error } = await supabase
        .from('plugin_licenses')
        .select('*, plugin_activations(*), users(email)')
        .eq('license_type', 'trial')
        .or('plugin_name.ilike.%Easy Mix%,plugin_name.ilike.%Easy Master%')
        .order('created_at', { ascending: false });

    if (error) { console.error(error); return; }

    const now = new Date();

    // Already notified today: licenses whose expires_at is between 40h and 76h from now
    const alreadyNotifiedIds = new Set();
    licenses.forEach(l => {
        if (!l.expires_at) return;
        const diffHours = (new Date(l.expires_at) - now) / (1000 * 60 * 60);
        if (diffHours > 40 && diffHours <= 76) {
            alreadyNotifiedIds.add(l.id);
        }
    });

    const userMap = new Map();

    for (const l of licenses) {
        if (alreadyNotifiedIds.has(l.id)) continue;

        let email = l.email || l.guest_email || l.users?.email;
        if (!email && l.user_id) {
            const { data: u } = await supabase.from('users').select('email').eq('id', l.user_id).single();
            email = u?.email;
        }

        if (!email) continue;
        const normEmail = email.toLowerCase().trim();
        const created = new Date(l.created_at);

        // July 2026 filter
        const julStart = new Date('2026-07-01T00:00:00.000Z');
        const julEnd = new Date('2026-08-01T00:00:00.000Z');

        if (created < julStart || created >= julEnd) continue;

        if (!userMap.has(normEmail)) {
            userMap.set(normEmail, {
                email: normEmail,
                userId: l.user_id || null,
                mixLic: null,
                masterLic: null,
                newestDate: created
            });
        }

        const entry = userMap.get(normEmail);
        if (created > entry.newestDate) entry.newestDate = created;

        const isMaster = l.plugin_name.toLowerCase().includes('master');
        if (isMaster) {
            if (!entry.masterLic) entry.masterLic = l;
        } else {
            if (!entry.mixLic) entry.mixLic = l;
        }
    }

    const julyUsers = Array.from(userMap.values()).sort((a, b) => b.newestDate - a.newestDate);

    console.log(`=== CANDIDATOS DEL MES ANTERIOR (JULIO 2026) ===`);
    console.log(`Total usuarios únicos de Julio 2026 (excluyendo enviados hoy): ${julyUsers.length}`);

    julyUsers.slice(0, 15).forEach((u, i) => {
        console.log(`[${i + 1}] ${u.email} | MixKey: ${u.mixLic ? u.mixLic.serial_key : 'Sin clave'} | MasterKey: ${u.masterLic ? u.masterLic.serial_key : 'Sin clave'} | Fecha: ${u.newestDate.toISOString()}`);
    });
}

findJulyTargets();
