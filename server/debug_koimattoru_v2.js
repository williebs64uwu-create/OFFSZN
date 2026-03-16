
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkKoimattoruDetails() {
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, nickname')
        .eq('nickname', 'koimattoru')
        .single();

    if (userError || !userData) {
        console.error('Error al encontrar koimattoru:', userError);
        return;
    }

    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, image_url, mp3_url, audio_url, r2_version, created_at')
        .eq('producer_id', userData.id);

    if (error) {
        console.error('Error al obtener productos:', error);
        return;
    }

    console.log(`Resultados detallados para ${userData.nickname}:`);
    products.forEach(p => {
        console.log(`\n--- [${p.id}] ${p.name} ---`);
        console.log(`Created: ${p.created_at}`);
        console.log(`Image: ${p.image_url}`);
        console.log(`MP3: ${p.mp3_url}`);
        console.log(`R2 Version: ${p.r2_version}`);
    });
}

checkKoimattoruDetails();
