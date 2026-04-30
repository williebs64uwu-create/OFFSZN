import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

async function run() {
    try {
        console.log("🔍 Buscando Preset de Torres...");
        
        // Find product
        const { data: products, error: prodErr } = await supabase
            .from('products')
            .select('id, name, producer_id, views_count, downloads_count')
            .ilike('name', '%torre%')
            .limit(1);
            
        if (prodErr) throw prodErr;
        
        if (!products || products.length === 0) {
            console.log("❌ No se encontró ningín preset que contenga 'torres' en el nombre.");
            return;
        }

        const product = products[0];
        console.log(`✅ Producto encontrado: ${product.name} (${product.id})`);

        // 1. Insert into page_views for Analytics Chart
        console.log(`⏳ Registrando histórico de vistas para Analytics en 'page_views'...`);
        
        const viewsToInsert = [];
        for (let i = 0; i < 100; i++) {
            viewsToInsert.push({
                user_id: product.producer_id,
                path: `/producto/${product.id}`,
                viewed_at: randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()) 
            });
        }

        const { error: viewAddErr } = await supabase
            .from('page_views')
            .insert(viewsToInsert);
            
        if (viewAddErr) {
             console.error("❌ Error al añadir historial en page_views:", viewAddErr.message);
        } else {
             console.log("✅ 100 filas historicas insertadas en 'page_views' log.");
        }
        
        console.log("🚀 Proceso terminado con éxito.");
        process.exit(0);
        
    } catch (err) {
        console.error("❌ ERROR CRÍTICO:", err);
        process.exit(1);
    }
}

run();
