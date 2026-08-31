/**
 * OFFSZN Google Wallet - Full Diagnostic Script
 * Runs all checks and generates a definitive test URL
 */

import { googleWalletService } from './src/infrastructure/services/googleWalletService.js';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';

const ISSUER_ID = '3388000000023178042';
const CLASS_ID = `${ISSUER_ID}.willieinspired_vip_pass_v1`;
const TEST_EMAIL = 'williebeatsyt@gmail.com';
const TEST_OBJ_ID = `${ISSUER_ID}.williebeatsyt_gmail_com_vip`;

async function runDiagnostic() {
    console.log('=== 🔍 GOOGLE WALLET DIAGNOSTIC ===\n');

    googleWalletService.loadConfig();
    const auth = googleWalletService.getGoogleAuthClient();

    if (!auth) {
        console.error('❌ FATAL: No Google Auth client — check credentials in wallet_config.json');
        return;
    }
    console.log('✅ Auth client created');
    console.log('   Email:', googleWalletService.clientEmail);
    console.log('   Key length:', googleWalletService.privateKey.length);

    const walletobjects = google.walletobjects({ version: 'v1', auth });

    // ── 1. Try authorizing a token first ─────────────────────────────────────
    try {
        await auth.authorize();
        console.log('\n✅ Service Account auth SUCCESSFUL');
    } catch (e) {
        console.error('\n❌ Service Account auth FAILED:', e.message);
        return;
    }

    // ── 2. Fetch GenericClass ─────────────────────────────────────────────────
    console.log('\n--- CLASS ---');
    try {
        const cls = await walletobjects.genericclass.get({ resourceId: CLASS_ID });
        const d = cls.data;
        console.log('✅ Class exists. Fields present:');
        console.log('   id:', d.id);
        console.log('   issuerName:', d.issuerName || '⚠️  MISSING');
        console.log('   cardTitle:', d.cardTitle?.defaultValue?.value || '⚠️  MISSING');
        console.log('   logo:', d.logo?.sourceUri?.uri || '⚠️  MISSING');
        console.log('   hexBackgroundColor:', d.hexBackgroundColor || '⚠️  MISSING');
        console.log('   viewUnlockRequirement:', d.viewUnlockRequirement);
        console.log('   reviewStatus:', d.reviewStatus || '⚠️  MISSING (needed for test accounts!)');
    } catch (e) {
        console.error('❌ Class fetch FAILED:', e.response?.data || e.message);
        return;
    }

    // ── 3. Force full-UPDATE on GenericClass (not patch) ─────────────────────
    console.log('\n--- FORCE UPDATING CLASS ---');
    try {
        const res = await walletobjects.genericclass.update({
            resourceId: CLASS_ID,
            requestBody: {
                id: CLASS_ID,
                issuerName: 'OFFSZN Willie Inspired',
                reviewStatus: 'UNDER_REVIEW',
                viewUnlockRequirement: 'UNLOCK_NOT_REQUIRED',
                cardTitle: {
                    defaultValue: { language: 'es', value: 'WILLIE INSPIRED VIP' }
                },
                logo: {
                    sourceUri: { uri: 'https://offszn.lat/images/LOGO-OFFSZN.png' },
                    contentDescription: {
                        defaultValue: { language: 'es', value: 'Logo OFFSZN' }
                    }
                },
                hexBackgroundColor: '#0b0c10',
                enableSmartTap: false,
                multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES'
            }
        });
        console.log('✅ Class UPDATED. Status:', res.status);
        console.log('   Returned fields:', Object.keys(res.data).join(', '));
    } catch (e) {
        console.error('❌ Class update FAILED:', e.response?.data || e.message);
    }

    // ── 4. Fetch GenericObject ────────────────────────────────────────────────
    console.log('\n--- OBJECT ---');
    try {
        const obj = await walletobjects.genericobject.get({ resourceId: TEST_OBJ_ID });
        const d = obj.data;
        console.log('✅ Object exists:');
        console.log('   id:', d.id);
        console.log('   classId:', d.classId);
        console.log('   state:', d.state);
        console.log('   hasUsers:', d.hasUsers);
        console.log('   cardTitle:', d.cardTitle?.defaultValue?.value || '⚠️  MISSING');
    } catch (e) {
        if (e.code === 404) {
            console.warn('⚠️  Object not found — will try inserting fresh');
        } else {
            console.error('❌ Object fetch FAILED:', e.response?.data || e.message);
        }
    }

    // ── 5. Build a MINIMAL JWT ────────────────────────────────────────────────
    console.log('\n--- GENERATING JWT ---');
    const minimalClaims = {
        iss: googleWalletService.clientEmail,
        aud: 'google',
        typ: 'savetogooglewallet',
        iat: Math.floor(Date.now() / 1000),
        payload: {
            genericObjects: [{ id: TEST_OBJ_ID, classId: CLASS_ID }]
        }
    };
    
    const token = jwt.sign(minimalClaims, googleWalletService.privateKey, {
        algorithm: 'RS256',
        noTimestamp: true  // we added iat manually
    });

    const saveUrl = `https://pay.google.com/gp/v/save/${token}`;
    console.log('\n✅ FINAL SAVE URL (try this on your phone):');
    console.log(saveUrl);
    console.log('\n(Token length:', token.length, ')');

    // ── 6. Decode back to verify ──────────────────────────────────────────────
    const decoded = jwt.decode(token);
    console.log('\nDecoded payload preview:', JSON.stringify(decoded, null, 2));
}

runDiagnostic().catch(console.error);
