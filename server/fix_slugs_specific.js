import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function generateSlug(name, producerName = 'maidana') {
    return `${producerName} ${name}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function fixSlugs() {
    try {
        console.log("🛠️ Fixing Slugs for 149 and 150...");

        // 149 should be 'blessed'
        const slug149 = generateSlug('[FREE]Detroit Type Beat x Flint Type Beat - blessed');
        console.log(`Title 149: '[FREE]Detroit Type Beat x Flint Type Beat - blessed'`);
        console.log(`New Slug 149: ${slug149}`);

        const { error: e1 } = await supabase
            .from('products')
            .update({ public_slug: slug149 })
            .eq('id', 149);
        if (e1) console.error("Error updating 149:", e1);
        else console.log("✅ Updated 149.");

        // 150 should be 'camera'
        const slug150 = generateSlug('[FREE]Detroit Type Beat x Flint Type Beat - camera');
        console.log(`Title 150: '[FREE]Detroit Type Beat x Flint Type Beat - camera'`);
        console.log(`New Slug 150: ${slug150}`);

        const { error: e2 } = await supabase
            .from('products')
            .update({ public_slug: slug150 })
            .eq('id', 150);
        if (e2) console.error("Error updating 150:", e2);
        else console.log("✅ Updated 150.");

    } catch (err) {
        console.error("💥 Error:", err);
    }
}

fixSlugs();
