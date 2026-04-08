
CREATE TABLE public.activity_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  predecessor_module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  predecessor_stage integer NOT NULL,
  successor_module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  successor_stage integer NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HOD roles full access on activity_dependencies"
  ON public.activity_dependencies FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE auth_user_id = auth.uid()
        AND is_active = true
        AND role IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','production_head','planning_engineer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE auth_user_id = auth.uid()
        AND is_active = true
        AND role IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','production_head','planning_engineer')
    )
  );
