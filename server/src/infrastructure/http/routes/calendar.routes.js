import express from 'express';
import {
    getEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    sendReminderNow,
    checkAndSendReminders
} from '../controllers/CalendarController.js';

const router = express.Router();

// Content Calendar API Endpoints
router.get('/content-calendar', getEvents);
router.post('/content-calendar', createEvent);
router.put('/content-calendar/:id', updateEvent);
router.delete('/content-calendar/:id', deleteEvent);

// Brevo Email Reminders Trigger Endpoints
router.post('/content-calendar/send-reminder/:id', sendReminderNow);
router.post('/content-calendar/check-reminders', checkAndSendReminders);

export default router;
