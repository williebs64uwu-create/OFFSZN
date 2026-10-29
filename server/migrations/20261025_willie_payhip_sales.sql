-- Ventas de plugins de Payhip (se importan desde el CSV de clientes en el CRM). Sin correos ni datos personales.
-- Idempotente. Solo el backend (service role) lee/escribe: RLS sin políticas.
create table if not exists public.store_payhip_sales (
    order_id text primary key,                 -- id del pedido en Payhip
    imported_at timestamptz not null default now(),
    sold_on date not null,
    plugin text not null,
    unit_price_usd numeric(10,2),              -- sin impuestos; null si el pedido llevaba más productos (mixto)
    gross_usd numeric(10,2) not null,
    tax_usd numeric(10,2) not null default 0,
    fee_usd numeric(10,2) not null default 0,
    coupon text,
    cart_items int not null default 1,
    mixed boolean not null default false
);
create index if not exists store_payhip_sales_date_idx on public.store_payhip_sales (sold_on desc);
alter table public.store_payhip_sales enable row level security;

-- Precio del plugin dentro de un pedido mixto, deducido a mano (cupón y precios de lista). Un reimport no lo pisa.
alter table public.store_payhip_sales add column if not exists price_estimated boolean not null default false;
