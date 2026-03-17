
-- 1. Add module_type and module_code to modules
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS module_type text NOT NULL DEFAULT 'standard';
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS module_code text;

-- 2. Create panels table
CREATE TABLE IF NOT EXISTS public.panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  panel_code text NOT NULL,
  panel_type text NOT NULL DEFAULT 'wall',
  length_mm numeric,
  height_mm numeric,
  production_status text DEFAULT 'not_started',
  current_stage text DEFAULT 'Fabrication - Main Frame',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_archived boolean DEFAULT false,
  UNIQUE(panel_code)
);

-- 3. Enable RLS on panels
ALTER TABLE public.panels ENABLE ROW LEVEL SECURITY;

-- 4. Fix modules RLS: drop old INSERT/UPDATE policies, recreate for planning_engineer only
DROP POLICY IF EXISTS "Management can insert modules" ON public.modules;
DROP POLICY IF EXISTS "Management can update modules" ON public.modules;

CREATE POLICY "Planning engineer can insert modules" ON public.modules
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'planning_engineer');

CREATE POLICY "Planning engineer can update modules" ON public.modules
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = 'planning_engineer');

-- 5. Panels RLS policies
CREATE POLICY "Authenticated can view panels" ON public.panels
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Planning engineer can insert panels" ON public.panels
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'planning_engineer');

CREATE POLICY "Planning engineer can update panels" ON public.panels
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = 'planning_engineer');

-- 6. updated_at trigger for panels
CREATE TRIGGER update_panels_updated_at
  BEFORE UPDATE ON public.panels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
