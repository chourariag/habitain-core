ALTER TABLE public.panels DROP CONSTRAINT IF EXISTS panels_panel_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS panels_module_panel_code_key ON public.panels (module_id, panel_code);