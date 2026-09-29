-- ============================================================================
-- OFFSZN / WILLIE INSPIRED: SISTEMA DE AGENDAMIENTO & CALENDARIO
-- Basado en la arquitectura central de Cal.diy (PostgreSQL / Supabase)
-- Fecha: 2026-09-28
-- 
-- SEGURIDAD & AISLAMIENTO:
--   - Este script crea TABLAS NUEVAS totalmente independientes.
--   - NO modifica ni afecta 'users', 'products', 'orders' ni ninguna tabla existente.
--   - Si se desea revertir, basta con ejecutar los DROP TABLE correspondientes.
-- ============================================================================

-- Extensión para prevención de colisiones en rangos de tiempo (opcional según permisos de Supabase)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. TIPOS DE SERVICIOS / EVENT TYPES
CREATE TABLE IF NOT EXISTS public.booking_event_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,               -- ej: 'asesoria-mezcla-60min'
    title TEXT NOT NULL,                     -- ej: 'Asesoría 1 a 1: Mezcla & Producción'
    description TEXT,                        -- Lo que incluye y preparación previa
    duration_minutes INT NOT NULL DEFAULT 60,
    price_usd NUMERIC(10,2) DEFAULT 0.00,    -- 0 para discovery call o valor en USD
    is_active BOOLEAN DEFAULT true,
    color TEXT DEFAULT '#ec4899',            -- Color distintivo (magenta Willie)
    location_type TEXT DEFAULT 'google_meet',-- 'google_meet', 'zoom', 'discord'
    location_url TEXT,
    buffer_before_minutes INT DEFAULT 10,    -- Descanso / preparación antes
    buffer_after_minutes INT DEFAULT 15,     -- Minutos de colchón después
    requires_approval BOOLEAN DEFAULT false,
    custom_questions JSONB DEFAULT '[
        {"id": "daw", "label": "¿Qué DAW utilizas?", "type": "select", "options": ["FL Studio", "Ableton Live", "Logic Pro", "Studio One", "Otro"], "required": true},
        {"id": "audio_link", "label": "Enlace a tu proyecto o maqueta (Drive / Dropbox)", "type": "url", "required": false},
        {"id": "goal", "label": "¿Qué objetivo principal buscas resolver?", "type": "textarea", "required": true}
    ]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. HORARIOS BASE DE WILLIE (SCHEDULES)
CREATE TABLE IF NOT EXISTS public.booking_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Horario Habitual de Estudio',
    time_zone TEXT NOT NULL DEFAULT 'America/Lima',
    is_default BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BLOQUES DE DISPONIBILIDAD SEMANAL (AVAILABILITY)
