import 'dotenv/config';
import { supabase } from '../src/infrastructure/database/connection.js';

async function main() {
    console.log('Inserting Easy Mix and Easy Master into the products table...');

    const productsToInsert = [
        {
            name: 'Easy Mix',
            description: 'Vocal FX by OFFSZN - El mejor plugin para mezclar en 2026.',
            product_type: 'preset',
            price_basic: 5.00,
            is_free: false,
            status: 'approved',
            visibility: 'public',
            producer_id: '820bb444-8bed-4920-b758-bd707da7ab9c', // Willie's producer ID
            image_url: '/images/plugins/easy mixx.png',
            public_slug: 'easy-mix',
            storage_version: 'v3',
            r2_version: 'v3'
        },
        {
            name: 'Easy Master',
            description: 'El plugin definitivo para masterizar tus temas.',
            product_type: 'preset',
            price_basic: 5.00,
            is_free: false,
            status: 'approved',
            visibility: 'public',
            producer_id: '820bb444-8bed-4920-b758-bd707da7ab9c', // Willie's producer ID
            image_url: '/images/plugins/EASY MASTER IMAGE.png',
            public_slug: 'easy-master',
            storage_version: 'v3',
            r2_version: 'v3'
        }
    ];

    for (const prod of productsToInsert) {
        // Check if it already exists to avoid duplicate entries
        const { data: existing } = await supabase
            .from('products')
            .select('id')
            .eq('name', prod.name)
            .maybeSingle();

        if (existing) {
            console.log(`⚠️ Product "${prod.name}" already exists with ID: ${existing.id}. Skipping insert.`);
        } else {
            const { data: inserted, error } = await supabase
                .from('products')
                .insert(prod)
                .select('*')
                .single();

            if (error) {
                console.error(`❌ Error inserting "${prod.name}":`, error);
            } else {
                console.log(`✅ Successfully inserted "${prod.name}" with ID: ${inserted.id}`);
            }
        }
    }
}

main().catch(err => {
    console.error('Unhandled error:', err);
});
