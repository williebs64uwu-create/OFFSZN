const fs = require('fs');

const envContent = fs.readFileSync('c:/Users/Willie/Desktop/OFFSZN/server/.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if(parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/['"]/g, '');
    }
});

const supabaseUrl = env['SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_KEY'] || env['SUPABASE_ANON_KEY'];

const tracks = [
    { id: 330, name: "LOCO PECADOR", filename: "1771986943173_LOCO_PECADOR_Prod.BP_.mp3", uuid: "c6d82b6d-4e1e-4064-9782-291d854311d5" },
    { id: 295, name: "MIRAR", filename: "1771803074053_MIRAR_PROD._BP_.mp3", uuid: "c6d82b6d-4e1e-4064-9782-291d854311d5" }
];

async function checkSupabase() {
    for (const track of tracks) {
        const paths = [
            `products/${track.uuid}/mp3_tagged/${track.filename}`,
            `products/${track.uuid}/audio/${track.filename}`,
            `products/beats/mp3/${track.uuid}/${track.filename}`
        ];
        
        console.log(`--- Checking ${track.name} ---`);
        for (const path of paths) {
            const url = `${supabaseUrl}/storage/v1/object/info/public/${path}`;
            try {
                const response = await fetch(url, {
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`
                    }
                });
                
                if (response.ok) {
                    console.log(`[FOUND] ${path}`);
                    return;
                } else {
                    console.log(`[NOT FOUND] ${path} (${response.status})`);
                }
            } catch (e) {
                console.error(`Fetch error for ${path}:`, e);
            }
        }
    }
}

checkSupabase();