-- day_of_week: 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado
CREATE TABLE IF NOT EXISTS public.booking_availabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES public.booking_schedules(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL, -- ej: 14:00:00
    end_time TIME NOT NULL,   -- ej: 20:00:00
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- 4. EXCEPCIONES Y DÍAS BLOQUEADOS (OVERRIDES / VACACIONES)
CREATE TABLE IF NOT EXISTS public.booking_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES public.booking_schedules(id) ON DELETE CASCADE,
    override_date DATE NOT NULL,
    is_unavailable BOOLEAN DEFAULT true,  -- true: día cerrado por completo
    start_time TIME,                      -- horario especial si está disponible
    end_time TIME,
    reason TEXT,                          -- ej: 'Grabación de estudio externo'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CITAS AGENDADAS (BOOKINGS)
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uid TEXT UNIQUE NOT NULL,             -- ej: 'bk_wll_8f93a1c0'
    event_type_id UUID REFERENCES public.booking_event_types(id) ON DELETE RESTRICT,
    
    -- Datos del cliente / artista
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    client_phone TEXT,                    -- WhatsApp para recordatorios
    client_timezone TEXT NOT NULL DEFAULT 'America/Lima',
    
    -- Tiempos en UTC (absolutos)
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    
    -- Estado de la cita y pago
    status VARCHAR(20) NOT NULL DEFAULT 'ACCEPTED', -- 'ACCEPTED', 'PENDING', 'CANCELLED', 'COMPLETED'
    payment_status VARCHAR(20) DEFAULT 'FREE',      -- 'FREE', 'PAID', 'PENDING_PAYMENT'
    payment_id TEXT,                               -- PayPal Order ID / Transacción
    amount_paid NUMERIC(10,2) DEFAULT 0.00,
    
    -- Sala de reunión y respuestas del cuestionario
    meeting_url TEXT,                              -- Enlace de Google Meet generado
    responses JSONB DEFAULT '{}'::jsonb,           -- Respuestas a DAW, dudas, stems
    
    -- Tokens de seguridad para autoservicio del cliente
    cancellation_token TEXT UNIQUE NOT NULL,       -- Token para cancelar/reagendar en 1 clic
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TAREAS AUTOMATIZADAS & RECORDATORIOS (BOOKING TASKS)
CREATE TABLE IF NOT EXISTS public.booking_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    task_type VARCHAR(35) NOT NULL, -- 'CONFIRMATION_EMAIL', 'REMINDER_24H', 'REMINDER_1H', 'FOLLOWUP_SURVEY'
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'COMPLETED', 'FAILED'
    attempts INT DEFAULT 0,
    executed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de alto rendimiento para búsqueda rápida y no colisión
CREATE INDEX IF NOT EXISTS idx_bookings_time_range ON public.bookings (start_time, end_time) WHERE status = 'ACCEPTED';
CREATE INDEX IF NOT EXISTS idx_bookings_client_email ON public.bookings (client_email);
CREATE INDEX IF NOT EXISTS idx_booking_tasks_due ON public.booking_tasks (scheduled_at, status) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_availabilities_schedule_day ON public.booking_availabilities (schedule_id, day_of_week);

-- ============================================================================
-- DATOS INICIALES (SEED DATA PARA WILLIE INSPIRED)
-- ============================================================================

-- A. Horario Base de Willie (America/Lima)
INSERT INTO public.booking_schedules (id, name, time_zone, is_default)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Horario de Sesiones Willie Inspired', 'America/Lima', true)
ON CONFLICT (id) DO NOTHING;

-- B. Disponibilidad Semanal:
-- Lunes (1) a Viernes (5): 14:00 a 20:00
-- Sábado (6): 11:00 a 16:00
INSERT INTO public.booking_availabilities (schedule_id, day_of_week, start_time, end_time)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 1, '14:00:00', '20:00:00'),
    ('a0000000-0000-0000-0000-000000000001', 2, '14:00:00', '20:00:00'),
    ('a0000000-0000-0000-0000-000000000001', 3, '14:00:00', '20:00:00'),
    ('a0000000-0000-0000-0000-000000000001', 4, '14:00:00', '20:00:00'),
    ('a0000000-0000-0000-0000-000000000001', 5, '14:00:00', '20:00:00'),
    ('a0000000-0000-0000-0000-000000000001', 6, '11:00:00', '16:00:00')
ON CONFLICT DO NOTHING;

-- C. Servicios iniciales de Willie
INSERT INTO public.booking_event_types (id, slug, title, description, duration_minutes, price_usd, color, location_type)
VALUES 
    (
        'b0000000-0000-0000-0000-000000000001',
        'asesoria-mezcla-60min',
        'Asesoría 1 a 1: Mezcla & Master en FL Studio',
        'Sesión privada intensiva por Google Meet compartiendo pantalla. Revisaremos tu proyecto FLP en vivo, afinación vocal, balance de frecuencias, compresión paralela y resolución de dudas quirúrgicas.',
        60,
        35.00,
        '#ec4899',
        'google_meet'
    ),
    (
        'b0000000-0000-0000-0000-000000000002',
        'revision-beat-45min',
        'Revisión de Beat & Arreglo Musical en Vivo',
        'Sesión de feedback técnico y creativo sobre tu instrumental. Optimización de drums, 808 sidechain, estructura de transiciones y preparación para enviar a artistas.',
        45,
        25.00,
        '#8b5cf6',
        'google_meet'
    ),
    (
        'b0000000-0000-0000-0000-000000000003',
        'diagnostico-vocal-30min',
        'Diagnóstico Rápido de Cadena Vocal & Home Studio',
        'Llamada rápida de diagnóstico para revisar tu acústica, cadena de plugins y darte la hoja de ruta exacta para que tus voces suenen profesionales sin micrófonos caros.',
        30,
        0.00,
        '#10b981',
        'google_meet'
    )
ON CONFLICT (id) DO NOTHING;
