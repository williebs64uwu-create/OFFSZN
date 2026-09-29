-- Solicitudes de creadores / afiliados (willieinspired/aplicar). Tabla nueva, independiente.
CREATE TABLE IF NOT EXISTS public.creator_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    instagram TEXT,
    tiktok TEXT,
    youtube TEXT,
    main_platform TEXT,
    reach TEXT,
    content_type TEXT,
    best_post TEXT,
    status TEXT NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.creator_applications ENABLE ROW LEVEL SECURITY; -- solo el backend (service role) escribe/lee
