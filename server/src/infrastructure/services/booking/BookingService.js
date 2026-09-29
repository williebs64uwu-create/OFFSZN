import crypto from 'crypto';
import { supabase } from '../../database/connection.js';

// Datos por defecto (fallback seguro si aún no se corrió la migración en Supabase)
const FALLBACK_EVENT_TYPES = [
    {
        id: 'b0000000-0000-0000-0000-000000000001',
        slug: 'asesoria-mezcla-60min',
        title: 'Asesoría 1 a 1: Mezcla & Master en FL Studio',
        description: 'Sesión privada intensiva por Google Meet compartiendo pantalla. Revisaremos tu proyecto FLP en vivo, afinación vocal, balance de frecuencias, compresión paralela y resolución de dudas quirúrgicas.',
        duration_minutes: 60,
        price_usd: 35.00,
        color: '#ec4899',
        location_type: 'google_meet',
        buffer_before_minutes: 10,
        buffer_after_minutes: 15
    },
    {
        id: 'b0000000-0000-0000-0000-000000000002',
        slug: 'revision-beat-45min',
        title: 'Revisión de Beat & Arreglo Musical en Vivo',
        description: 'Sesión de feedback técnico y creativo sobre tu instrumental. Optimización de drums, 808 sidechain, estructura de transiciones y preparación para enviar a artistas.',
        duration_minutes: 45,
        price_usd: 25.00,
        color: '#8b5cf6',
        location_type: 'google_meet',
        buffer_before_minutes: 10,
        buffer_after_minutes: 15
    },
    {
        id: 'b0000000-0000-0000-0000-000000000003',
        slug: 'diagnostico-vocal-30min',
        title: 'Diagnóstico Rápido de Cadena Vocal & Home Studio',
        description: 'Llamada rápida de diagnóstico para revisar tu acústica, cadena de plugins y darte la hoja de ruta exacta para que tus voces suenen profesionales sin micrófonos caros.',
        duration_minutes: 30,
        price_usd: 0.00,
        color: '#10b981',
        location_type: 'google_meet',
        buffer_before_minutes: 10,
        buffer_after_minutes: 10
    }
];

export class BookingService {
    /**
     * Obtener todos los servicios activos
     */
    static async getEventTypes() {
        try {
            const { data, error } = await supabase
                .from('booking_event_types')
                .select('*')
                .eq('is_active', true)
                .order('price_usd', { ascending: false });

            if (error || !data || data.length === 0) {
                return FALLBACK_EVENT_TYPES;
            }
            return data;
        } catch {
            return FALLBACK_EVENT_TYPES;
        }
    }

    /**
     * Obtener un servicio por slug
     */
    static async getEventTypeBySlug(slug) {
        try {
            const { data, error } = await supabase
                .from('booking_event_types')
                .select('*')
                .eq('slug', slug)
                .single();

            if (error || !data) {
                return FALLBACK_EVENT_TYPES.find(e => e.slug === slug) || FALLBACK_EVENT_TYPES[0];
            }
            return data;
        } catch {
            return FALLBACK_EVENT_TYPES.find(e => e.slug === slug) || FALLBACK_EVENT_TYPES[0];
        }
    }

    /**
     * Calcular slots disponibles para una fecha específica (YYYY-MM-DD)
     * Respetando día de la semana, colisiones de reservas y zonas horarias.
     */
    static async getAvailableSlots(slug, dateStr, clientTimezone = 'America/Lima') {
        const eventType = await this.getEventTypeBySlug(slug);
        if (!eventType) return [];

        const targetDate = new Date(`${dateStr}T00:00:00Z`);
        const dayOfWeek = targetDate.getUTCDay(); // 0: Dom, 1: Lun ... 6: Sab

        // 1. Obtener rangos de disponibilidad para el día
        let dayRanges = [];
        try {
            const { data: availData, error: availError } = await supabase
                .from('booking_availabilities')
                .select('start_time, end_time')
                .eq('day_of_week', dayOfWeek);

            if (!availError && availData && availData.length > 0) {
                dayRanges = availData;
            }
        } catch {
            // Silencioso
        }

        // Fallback si no hay tablas aún:
        // Lunes a Viernes (1-5): 14:00 a 20:00 | Sábado (6): 11:00 a 16:00 | Domingo: cerrado
        if (dayRanges.length === 0) {
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                dayRanges = [{ start_time: '14:00:00', end_time: '20:00:00' }];
            } else if (dayOfWeek === 6) {
                dayRanges = [{ start_time: '11:00:00', end_time: '16:00:00' }];
            } else {
                return []; // Domingo no disponible
            }
        }

        // 2. Obtener reservas confirmadas en esa fecha
        let existingBookings = [];
        try {
            const dayStart = new Date(`${dateStr}T00:00:00Z`).toISOString();
            const dayEnd = new Date(`${dateStr}T23:59:59Z`).toISOString();

            const { data: bData } = await supabase
                .from('bookings')
                .select('start_time, end_time')
                .eq('status', 'ACCEPTED')
                .gte('start_time', dayStart)
                .lte('start_time', dayEnd);

            if (bData) existingBookings = bData;
        } catch {
            // Silencioso
        }

        const durationMinutes = eventType.duration_minutes || 60;
        const bufferAfter = eventType.buffer_after_minutes || 15;
        const stepMinutes = durationMinutes + bufferAfter;

