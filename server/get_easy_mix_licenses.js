import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Checking all columns of plugin_licenses...");
  
  let { data: licenses } = await supabase
    .from('plugin_licenses')
    .select('*')
    .eq('license_type', 'lifetime');
    
  if (licenses.length > 0) {
    console.log("Keys in license row:", Object.keys(licenses[0]));
    console.log("Details of all lifetime licenses:");
    licenses.forEach(l => {
      console.log(`- ID: ${l.id} | User ID: ${l.user_id} | Plugin: ${l.plugin_name} | Key: ${l.serial_key} | Created: ${l.created_at} | email: ${l.email || l.guest_email || 'none'}`);
    });
  }
}

main();
