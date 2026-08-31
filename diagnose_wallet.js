import { googleWalletService } from './server/src/infrastructure/services/googleWalletService.js';
import { google } from 'googleapis';

async function diagnose() {
    googleWalletService.loadConfig();
    const auth = googleWalletService.getGoogleAuthClient();
    const walletobjects = google.walletobjects({ version: 'v1', auth });

    console.log('--- 1. Checking GenericClass ---');
    try {
        const cls = await walletobjects.genericclass.get({ resourceId: googleWalletService.fullClassId });
        console.log('✅ GenericClass found on Google Servers:', JSON.stringify(cls.data, null, 2));
    } catch (e) {
        console.error('❌ GenericClass error:', e.response ? e.response.data : e.message);
    }

    console.log('--- 2. Testing GenericObject Insert via REST API ---');
    const testObjectId = `${googleWalletService.issuerId}.diagnostic_test_user_vip`;
    const genericObjectPayload = {
        id: testObjectId,
        classId: googleWalletService.fullClassId,
        header: {
            defaultValue: { language: 'es', value: 'WILLIE GARAY' }
        },
        subheader: {
            defaultValue: { language: 'es', value: 'PASE DE REGALOS & DROPS' }
        },
        hexBackgroundColor: '#0a0a0f',
        textModulesData: [
            {
                id: 'points_balance',
                header: 'PUNTOS OFFSZN',
                body: '⚡ 100 PTS'
            },
            {
                id: 'welcome_gift',
                header: 'REGALO ACTIVO',
                body: 'Cupón 20% OFF: WILLIEVIP'
            }
        ],
        barcode: {
            type: 'QR_CODE',
            value: 'OFFSZN-VIP-TEST',
            alternateText: 'VIP-TEST'
        },
        linksModuleData: {
            uris: [
                {
                    uri: 'https://offszn.lat/@willieinspired',
                    description: 'Tienda Oficial Willie Inspired',
                    id: 'store_link'
                }
            ]
        }
    };

    try {
        // Try getting first
        try {
            await walletobjects.genericobject.get({ resourceId: testObjectId });
            console.log('Object exists, patching...');
            const patched = await walletobjects.genericobject.patch({
                resourceId: testObjectId,
                requestBody: genericObjectPayload
            });
            console.log('✅ GenericObject patched successfully:', patched.data.id);
        } catch (err) {
            if (err.code === 404) {
                console.log('Object does not exist, inserting...');
                const inserted = await walletobjects.genericobject.insert({
                    requestBody: genericObjectPayload
                });
                console.log('✅ GenericObject inserted successfully:', inserted.data.id);
            } else {
                throw err;
            }
        }
    } catch (e) {
        console.error('❌ GenericObject Insert/Patch error:', e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
    }
}

diagnose().catch(console.error);
