import { Router } from 'express';
import {
    getBookingServices,
    getBookingSlots,
    createBooking,
    getBookingDetails,
    cancelBooking
} from '../controllers/BookingController.js';

const router = Router();

// Endpoints públicos del sistema de agendamiento (Willie Inspired / OFFSZN)
router.get('/services', getBookingServices);
router.get('/slots', getBookingSlots);
router.post('/create', createBooking);
router.get('/:uid', getBookingDetails);
router.post('/cancel/:uid', cancelBooking);

export default router;
