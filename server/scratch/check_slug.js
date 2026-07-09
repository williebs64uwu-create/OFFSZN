import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkProductBySlug() {
    const slug = 'trust-who-drumless';
    console.log(`Searching for product with slug or name containing '${slug}'...`);

    // Let's search by public_slug
    const { data: bySlug, error: slugErr } = await supabase
        .from('products')
        .select('*')
        .eq('public_slug', slug);

    if (slugErr) {
        console.error("Error searching by public_slug:", slugErr);
    } else {
        console.log(`Results by public_slug (${bySlug?.length || 0}):`);
        bySlug.forEach(p => {
            console.log(`- ID: ${p.id} | Name: ${p.name} | Status: ${p.status} | Visibility: ${p.visibility} | Slug: ${p.public_slug}`);
        });
    }

    // Let's also do a text search on name or description just in case the slug is slightly different
    const { data: byName, error: nameErr } = await supabase
        .from('products')
        .select('id, name, public_slug, status, visibility')
        .ilike('name', '%trust%');

    if (nameErr) {
        console.error("Error searching by name:", nameErr);
    } else {
        console.log(`\nResults containing 'trust' in Name (${byName?.length || 0}):`);
        byName.forEach(p => {
            console.log(`- ID: ${p.id} | Name: ${p.name} | Status: ${p.status} | Visibility: ${p.visibility} | Slug: ${p.public_slug}`);
        });
    }
}

checkProductBySlug();
