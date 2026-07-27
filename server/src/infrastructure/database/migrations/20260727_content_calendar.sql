-- Migration: 20260727_content_calendar.sql
-- Table definition for Content Calendar in Supabase

CREATE TABLE IF NOT EXISTS public.content_calendar (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    channel TEXT DEFAULT 'general',
    category TEXT DEFAULT 'Reel/Short',
    scheduled_date DATE NOT NULL,
    start_time VARCHAR(10) DEFAULT '10:00',
    end_time VARCHAR(10) DEFAULT '11:00',
    reminder_at TIMESTAMPTZ,
    email_reminder BOOLEAN DEFAULT true,
    target_email TEXT DEFAULT 'offszn.studio@gmail.com',
    status VARCHAR(20) DEFAULT 'scheduled',
    price_usd NUMERIC DEFAULT 0,
    notes TEXT,
    reminder_sent BOOLEAN DEFAULT false,
    reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_calendar_scheduled_date ON public.content_calendar (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_content_calendar_reminder ON public.content_calendar (reminder_at, reminder_sent, email_reminder);
