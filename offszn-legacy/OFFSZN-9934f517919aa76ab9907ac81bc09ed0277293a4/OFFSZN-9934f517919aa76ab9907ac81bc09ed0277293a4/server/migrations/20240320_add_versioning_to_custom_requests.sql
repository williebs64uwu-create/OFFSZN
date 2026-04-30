-- Migration to add R2 versioning to custom_requests
ALTER TABLE public.custom_requests 
ADD COLUMN IF NOT EXISTS r2_version text DEFAULT 'v2',
ADD COLUMN IF NOT EXISTS storage_version text DEFAULT 'v2';

-- Update existing rows to default to 'v2' (as the user is primarily using account r2 v2 now)
UPDATE public.custom_requests SET r2_version = 'v2', storage_version = 'v2' WHERE r2_version IS NULL;
