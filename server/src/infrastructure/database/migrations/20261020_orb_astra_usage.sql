-- ============================================================
-- ORB · ASTRA EN LA NUBE (planes Pro / Max) – CUOTA DE USO
-- Fecha: 2026-10-20
--
-- QUÉ HACE:
--   Crea public.astra_usage (pedidos y tokens por licencia y periodo) y tres funciones que solo usa el backend:
--     consume_astra_quota  → descuenta 1 pedido si queda cupo (comprobar y descontar en UNA sentencia:
--                            dos pedidos simultáneos nunca leen el mismo saldo). Devuelve los restantes o NULL.
--     refund_astra_quota   → devuelve el pedido si el modelo falló.
--     record_astra_tokens  → suma los tokens reales del proveedor (control de costo).
--   El tipo de license_id se toma de plugin_licenses.id (sirve tanto si es bigint como uuid).
--
-- QUÉ NO HACE:
--   - NO toca plugin_licenses, plugin_activations, subscriptions ni users.
--   - NO crea políticas: RLS activo sin políticas = solo service role (el backend) puede leer/escribir.
--
-- REVERSIÓN:
--   DROP FUNCTION IF EXISTS public.consume_astra_quota, public.refund_astra_quota, public.record_astra_tokens;
--   DROP TABLE IF EXISTS public.astra_usage;
-- ============================================================

do $migration$
declare
    id_type text;
begin
    select format_type(a.atttypid, a.atttypmod) into id_type
    from pg_attribute a
    where a.attrelid = 'public.plugin_licenses'::regclass and a.attname = 'id' and not a.attisdropped;

    execute format($sql$
        create table if not exists public.astra_usage (
            license_id  %1$s        not null references public.plugin_licenses(id) on delete cascade,
            period      text        not null,             -- 'YYYY-MM' (Pro/Max, se renueva cada mes) o 'trial' (cupo total de la prueba)
            requests    integer     not null default 0,   -- pedidos consumidos (lo que ve el usuario)
            tokens_in   integer     not null default 0,   -- tokens reales (para controlar el costo)
            tokens_out  integer     not null default 0,
            updated_at  timestamptz not null default now(),
            primary key (license_id, period)
        )$sql$, id_type);

    execute 'alter table public.astra_usage enable row level security';

    execute format($sql$
        create or replace function public.consume_astra_quota(p_license %1$s, p_period text, p_limit integer)
        returns integer language sql security definer set search_path = public as $f$
            insert into astra_usage as u (license_id, period, requests)
            values (p_license, p_period, 1)
            on conflict (license_id, period) do update
                set requests = u.requests + 1, updated_at = now()
                where u.requests < p_limit
            returning p_limit - requests;
        $f$$sql$, id_type);

    execute format($sql$
        create or replace function public.refund_astra_quota(p_license %1$s, p_period text)
        returns void language sql security definer set search_path = public as $f$
            update astra_usage set requests = greatest(requests - 1, 0), updated_at = now()
            where license_id = p_license and period = p_period;
        $f$$sql$, id_type);

    execute format($sql$
        create or replace function public.record_astra_tokens(p_license %1$s, p_period text, p_in integer, p_out integer)
        returns void language sql security definer set search_path = public as $f$
            update astra_usage set tokens_in = tokens_in + greatest(p_in, 0), tokens_out = tokens_out + greatest(p_out, 0), updated_at = now()
            where license_id = p_license and period = p_period;
        $f$$sql$, id_type);

    -- Solo el backend (service role) puede ejecutarlas
    execute format('revoke all on function public.consume_astra_quota(%1$s, text, integer) from public, anon, authenticated', id_type);
    execute format('revoke all on function public.refund_astra_quota(%1$s, text) from public, anon, authenticated', id_type);
    execute format('revoke all on function public.record_astra_tokens(%1$s, text, integer, integer) from public, anon, authenticated', id_type);
end
$migration$;
