import { syncUserStatsToEmailOctopus, syncToN8N } from '../infrastructure/services/email-octopus.service.js';
import { supabase } from '../infrastructure/database/connection.js';

async function runTest() {
    console.log('🚀 Iniciando prueba de sincronización...');

    // 1. Probar un evento directo a n8n
    const testData = {
        email: 'test-willie@offszn.lat',
        nickname: 'Willie Test',
        plan: 'Pro',
        onboarding_status: 'Incompleto',
        role: 'Producer'
    };

    console.log('📡 Mandando evento de prueba a n8n...');
    await syncToN8N('registration_test', testData);

    // 2. Intentar sincronizar el primer usuario que encontremos en la DB para ver datos reales
    try {
        const { data: users } = await supabase.from('users').select('id').limit(1);
        if (users && users.length > 0) {
            const userId = users[0].id;
            console.log(`🔄 Sincronizando usuario real (ID: ${userId}) para probar estadísticas...`);
            await syncUserStatsToEmailOctopus(userId);
        }
    } catch (e) {
        console.error('Error sincronizando usuario real:', e.message);
    }

    console.log('✅ Prueba terminada. Revisa tu n8n!');
    process.exit(0);
}

runTest();
