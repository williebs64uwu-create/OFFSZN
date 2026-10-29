-- CRM de la tienda Willie Inspired: carritos, pipeline de ventas, notas/tareas, automatizaciones y baja de correos.
-- Correr DESPUÉS de 20261022_willie_store.sql. Idempotente. Solo el backend (service role) lee/escribe.

-- ─── Campos nuevos en clientes ────────────────────────────────────────────────────────────────────────────────
alter table public.store_customers add column if not exists tags text[] not null default '{}';
alter table public.store_customers add column if not exists unsubscribed boolean not null default false;
alter table public.store_customers add column if not exists whatsapp text;

-- ─── Carritos (para carrito abandonado y recuperación) ───────────────────────────────────────────────────────
create table if not exists public.store_carts (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    email text not null unique,           -- siempre en minúsculas
    items jsonb not null default '[]'::jsonb,
    total_usd numeric(10,2),
    country text,
    session_id text,
    reminder_sent_at timestamptz,
    recovered_at timestamptz
);
create index if not exists store_carts_pending_idx on public.store_carts (updated_at) where reminder_sent_at is null and recovered_at is null;

-- ─── Pipeline de ventas 1 a 1 ────────────────────────────────────────────────────────────────────────────────
-- stage: lead | prueba | cotizado | pagado | perdido
create table if not exists public.store_deals (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    email text not null,
    title text not null,
    stage text not null default 'lead',
    value_usd numeric(10,2),
    product_id text,
    source text,
    notes text,
    lost_reason text,
    closed_at timestamptz
);
create index if not exists store_deals_stage_idx on public.store_deals (stage, updated_at desc);
create index if not exists store_deals_email_idx on public.store_deals (lower(email));

-- ─── Notas y tareas por contacto ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.store_notes (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    email text not null,
    kind text not null default 'note',     -- note | task
    body text not null,
    due_at timestamptz,
    done boolean not null default false
);
create index if not exists store_notes_email_idx on public.store_notes (lower(email), created_at desc);
create index if not exists store_notes_tasks_idx on public.store_notes (due_at) where kind = 'task' and done = false;

-- ─── Automatizaciones: reglas y registro de envíos ───────────────────────────────────────────────────────────
create table if not exists public.store_automation_rules (
    key text primary key,
    name text not null,
    enabled boolean not null default true,
    updated_at timestamptz not null default now()
);
insert into public.store_automation_rules (key, name) values
    ('abandoned_cart', 'Carrito abandonado (2 h)'),
    ('lead_nurture', 'Lead sin comprar (3 días)'),
    ('post_purchase_upsell', 'Upsell post-compra (24 h)'),
    ('winback', 'Recompra (45 días)')
on conflict (key) do nothing;

create table if not exists public.store_automation_log (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    rule text not null,
    email text not null,
    ref text not null default '',
    meta jsonb
);
create unique index if not exists store_automation_log_uniq on public.store_automation_log (rule, lower(email), ref);

alter table public.store_carts enable row level security;
alter table public.store_deals enable row level security;
alter table public.store_notes enable row level security;
alter table public.store_automation_rules enable row level security;
alter table public.store_automation_log enable row level security;
