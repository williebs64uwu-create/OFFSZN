import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../../database/connection.js';
import { sendOffsznEmail } from '../../../shared/utils/mailer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DB_PATH = path.join(__dirname, '../../../../database/content_calendar.json');

// Función auxiliar para garantizar la existencia del archivo de respaldo JSON
function ensureLocalDbFile() {
    try {
        const dir = path.dirname(LOCAL_DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(LOCAL_DB_PATH)) {
            fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify([], null, 2), 'utf-8');
        }
    } catch (err) {
        console.error('[CalendarController] Error asegurando BD local JSON:', err.message);
    }
}

// Cargar eventos (Supabase primero, fallback a JSON local)
async function getStoredEvents() {
    ensureLocalDbFile();
    try {
        if (supabase) {
            const { data, error } = await supabase
                .from('content_calendar')
                .select('*')
                .order('scheduled_date', { ascending: true });

            if (!error && Array.isArray(data)) {
                return data;
            }
        }
    } catch (e) {
        console.warn('[CalendarController] Supabase no disponible para calendario, usando archivo local:', e.message);
    }

    // Fallback a JSON local
    try {
        const fileContent = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
        return JSON.parse(fileContent || '[]');
    } catch (err) {
        console.error('[CalendarController] Error leyendo JSON local:', err.message);
        return [];
    }
}

// Guardar eventos (Intenta guardar en Supabase, guarda siempre en JSON local)
async function saveEvent(event) {
    ensureLocalDbFile();

    try {
        if (supabase) {
            await supabase
                .from('content_calendar')
                .upsert([event], { onConflict: 'id' });
        }
    } catch (e) {
        console.warn('[CalendarController] Supabase upsert error:', e.message);
    }

    // Siempre sincronizar con JSON local para máxima disponibilidad
    try {
        const events = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf-8') || '[]');
        const idx = events.findIndex(e => e.id === event.id);
        if (idx >= 0) {
            events[idx] = event;
        } else {
            events.push(event);
        }
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(events, null, 2), 'utf-8');
    } catch (err) {
        console.error('[CalendarController] Error guardando en JSON local:', err.message);
    }

    return event;
}

// Eliminar evento
async function removeEvent(id) {
    ensureLocalDbFile();
    try {
        if (supabase) {
            await supabase.from('content_calendar').delete().eq('id', id);
        }
    } catch (e) {
        console.warn('[CalendarController] Error delete Supabase:', e.message);
    }

    try {
        const events = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf-8') || '[]');
        const filtered = events.filter(e => e.id !== id);
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(filtered, null, 2), 'utf-8');
    } catch (err) {
        console.error('[CalendarController] Error delete JSON local:', err.message);
    }
}

/**
 * Plantilla HTML con estilo OFFSZN para correos de recordatorio por Brevo
 */
