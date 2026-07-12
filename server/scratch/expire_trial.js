import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const { data, error } = await supabase
    .from('plugin_licenses')
    .update({ status: 'expired', expires_at: '2025-01-01T00:00:00Z' })
    .eq('serial_key', 'EASY-TRIAL-22CB49D9-B6A6EE7C')
    .select('serial_key, status, expires_at')
    .single();

if (error) console.log('Error:', error);
else console.log('✅ EXPIRADA:', JSON.stringify(data, null, 2));
