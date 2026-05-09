import fetch from 'node-fetch';
import { EMAILOCTOPUS_API_KEY, EMAILOCTOPUS_LIST_ID } from '../../shared/config/config.js';
import crypto from 'crypto';

/**
 * Sincroniza un usuario de OFFSZN con EmailOctopus.
 * @param {Object} userData - Datos del usuario (email, nickname, role, onboarding_status, etc.)
 */
export const syncUserToEmailOctopus = async (userData) => {
    if (!EMAILOCTOPUS_API_KEY || !EMAILOCTOPUS_LIST_ID) {
        console.error('[EmailOctopus] Missing API Key or List ID');
        return;
    }

    const { 
        email, 
        nickname, 
        role, 
        plan = 'Free', 
        onboarding_status = 'Incompleto',
        first_upload = 'No',
        products_count = 0,
        followers_count = 0,
        segmento = 'Producer'
    } = userData;

    if (!email) return;

    try {
        console.log(`[EmailOctopus] Syncing ${email}...`);

        const response = await fetch(`https://emailoctopus.com/api/1.6/lists/${EMAILOCTOPUS_LIST_ID}/contacts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: EMAILOCTOPUS_API_KEY,
                email_address: email,
                fields: {
                    FirstName: nickname || '',
                    Segmento: segmento,
                    Plan: plan,
                    Role: role || 'Sin definir',
                    Onboarding: onboarding_status,
                    PrimerUpload: first_upload,
                    Productos: String(products_count),
                    Seguidores: String(followers_count)
                },
                status: 'SUBSCRIBED'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            // Si ya existe, intentamos un UPDATE (PUT)
            if (data.error && data.error.code === 'MEMBER_EXISTS_WITH_EMAIL_ADDRESS') {
                const emailMd5 = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
                
                const updateRes = await fetch(`https://emailoctopus.com/api/1.6/lists/${EMAILOCTOPUS_LIST_ID}/contacts/${emailMd5}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        api_key: EMAILOCTOPUS_API_KEY,
                        fields: {
                            FirstName: nickname || '',
                            Segmento: segmento,
                            Plan: plan,
                            Role: role || 'Sin definir',
                            Onboarding: onboarding_status,
                            PrimerUpload: first_upload,
                            Productos: String(products_count),
                            Seguidores: String(followers_count)
                        }
                    })
                });

                if (!updateRes.ok) {
                    const updateData = await updateRes.json();
                    console.error('[EmailOctopus] Update Failed:', updateData);
                } else {
                    console.log(`[EmailOctopus] Updated: ${email}`);
                }
            } else {
                console.error('[EmailOctopus] Sync Failed:', data);
            }
        } else {
            console.log(`[EmailOctopus] Synced New Contact: ${email}`);
        }

    } catch (error) {
        console.error('[EmailOctopus] Fatal Error:', error.message);
    }
};

/**
 * Envía una señal a n8n para automatizaciones extra (WhatsApp, Slack, etc.)
 * @param {string} event - Nombre del evento (registration, onboarding_complete, upgrade, etc.)
 * @param {Object} data - Datos a enviar a n8n
 */
export const syncToN8N = async (event, data) => {
    // Si no hay URL de n8n configurada, no hacemos nada
    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
    if (!N8N_WEBHOOK_URL) return;

    try {
        await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event,
                timestamp: new Date().toISOString(),
                ...data
            })
        });
        console.log(`[n8n] Event sent: ${event}`);
    } catch (error) {
        console.error(`[n8n] Error sending event ${event}:`, error.message);
    }
};

/**
 * Obtiene los datos actualizados de un usuario desde Supabase y los sincroniza con EmailOctopus.
 * @param {string} userId - ID del usuario en Supabase.
 */
export const syncUserStatsToEmailOctopus = async (userId) => {
    try {
        const { supabase } = await import('../database/connection.js');
        
        // Fetch user data
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError || !user) throw new Error(`User not found: ${userId}`);

        // Fetch product count
        const { count: productsCount } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('producer_id', userId);

        // Fetch followers count
        const { count: followersCount } = await supabase
            .from('followers')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        // Determine First Upload status
        const firstUpload = (productsCount > 0) ? 'Sí' : 'No';
        
        // Determine Onboarding status
        const onboardingStatus = user.onboarding_completed ? 'Completado' : 'Incompleto';

        const payload = {
            email: user.email,
            nickname: user.nickname,
            role: user.role,
            plan: user.plan || 'Free',
            onboarding_status: onboardingStatus,
            first_upload: firstUpload,
            products_count: productsCount || 0,
            followers_count: followersCount || 0,
            segmento: user.is_producer ? 'Producer' : 'Artist'
        };

        // 1. Direct Sync to EmailOctopus
        await syncUserToEmailOctopus(payload);

        // 2. Optional Sync to n8n for custom workflows
        await syncToN8N('user_update', payload);

    } catch (error) {
        console.error('[EmailOctopus] Stats Sync Error:', error.message);
    }
};
