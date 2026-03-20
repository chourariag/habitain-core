
CREATE TABLE public.material_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  material_name text NOT NULL,
  category text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'units',
  required_by date,
  lead_time_days integer NOT NULL DEFAULT 7,
  supplier text,
  status text NOT NULL DEFAULT 'planned',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.material_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view material_plan_items"
  ON public.material_plan_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Planners can insert material_plan_items"
  ON public.material_plan_items FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('planning_engineer','super_admin','managing_director'));

CREATE POLICY "Planners can update material_plan_items"
  ON public.material_plan_items FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('planning_engineer','super_admin','managing_director','procurement'));
