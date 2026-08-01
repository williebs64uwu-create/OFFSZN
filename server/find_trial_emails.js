import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function findEmails() {
    const { data: licenses, error } = await supabase
        .from('plugin_licenses')
        .select('*, plugin_activations(*), users(email)')
        .eq('license_type', 'trial')
        .or('plugin_name.ilike.%Easy Mix%,plugin_name.ilike.%Easy Master%')
        .order('created_at', { ascending: false });

    if (error) { console.error(error); return; }

    const now = new Date();
    const listToNotify = [];

    for (const l of licenses) {
        if (!l.expires_at) continue;
        const exp = new Date(l.expires_at);
        const diffHours = (exp - now) / (1000 * 60 * 60);

        let email = l.email || l.guest_email || l.users?.email;

        if (!email && l.user_id) {
            const { data: u } = await supabase.from('users').select('email').eq('id', l.user_id).single();
            email = u?.email;
        }

        const isGroup1 = diffHours > 24 && diffHours <= 52; // extended 2 days (NOW + 48h)
        const isGroup2 = diffHours > 52 && diffHours <= 76; // extended 3 days (NOW + 72h)

        if (isGroup1 || isGroup2) {
            listToNotify.push({
                id: l.id,
                plugin: l.plugin_name,
                serial: l.serial_key,
                group: isGroup1 ? 'Grupo 1 (Ext. 2 días)' : 'Grupo 2 (Ext. 3 días)',
                email: email || null,
                activations: l.plugin_activations?.length || 0
            });
        }
    }

    console.log(`=== LICENCIAS A NOTIFICAR (TOTAL: ${listToNotify.length}) ===\n`);
    let withEmailCount = 0;
    let noEmailCount = 0;

    listToNotify.forEach((item, idx) => {
        if (item.email) withEmailCount++;
        else noEmailCount++;

        console.log(`[${idx + 1}] ${item.group} | Plugin: ${item.plugin}`);
        console.log(`     Serial: ${item.serial}`);
        console.log(`     Email: ${item.email || '❌ Sin email en DB (creado via request-trial de plugin local)'}`);
        console.log(`     Activaciones: ${item.activations}\n`);
    });

    console.log(`📊 RESUMEN:`);
    console.log(`- Licencias con correo electrónico: ${withEmailCount}`);
    console.log(`- Licencias creadas por HWID local (sin correo): ${noEmailCount}`);
}

findEmails();
