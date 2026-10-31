-- STAR CHAIN en 3 cuotas (suscripción de PayPal): suscripciones, pagos y configuración. Idempotente.
-- Solo el backend (service role) lee/escribe: RLS sin políticas.

-- Una fila por suscripción de PayPal.
create table if not exists public.star_subscriptions (
    subscription_id text primary key,            -- I-XXXXXXXX de PayPal
    email text not null,                         -- correo donde llegan las claves
    user_id uuid,
    plan_id text not null,
    status text not null default 'active',       -- active | past_due | cancelled | suspended | expired | completed
    payments_count int not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_payment_at timestamptz,
    last_failed_at timestamptz
);
create index if not exists star_subscriptions_email_idx on public.star_subscriptions (lower(email));

-- Una fila por cuota cobrada. sale_id único = un pago nunca se procesa dos veces (webhook + confirmación del navegador).
create table if not exists public.star_subscription_payments (
    sale_id text primary key,
    subscription_id text not null references public.star_subscriptions(subscription_id) on delete cascade,
    n int not null,                              -- número de cuota: 1, 2, 3
    amount_usd numeric(10,2) not null,
    license_serial text,
    license_type text,                           -- subscription (cuotas 1 y 2) | lifetime (cuota 3)
    paid_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (subscription_id, n)
);

-- Pares clave/valor (ej. id del plan de PayPal creado desde el CRM).
create table if not exists public.star_config (
    key text primary key,
    value text not null,
    updated_at timestamptz not null default now()
);

alter table public.star_subscriptions enable row level security;
alter table public.star_subscription_payments enable row level security;
alter table public.star_config enable row level security;