function buildReminderEmailHtml(event) {
    const channelNames = {
        instagram: 'Instagram 📸',
        tiktok: 'TikTok 🎵',
        youtube: 'YouTube 📺',
        beat_release: 'Lanzamiento de Beat 🔥',
        email_newsletter: 'Boletín por Email 📧',
        spotify: 'Spotify 🎧',
        general: 'General 📌'
    };

    const channelName = channelNames[event.channel] || event.channel || 'Contenido';
    const statusText = event.status === 'published' ? 'Publicado' : 'Programado';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #0b0d12; color: #ffffff; margin: 0; padding: 20px; }
            .card { max-width: 600px; margin: 0 auto; background: #131722; border: 1px solid #2a2f45; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            .header { background: linear-gradient(135deg, #7928CA 0%, #FF0080 100%); padding: 25px; text-align: center; }
            .header h1 { margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 2px; color: #fff; font-weight: 800; }
            .content { padding: 30px; }
            .badge { display: inline-block; background: #222738; color: #a5b4fc; border: 1px solid #3b82f6; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; text-transform: uppercase; margin-bottom: 15px; }
            .title { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 10px; line-height: 1.3; }
            .time-box { background: #181d2c; border-left: 4px solid #FF0080; padding: 12px 18px; margin: 15px 0; border-radius: 4px; font-size: 14px; color: #cbd5e1; }
            .notes { background: #0f121d; border: 1px solid #23283b; padding: 15px; border-radius: 8px; font-size: 14px; color: #94a3b8; white-space: pre-wrap; margin-top: 15px; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e2436; }
            .btn { display: inline-block; margin-top: 20px; background: #FF0080; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <h1>⏰ Recordatorio OFFSZN</h1>
            </div>
            <div class="content">
                <div class="badge">${channelName}</div>
                <div class="title">${event.title}</div>
                
                <div class="time-box">
                    <strong>📅 Fecha de Publicación:</strong> ${event.scheduled_date || 'Hoy'}<br>
                    <strong>🕒 Horario:</strong> ${event.start_time || '07:00'} - ${event.end_time || '08:00'}<br>
                    <strong>📌 Estado:</strong> ${statusText}
                </div>

                ${event.notes ? `
                <div style="font-weight:600; color:#e2e8f0; margin-top:15px;">📝 Notas / Script / Hashtags:</div>
                <div class="notes">${event.notes}</div>
                ` : ''}

                <div style="text-align: center;">
                    <a href="https://offszn.lat/owner/content-calendar" class="btn">Abrir Calendario de Contenido</a>
                </div>
            </div>
            <div class="footer">
                OFFSZN Studio Internal Engine &bull; Brevo Automated Dispatcher
            </div>
        </div>
    </body>
    </html>
    `;
}

// ----------------------------------------------------
// EXPORTED CONTROLLER METHODS
// ----------------------------------------------------

export const getEvents = async (req, res) => {
    try {
        const events = await getStoredEvents();
        res.status(200).json({ success: true, data: events });
    } catch (error) {
        console.error('[CalendarController] Error obteniendo eventos:', error.message);
        res.status(500).json({ success: false, error: 'Error al obtener eventos del calendario' });
    }
};

export const createEvent = async (req, res) => {
    try {
        const body = req.body;
        if (!body.title) {
            return res.status(400).json({ success: false, error: 'El título del contenido es obligatorio' });
        }

        const newEvent = {
            id: body.id || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            title: body.title,
            channel: body.channel || 'general',
            category: body.category || 'Reel/Short',
            scheduled_date: body.scheduled_date || new Date().toISOString().split('T')[0],
            start_time: body.start_time || '10:00',
            end_time: body.end_time || '11:00',
            reminder_at: body.reminder_at || null,
            email_reminder: body.email_reminder !== false,
            target_email: body.target_email || 'offszn.studio@gmail.com',
            price_usd: body.price_usd ? parseFloat(body.price_usd) : 0,
            status: body.status || 'scheduled',
            notes: body.notes || '',
            reminder_sent: false,
            created_at: new Date().toISOString()
        };

        const saved = await saveEvent(newEvent);
        res.status(201).json({ success: true, data: saved });
    } catch (error) {
        console.error('[CalendarController] Error creando evento:', error.message);
        res.status(500).json({ success: false, error: 'Error al guardar el contenido' });
    }
};

export const updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const events = await getStoredEvents();
        const existing = events.find(e => e.id === id);

        if (!existing) {
            return res.status(404).json({ success: false, error: 'Evento no encontrado' });
        }

        const updatedEvent = {
            ...existing,
            ...updates,
            id,
            updated_at: new Date().toISOString()
        };

        const saved = await saveEvent(updatedEvent);
        res.status(200).json({ success: true, data: saved });
    } catch (error) {
        console.error('[CalendarController] Error actualizando evento:', error.message);
        res.status(500).json({ success: false, error: 'Error al actualizar el contenido' });
    }
};

export const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        await removeEvent(id);
        res.status(200).json({ success: true, message: 'Evento eliminado correctamente' });
    } catch (error) {
        console.error('[CalendarController] Error eliminando evento:', error.message);
        res.status(500).json({ success: false, error: 'Error al eliminar el contenido' });
    }
};

export const sendReminderNow = async (req, res) => {
    try {
        const { id } = req.params;
        const events = await getStoredEvents();
        const event = events.find(e => e.id === id);

        if (!event) {
            return res.status(404).json({ success: false, error: 'Evento no encontrado' });
        }

        const recipientEmail = req.body.target_email || event.target_email || 'offszn.studio@gmail.com';
        const html = buildReminderEmailHtml(event);

        console.log(`[CalendarController] Dispatching Brevo reminder manually for event ${event.id} to ${recipientEmail}`);

        const mailResult = await sendOffsznEmail({
            to: recipientEmail,
            subject: `⏰ [OFFSZN Recordatorio] ${event.title}`,
            html: html,
            fromName: 'OFFSZN Calendar',
            type: 'transactional'
        });

        event.reminder_sent = true;
        event.reminder_sent_at = new Date().toISOString();
        await saveEvent(event);

        res.status(200).json({
            success: true,
            message: `Recordatorio enviado con éxito a ${recipientEmail} vía Brevo API`,
            result: mailResult
        });
    } catch (error) {
        console.error('[CalendarController] Error enviando correo de prueba:', error.message);
        res.status(500).json({ success: false, error: `Error al enviar correo por Brevo: ${error.message}` });
    }
};

export const checkAndSendRemindersInternal = async () => {
    try {
        const events = await getStoredEvents();
        const now = new Date();

        const pendingReminders = events.filter(event => {
            if (!event.email_reminder || event.reminder_sent) return false;
            if (!event.reminder_at) return false;
            const reminderDate = new Date(event.reminder_at);
            return reminderDate <= now;
        });

        if (pendingReminders.length === 0) return;

        console.log(`[CalendarController Background] Encontrados ${pendingReminders.length} recordatorios pendientes de envío Brevo.`);

        for (const event of pendingReminders) {
            try {
                const targetEmail = event.target_email || 'offszn.studio@gmail.com';
                const html = buildReminderEmailHtml(event);

                console.log(`[CalendarController Background] Enviando correo Brevo para "${event.title}" a ${targetEmail}...`);

                await sendOffsznEmail({
                    to: targetEmail,
                    subject: `⏰ [OFFSZN Recordatorio] ${event.title}`,
                    html: html,
                    fromName: 'OFFSZN Calendar',
                    type: 'transactional'
                });

                event.reminder_sent = true;
                event.reminder_sent_at = new Date().toISOString();
                await saveEvent(event);
                console.log(`[CalendarController Background] ✅ Recordatorio completado para ${event.id}`);
            } catch (err) {
                console.error(`[CalendarController Background] ❌ Fallo al enviar recordatorio para ${event.id}:`, err.message);
            }
        }
    } catch (error) {
        console.error('[CalendarController Background] Error en chequeo de recordatorios:', error.message);
    }
};

export const checkAndSendReminders = async (req, res) => {
    await checkAndSendRemindersInternal();
    res.status(200).json({ success: true, message: 'Chequeo de recordatorios ejecutado correctamente' });
};
