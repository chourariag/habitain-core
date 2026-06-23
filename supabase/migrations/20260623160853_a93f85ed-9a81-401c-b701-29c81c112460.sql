
CREATE TABLE public.material_delivery_tracker (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  material_category TEXT NOT NULL,
  planned_delivery_date DATE,
  actual_delivery_date DATE,
  delay_days INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN planned_delivery_date IS NULL OR actual_delivery_date IS NULL THEN NULL
      ELSE (actual_delivery_date - planned_delivery_date)
    END
  ) STORED,
  status TEXT GENERATED ALWAYS AS (
    CASE
      WHEN planned_delivery_date IS NULL OR actual_delivery_date IS NULL THEN 'Pending'
      WHEN (actual_delivery_date - planned_delivery_date) <= 0 THEN 'On Track'
      WHEN (actual_delivery_date - planned_delivery_date) <= 14 THEN 'At Risk'
      ELSE 'Delayed'
    END
  ) STORED,
  risk_level TEXT CHECK (risk_level IN ('High','Medium','Low')),
  mitigation_note TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mdt_project ON public.material_delivery_tracker(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_delivery_tracker TO authenticated;
GRANT ALL ON public.material_delivery_tracker TO service_role;

ALTER TABLE public.material_delivery_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "MDT viewers can read"
  ON public.material_delivery_tracker FOR SELECT
  TO authenticated
  USING (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director',
            'head_operations','production_head','site_installation_mgr',
            'procurement','stores_executive','planning_engineer','planning_head','costing_engineer']::app_role[]
    )
  );

CREATE POLICY "MDT editors can insert"
  ON public.material_delivery_tracker FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['super_admin','managing_director','procurement','stores_executive','planning_engineer','planning_head','head_operations']::app_role[]
    )
  );

CREATE POLICY "MDT editors can update"
  ON public.material_delivery_tracker FOR UPDATE
  TO authenticated
  USING (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['super_admin','managing_director','procurement','stores_executive','planning_engineer','planning_head','head_operations']::app_role[]
    )
  );

CREATE POLICY "MDT editors can delete"
  ON public.material_delivery_tracker FOR DELETE
  TO authenticated
  USING (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['super_admin','managing_director','procurement','stores_executive','planning_engineer','planning_head','head_operations']::app_role[]
    )
  );

CREATE TRIGGER trg_mdt_updated_at
  BEFORE UPDATE ON public.material_delivery_tracker
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
