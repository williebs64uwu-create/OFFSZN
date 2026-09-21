import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local cache for subscribers / passes (ensures persistency without requiring database migrations immediately)
const DATA_DIR = path.join(__dirname, '../../../database');
const WALLET_DB_FILE = path.join(DATA_DIR, 'wallet_passes.json');
const WALLET_CONFIG_FILE = path.join(DATA_DIR, 'wallet_config.json');

// Ensure database directory exists
if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { }
}

export class GoogleWalletService {
    constructor() {
        this.loadConfig();
    }

    loadConfig() {
        let fileConfig = {};
        if (fs.existsSync(WALLET_CONFIG_FILE)) {
            try {
                fileConfig = JSON.parse(fs.readFileSync(WALLET_CONFIG_FILE, 'utf8'));
            } catch (e) {
                console.error('Error reading wallet_config.json:', e.message);
            }
        } else {
            // Check for service-account.json or google-key.json in server root or database
            const candidatePaths = [
                path.join(__dirname, '../../../service-account.json'),
                path.join(__dirname, '../../../google-key.json'),
                path.join(DATA_DIR, 'service-account.json'),
                path.join(DATA_DIR, 'google-key.json')
            ];
            for (const cPath of candidatePaths) {
                if (fs.existsSync(cPath)) {
                    try {
                        const parsed = JSON.parse(fs.readFileSync(cPath, 'utf8'));
                        if (parsed.client_email && parsed.private_key) {
                            fileConfig = parsed;
                            break;
                        }
                    } catch (e) { }
                }
            }
        }

        this.issuerId = process.env.GOOGLE_WALLET_ISSUER_ID || fileConfig.issuerId || fileConfig.issuer_id || '3388000000023178042';
        this.clientEmail = process.env.GOOGLE_WALLET_CLIENT_EMAIL || fileConfig.clientEmail || fileConfig.client_email || '';
        
        let rawKey = process.env.GOOGLE_WALLET_PRIVATE_KEY || fileConfig.privateKey || fileConfig.private_key || '';
        if (rawKey) {
            // Replace escaped newlines if passed as env string
            this.privateKey = rawKey.replace(/\\n/g, '\n');
        } else {
            this.privateKey = '';
        }

        this.classId = process.env.GOOGLE_WALLET_CLASS_ID || fileConfig.classId || fileConfig.class_id || 'willieinspired_vip_pass_v1';
        this.fullClassId = this.issuerId ? `${this.issuerId}.${this.classId}` : `mock_issuer.${this.classId}`;
    }

