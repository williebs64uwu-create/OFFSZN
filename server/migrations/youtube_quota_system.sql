-- ============================================================
-- MIGRATION: YouTube Upload Monthly Quota System
-- ============================================================
-- Adds columns for monthly YouTube+OFFSZN upload tracking.
-- youtube_uploads_this_month: counter (resets monthly)
-- youtube_quota_reset_date: date of next reset

-- 1. Add monthly counter column (keeps old youtube_import_count for legacy)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS youtube_uploads_this_month integer DEFAULT 0;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS youtube_quota_reset_date timestamptz DEFAULT now();

-- 2. Initialize reset date for all existing profiles
UPDATE public.profiles 
SET youtube_quota_reset_date = now()
WHERE youtube_quota_reset_date IS NULL;

-- 3. Security: Protect youtube quota columns from client-side tampering
-- (Add to existing protect_plan_column trigger function)
CREATE OR REPLACE FUNCTION protect_plan_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Block plan changes from non-service_role
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
        IF current_user != 'postgres' AND current_user != 'service_role' THEN
            NEW.plan := OLD.plan;
        END IF;
    END IF;
    -- Block youtube quota manipulation from non-service_role
    IF NEW.youtube_uploads_this_month IS DISTINCT FROM OLD.youtube_uploads_this_month THEN
        IF current_user != 'postgres' AND current_user != 'service_role' THEN
            NEW.youtube_uploads_this_month := OLD.youtube_uploads_this_month;
        END IF;
    END IF;
    IF NEW.youtube_quota_reset_date IS DISTINCT FROM OLD.youtube_quota_reset_date THEN
        IF current_user != 'postgres' AND current_user != 'service_role' THEN
            NEW.youtube_quota_reset_date := OLD.youtube_quota_reset_date;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger (idempotent)
DROP TRIGGER IF EXISTS protect_plan_on_update ON public.profiles;
CREATE TRIGGER protect_plan_on_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION protect_plan_column();
