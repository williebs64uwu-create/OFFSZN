import { supabase } from '../../database/connection.js';
import { sendReceiptEmail } from '../../../shared/utils/email.js';
import { v4 as uuidv4 } from 'uuid';
import { R2_ENDPOINT } from '../../../shared/config/config.js';

// Configuration for daily limits
const PLAN_LIMITS = {
    'free': 1,
    'básico': 1,
    'starter': 5,
    'pro': Infinity
};

export const createRequest = async (req, res) => {
    try {
        const buyerId = req.user?.id || req.user?.userId;

        console.log(`📡 createRequest: buyerId=${buyerId}`, "req.user:", req.user);

        if (!buyerId || buyerId === 'undefined') {
            return res.status(401).json({ error: 'Sesión inválida o identificación de usuario faltante.' });
        }

        const {
            producerId,
            description,
            budget,
            bpm,
            key,
            referenceLink1,
            referenceLink2,
            previewUrl
        } = req.body;

        // Strict Validations
        if (!description || !budget) {
            return res.status(400).json({ error: 'La descripción y el presupuesto son obligatorios' });
        }

        const budgetNum = Number(budget);
        if (!Number.isInteger(budgetNum) || budgetNum < 10 || budgetNum > 1000) {
            return res.status(400).json({ error: 'El presupuesto debe ser un número entero entre $10 y $1000 USD' });
        }

        if (!producerId) {
            return res.status(400).json({ error: 'Faltan campos requeridos (producerId).' });
        }

        if (buyerId === producerId) {
            return res.status(400).json({ error: 'No puedes enviarte una solicitud a ti mismo.' });
        }

        // 1. Get buyer's info (try profiles, fallback to users)
        let { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('plan, display_name, username')
            .eq('id', buyerId)
            .single();

        let buyerName = 'Usuario';
        let userPlan = 'free';

        if (profile) {
            buyerName = profile.display_name || profile.username || 'Usuario';
            userPlan = (profile.plan || 'free').toLowerCase();
        } else {
            // Fallback to users table if profile doesn't exist
            const { data: userData } = await supabase
                .from('users')
                .select('nickname, role')
                .eq('id', buyerId)
                .single();

            if (userData) {
                buyerName = userData.nickname || 'Usuario';
                // Roles in users table might not match plan names directly, but we default to free
            }
        }

        const dailyLimit = PLAN_LIMITS[userPlan] || 1;

        // 2. Check how many requests they made today
        if (dailyLimit !== Infinity) {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            // Using select with count: 'exact' and head: true can sometimes be finicky depending on PostgREST version/config
            // Let's use a more standard select('id') and check the length of data, or use the count parameter correctly.
            const { data: existingRequests, count, error: countErr } = await supabase
                .from('custom_requests')
                .select('id', { count: 'exact' })
                .eq('buyer_id', buyerId)
                .gte('created_at', todayStart.toISOString());

            if (countErr) {
                console.error("Error checking request limits:", countErr);
                // Log more details if available
                if (countErr.details) console.error("Error details:", countErr.details);
                if (countErr.hint) console.error("Error hint:", countErr.hint);

                return res.status(500).json({
                    error: 'Error verificando límites de solicitudes.',
                    details: countErr.message
                });
            }

            const currentCount = count || 0;

            if (currentCount >= dailyLimit) {
                return res.status(403).json({
                    error: `Has alcanzado tu límite diario de solicitudes (${dailyLimit}). Regresa en 24 horas para enviar otra solicitud.`,
                    limitReached: true
                });
            }
        }

        // 3. Insert Request
        const { data: newRequest, error: insertErr } = await supabase
            .from('custom_requests')
            .insert({
                buyer_id: buyerId,
                producer_id: producerId,
                description,
                budget: budgetNum || null,
                bpm: bpm || null,
                key: key || null,
                reference_link_1: referenceLink1 || null,
                reference_link_2: referenceLink2 || null,
                preview_url: previewUrl || null
            })
            .select()
            .single();

        if (insertErr) {
            console.error("Error inserting custom request:", insertErr);
            return res.status(500).json({ error: 'Error al procesar la solicitud.' });
        }

        // 4. Notify Producer (Email/In-App)
        const { data: producerProfile } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', producerId)
            .single();

        const { data: producerEmailUser } = await supabase
            .from('users')
            .select('email')
            .eq('id', producerId)
            .single();

        // In-App Notification
        await supabase.from('notifications').insert({
            user_id: producerId,
            type: 'custom_request',
            message: `${buyerName} te ha enviado una solicitud de Custom Beat.`,
            metadata: { request_id: newRequest.id, buyer_id: buyerId }
        });

        // NOTIFICACIÓN EMAIL
        if (producerEmailUser && producerEmailUser.email) {
            try {
                // Si 'new_custom_request' no existe en el dashboard, fallará con 400.
                // Podríamos usar una variable de entorno para mapear estos IDs.
                await sendReceiptEmail({
                    to_email: producerEmailUser.email,
                    // Intentamos usar un ID específico, o el genérico configurado
                    template_id: process.env.EMAILJS_TEMPLATE_NEW_REQUEST || 'new_custom_request',
                    producerName: producerProfile?.display_name || producerProfile?.username || 'Productor',
                    buyerName: buyerName,
                    description: description,
                    budget: budget ? `$${budget}` : 'A convenir',
                    ctaLink: `https://offszn.lat/cuenta/solicitudes`
                });
            } catch (emailErr) {
                console.warn("Could not send email for custom request:", emailErr.message);

                // Segundo intento con el template ID principal si el anterior falló por ID no encontrado
                if (emailErr.message.includes('400') || emailErr.message.includes('not found')) {
                    try {
                        await sendReceiptEmail({
                            to_email: producerEmailUser.email,
                            // Aquí NO pasamos template_id para que use el EMAILJS_TEMPLATE_ID por defecto
                            producerName: producerProfile?.display_name || producerProfile?.username || 'Productor',
                            buyerName: buyerName,
                            description: description,
                            budget: budget ? `$${budget}` : 'A convenir',
                            ctaLink: `https://offszn.lat/cuenta/solicitudes`
                        });
                    } catch (retryErr) {
                        console.error("Retry email failed:", retryErr.message);
                    }
                }
            }
        }

        return res.status(201).json({ message: 'Solicitud enviada correctamente.', request: newRequest });

    } catch (error) {
        console.error('Error en createRequest:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

export const getPublicRequests = async (req, res) => {
    try {
        const { data: requests, error } = await supabase
            .from('custom_requests')
            .select(`
                *,
                buyer:buyer_id(id, nickname, avatar_url, role),
                producer:producer_id(id, nickname, avatar_url, role)
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            return res.status(500).json({ error: 'Error al obtener solicitudes públicas.' });
        }

        res.status(200).json({ requests });
    } catch (error) {
        console.error('Error en getPublicRequests:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

export const claimRequest = async (req, res) => {
    try {
        const producerId = req.user.id;
        const requestId = req.params.id;

        // 1. Verify request is still pending
        const { data: request, error: fetchErr } = await supabase
            .from('custom_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (fetchErr || !request) {
            return res.status(404).json({ error: 'Solicitud no encontrada.' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Esta solicitud ya no está disponible.' });
        }

        if (request.buyer_id === producerId) {
            return res.status(400).json({ error: 'No puedes tomar tu propia solicitud.' });
        }

        if (request.producer_id === producerId) {
            return res.status(400).json({ error: 'Ya eres el productor asignado a esta solicitud.' });
        }

        // 2. Update producer
        const { data: updatedRequest, error: updateErr } = await supabase
            .from('custom_requests')
            .update({
                producer_id: producerId,
                // Optional: maybe we don't want to change status to 'claimed' but keep 'pending' for them to respond
            })
            .eq('id', requestId)
            .select()
            .single();

        if (updateErr) {
            return res.status(500).json({ error: 'Error al reclamar la solicitud.' });
        }

        // 3. Notify Buyer
        const { data: producerProfile } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', producerId)
            .single();

        await supabase.from('notifications').insert({
            user_id: request.buyer_id,
            type: 'custom_request_claimed',
            message: `${producerProfile.display_name || producerProfile.username} ha tomado tu solicitud de Custom Beat. ¡Pronto recibirás una preview!`,
            metadata: { request_id: requestId, producer_id: producerId }
        });

        res.status(200).json({ message: 'Has tomado el trabajo correctamente.', request: updatedRequest });

    } catch (error) {
        console.error('Error en claimRequest:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

export const respondRequest = async (req, res) => {
    try {
        const producerId = req.user.id;
        const requestId = req.params.id;
        const { previewUrl } = req.body;

        if (!previewUrl) {
            return res.status(400).json({ error: 'Debes incluir la URL del archivo de audio recortado (30s max).' });
        }

        // Verify request ownership and status
        const { data: request, error: fetchErr } = await supabase
            .from('custom_requests')
            .select('*')
            .eq('id', requestId)
            .eq('producer_id', producerId)
            .single();

        if (fetchErr || !request) {
            return res.status(404).json({ error: 'Solicitud no encontrada o no autorizada.' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Esta solicitud ya no está pendiente.' });
        }

        // Set expiration 24 hours from now
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        // Update database
        const { data: updatedRequest, error: updateErr } = await supabase
            .from('custom_requests')
            .update({
                status: 'responded',
                preview_url: previewUrl,
                expires_at: expiresAt.toISOString()
            })
            .eq('id', requestId)
            .select()
            .single();

        if (updateErr) {
            return res.status(500).json({ error: 'Error al actualizar la solicitud.' });
        }

        // Notify Buyer
        const { data: buyerEmailUser } = await supabase
            .from('users')
            .select('email')
            .eq('id', request.buyer_id)
            .single();

        const { data: producerProfile } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', producerId)
            .single();

        await supabase.from('notifications').insert({
            user_id: request.buyer_id,
            type: 'custom_request_responded',
            message: `${producerProfile.display_name || producerProfile.username} ha respondido a tu solicitud. ¡Tienes 24 horas para escucharla!`,
            metadata: { request_id: requestId }
        });

        if (buyerEmailUser && buyerEmailUser.email) {
            try {
                await sendReceiptEmail({
                    to_email: buyerEmailUser.email,
                    template_id: 'request_responded', // Replace with actual template if needed
                    producerName: producerProfile?.display_name || producerProfile?.username || 'El productor',
                    ctaLink: `https://offszn.lat/cuenta/solicitudes/${requestId}`
                });
            } catch (emailErr) {
                console.warn("Could not notify buyer via email:", emailErr.message);
            }
        }

        res.status(200).json({ message: 'Respuesta enviada. Expira en 24 horas.', request: updatedRequest });

    } catch (error) {
        console.error('Error en respondRequest:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

export const getMyRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        // As a buyer or producer
        const type = req.query.type || 'buyer'; // 'buyer' or 'producer'

        const columnFilter = type === 'producer' ? 'producer_id' : 'buyer_id';

        const { data: requests, error } = await supabase
            .from('custom_requests')
            .select(`
                *,
                buyer:buyer_id(id, display_name, username, avatar_url),
                producer:producer_id(id, display_name, username, avatar_url)
            `)
            .eq(columnFilter, userId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: 'Error al obtener solicitudes.' });
        }

        res.status(200).json({ requests });

    } catch (error) {
        console.error('Error en getMyRequests:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};
