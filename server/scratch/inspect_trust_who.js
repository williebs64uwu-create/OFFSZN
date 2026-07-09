import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectProducts() {
    const ids = [823, 861];
    
    const { data: products, error } = await supabase
        .from('products')
        .select(`
            id,
            name,
            created_at,
            status,
            visibility,
            public_slug,
            producer_id
        `)
        .in('id', ids);

    if (error) {
        console.error("Error fetching products:", error);
        return;
    }

    console.log("Detail of products:");
    for (const p of products) {
        const { data: user } = await supabase
            .from('users')
            .select('nickname, email')
            .eq('id', p.producer_id)
            .single();

        console.log(`\n------------------ Product ID: ${p.id} ------------------`);
        console.log(`Name:        ${p.name}`);
        console.log(`Created At:  ${p.created_at}`);
        console.log(`Status:      ${p.status}`);
        console.log(`Visibility:  ${p.visibility}`);
        console.log(`Slug:        ${p.public_slug}`);
        console.log(`Producer:    ${user?.nickname} (${user?.email})`);
    }
}

inspectProducts();
