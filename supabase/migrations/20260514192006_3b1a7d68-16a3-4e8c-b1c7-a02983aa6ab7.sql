
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'director';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operations_architect';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department text;
