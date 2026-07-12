import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
    // 1. Check novagxv3@gmail.com
    console.log('═══════════════════════════════════════════════');
    console.log('  LICENCIAS DE novagxv3@gmail.com');
    console.log('═══════════════════════════════════════════════');
    
    const { data: user } = await supabase
        .from('users')
        .select('id, email, username, created_at')
        .eq('email', 'novagxv3@gmail.com')
        .single();
    
    if (user) {
        console.log(`User: ${user.username} (${user.email})`);
        console.log(`ID: ${user.id}`);
        console.log(`Registered: ${user.created_at}`);
        
        const { data: licenses } = await supabase
            .from('plugin_licenses')
            .select('*')
            .eq('user_id', user.id);
        
        if (licenses && licenses.length > 0) {
            licenses.forEach(l => {
                const expired = l.expires_at && new Date(l.expires_at) < new Date();
                console.log(`\n  Serial: ${l.serial_key}`);
                console.log(`  Type: ${l.license_type} | Status: ${l.status}`);
                console.log(`  Expires: ${l.expires_at || 'NEVER'} ${expired ? '⚠️ EXPIRED' : '✅ ACTIVE'}`);
                console.log(`  Max devices: ${l.max_devices} | Plugin: ${l.plugin_name}`);
            });
        } else {
            console.log('  No licenses found for this user');
        }
    } else {
        console.log('  User not found!');
    }

    // 2. Full panorama of ALL trial keys
    console.log('\n\n═══════════════════════════════════════════════');
    console.log('  TODAS LAS LICENCIAS TRIAL EN LA BD');
    console.log('═══════════════════════════════════════════════');
    
    const { data: allTrials } = await supabase
        .from('plugin_licenses')
        .select('serial_key, license_type, status, expires_at, user_id, plugin_name, max_devices, created_at')
        .eq('license_type', 'trial')
        .order('created_at', { ascending: false });
    
    if (allTrials) {
        const now = new Date();
        let countExpired = 0;
        let countActive = 0;
        let countEasyTrial = 0;
        let countTrial = 0;
        
        console.log(`\nTotal trial keys: ${allTrials.length}\n`);
        
        for (const t of allTrials) {
            const expired = t.expires_at && new Date(t.expires_at) < now;
            if (expired) countExpired++; else countActive++;
            if (t.serial_key.startsWith('EASY-TRIAL')) countEasyTrial++;
            else if (t.serial_key.startsWith('TRIAL-')) countTrial++;
            
            // Get username if user_id exists
            let username = '-';
            if (t.user_id) {
                const { data: u } = await supabase.from('users').select('username, email').eq('id', t.user_id).single();
                if (u) username = `${u.username} (${u.email})`;
            }
            
            const statusIcon = expired ? '🔴' : (t.status === 'expired' ? '🟡' : '🟢');
            console.log(`${statusIcon} ${t.serial_key}`);
            console.log(`   User: ${username}`);
            console.log(`   Status: ${t.status} | Expires: ${t.expires_at || 'N/A'} ${expired ? '← EXPIRADO' : ''}`);
            console.log('');
        }
        
        console.log('═══════════════════════════════════════════════');
        console.log('  RESUMEN');
        console.log('═══════════════════════════════════════════════');
        console.log(`  Total trials: ${allTrials.length}`);
        console.log(`  Format EASY-TRIAL-*: ${countEasyTrial} (web-generated)`);
        console.log(`  Format TRIAL-*: ${countTrial} (plugin-generated)`);
        console.log(`  Active (aún vigentes): ${countActive}`);
        console.log(`  Expired (vencidas): ${countExpired}`);
    }
    
    // 3. Also show ALL FULL licenses (non-trial)
    console.log('\n\n═══════════════════════════════════════════════');
    console.log('  LICENCIAS FULL / LIFETIME');
    console.log('═══════════════════════════════════════════════');
    
    const { data: fullLics } = await supabase
        .from('plugin_licenses')
        .select('serial_key, license_type, status, expires_at, user_id, plugin_name, max_devices')
        .neq('license_type', 'trial')
        .order('created_at', { ascending: false });
    
    if (fullLics) {
        for (const l of fullLics) {
            let username = '-';
            if (l.user_id) {
                const { data: u } = await supabase.from('users').select('username, email').eq('id', l.user_id).single();
                if (u) username = `${u.username} (${u.email})`;
            }
            console.log(`✅ ${l.serial_key} | ${l.license_type} | ${l.status}`);
            console.log(`   User: ${username} | Plugin: ${l.plugin_name}`);
            console.log('');
        }
    }
}

main().catch(console.error);
