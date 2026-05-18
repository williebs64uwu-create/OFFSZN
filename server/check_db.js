import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, image_url, audio_url')
    .or('image_url.ilike.http%,audio_url.ilike.http%');
    
  if (error) {
    console.error('Error fetching:', error);
    return;
  }
  
  if (data.length === 0) {
    console.log('✅ EXCELENTE: 0 rutas absolutas (http) en la base de datos.');
  } else {
    console.log('❌ Aun quedan ' + data.length + ' productos con rutas absolutas:');
    data.forEach(p => console.log(`- ID: ${p.id} | Nombre: ${p.name}\n  Audio: ${p.audio_url}\n  Imagen: ${p.image_url}\n`));
  }
}
check();
