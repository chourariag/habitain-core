
CREATE TABLE public.dry_assembly_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  checklist_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  issues_found boolean NOT NULL DEFAULT false,
  linked_ncr_id text,
  azad_signed_by uuid,
  azad_signed_at timestamptz,
  tagore_signed_by uuid,
  tagore_signed_at timestamptz,
  stage2_unlocked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_project_dry_assembly UNIQUE (project_id)
);

ALTER TABLE public.dry_assembly_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Production head full access"
  ON public.dry_assembly_checks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'production_head'))
  WITH CHECK (public.has_role(auth.uid(), 'production_head'));

CREATE POLICY "QC inspector full access"
  ON public.dry_assembly_checks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'qc_inspector'))
  WITH CHECK (public.has_role(auth.uid(), 'qc_inspector'));

CREATE POLICY "Directors and planners read only"
  ON public.dry_assembly_checks FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'planning_engineer')
    OR public.has_role(auth.uid(), 'head_operations')
    OR public.is_full_admin(auth.uid())
    OR public.is_director(auth.uid())
  );

CREATE TRIGGER update_dry_assembly_checks_updated_at
  BEFORE UPDATE ON public.dry_assembly_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
