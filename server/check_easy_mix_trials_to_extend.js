import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qtjpvztpgfymjhhpoouq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc4MDkxNSwiZXhwIjoyMDc2MzU2OTE1fQ.H7W46uPe7yJkQIMJSzpEJmetFwWdnYFYjF8Hug0GJ9Q';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkTrials() {
  const { data, error } = await supabase
    .from('plugin_licenses')
    .select('id, serial_key, plugin_name, license_type, expires_at, created_at, status')
    .ilike('plugin_name', '%mix%')
    .eq('license_type', 'trial')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching trials:', error);
    return;
  }

  console.log('Total Easy Mix trials found:', data.length);
  
  const now = new Date();
  console.log('Current time:', now.toISOString());

  // Today is 2026-08-20.
  // Yesterday was 2026-08-19.
  // "menos los creados hoy y ayer" means created BEFORE 2026-08-19 00:00:00 (i.e. <= 2026-08-18 23:59:59).
  
  const yesterdayStart = new Date('2026-08-19T00:00:00.000Z'); // or local midnight
  console.log('Threshold date (before yesterday start):', yesterdayStart.toISOString());

  const eligible = data.filter(lic => {
    const createdAt = new Date(lic.created_at);
    return createdAt < yesterdayStart;
  });

  const excluded = data.filter(lic => {
    const createdAt = new Date(lic.created_at);
    return createdAt >= yesterdayStart;
  });

  console.log(`Eligible to extend (+2 days): ${eligible.length}`);
  console.log(`Excluded (created today or yesterday): ${excluded.length}`);

  console.log('\n--- Sample of Excluded (Today / Yesterday) ---');
  excluded.slice(0, 5).forEach(lic => {
    console.log(`${lic.serial_key} | created: ${lic.created_at} | expires: ${lic.expires_at}`);
  });

  console.log('\n--- Sample of Eligible (to extend +2 days) ---');
  eligible.slice(0, 10).forEach(lic => {
    const currentExp = lic.expires_at ? new Date(lic.expires_at) : null;
    let newExp = null;
    if (currentExp) {
      newExp = new Date(currentExp.getTime() + 2 * 24 * 60 * 60 * 1000);
    }
    console.log(`${lic.serial_key} | created: ${lic.created_at} | current expires: ${lic.expires_at} -> new expires: ${newExp ? newExp.toISOString() : 'N/A'}`);
  });
}

checkTrials();
