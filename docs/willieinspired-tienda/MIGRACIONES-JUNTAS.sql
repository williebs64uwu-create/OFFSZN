-- Tienda Willie Inspired: clientes con tags, órdenes, ofertas de un solo uso, pruebas de plugins con correo
-- y eventos del A/B (popup 50% vs 2x1). Solo el backend (service role) lee/escribe: RLS sin políticas.
-- Correr una vez en Supabase → SQL Editor. Es idempotente.

-- ─── Clientes / leads ─────────────────────────────────────────────────────────────────────────────────────────
-- segment: FREE (solo gratis) | COMPRADOR V1 (1 compra) | COMPRADOR V2 (2 o más)
create table if not exists public.store_customers (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    email text not null,
    user_id uuid,
    username text,
    country text,                 -- declarado en el onboarding (ISO-2)
    ip_country text,              -- último país visto por el CDN
    vpn_suspected boolean not null default false,
    first_source text,            -- lead magnet / utm_source de la primera visita
    lead_magnets text[] not null default '{}',
    segment text not null default 'FREE',
    purchase_count int not null default 0,
    total_spent_usd numeric(10,2) not null default 0,
    first_purchase_at timestamptz,
    last_purchase_at timestamptz,
    ab_variant text,              -- welcome50 | 2x1
    onboarding_done boolean not null default false,
    utm jsonb,
    brevo_synced_at timestamptz
);
create unique index if not exists store_customers_email_idx on public.store_customers (lower(email));
create index if not exists store_customers_user_idx on public.store_customers (user_id);
create index if not exists store_customers_segment_idx on public.store_customers (segment, last_purchase_at desc);

-- ─── Órdenes (PayPal y Yape) ──────────────────────────────────────────────────────────────────────────────────
create table if not exists public.store_orders (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    status text not null default 'pending',      -- pending | completed | failed
    payment_method text not null,                -- paypal | yape
    payment_ref text not null,                   -- id de orden PayPal / pago Mercado Pago
    email text,
    user_id uuid,
    country text,
    tier text,
    vpn_suspected boolean not null default false,
    currency text,
    subtotal_usd numeric(10,2),
    discount_usd numeric(10,2),
    total_usd numeric(10,2),
    total_pen numeric(10,2),
    offer_type text,                             -- welcome50 | 2x1 | code | coupon
    offer_ref text,
    ab_variant text,
    lines jsonb not null default '[]'::jsonb,
    delivery_token text,
    license_count int not null default 0,
    session_id text,
    utm jsonb
);
create unique index if not exists store_orders_ref_idx on public.store_orders (payment_method, payment_ref);
create index if not exists store_orders_email_idx on public.store_orders (lower(email), created_at desc);

-- ─── Ofertas de un solo uso ───────────────────────────────────────────────────────────────────────────────────
-- welcome50: una por cuenta. trial_followup: el correo de "tu prueba terminó" con precio por país.
create table if not exists public.store_offers (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    code text not null,
    type text not null,
    user_id uuid,
    email text,
    product_id text,
    price_usd numeric(10,2),
    country text,
    expires_at timestamptz,
    sent_at timestamptz,
    clicked_at timestamptz,
    used_at timestamptz,
    used_order_ref text,
    meta jsonb
);
create unique index if not exists store_offers_code_idx on public.store_offers (code);
create unique index if not exists store_offers_welcome_user_idx on public.store_offers (user_id) where type = 'welcome50';

-- ─── Pruebas de plugins pedidas desde la web (con correo, para el correo de seguimiento) ───────────────────────
create table if not exists public.store_trials (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    email text not null,
    serial_key text not null,
    plugin_name text not null,
    country text,
    source text,
    nudge_sent_at timestamptz,       -- "¿no lo instalaste?" (48 h sin activar)
    followup_sent_at timestamptz,    -- oferta al vencer la prueba
    followup_offer_code text,
    converted_at timestamptz
);
create unique index if not exists store_trials_email_plugin_idx on public.store_trials (lower(email), plugin_name);
create index if not exists store_trials_pending_idx on public.store_trials (followup_sent_at) where followup_sent_at is null;

-- ─── Eventos (A/B del popup, embudo) ──────────────────────────────────────────────────────────────────────────
create table if not exists public.store_events (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    session_id text,
    user_id uuid,
    email text,
    event text not null,          -- popup_view | popup_click | popup_close | lead | add_to_cart | checkout_start | purchase | upsell_view | upsell_click
    variant text,                 -- welcome50 | 2x1
    page text,
    product_id text,
    country text,
    meta jsonb
);
create index if not exists store_events_variant_idx on public.store_events (variant, event, created_at desc);

-- ─── Entregas de presets (ya la usaba el checkout; se crea si no existe) ──────────────────────────────────────
create table if not exists public.willie_orders (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz,
    delivery_token text not null,
    order_id text,
    customer_email text,
    order_payload jsonb
);
create index if not exists willie_orders_token_idx on public.willie_orders (delivery_token);

alter table public.store_customers enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_offers enable row level security;
alter table public.store_trials enable row level security;
alter table public.store_events enable row level security;
alter table public.willie_orders enable row level security;
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
