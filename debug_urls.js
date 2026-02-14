import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, 'server', '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkMaidanaProducts() {
    try {
        console.log("🔍 Finding user 'maidana'...");
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, nickname')
            .ilike('nickname', 'maidana')
            .single();

        if (userError || !user) {
            console.error("❌ User not found:", userError);
            return;
        }

        console.log(`✅ Found user: ${user.nickname} (${user.id})`);

        console.log("🔍 Fetching products...");
        const { data: products, error: prodError } = await supabase
            .from('products')
            .select('id, name, image_url, mp3_url, download_url_mp3')
            .eq('producer_id', user.id);

        if (prodError) {
            console.error("❌ Error fetching products:", prodError);
            return;
        }

        console.log(`📦 Found ${products.length} products:`);
        products.forEach(p => {
            console.log(`--- Product: ${p.name} ---`);
            console.log(`Image URL: ${p.image_url}`);
            console.log(`MP3 URL: ${p.mp3_url}`);
            console.log(`Download URL MP3: ${p.download_url_mp3}`);
        });

    } catch (err) {
        console.error("💥 Script error:", err);
    }
}

checkMaidanaProducts();
