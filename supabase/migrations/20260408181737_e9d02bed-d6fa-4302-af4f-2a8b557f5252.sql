-- Material availability gate table
CREATE TABLE public.material_availability_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  module_id text NOT NULL,
  stage_number integer NOT NULL,
  stage_start_date date NOT NULL,
  confirmed_by uuid,
  confirmed_at timestamptz,
  materials_confirmed text,
  materials_missing text,
  missing_eta date,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.material_availability_confirmations ENABLE ROW LEVEL SECURITY;

-- Select: procurement, production_head, planning_engineer, directors, md
CREATE POLICY "mac_select" ON public.material_availability_confirmations
  FOR SELECT TO authenticated
  USING (
    public.is_full_admin(auth.uid())
    OR public.is_director(auth.uid())
    OR public.has_role(auth.uid(), 'procurement')
    OR public.has_role(auth.uid(), 'stores_executive')
    OR public.has_role(auth.uid(), 'production_head')
    OR public.has_role(auth.uid(), 'head_operations')
    OR public.has_role(auth.uid(), 'planning_engineer')
    OR public.has_role(auth.uid(), 'factory_floor_supervisor')
  );

-- Insert: procurement, stores, directors
CREATE POLICY "mac_insert" ON public.material_availability_confirmations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_full_admin(auth.uid())
    OR public.is_director(auth.uid())
    OR public.has_role(auth.uid(), 'procurement')
    OR public.has_role(auth.uid(), 'stores_executive')
  );

-- Update: procurement, stores, directors
CREATE POLICY "mac_update" ON public.material_availability_confirmations
  FOR UPDATE TO authenticated
  USING (
    public.is_full_admin(auth.uid())
    OR public.is_director(auth.uid())
    OR public.has_role(auth.uid(), 'procurement')
    OR public.has_role(auth.uid(), 'stores_executive')
  );

-- Timestamp trigger
CREATE TRIGGER update_mac_updated_at
  BEFORE UPDATE ON public.material_availability_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();