const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('c:/Users/Willie/Desktop/OFFSZN/env.js', 'utf8');
const urlMatch = env.match(/window\.SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = env.match(/window\.SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);
const supabase = createClient(urlMatch[1], keyMatch[1]);
async function run() {
    const { data, error } = await supabase.from('products').select('image_url, r2_version, storage_version').limit(10);
    if(error) console.error(error);
    console.log(JSON.stringify(data, null, 2));
}
run();
