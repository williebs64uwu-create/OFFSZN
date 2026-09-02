import { activateSerial, requestTrial } from './src/infrastructure/http/controllers/PluginLicensingController.js';
import { supabase } from './src/infrastructure/database/connection.js';
import crypto from 'crypto';

// Helper mock response
function createMockRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        }
    };
}

async function runTestSuite() {
    console.log('🧪 ==========================================');
    console.log('🧪 OFFSZN PLUGINS & TRIALS VALIDATION SUITE');
    console.log('🧪 ==========================================\n');

    let totalPassed = 0;
    let totalFailed = 0;

    const testHwid = 'TEST_AUTO_AUDIT_' + Date.now();
    const testCreatedLicenses = [];

    async function cleanup() {
        console.log('\n🧹 Cleaning up test records from database...');
        for (const licId of testCreatedLicenses) {
            await supabase.from('plugin_activations').delete().eq('license_id', licId);
            await supabase.from('plugin_licenses').delete().eq('id', licId);
        }
        await supabase.from('plugin_activations').delete().like('hwid', 'TEST_AUTO_%');
        console.log('✨ Cleanup complete.');
    }

    try {
        const plugins = [
            { name: 'Easy Mix', prefix: 'EASY', reqPlugin: 'Easy Mix' },
            { name: 'Easy Master', prefix: 'MASTER', reqPlugin: 'Easy Master' },
            { name: 'COCA COLA', prefix: 'COKE', reqPlugin: 'Coca-Cola' },
            { name: 'Inka Kola', prefix: 'INKA', reqPlugin: 'Inka Kola' }
        ];

        // ── 1. TEST FULL LICENSES FOR ALL PLUGINS ──
        console.log('▶️ TEST GROUP 1: FULL / LIFETIME LICENSES');
        for (const p of plugins) {
            const h1 = crypto.randomBytes(4).toString('hex').toUpperCase();
            const h2 = crypto.randomBytes(4).toString('hex').toUpperCase();
            const serialKey = `${p.prefix}-FULL-${h1}-${h2}`;
            // Insert test license
            const { data: lic, error: insErr } = await supabase.from('plugin_licenses').insert({
                serial_key: serialKey,
                plugin_name: p.name,
                license_type: 'lifetime',
                status: 'active',
                expires_at: null,
                max_devices: 3
            }).select('id').single();

            if (insErr) {
                console.error(`❌ [FULL] Failed to insert test license for ${p.name}:`, insErr.message);
                totalFailed++;
                continue;
            }
            testCreatedLicenses.push(lic.id);

            // Test 1.1: Activate on first device
            const req1 = {
                body: {
                    serial_key: serialKey,
                    hwid: `${testHwid}_DEV1`,
                    device_name: `PC Test ${p.name}`,
                    plugin_name: p.reqPlugin
                }
            };
            const res1 = createMockRes();
            await activateSerial(req1, res1);

            if (res1.statusCode === 200 && res1.body?.success && res1.body?.signature) {
                console.log(`  ✅ [FULL] ${p.name} - Device 1 Activation SUCCESS (Signed payload: ${res1.body.license_type})`);
                totalPassed++;
            } else {
                console.error(`  ❌ [FULL] ${p.name} - Device 1 Activation FAILED:`, res1.statusCode, res1.body);
                totalFailed++;
            }

            // Test 1.2: Re-activate on same device (idempotent)
            const res1_re = createMockRes();
            await activateSerial(req1, res1_re);
            if (res1_re.statusCode === 200 && res1_re.body?.success) {
                console.log(`  ✅ [FULL] ${p.name} - Device 1 Re-activation (Idempotent) SUCCESS`);
                totalPassed++;
            } else {
                console.error(`  ❌ [FULL] ${p.name} - Device 1 Re-activation FAILED:`, res1_re.statusCode, res1_re.body);
                totalFailed++;
            }

            // Test 1.3: Activate on 2nd device
            const req2 = {
                body: {
                    serial_key: serialKey,
                    hwid: `${testHwid}_DEV2`,
                    device_name: `Laptop Test ${p.name}`,
                    plugin_name: p.reqPlugin
                }
            };
            const res2 = createMockRes();
            await activateSerial(req2, res2);

            if (res2.statusCode === 200 && res2.body?.success) {
                console.log(`  ✅ [FULL] ${p.name} - Device 2 Activation SUCCESS`);
                totalPassed++;
            } else {
                console.error(`  ❌ [FULL] ${p.name} - Device 2 Activation FAILED:`, res2.statusCode, res2.body);
                totalFailed++;
            }
        }

        // ── 2. TEST TRIAL REQUESTS & ACTIVATIONS FOR ALL PLUGINS ──
        console.log('\n▶️ TEST GROUP 2: TRIAL GENERATION & ACTIVATIONS');
        for (const p of plugins) {
            const trialHwid = `${testHwid}_TRIAL_${p.prefix}`;
            
            // Test 2.1: Request trial via API (/api/plugin/request-trial)
            const reqTrial = {
                body: {
                    hwid: trialHwid,
                    device_name: `Device for ${p.name} Trial`,
                    plugin_name: p.name
                }
            };
            const resTrial = createMockRes();
            await requestTrial(reqTrial, resTrial);

            let trialSerial = null;
            if (resTrial.statusCode === 200 && resTrial.body?.success && resTrial.body?.serial_key) {
                trialSerial = resTrial.body.serial_key;
                console.log(`  ✅ [TRIAL] ${p.name} - Trial Request SUCCESS: Key = ${trialSerial}, Exp = ${resTrial.body.expires_at}`);
                totalPassed++;

                // Track license for cleanup
                const { data: licObj } = await supabase.from('plugin_licenses').select('id').eq('serial_key', trialSerial).single();
                if (licObj) testCreatedLicenses.push(licObj.id);
            } else {
                console.error(`  ❌ [TRIAL] ${p.name} - Trial Request FAILED:`, resTrial.statusCode, resTrial.body);
                totalFailed++;
            }

            // Test 2.2: Second request from same machine returns existing trial
            if (trialSerial) {
                const resTrialRepeat = createMockRes();
                await requestTrial(reqTrial, resTrialRepeat);
                if (resTrialRepeat.statusCode === 200 && resTrialRepeat.body?.serial_key === trialSerial) {
                    console.log(`  ✅ [TRIAL] ${p.name} - Same HWID Trial Return SUCCESS (Matched key)`);
                    totalPassed++;
                } else {
                    console.error(`  ❌ [TRIAL] ${p.name} - Same HWID Trial Return FAILED:`, resTrialRepeat.statusCode, resTrialRepeat.body);
                    totalFailed++;
                }

                // Test 2.3: Activate the trial key explicitly (/api/plugin/activate)
                const reqActTrial = {
                    body: {
                        serial_key: trialSerial,
                        hwid: trialHwid,
                        device_name: `Device for ${p.name} Trial`,
                        plugin_name: p.reqPlugin
                    }
                };
                const resActTrial = createMockRes();
                await activateSerial(reqActTrial, resActTrial);

                if (resActTrial.statusCode === 200 && resActTrial.body?.success && resActTrial.body?.license_type === 'trial') {
                    console.log(`  ✅ [TRIAL] ${p.name} - Trial Activation SUCCESS (Days remaining: ${resActTrial.body.days_remaining})`);
                    totalPassed++;
                } else {
                    console.error(`  ❌ [TRIAL] ${p.name} - Trial Activation FAILED:`, resActTrial.statusCode, resActTrial.body);
                    totalFailed++;
                }
            }
        }

        // ── 3. TEST SECURITY & CROSS-PLUGIN MISMATCH PREVENTION ──
        console.log('\n▶️ TEST GROUP 3: CROSS-PLUGIN MISMATCH & SECURITY CHECKS');

        // Test 3.1: Try activating Easy Mix key inside Coca-Cola plugin
        const mixKeyForMismatch = `EASY-FULL-11223344-55667788`;
        const { data: mismatchLic } = await supabase.from('plugin_licenses').insert({
            serial_key: mixKeyForMismatch,
            plugin_name: 'Easy Mix',
            license_type: 'lifetime',
            status: 'active',
            expires_at: null,
            max_devices: 3
        }).select('id').single();
        if (mismatchLic) testCreatedLicenses.push(mismatchLic.id);

        const resMismatch = createMockRes();
        await activateSerial({
            body: {
                serial_key: mixKeyForMismatch,
                hwid: `${testHwid}_MISMATCH`,
                device_name: 'Test PC',
                plugin_name: 'Coca-Cola'
            }
        }, resMismatch);

        if (resMismatch.statusCode === 403 && resMismatch.body?.error?.includes('Coca-Cola')) {
            console.log(`  ✅ [SECURITY] Easy Mix Key in Coca-Cola Plugin correctly rejected (403: "${resMismatch.body.error}")`);
            totalPassed++;
        } else {
            console.error(`  ❌ [SECURITY] Mismatch check failed:`, resMismatch.statusCode, resMismatch.body);
            totalFailed++;
        }

        // Test 3.2: Try activating Expired Trial
        const expiredKey = `EASY-TRIAL-11223344-99887766`;
        const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString();
        const { data: expiredLic } = await supabase.from('plugin_licenses').insert({
            serial_key: expiredKey,
            plugin_name: 'Easy Mix',
            license_type: 'trial',
            status: 'active',
            expires_at: pastDate,
            max_devices: 1
        }).select('id').single();
        if (expiredLic) testCreatedLicenses.push(expiredLic.id);

        const resExpired = createMockRes();
        await activateSerial({
            body: {
                serial_key: expiredKey,
                hwid: `${testHwid}_EXPIRED`,
                device_name: 'Test PC',
                plugin_name: 'Easy Mix'
            }
        }, resExpired);

        if (resExpired.statusCode === 403 && resExpired.body?.error?.includes('expirado')) {
            console.log(`  ✅ [SECURITY] Expired Trial correctly rejected (403: "${resExpired.body.error}")`);
            totalPassed++;
        } else {
            console.error(`  ❌ [SECURITY] Expired check failed:`, resExpired.statusCode, resExpired.body);
            totalFailed++;
        }

        // Test 3.3: Device Limit Exceeded Check
        const limitKey = `EASY-FULL-11223344-44332211`;
        const { data: limitLic } = await supabase.from('plugin_licenses').insert({
            serial_key: limitKey,
            plugin_name: 'Easy Mix',
            license_type: 'lifetime',
            status: 'active',
            expires_at: null,
            max_devices: 1
        }).select('id').single();
        if (limitLic) testCreatedLicenses.push(limitLic.id);

        // Activate device 1
        await activateSerial({
            body: {
                serial_key: limitKey,
                hwid: `${testHwid}_LIMIT_DEV1`,
                device_name: 'Device 1',
                plugin_name: 'Easy Mix'
            }
        }, createMockRes());

        // Try activating device 2 (max_devices is 1)
        const resLimit2 = createMockRes();
        await activateSerial({
            body: {
                serial_key: limitKey,
                hwid: `${testHwid}_LIMIT_DEV2`,
                device_name: 'Device 2',
                plugin_name: 'Easy Mix'
            }
        }, resLimit2);

        if (resLimit2.statusCode === 403 && resLimit2.body?.error?.includes('Límite de dispositivos alcanzado')) {
            console.log(`  ✅ [SECURITY] Exceeded max_devices correctly rejected (403: "${resLimit2.body.error}")`);
            totalPassed++;
        } else {
            console.error(`  ❌ [SECURITY] Device limit check failed:`, resLimit2.statusCode, resLimit2.body);
            totalFailed++;
        }

    } catch (err) {
        console.error('💥 Unexpected test error:', err);
        totalFailed++;
    } finally {
        await cleanup();
    }

    console.log('\n==========================================');
    console.log(`🏁 TEST RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
    console.log('==========================================');

    process.exit(totalFailed === 0 ? 0 : 1);
}

runTestSuite();
