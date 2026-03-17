
-- Update default current_stage to match the new 9-stage names
ALTER TABLE public.modules ALTER COLUMN current_stage SET DEFAULT 'Sub-Frame';
ALTER TABLE public.panels ALTER COLUMN current_stage SET DEFAULT 'Sub-Frame';