    saveRuntimeConfig(config) {
        try {
            let parsed = config;
            if (typeof config === 'string') {
                try { parsed = JSON.parse(config); } catch (e) {}
            }

            const current = fs.existsSync(WALLET_CONFIG_FILE) 
                ? JSON.parse(fs.readFileSync(WALLET_CONFIG_FILE, 'utf8')) 
                : {};
            
            const updated = {
                ...current,
                issuerId: parsed.issuerId || parsed.issuer_id || current.issuerId || '3388000000023178042',
                clientEmail: parsed.clientEmail || parsed.client_email || current.clientEmail || '',
                privateKey: (parsed.privateKey || parsed.private_key || current.privateKey || '').replace(/\\n/g, '\n'),
                classId: parsed.classId || parsed.class_id || current.classId || 'willieinspired_vip_pass_v1',
                updatedAt: new Date().toISOString()
            };

            fs.writeFileSync(WALLET_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
            this.loadConfig();
            return { success: true, config: this.getPublicStatus() };
        } catch (e) {
            console.error('Error saving runtime wallet config:', e);
            throw new Error('No se pudo guardar la configuración: ' + e.message);
        }
    }

    getPublicStatus() {
        return {
            hasIssuerId: Boolean(this.issuerId),
            issuerId: this.issuerId ? `${this.issuerId.slice(0, 4)}...${this.issuerId.slice(-4)}` : null,
            fullIssuerId: this.issuerId,
            hasClientEmail: Boolean(this.clientEmail),
            clientEmail: this.clientEmail || null,
            hasPrivateKey: Boolean(this.privateKey),
            classId: this.classId,
            fullClassId: this.fullClassId,
            isReady: Boolean(this.issuerId && this.clientEmail && this.privateKey)
        };
    }

    getPassesList() {
        if (!fs.existsSync(WALLET_DB_FILE)) return [];
        try {
            return JSON.parse(fs.readFileSync(WALLET_DB_FILE, 'utf8'));
        } catch (e) {
            return [];
        }
    }

    formatStampBar(current, max = 5) {
        const targetMax = Math.max(1, Number(max) || 5);
        const filled = Math.min(Math.max(0, Number(current) || 0), targetMax);
        const empty = Math.max(0, targetMax - filled);
        return '⭐'.repeat(filled) + '⚪'.repeat(empty) + ` (${filled}/${targetMax} Sellos)`;
    }

    savePassRecord(pass) {
        try {
            const list = this.getPassesList();
            const existingIdx = list.findIndex(p => p.email.toLowerCase() === pass.email.toLowerCase());
            const stamps = pass.stamps !== undefined ? Number(pass.stamps) : 1;
            const maxStamps = pass.maxStamps !== undefined ? Number(pass.maxStamps) : 5;
            
            if (existingIdx >= 0) {
                list[existingIdx] = { 
                    ...list[existingIdx], 
                    ...pass, 
                    stamps,
                    maxStamps,
                    updatedAt: new Date().toISOString() 
                };
            } else {
                list.unshift({ 
                    ...pass, 
                    stamps,
                    maxStamps,
                    points: pass.points || 100,
                    createdAt: new Date().toISOString() 
                });
            }

            fs.writeFileSync(WALLET_DB_FILE, JSON.stringify(list, null, 2), 'utf8');
        } catch (e) {
            console.error('Error saving pass record:', e.message);
        }
    }

    getGoogleAuthClient() {
        if (!this.clientEmail || !this.privateKey) return null;
        return new google.auth.JWT({
            email: this.clientEmail,
            key: this.privateKey,
            scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
        });
    }

    /**
     * Asegura que la GenericClass esté creada en la consola de Google Wallet API
     */
    async ensureGenericClass(customSettings = {}) {
        const auth = this.getGoogleAuthClient();
        if (!auth || !this.issuerId) {
            return { mock: true, message: 'Ejecutando en modo Simulación (faltan credenciales de Google)' };
        }

        try {
            const walletobjects = google.walletobjects({ version: 'v1', auth });
            const classPayload = {
                id: this.fullClassId,
                issuerName: customSettings.issuerName || 'OFFSZN Willie Inspired',
                reviewStatus: 'UNDER_REVIEW', // Allows immediate dev testing with test accounts
                viewUnlockRequirement: 'UNLOCK_NOT_REQUIRED',
                logo: {
                    sourceUri: {
                        uri: customSettings.logoUrl || 'https://offszn.lat/images/LOGO%20OFFSZN.webp'
                    },
                    contentDescription: {
                        defaultValue: { language: 'es', value: 'Logo Oficial OFFSZN' }
                    }
                },
                cardTitle: {
                    defaultValue: { language: 'es', value: customSettings.cardTitle || 'WILLIE INSPIRED VIP PASS' }
                },
                hexBackgroundColor: customSettings.hexBackgroundColor || '#0b0c10'
            };

            try {
                await walletobjects.genericclass.get({ resourceId: this.fullClassId });
                // Patch existing class to keep titles and logos up to date
                await walletobjects.genericclass.patch({
                    resourceId: this.fullClassId,
                    requestBody: classPayload
                });
                console.log(`[GoogleWallet] GenericClass ${this.fullClassId} sincronizada.`);
            } catch (err) {
                if (err.code === 404) {
                    console.log(`[GoogleWallet] Creando GenericClass ${this.fullClassId}...`);
                    await walletobjects.genericclass.insert({ requestBody: classPayload });
                    console.log(`[GoogleWallet] GenericClass creada exitosamente.`);
                } else {
                    throw err;
                }
            }

            return { success: true, classId: this.fullClassId };
        } catch (error) {
            console.error('[GoogleWallet] Error en ensureGenericClass:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Genera el Pase Digital (GenericObject) y el enlace firmado Save to Google Wallet
     */
    async createPass({ name, email, phone, points = 100, stamps = 1, maxStamps = 5, customData = {} }) {
        if (!email) throw new Error('El correo electrónico es requerido.');

        const cleanEmail = email.trim().toLowerCase();
        const safeUserId = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
        const objectId = this.issuerId 
            ? `${this.issuerId}.${safeUserId}_vip` 
            : `mock_issuer.${safeUserId}_vip`;

        const displayName = (name || 'Productor VIP').toUpperCase();
        const initialPoints = Number(points) || 100;
        const initialStamps = Math.max(0, Number(stamps) || 1);
        const targetMaxStamps = Number(maxStamps) || 5;
        const isCompleted = initialStamps >= targetMaxStamps;
        const stampBar = this.formatStampBar(initialStamps, targetMaxStamps);
        const rewardText = isCompleted 
            ? '🎉 ¡TARJETA COMPLETA! Reclama tu Plugin/Preset Gratis' 
            : `🎁 Te faltan ${targetMaxStamps - initialStamps} sello(s) para tu Regalo`;

        // Construir estructura del GenericObject de Google Wallet
        const genericObject = {
            id: objectId,
            classId: this.fullClassId,
            genericType: 'GENERIC_OTHER',
            logo: {
                sourceUri: {
                    uri: customData.logoUrl || 'https://offszn.lat/images/LOGO-OFFSZN.png'
                },
                contentDescription: {
                    defaultValue: { language: 'es', value: 'OFFSZN' }
                }
            },
            cardTitle: {
                defaultValue: { language: 'es', value: customData.cardTitle || 'WILLIE INSPIRED' }
            },
            header: {
                defaultValue: { language: 'es', value: displayName }
            },
            subheader: {
                defaultValue: { language: 'es', value: 'TARJETA DE SELLOS & VIP' }
            },
            hexBackgroundColor: customData.hexBackgroundColor || '#0a0a0f',
            textModulesData: [
                {
                    id: 'stamps_module',
                    header: 'TUS SELLOS OFFSZN',
                    body: stampBar
                },
                {
                    id: 'reward_module',
                    header: 'PRÓXIMO PREMIO',
                    body: rewardText
                },
                {
                    id: 'points_balance',
                    header: 'PUNTOS OFFSZN',
                    body: `⚡ ${initialPoints} PTS`
                },
                {
                    id: 'welcome_gift',
                    header: 'REGALO ACTIVO',
                    body: 'Cupón 20% OFF: WILLIEVIP'
                }
            ],
            barcode: {
                type: 'QR_CODE',
                value: `OFFSZN-VIP-${cleanEmail}`,
                alternateText: `ID: ${cleanEmail.slice(0, 12)}...`
            },
            linksModuleData: {
                uris: [
                    {
                        uri: 'https://offszn.lat/@willieinspired',
                        description: 'Tienda Oficial Willie Inspired',
                        id: 'store_link'
                    },
                    {
                        uri: 'https://offszn.lat/willieinspired/regalos',
                        description: 'Portal de Recompensas & Regalos',
                        id: 'rewards_portal'
                    },
                    {
                        uri: 'https://instagram.com/willieinspired',
                        description: 'Instagram @willieinspired',
                        id: 'social_ig'
                    }
                ]
            }
        };

        // Guardamos el registro local
        this.savePassRecord({
            id: objectId,
            name: displayName,
            email: cleanEmail,
            phone: phone || '',
            points: initialPoints,
            stamps: initialStamps,
            maxStamps: targetMaxStamps,
            status: 'ACTIVE'
        });

        // Si tenemos credenciales reales de Google Wallet, firmamos el JWT oficial
        if (this.issuerId && this.clientEmail && this.privateKey) {
            try {
                // Asegurar que la clase exista y esté sincronizada
                await this.ensureGenericClass(customData);

                // Pre-registrar o actualizar el objeto en Google Wallet API
                const auth = this.getGoogleAuthClient();
                if (auth) {
                    const walletobjects = google.walletobjects({ version: 'v1', auth });
                    try {
                        await walletobjects.genericobject.insert({ requestBody: genericObject });
                        console.log(`[GoogleWallet] GenericObject ${objectId} registrado en Google.`);
                    } catch (objErr) {
                        if (objErr.code === 409) {
                            await walletobjects.genericobject.patch({ resourceId: objectId, requestBody: genericObject });
                            console.log(`[GoogleWallet] GenericObject ${objectId} actualizado en Google.`);
                        } else {
                            console.warn(`[GoogleWallet] Aviso registrando GenericObject:`, objErr.message);
                        }
                    }
                }

                const classPayload = {
                    id: this.fullClassId,
                    issuerName: customData.issuerName || 'OFFSZN Willie Inspired',
                    reviewStatus: 'UNDER_REVIEW',
                    viewUnlockRequirement: 'UNLOCK_NOT_REQUIRED',
                    logo: {
                        sourceUri: { uri: customData.logoUrl || 'https://offszn.lat/images/LOGO-OFFSZN.png' },
                        contentDescription: { defaultValue: { language: 'es', value: 'Logo OFFSZN' } }
                    },
                    cardTitle: {
                        defaultValue: { language: 'es', value: customData.cardTitle || 'WILLIE INSPIRED VIP PASS' }
                    },
                    hexBackgroundColor: customData.hexBackgroundColor || '#0a0a0f'
                };

                const claims = {
                    iss: this.clientEmail,
                    aud: 'google',
                    typ: 'savetogooglewallet',
                    iat: Math.floor(Date.now() / 1000),
                    payload: {
                        genericClasses: [ classPayload ],
                        genericObjects: [ genericObject ]
                    }
                };

                const token = jwt.sign(claims, this.privateKey, { algorithm: 'RS256' });
                const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

                return {
                    success: true,
                    isRealGooglePass: true,
                    saveUrl,
                    objectId,
                    passData: genericObject,
                    message: 'Pase oficial generado para Google Wallet'
                };
            } catch (err) {
                console.error('[GoogleWallet] Error firmando JWT real:', err);
            }
        }

        // Modo Simulación / Demo (Ideal para probar antes de conectar la Service Account)
        return {
            success: true,
            isRealGooglePass: false,
            isDemo: true,
            saveUrl: `https://offszn.lat/willieinspired/regalos?demo_pass=${encodeURIComponent(cleanEmail)}`,
            objectId,
            passData: genericObject,
            message: 'Pase generado en modo prueba. Conecta tu Service Account en el panel para emitir enlaces oficiales de Google.'
        };
    }

    /**
     * Envía una notificación Push / Mensaje al Pase de Google Wallet
     */
    async broadcastPushNotification({ title, body, linkUrl, targetEmail }) {
        if (!title || !body) throw new Error('Se requiere título y cuerpo del mensaje.');

        const passes = this.getPassesList();
        if (passes.length === 0) {
            return { success: false, message: 'No hay tarjetas de miembros registradas todavía.' };
        }

        const targets = targetEmail 
            ? passes.filter(p => p.email.toLowerCase() === targetEmail.toLowerCase())
            : passes;

        const auth = this.getGoogleAuthClient();
        const results = {
            total: targets.length,
            sent: 0,
            failed: 0,
            simulated: 0,
            logs: []
        };

        const now = new Date().toISOString();

        for (const target of targets) {
            if (auth && this.issuerId && !target.id.startsWith('mock_')) {
                try {
                    const walletobjects = google.walletobjects({ version: 'v1', auth });
                    
                    // TEXT_AND_NOTIFY envía una notificación push a la pantalla de bloqueo de Android
                    await walletobjects.genericobject.addmessage({
                        resourceId: target.id,
                        requestBody: {
                            message: {
                                header: title,
                                body: linkUrl ? `${body} <br><a href="${linkUrl}">Ver Promoción</a>` : body,
                                messageType: 'TEXT_AND_NOTIFY',
                                displayInterval: {
                                    start: { date: now }
                                }
                            }
                        }
                    });

                    results.sent++;
                    results.logs.push({ email: target.email, status: 'PUSH_SENT' });
                } catch (e) {
                    console.error(`[GoogleWallet] Fallo push a ${target.email}:`, e.message);
                    results.failed++;
                    results.logs.push({ email: target.email, status: 'ERROR', error: e.message });
                }
            } else {
                // Modo simulado
                results.simulated++;
                results.logs.push({ email: target.email, status: 'SIMULATED_PUSH' });
            }
        }

        return {
            success: true,
            title,
            body,
            results,
            message: results.sent > 0 
                ? `¡Notificación enviada a ${results.sent} dispositivos Android!` 
                : `Simulación de notificación push completada para ${results.simulated} miembros.`
        };
    }

    /**
     * Suma o resta sellos a un miembro y envía notificación push a su Android
     */
    async addStampToMember({ email, count = 1, notify = true, customMessage = '' }) {
        const cleanEmail = email.trim().toLowerCase();
        const passes = this.getPassesList();
        const member = passes.find(p => p.email.toLowerCase() === cleanEmail);

        if (!member) throw new Error('Miembro no encontrado con ese correo.');

        const maxStamps = Number(member.maxStamps) || 5;
        member.stamps = Math.max(0, (Number(member.stamps) || 0) + Number(count));
        member.updatedAt = new Date().toISOString();
        this.savePassRecord(member);

        const isCompleted = member.stamps >= maxStamps;
        const stampBar = this.formatStampBar(member.stamps, maxStamps);
        const rewardText = isCompleted 
            ? '🎉 ¡TARJETA COMPLETA! Reclama tu Plugin/Preset Gratis' 
            : `🎁 Te faltan ${maxStamps - member.stamps} sello(s) para tu Regalo`;

        const auth = this.getGoogleAuthClient();
        if (auth && this.issuerId && !member.id.startsWith('mock_')) {
            try {
                const walletobjects = google.walletobjects({ version: 'v1', auth });
                await walletobjects.genericobject.patch({
                    resourceId: member.id,
                    requestBody: {
                        textModulesData: [
                            {
                                id: 'stamps_module',
                                header: 'TUS SELLOS OFFSZN',
                                body: stampBar
                            },
                            {
                                id: 'reward_module',
                                header: 'PRÓXIMO PREMIO',
                                body: rewardText
                            },
                            {
                                id: 'points_balance',
                                header: 'PUNTOS OFFSZN',
                                body: `⚡ ${member.points || 100} PTS`
                            },
                            {
                                id: 'welcome_gift',
                                header: 'REGALO ACTIVO',
                                body: isCompleted ? '🔥 100% OFF EN CUALQUIER PRESET' : 'Cupón 20% OFF: WILLIEVIP'
                            }
                        ]
                    }
                });

                if (notify) {
                    const title = isCompleted
                        ? '🎉 ¡TARJETA OFFSZN COMPLETADA!'
                        : `⭐ ¡Nuevo Sello OFFSZN! (${member.stamps}/${maxStamps})`;
                    const body = customMessage || (isCompleted
                        ? '¡Felicidades! Completaste tus 5 sellos. Toca tu tarjeta para reclamar tu regalo.'
                        : `Acabas de ganar 1 sello. Te faltan ${maxStamps - member.stamps} para ganar tu premio.`);

                    await walletobjects.genericobject.addmessage({
                        resourceId: member.id,
                        requestBody: {
                            message: {
                                header: title,
                                body: body,
                                messageType: 'TEXT_AND_NOTIFY'
                            }
                        }
                    });
                }
            } catch (e) {
                console.error('[GoogleWallet] Error sincronizando sello en Google:', e.message);
            }
        }

        return {
            success: true,
            email: cleanEmail,
            stamps: member.stamps,
            maxStamps,
            stampBar,
            isCompleted,
            message: `Sellos actualizados: ${member.stamps}/${maxStamps}`
        };
    }

    /**
     * Actualiza los puntos de un miembro específico
     */
    async updateMemberPoints({ email, pointsChange, newTotal }) {
        const cleanEmail = email.trim().toLowerCase();
        const passes = this.getPassesList();
        const member = passes.find(p => p.email.toLowerCase() === cleanEmail);

        if (!member) throw new Error('Miembro no encontrado.');

        const updatedPoints = newTotal !== undefined 
            ? Number(newTotal) 
            : (member.points || 0) + Number(pointsChange || 0);

        member.points = Math.max(0, updatedPoints);
        member.updatedAt = new Date().toISOString();
        this.savePassRecord(member);

        // Si tenemos Google API real, actualizamos el GenericObject en tiempo real
        const auth = this.getGoogleAuthClient();
        if (auth && this.issuerId && !member.id.startsWith('mock_')) {
            try {
                const walletobjects = google.walletobjects({ version: 'v1', auth });
                await walletobjects.genericobject.patch({
                    resourceId: member.id,
                    requestBody: {
                        textModulesData: [
                            {
                                id: 'points_balance',
                                header: 'PUNTOS OFFSZN',
                                body: `⚡ ${member.points} PTS`
                            },
                            {
                                id: 'welcome_gift',
                                header: 'REGALO ACTIVO',
                                body: member.points >= 200 ? '🔥 ¡Tienes 1 Plugin Gratis disponible!' : 'Cupón 20% OFF: WILLIEVIP'
                            },
                            {
                                id: 'status_tier',
                                header: 'NIVEL',
                                body: member.points >= 500 ? '👑 VIP MASTER' : '💎 VIP PRODUCER'
                            }
                        ]
                    }
                });
            } catch (e) {
                console.error('[GoogleWallet] Error actualizando puntos en Google API:', e.message);
            }
        }

        return {
            success: true,
            email: cleanEmail,
            newPoints: member.points,
            message: `Puntos actualizados a ${member.points} PTS`
        };
    }
}

export const googleWalletService = new GoogleWalletService();
