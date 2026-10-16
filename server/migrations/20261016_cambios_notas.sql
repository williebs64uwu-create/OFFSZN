-- Panel interno Willie + Gian: offszn.lat/cambios/notas
-- Tareas, ideas, links y el feed rapido. Solo el backend (service role) lee/escribe.
create table if not exists public.cambios_items (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    kind text not null default 'task',          -- task | idea | link | note
    folder text not null default 'ideas',       -- plugins | contenido | ventas | disenos | ideas | otro
    title text not null,
    body text,
    link text,
    status text not null default 'todo',        -- todo | doing | done
    assignee text,                              -- willie | gian | null
    priority text not null default 'normal',    -- low | normal | high
    due_date date,
    created_by text,
    updated_by text
);
create index if not exists cambios_items_folder_idx on public.cambios_items (folder, status);
create index if not exists cambios_items_updated_idx on public.cambios_items (updated_at desc);

create table if not exists public.cambios_feed (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    author text not null,
    color text not null default 'azul',         -- azul | verde | amarillo | rojo | morado
    text text not null
);
create index if not exists cambios_feed_created_idx on public.cambios_feed (created_at desc);

alter table public.cambios_items enable row level security;
alter table public.cambios_feed enable row level security;
-- Sin politicas: solo el service role del backend puede leer/escribir.
