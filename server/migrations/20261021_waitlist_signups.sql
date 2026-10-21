-- Lista de espera de FAST MIX BETA: offszn.lat/list/lista-de-espera
-- Panel de correos: offszn.lat/owner/correos-lista-de-espera
-- Solo el backend (service role) lee/escribe.
create table if not exists public.waitlist_signups (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    list text not null default 'fast-mix-beta',
    email text not null,
    country text,                -- ISO-2 detectado por el CDN (ej. PE, MX, CO)
    whatsapp text,               -- opcional, con codigo de pais
    daw text,                    -- opcional: fl-studio | ableton | logic | pro-tools | otro
    plugins text,                -- opcional: plugins que ya usa
    source text,                 -- utm_source / ref
    notes text,                  -- notas internas del owner
    contacted boolean not null default false
);
create unique index if not exists waitlist_signups_list_email_idx on public.waitlist_signups (list, lower(email));
create index if not exists waitlist_signups_created_idx on public.waitlist_signups (created_at desc);

alter table public.waitlist_signups enable row level security;
-- Sin politicas: solo el service role del backend puede leer/escribir.
