import { BookingService } from '../../services/booking/BookingService.js';

/**
 * Obtener todos los tipos de citas/servicios disponibles
 */
export async function getBookingServices(req, res) {
    try {
        const services = await BookingService.getEventTypes();
        return res.status(200).json({ success: true, data: services });
    } catch (error) {
        console.error('[BookingController] Error getBookingServices:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener servicios de agendamiento' });
    }
}

/**
 * Obtener slots disponibles para un servicio y fecha
 * GET /api/booking/slots?slug=...&date=YYYY-MM-DD&timezone=...
 */
export async function getBookingSlots(req, res) {
    try {
        const { slug, date, timezone } = req.query;

        if (!slug || !date) {
            return res.status(400).json({ success: false, message: 'Faltan parámetros requeridos: slug y date (YYYY-MM-DD)' });
        }

        // Validación básica de formato de fecha YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ success: false, message: 'Formato de fecha inválido. Usa YYYY-MM-DD' });
        }

        const slots = await BookingService.getAvailableSlots(slug, date, timezone);
        return res.status(200).json({ success: true, date, slots });
    } catch (error) {
        console.error('[BookingController] Error getBookingSlots:', error);
        return res.status(500).json({ success: false, message: 'Error al calcular horarios disponibles' });
    }
}

/**
 * Crear una reserva confirmada
 * POST /api/booking/create
 */
export async function createBooking(req, res) {
    try {
        const {
            slug,
            clientName,
            clientEmail,
            clientPhone,
            clientTimezone,
            startTime,
            responses
        } = req.body;

        if (!slug || !clientName || !clientEmail || !startTime) {
            return res.status(400).json({
                success: false,
                message: 'Campos obligatorios faltantes (servicio, nombre, email, horario)'
            });
        }

        const booking = await BookingService.createBooking({
            slug,
            clientName,
            clientEmail,
            clientPhone,
            clientTimezone,
            startTime,
            responses
        });

        return res.status(201).json({
            success: true,
            message: 'Cita agendada exitosamente',
            data: booking
        });
    } catch (error) {
        console.error('[BookingController] Error createBooking:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'No se pudo crear la reserva'
        });
    }
}

/**
 * Obtener detalles de una reserva por su UID
 * GET /api/booking/:uid
 */
export async function getBookingDetails(req, res) {
    try {
        const { uid } = req.params;
        const booking = await BookingService.getBookingByUid(uid);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Cita no encontrada' });
        }

        return res.status(200).json({ success: true, data: booking });
    } catch (error) {
        console.error('[BookingController] Error getBookingDetails:', error);
        return res.status(500).json({ success: false, message: 'Error al consultar la cita' });
    }
}

/**
 * Cancelar una reserva
 * POST /api/booking/cancel/:uid
 */
export async function cancelBooking(req, res) {
    try {
        const { uid } = req.params;
        const { cancellationToken, reason } = req.body;

        if (!cancellationToken) {
            return res.status(400).json({ success: false, message: 'Token de cancelación requerido' });
        }

        const cancelled = await BookingService.cancelBooking(uid, cancellationToken, reason);
        return res.status(200).json({
            success: true,
            message: 'Cita cancelada con éxito',
            data: cancelled
        });
    } catch (error) {
        console.error('[BookingController] Error cancelBooking:', error);
        return res.status(400).json({ success: false, message: error.message });
    }
}
