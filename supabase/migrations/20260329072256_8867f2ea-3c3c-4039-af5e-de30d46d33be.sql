
-- Create delivery_checklists table
CREATE TABLE public.delivery_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  site_ready_confirmed_at timestamptz,
  modules_signed_by uuid,
  modules_signed_at timestamptz,
  modules_checklist jsonb DEFAULT '[]'::jsonb,
  tools_signed_by uuid,
  tools_signed_at timestamptz,
  tools_checklist jsonb DEFAULT '[]'::jsonb,
  additional_materials jsonb DEFAULT '[]'::jsonb,
  additional_signed_by uuid,
  additional_signed_at timestamptz,
  dispatch_confirmed_at timestamptz,
  dispatch_confirmed_by uuid,
  created_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'
);

CREATE INDEX idx_delivery_checklists_project ON public.delivery_checklists(project_id);

ALTER TABLE public.delivery_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read delivery checklists"
ON public.delivery_checklists FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authorized roles can insert delivery checklists"
ON public.delivery_checklists FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'factory_floor_supervisor') OR
  public.has_role(auth.uid(), 'production_head') OR
  public.has_role(auth.uid(), 'stores_executive') OR
  public.has_role(auth.uid(), 'site_installation_mgr') OR
  public.is_full_admin(auth.uid())
);

CREATE POLICY "Authorized roles can update delivery checklists"
ON public.delivery_checklists FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'factory_floor_supervisor') OR
  public.has_role(auth.uid(), 'production_head') OR
  public.has_role(auth.uid(), 'stores_executive') OR
  public.has_role(auth.uid(), 'site_installation_mgr') OR
  public.is_full_admin(auth.uid())
);
