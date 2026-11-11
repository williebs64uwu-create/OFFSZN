-- Beat Post: interés en funciones bloqueadas (anónimo). Idempotente.
-- Solo el backend (service role) lee/escribe: RLS sin políticas.
create table if not exists public.beatpost_interest (
    id bigint generated always as identity primary key,
    feature text not null,
    plan text not null default 'free',
    version text,
    created_at timestamptz not null default now()
);
create index if not exists beatpost_interest_feature_idx on public.beatpost_interest (feature, created_at desc);
alter table public.beatpost_interest enable row level security;

-- Cada activación de PRO por Beat Post (pago único, cuota o a mano). ref única = nunca se aplica dos veces.
-- applied_at vacío = el correo aún no tenía cuenta: se aplica cuando inicia sesión en Beat Post (/api/beatpost/claim).
create table if not exists public.beatpost_grants (
    ref text primary key,                        -- order:<id PayPal> | sale:<id cuota> | manual:<correo>:<ms>
    email text not null,
    user_id uuid,
    until timestamptz not null,
    source text not null,                        -- paypal | paypal_cuotas | manual
    note text,
    applied_at timestamptz,
    created_at timestamptz not null default now()
);
create index if not exists beatpost_grants_pending_idx on public.beatpost_grants (lower(email)) where applied_at is null;

-- 2 cuotas (suscripción de PayPal): una fila por suscripción y una por cuota cobrada.
create table if not exists public.beatpost_subscriptions (
    subscription_id text primary key,
    email text not null,
    user_id uuid,
    plan_id text not null,
    status text not null default 'active',       -- active | past_due | cancelled | completed
    payments_count int not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_payment_at timestamptz,
    last_failed_at timestamptz
);
create table if not exists public.beatpost_payments (
    sale_id text primary key,
    subscription_id text not null references public.beatpost_subscriptions(subscription_id) on delete cascade,
    n int not null,
    amount_usd numeric(10,2) not null,
    pro_until timestamptz,
    paid_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (subscription_id, n)
);
alter table public.beatpost_grants enable row level security;
alter table public.beatpost_subscriptions enable row level security;
alter table public.beatpost_payments enable row level security;
