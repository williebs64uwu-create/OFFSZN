import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key to bypass RLS and perform database-level batch updates securely!
);

function stripToRelativeKey(url) {
  if (!url) return null;
  let clean = url.split('?')[0]; // Remove query params
  
  if (!clean.startsWith('http')) return clean;

  const patterns = [
    '/api/r2-public/',
    '/api/admin/r2-proxy/',
    '/public/products/',
    '/public/avatars/',
    '/products/covers/',
    '/beats/mp3/',
    '/storage/v1/object/public/products/',
    '/storage/v1/object/public/'
  ];
  for (const pt of patterns) {
    if (clean.includes(pt)) {
      clean = clean.substring(clean.indexOf(pt) + pt.length);
      break;
    }
  }
  
  if (clean.startsWith('products/')) clean = clean.substring(9);
  if (clean.startsWith('audio/')) clean = clean.substring(6);
  if (clean.startsWith('covers/')) clean = clean.substring(7);
  
  // Cloudflare R2 direct domain (v1/v2/v3) — keep full key path after hostname
  if (clean.includes('r2.cloudflarestorage.com/')) {
    clean = clean.split('r2.cloudflarestorage.com/')[1];
  } else if (clean.startsWith('http')) {
    const uuidMatch = clean.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) {
      clean = clean.substring(uuidMatch.index);
    }
  }

  const bucketPrefixes = ['offsznlatbucket/', 'offszn-storage/', 'bucket3lat/'];
  for (const prefix of bucketPrefixes) {
    if (clean.toLowerCase().startsWith(prefix)) {
      clean = clean.substring(prefix.length);
    }
  }
  
  return clean;
}

async function runBatchFix() {
  console.log('🔄 Iniciando Batch Fix de Base de Datos para OFFSZN...');
  
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, image_url, audio_url')
    .or('image_url.ilike.http%,audio_url.ilike.http%');
    
  if (error) {
    console.error('❌ Error al obtener productos:', error);
    return;
  }
  
  if (!products || products.length === 0) {
    console.log('✅ EXCELENTE: 0 productos necesitan corrección. ¡La base de datos está 100% limpia!');
    return;
  }
  
  console.log(`📦 Encontrados ${products.length} productos que tienen rutas absolutas (http). Procesando corrección segura...`);
  
  let successCount = 0;
  
  for (const prod of products) {
    const updateData = {};
    let logs = [];
    
    if (prod.image_url && prod.image_url.startsWith('http')) {
      const relative = stripToRelativeKey(prod.image_url);
      if (relative !== prod.image_url) {
        updateData.image_url = relative;
        logs.push(`   - Portada: "${prod.image_url}" ➔ "${relative}"`);
      }
    }
    
    if (prod.audio_url && prod.audio_url.startsWith('http')) {
      const relative = stripToRelativeKey(prod.audio_url);
      if (relative !== prod.audio_url) {
        updateData.audio_url = relative;
        logs.push(`   - Audio:   "${prod.audio_url}" ➔ "${relative}"`);
      }
    }
    
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', prod.id);
        
      if (updateError) {
        console.error(`❌ Error al actualizar producto ID ${prod.id} (${prod.name}):`, updateError.message);
      } else {
        console.log(`✅ Producto ID: ${prod.id} | "${prod.name}" corregido exitosamente:`);
        logs.forEach(l => console.log(l));
        successCount++;
      }
    }
  }
  
  console.log(`\n🎉 BATCH COMPLETO: ${successCount} de ${products.length} productos fueron actualizados a rutas relativas dinámicas.`);
}

runBatchFix();
