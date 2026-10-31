-- Finanzas del CRM: libro de ingresos reales, gastos y ajustes (cuenta del banco, tipo de cambio). Idempotente.
-- Solo el backend (service role) lee/escribe: RLS sin políticas.

-- Un pago real = una fila. (source, ref) único: el mismo pago nunca se guarda dos veces.
create table if not exists public.finance_income (
    id uuid primary key default gen_random_uuid(),
    occurred_at timestamptz not null default now(),        -- hora exacta del pago
    source text not null,                                  -- paypal | yape_web | subscription | store_paypal | store_yape | manual
    ref text not null,                                     -- id único del pago (captura de PayPal, pago de Mercado Pago, venta de cuota, serial en manual)
    email text,
    product text,
    product_id bigint,
    method text not null,                                  -- paypal | yape | mercadopago | binance | transferencia | otro
    currency text not null check (currency in ('USD', 'PEN', 'ARS')),
    gross numeric(12,2),                                   -- en la moneda original
    fee numeric(12,2),
    net numeric(12,2),                                     -- null mientras no se sepa (ej. pesos argentinos)
    status text not null default 'confirmed',              -- confirmed | pending_review (pesos argentinos) | no_detail (sin dato, revisar)
    verified boolean not null default false,               -- confirmado contra PayPal / Mercado Pago
    by_willie boolean not null default false,              -- "Acción de Willie": lo registró él a mano al despachar
    note text,
    order_id bigint,
    created_at timestamptz not null default now(),
    unique (source, ref)
);
create index if not exists finance_income_time_idx on public.finance_income (occurred_at desc);

-- Gastos: siempre en soles, con categoría fija.
create table if not exists public.finance_expenses (
    id uuid primary key default gen_random_uuid(),
    spent_at date not null default current_date,
    category text not null check (category in ('GASEOSA', 'COMIDA RÁPIDA', 'SUSCRIPCIÓN IMPORTANTE')),
    amount_pen numeric(12,2) not null check (amount_pen > 0),
    note text,
    created_at timestamptz not null default now()
);
create index if not exists finance_expenses_date_idx on public.finance_expenses (spent_at desc);

-- Ajustes: cuenta del banco, tipo de cambio de referencia y desde cuándo se cuenta.
create table if not exists public.finance_settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz not null default now()
);
insert into public.finance_settings (key, value) values
    ('bank_base', '{"pen": 26824, "as_of": "2026-10-31"}'::jsonb),
    ('fx_pen_per_usd', '3.37'::jsonb),
    ('start_at', '"2026-10-31T05:00:00.000Z"'::jsonb)
on conflict (key) do nothing;

alter table public.finance_income enable row level security;
alter table public.finance_expenses enable row level security;
alter table public.finance_settings enable row level security;
