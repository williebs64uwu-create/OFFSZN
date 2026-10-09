-- Clics en metodos de pago manuales (Yape, Mercado Pago, Binance, WhatsApp).
-- POST /api/plugin/payment-click  |  GET /api/plugin/admin/payment-clicks
create table if not exists public.manual_payment_clicks (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    ref text not null,
    product text,
    method text,
    price_usd numeric,
    price_pen numeric,
    variant text,
    page text,
    email text
);
create index if not exists manual_payment_clicks_ref_idx on public.manual_payment_clicks (ref);
create index if not exists manual_payment_clicks_created_idx on public.manual_payment_clicks (created_at desc);
alter table public.manual_payment_clicks enable row level security;
-- Sin politicas: solo el service role del backend puede leer/escribir.
