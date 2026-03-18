-- Add project_id to site_readiness
ALTER TABLE public.site_readiness ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);

-- Add principal_architect role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'principal_architect';