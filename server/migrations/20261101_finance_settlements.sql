-- Finanzas: pesos argentinos confirmados con el depósito en soles, y número de operación en los gastos. Idempotente.

-- Un pago en pesos argentinos pasa a contar cuando llegan los soles (Mercado Pago → tu amigo → Binance → Yape).
alter table public.finance_income add column if not exists settled_pen numeric(12,2);   -- soles que realmente llegaron por este pago
alter table public.finance_income add column if not exists settled_at timestamptz;
alter table public.finance_income add column if not exists country text;

-- Cada depósito de soles (ej. "Depósito de Sayko") y qué pagos en pesos confirmó. El número de operación evita contarlo dos veces.
create table if not exists public.finance_deposits (
    id uuid primary key default gen_random_uuid(),
    occurred_at timestamptz not null default now(),
    label text not null,
    pen numeric(12,2) not null check (pen > 0),
    ref text,
    income_ids uuid[] not null default '{}',
    note text,
    created_at timestamptz not null default now()
);
create unique index if not exists finance_deposits_ref_idx on public.finance_deposits (ref) where ref is not null;
alter table public.finance_deposits enable row level security;

-- Gastos con número de operación (de la captura de Yape): la misma captura dos veces no duplica.
alter table public.finance_expenses add column if not exists ref text;
create unique index if not exists finance_expenses_ref_idx on public.finance_expenses (ref) where ref is not null;
