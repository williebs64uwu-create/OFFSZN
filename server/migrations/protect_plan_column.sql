-- ============================================================
-- MIGRATION: protect_plan_column
-- PURPOSE: Prevent users from self-upgrading their plan
--          via client-side Supabase queries.
-- 
-- SECURITY: Only the service_role (our Node.js backend, which
--           uses the SERVICE KEY) can change the plan column.
--           Regular authenticated users who call
--           supabase.from('profiles').update({ plan: 'pro' })
--           will have the change silently reverted to their
--           current plan.
-- ============================================================

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION protect_plan_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Only block plan changes from non-service_role sessions
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
        -- current_user is the DB role being used
        -- 'authenticated' is the Supabase anon/authenticated role
        -- 'service_role' is our backend server role
        IF current_user != 'postgres' AND current_user != 'service_role' THEN
            -- Silently revert — do NOT throw an error (avoids leaking info)
            NEW.plan := OLD.plan;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach trigger to profiles table (DROP IF EXISTS first for idempotency)
DROP TRIGGER IF EXISTS protect_plan_on_update ON public.profiles;

CREATE TRIGGER protect_plan_on_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION protect_plan_column();