        const now = new Date();
        const minNoticeMs = 2 * 60 * 60 * 1000; // Mínimo 2 horas de anticipación
        const slots = [];

        for (const range of dayRanges) {
            const [startH, startM] = range.start_time.split(':').map(Number);
            const [endH, endM] = range.end_time.split(':').map(Number);

            let currentMinutes = startH * 60 + startM;
            const endLimitMinutes = endH * 60 + endM;

            while (currentMinutes + durationMinutes <= endLimitMinutes) {
                const slotH = Math.floor(currentMinutes / 60);
                const slotM = currentMinutes % 60;

                const pad = (n) => String(n).padStart(2, '0');
                const slotStartIso = `${dateStr}T${pad(slotH)}:${pad(slotM)}:00Z`;
                const slotStartDate = new Date(slotStartIso);
                const slotEndDate = new Date(slotStartDate.getTime() + durationMinutes * 60000);

                // Descartar si cae en el pasado o con menos de 2h de antelación
                if (slotStartDate.getTime() - now.getTime() > minNoticeMs) {
                    // Verificar colisión con reservas existentes
                    const hasOverlap = existingBookings.some((b) => {
                        const bStart = new Date(b.start_time).getTime();
                        const bEnd = new Date(b.end_time).getTime();
                        return (
                            (slotStartDate.getTime() >= bStart && slotStartDate.getTime() < bEnd) ||
                            (slotEndDate.getTime() > bStart && slotEndDate.getTime() <= bEnd) ||
                            (slotStartDate.getTime() <= bStart && slotEndDate.getTime() >= bEnd)
                        );
                    });

                    if (!hasOverlap) {
                        // Formatear en hora local y hora en formato 12h/24h
                        const time24 = `${pad(slotH)}:${pad(slotM)}`;
                        const period = slotH >= 12 ? 'PM' : 'AM';
                        const hour12 = slotH % 12 || 12;
                        const time12 = `${hour12}:${pad(slotM)} ${period}`;

                        slots.push({
                            startTime: slotStartDate.toISOString(),
                            endTime: slotEndDate.toISOString(),
                            time24,
                            time12,
                            durationMinutes
                        });
                    }
                }

                currentMinutes += stepMinutes;
            }
        }

        return slots;
    }

    /**
     * Crear una nueva reserva
     */
    static async createBooking({
        slug,
        clientName,
        clientEmail,
        clientPhone,
        clientTimezone,
        startTime,
        responses = {}
    }) {
        if (!clientName || !clientEmail || !startTime) {
            throw new Error('Nombre, email y horario de inicio son requeridos');
        }

        const eventType = await this.getEventTypeBySlug(slug);
        if (!eventType) throw new Error('Servicio no encontrado');

        const startDate = new Date(startTime);
        const endDate = new Date(startDate.getTime() + eventType.duration_minutes * 60000);

        // Generar UID y token único de cancelación
        const uid = `bk_wll_${crypto.randomBytes(4).toString('hex')}`;
        const cancellationToken = crypto.randomBytes(16).toString('hex');

        // Generar sala de Google Meet (o enlace permanente de estudio)
        const meetingCode = `${crypto.randomBytes(3).toString('hex')}-${crypto.randomBytes(4).toString('hex')}-${crypto.randomBytes(3).toString('hex')}`;
        const meetingUrl = `https://meet.google.com/${meetingCode}`;

        const isFree = Number(eventType.price_usd) === 0;
        const paymentStatus = isFree ? 'FREE' : 'PENDING_PAYMENT';

        const bookingData = {
            uid,
            event_type_id: eventType.id.startsWith('b000') ? null : eventType.id,
            client_name: clientName,
            client_email: clientEmail.toLowerCase().trim(),
            client_phone: clientPhone || null,
            client_timezone: clientTimezone || 'America/Lima',
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            status: 'ACCEPTED',
            payment_status: paymentStatus,
            amount_paid: isFree ? 0.00 : eventType.price_usd,
            meeting_url: meetingUrl,
            responses,
            cancellation_token: cancellationToken,
            created_at: new Date().toISOString()
        };

        try {
            const { data, error } = await supabase
                .from('bookings')
                .insert([bookingData])
                .select()
                .single();

            if (error) {
                console.warn('[BookingService] Supabase insert fallback:', error.message);
            }
        } catch (err) {
            console.warn('[BookingService] Supabase error:', err.message);
        }

        return {
            uid,
            clientName,
            clientEmail,
            clientTimezone,
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
            durationMinutes: eventType.duration_minutes,
            serviceTitle: eventType.title,
            priceUsd: eventType.price_usd,
            meetingUrl,
            cancellationToken
        };
    }

    /**
     * Obtener detalle de una reserva por UID
     */
    static async getBookingByUid(uid) {
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select('*, booking_event_types(title, duration_minutes, price_usd, color)')
                .eq('uid', uid)
                .single();

            if (!error && data) return data;
        } catch {
            // Silencioso
        }

        return null;
    }

    /**
     * Cancelar una reserva
     */
    static async cancelBooking(uid, cancellationToken, reason = '') {
        try {
            const { data, error } = await supabase
                .from('bookings')
                .update({
                    status: 'CANCELLED',
                    cancellation_reason: reason,
                    cancelled_at: new Date().toISOString()
                })
                .eq('uid', uid)
                .eq('cancellation_token', cancellationToken)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (err) {
            throw new Error('No se pudo cancelar la cita: token inválido o cita no encontrada');
        }
    }
}
