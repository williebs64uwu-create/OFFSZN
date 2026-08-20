import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qtjpvztpgfymjhhpoouq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc4MDkxNSwiZXhwIjoyMDc2MzU2OTE1fQ.H7W46uPe7yJkQIMJSzpEJmetFwWdnYFYjF8Hug0GJ9Q';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function extendTrials() {
  console.log('🚀 Starting Easy Mix trial extension...');

  // 1. Fetch all Easy Mix trials
  const { data, error } = await supabase
    .from('plugin_licenses')
    .select('id, serial_key, plugin_name, license_type, expires_at, created_at, status')
    .ilike('plugin_name', '%mix%')
    .eq('license_type', 'trial');

  if (error) {
    console.error('❌ Error fetching trials:', error);
    return;
  }

  // Threshold: Start of yesterday (2026-08-19 00:00:00 UTC)
  const yesterdayStart = new Date('2026-08-19T00:00:00.000Z');

  const eligible = data.filter(lic => {
    const createdAt = new Date(lic.created_at);
    return createdAt < yesterdayStart && lic.expires_at;
  });

  console.log(`📊 Total found: ${data.length}`);
  console.log(`🎯 Eligible to extend by +2 days: ${eligible.length}`);
  console.log(`⛔ Excluded (created today or yesterday): ${data.length - eligible.length}`);

  let updatedCount = 0;
  let errorCount = 0;

  // Process in batches of 25 concurrently
  const BATCH_SIZE = 25;
  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (lic) => {
      try {
        const currentExp = new Date(lic.expires_at);
        const newExp = new Date(currentExp.getTime() + 2 * 24 * 60 * 60 * 1000); // +48 hours

        const { error: updateErr } = await supabase
          .from('plugin_licenses')
          .update({
            expires_at: newExp.toISOString(),
            status: 'active'
          })
          .eq('id', lic.id);

        if (updateErr) {
          console.error(`Error updating ${lic.serial_key}:`, updateErr.message);
          errorCount++;
        } else {
          updatedCount++;
        }
      } catch (err) {
        console.error(`Exception updating ${lic.serial_key}:`, err.message);
        errorCount++;
      }
    }));

    process.stdout.write(`⏳ Processed ${Math.min(i + BATCH_SIZE, eligible.length)} / ${eligible.length} licenses...\r`);
  }

  console.log(`\n\n✅ DONE! Successfully extended ${updatedCount} Easy Mix trial licenses by +2 days.`);
  if (errorCount > 0) {
    console.warn(`⚠️ Errors encountered: ${errorCount}`);
  }
}

extendTrials();
