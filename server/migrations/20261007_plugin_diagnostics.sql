-- Diagnosticos enviados por los plugins (POST /api/plugin/diag)
create table if not exists public.plugin_diagnostics (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    plugin text, version text, os text, host text, format text,
    sample_rate integer, block_size integer, channels text,
    hwid text, message text, log text
);
alter table public.plugin_diagnostics enable row level security;
-- Sin politicas: solo el service role del backend puede leer/escribir.
