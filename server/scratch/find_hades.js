import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findHadesBeat() {
    console.log("Searching for producer 'la7beat' or similar...");
    const { data: users, error: userErr } = await supabase
        .from('users')
        .select('id, nickname, email')
        .or('nickname.ilike.%la7%,email.ilike.%la7%');

    if (userErr) {
        console.error("Error searching users:", userErr);
        return;
    }

    console.log(`Found ${users?.length || 0} matching producers:`);
    console.log(users);

    const producerIds = users.map(u => u.id);

    console.log("\nSearching for beats containing 'hades' or from these producers...");
    
    let query = supabase.from('products').select('*');
    
    if (producerIds.length > 0) {
        query = query.or(`name.ilike.%hades%,producer_id.in.(${producerIds.join(',')})`);
    } else {
        query = query.ilike('name', '%hades%');
    }

    const { data: products, error: prodErr } = await query;

    if (prodErr) {
        console.error("Error searching products:", prodErr);
        return;
    }

    console.log(`\nFound ${products?.length || 0} products:`);
    for (const p of products) {
        const prodUser = users.find(u => u.id === p.producer_id) || { nickname: p.producer_id };
        console.log(`\nID:          ${p.id}`);
        console.log(`Name:        ${p.name}`);
        console.log(`Slug:        ${p.public_slug}`);
        console.log(`Status:      ${p.status}`);
        console.log(`Visibility:  ${p.visibility}`);
        console.log(`Producer:    ${prodUser.nickname}`);
        console.log(`Price Basic: $${p.price_basic}`);
        console.log(`Price Prem:  $${p.price_premium}`);
        console.log(`Price Excl:  $${p.price_exclusive}`);
        console.log(`Licenses:    `, JSON.stringify(p.licenses, null, 2));
    }
}

findHadesBeat();
