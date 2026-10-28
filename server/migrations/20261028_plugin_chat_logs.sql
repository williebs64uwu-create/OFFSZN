-- Conversaciones del chat de STAR CHAIN (POST /api/plugin/chatlog, lectura en owner/star-conversaciones.html)
create table if not exists public.plugin_chat_logs (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    said_at timestamptz,
    plugin text, version text, hwid text, license text,
    usuario text, ruta text, respuesta text,
    acciones jsonb not null default '[]'::jsonb
);
create index if not exists plugin_chat_logs_created_idx on public.plugin_chat_logs (created_at desc);
create index if not exists plugin_chat_logs_hwid_idx on public.plugin_chat_logs (hwid);
alter table public.plugin_chat_logs enable row level security;
-- Sin politicas: solo el service role del backend puede leer/escribir.
