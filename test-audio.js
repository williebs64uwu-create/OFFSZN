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

async function checkTracksDeep() {
    const url = `${supabaseUrl}/rest/v1/products?select=*&id=in.(330,295)`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        
        const data = await response.json();
        console.log('Tracks:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

checkTracksDeep();
