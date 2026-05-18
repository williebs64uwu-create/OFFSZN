import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key to bypass RLS and perform deletions securely
);

async function purgeTestProducts() {
  console.log('🔄 Iniciando purga de productos de prueba ("TEST", "PRUEBA") en la base de datos...');
  
  // 1. Obtener todos los productos activos
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, status')
    .neq('status', 'deleted');
    
  if (error) {
    console.error('❌ Error al obtener productos:', error);
    return;
  }
  
  if (!products || products.length === 0) {
    console.log('✅ EXCELENTE: No hay productos activos en la base de datos.');
    return;
  }
  
  // 2. Filtrar de forma ultra-precisa excluyendo falsos positivos (como "CONTESTO" o "DEMONS")
  const testsToPurge = products.filter(p => {
    const name = p.name.toLowerCase();
    
    const hasTest = name.includes('test') && !name.includes('contesto') && !name.includes('protest') && !name.includes('detest');
    const hasPrueba = name.includes('prueba') || name.includes('prueb');
    const hasDemo = name.includes('demo') && !name.includes('demon') && !name.includes('demasiado');
    
    return hasTest || hasPrueba || hasDemo;
  });
  
  if (testsToPurge.length === 0) {
    console.log('✅ EXCELENTE: 0 productos de prueba activos encontrados. Todo está limpio.');
    return;
  }
  
  console.log(`📦 Encontrados ${testsToPurge.length} productos de prueba activos. Cambiando su estado a "deleted" para ocultarlos de la plataforma...`);
  
  let deletedCount = 0;
  
  // 3. Actualizar estado a "deleted" uno por uno y loguear
  for (const prod of testsToPurge) {
    const { error: updateError } = await supabase
      .from('products')
      .update({ status: 'deleted' })
      .eq('id', prod.id);
      
    if (updateError) {
      console.error(`❌ Error al eliminar ID ${prod.id} (${prod.name}):`, updateError.message);
    } else {
      console.log(`🗑️ [Ocultado] ID: ${prod.id} | "${prod.name}" ➔ Cambiado a "deleted"`);
      deletedCount++;
    }
  }
  
  console.log(`\n🎉 PURGA COMPLETADA: ${deletedCount} de ${testsToPurge.length} productos de prueba fueron ocultados de la plataforma.`);
}

purgeTestProducts();
