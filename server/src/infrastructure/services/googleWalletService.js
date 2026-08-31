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
        }

        this.issuerId = process.env.GOOGLE_WALLET_ISSUER_ID || fileConfig.issuerId || '';
        this.clientEmail = process.env.GOOGLE_WALLET_CLIENT_EMAIL || fileConfig.clientEmail || '';
        
        let rawKey = process.env.GOOGLE_WALLET_PRIVATE_KEY || fileConfig.privateKey || '';
        if (rawKey) {
            // Replace escaped newlines if passed as env string
            this.privateKey = rawKey.replace(/\\n/g, '\n');
        } else {
            this.privateKey = '';
        }

        this.classId = process.env.GOOGLE_WALLET_CLASS_ID || fileConfig.classId || 'willieinspired_vip_pass_v1';
        this.fullClassId = this.issuerId ? `${this.issuerId}.${this.classId}` : `mock_issuer.${this.classId}`;
    }

    saveRuntimeConfig(config) {
        try {
            const current = fs.existsSync(WALLET_CONFIG_FILE) 
                ? JSON.parse(fs.readFileSync(WALLET_CONFIG_FILE, 'utf8')) 
                : {};
            
            const updated = { ...current, ...config, updatedAt: new Date().toISOString() };
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
            hasClientEmail: Boolean(this.clientEmail),
            clientEmail: this.clientEmail || null,
            hasPrivateKey: Boolean(this.privateKey),
            classId: this.classId,
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

    savePassRecord(pass) {
        try {
            const list = this.getPassesList();
            const existingIdx = list.findIndex(p => p.email.toLowerCase() === pass.email.toLowerCase());
            
            if (existingIdx >= 0) {
                list[existingIdx] = { ...list[existingIdx], ...pass, updatedAt: new Date().toISOString() };
            } else {
                list.unshift({ ...pass, createdAt: new Date().toISOString(), points: pass.points || 100 });
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
    async createPass({ name, email, phone, points = 100, customData = {} }) {
        if (!email) throw new Error('El correo electrónico es requerido.');

        const cleanEmail = email.trim().toLowerCase();
        const safeUserId = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
        const objectId = this.issuerId 
            ? `${this.issuerId}.${safeUserId}_vip` 
            : `mock_issuer.${safeUserId}_vip`;

        const displayName = (name || 'Productor VIP').toUpperCase();
        const initialPoints = Number(points) || 100;

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
                defaultValue: { language: 'es', value: 'PASE DE REGALOS & DROPS' }
            },
            hexBackgroundColor: customData.hexBackgroundColor || '#0a0a0f',
            textModulesData: [
                {
                    id: 'points_balance',
                    header: 'PUNTOS OFFSZN',
                    body: `⚡ ${initialPoints} PTS`
                },
                {
                    id: 'welcome_gift',
                    header: 'REGALO ACTIVO',
                    body: 'Cupón 20% OFF: WILLIEVIP'
                },
                {
                    id: 'status_tier',
                    header: 'NIVEL',
                    body: '💎 VIP PRODUCER'
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

                const claims = {
                    iss: this.clientEmail,
                    aud: 'google',
                    typ: 'savetogooglewallet',
                    payload: {
                        genericObjects: [
                            {
                                id: objectId,
                                classId: this.fullClassId
                            }
                        ]
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
                // Fallback a modo demo con aviso
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
                    
                    // addMessage envía una notificación push en Android al móvil del usuario
                    await walletobjects.genericobject.addmessage({
                        resourceId: target.id,
                        requestBody: {
                            message: {
                                header: title,
                                body: body,
                                messageType: 'TEXT_AND_URL',
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
