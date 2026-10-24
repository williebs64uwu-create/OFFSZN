-- Comisiones ganadas (por productos que vendieron otros). Se anotan desde el CRM.
-- Idempotente. Solo el backend (service role) lee/escribe: RLS sin políticas.
create table if not exists public.store_commissions (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    earned_at date not null default current_date,
    source text not null default 'Otro',
    product text,
    amount_usd numeric(10,2) not null check (amount_usd > 0),
    status text not null default 'pendiente',   -- pendiente | cobrada
    notes text
);
create index if not exists store_commissions_earned_idx on public.store_commissions (earned_at desc);
alter table public.store_commissions enable row level security;
