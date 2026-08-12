import express from 'express';
import {
    getEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    sendReminderNow,
    checkAndSendReminders
} from '../controllers/CalendarController.js';
import { isAdminMiddleware } from '../../middlewares/isAdmin.middleware.js';

const router = express.Router();

// Content Calendar API Endpoints (Admin Only)
router.use('/content-calendar', isAdminMiddleware);

router.get('/content-calendar', getEvents);
router.post('/content-calendar', createEvent);
router.put('/content-calendar/:id', updateEvent);
router.delete('/content-calendar/:id', deleteEvent);

// Brevo Email Reminders Trigger Endpoints
router.post('/content-calendar/send-reminder/:id', sendReminderNow);
router.post('/content-calendar/check-reminders', checkAndSendReminders);

export default router;
