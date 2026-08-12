-- ============================================================
-- OFFSZN SECURITY HARDENING – USERS TABLE TRIGGER
-- Proyecto: OFFSZN_Academy Backend DB (qtjpvztpgfymjhhpoouq)
-- Fecha: 2026-08-11
--
-- QUÉ HACE:
--   Protege columnas sensibles en la tabla 'users' contra
--   modificaciones directas desde el frontend (ANON_KEY o
--   authenticated). Solo el backend con SERVICE_ROLE puede
--   cambiar estas columnas.
--
-- QUÉ NO HACE:
--   - NO toca políticas SELECT (lectura pública intacta)
--   - NO modifica RLS policies existentes
--   - NO afecta perfiles públicos, likes, follows, etc.
--   - NO toca la tabla 'profiles' (ya tiene su propio trigger)
--
-- REVERIÓN (si algo sale mal):
--   DROP TRIGGER IF EXISTS trg_protect_sensitive_users ON public.users;
--   DROP FUNCTION IF EXISTS public.protect_sensitive_user_columns();
--
-- COLUMNAS PROTEGIDAS en users:
--   is_admin, es_admin, is_verified, role, plan, reward_balance
-- ============================================================

-- Paso 1: Crear la función trigger
CREATE OR REPLACE FUNCTION public.protect_sensitive_user_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo bloqueamos si quien hace el UPDATE no es el backend (service_role/postgres)
    -- Los usuarios autenticados normales NO pueden cambiar estas columnas sensibles
    IF current_user != 'postgres' AND current_user != 'service_role' THEN

        -- Proteger flag de admin
        IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
            NEW.is_admin := OLD.is_admin;
        END IF;

        -- Proteger array es_admin (columna legacy)
        IF NEW.es_admin IS DISTINCT FROM OLD.es_admin THEN
            NEW.es_admin := OLD.es_admin;
        END IF;

        -- Proteger verificación
        IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
            NEW.is_verified := OLD.is_verified;
        END IF;

        -- Proteger role
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            NEW.role := OLD.role;
        END IF;

        -- Proteger plan (ya protegido en 'profiles', aquí en 'users')
        IF NEW.plan IS DISTINCT FROM OLD.plan THEN
            NEW.plan := OLD.plan;
        END IF;

        -- Proteger saldo de créditos (reward_balance)
        -- Un usuario NO puede auto-otorgarse créditos desde el frontend
        IF NEW.reward_balance IS DISTINCT FROM OLD.reward_balance THEN
            NEW.reward_balance := OLD.reward_balance;
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Paso 2: Adjuntar el trigger a la tabla 'users'
-- (DROP IF EXISTS para que sea idempotente: correrlo N veces no rompe nada)
DROP TRIGGER IF EXISTS trg_protect_sensitive_users ON public.users;

CREATE TRIGGER trg_protect_sensitive_users
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_sensitive_user_columns();

-- ============================================================
-- VERIFICACIÓN (correr esto después para confirmar que quedó bien):
--
-- SELECT trigger_name, event_manipulation, event_object_table, action_timing
-- FROM information_schema.triggers
-- WHERE event_object_table = 'users' AND trigger_schema = 'public';
--
-- Deberías ver:
--   trg_protect_sensitive_users | UPDATE | users | BEFORE
-- ============================================================
