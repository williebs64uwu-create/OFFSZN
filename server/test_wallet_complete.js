import { googleWalletService } from './src/infrastructure/services/googleWalletService.js';

async function testWalletComplete() {
    console.log('==============================================');
    console.log('🧪 PRUEBA DEL SISTEMA GOOGLE WALLET & SELLOS');
    console.log('==============================================\n');

    // 1. Estado de Configuración
    const status = googleWalletService.getPublicStatus();
    console.log('1. Estado de la Configuración:');
    console.log('   - Issuer ID:', status.issuerId || '⚠️ Sin configurar (usará 3388000000023178042)');
    console.log('   - Client Email:', status.clientEmail || '⚠️ Sin configurar');
    console.log('   - Private Key:', status.hasPrivateKey ? '✅ Presente' : '⚠️ Sin configurar');
    console.log('   - Class ID:', status.fullClassId);
    console.log('   - Modo Activo:', status.isReady ? '🚀 PRODUCCIÓN (GOOGLE WALLET REAL)' : '🛠️ SIMULACIÓN / PRUEBA');
    console.log('');

    // 2. Crear un Pase de prueba con Sellos
    console.log('2. Generando Pase de Prueba con Sellos:');
    const testEmail = 'productor_vip@gmail.com';
    const passResult = await googleWalletService.createPass({
        name: 'Productor Leyenda',
        email: testEmail,
        points: 100,
        stamps: 2,
        maxStamps: 5,
        customData: {
            cardTitle: 'WILLIE INSPIRED VIP',
            hexBackgroundColor: '#0a0a0f'
        }
    });

    console.log('   - Éxito:', passResult.success);
    console.log('   - URL para Guardar:', passResult.saveUrl);
    console.log('   - Módulos de la tarjeta:', passResult.passData?.textModulesData?.map(m => `[${m.header}: ${m.body}]`).join(' | '));
    console.log('');

    // 3. Simular suma de un sello (+1)
    console.log('3. Probando Adición de Sello (+1 Sello):');
    const stampResult = await googleWalletService.addStampToMember({
        email: testEmail,
        count: 1,
        notify: true
    });
    console.log('   - Nuevo saldo de sellos:', stampResult.stampBar);
    console.log('   - ¿Meta alcanzada?:', stampResult.isCompleted ? '🎉 SÍ' : 'Aún faltan sellos');
    console.log('');

    // 4. Probar Notificación Push
    console.log('4. Probando Disparo de Notificación Push:');
    const pushResult = await googleWalletService.broadcastPushNotification({
        title: '🔥 ¡DROP OFFSZN: 50% OFF HOY!',
        body: 'Aprovecha 50% en presets vocales con tu tarjeta VIP.',
        targetEmail: testEmail
    });
    console.log('   - Resultado:', pushResult.message);
    console.log('   - Total enviados/simulados:', pushResult.results?.sent || pushResult.results?.simulated);
    console.log('\n==============================================');
    console.log('✅ TODAS LAS PRUEBAS DE WALLET COMPLETADAS');
    console.log('==============================================');
}

testWalletComplete().catch(err => {
    console.error('❌ Error en prueba:', err);
});
