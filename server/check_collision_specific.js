import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkCollision() {
    try {
        console.log("🔍 Checking Products 149 and 150...");

        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, public_slug')
            .in('id', [149, 150]);

        if (error) throw error;

        products.forEach(p => {
            console.log(`[ID: ${p.id}]`);
            console.log(`   Name: '${p.name}'`);
            console.log(`   Slug: '${p.public_slug}'`);
        });

        if (products.length === 2 && products[0].public_slug === products[1].public_slug) {
            console.log("⚠️ COLLISION DETECTED: Slugs are identical!");
        } else {
            console.log("✅ No exact slug collision found (checked exact string match).");
        }

    } catch (err) {
        console.error("💥 Error:", err);
    }
}

checkCollision();
