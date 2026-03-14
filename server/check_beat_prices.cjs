
const { createClient } = require('@supabase/supabase-client');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkBeat() {
    const { data: products } = await supabase
        .from('products')
        .select('*')
        .ilike('name', '%MY OWN%');

    if (products && products.length > 0) {
        console.log("Beat found:", products[0].name);
        console.log("Licenses:", JSON.stringify(products[0].licenses, null, 2));
        console.log("Price Basic:", products[0].price_basic);
    } else {
        console.log("Beat not found");
    }
}

checkBeat();
