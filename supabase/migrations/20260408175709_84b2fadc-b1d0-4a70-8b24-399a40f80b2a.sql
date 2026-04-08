
-- Table: bay_assignments
CREATE TABLE public.bay_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id text NOT NULL,
  project_id uuid REFERENCES public.projects(id),
  bay_number integer NOT NULL CHECK (bay_number BETWEEN 1 AND 17),
  bay_type text GENERATED ALWAYS AS (CASE WHEN bay_number <= 10 THEN 'indoor' ELSE 'outdoor' END) STORED,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid,
  moved_from integer,
  move_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Only one active assignment per module (latest wins, but enforce uniqueness for current state)
CREATE UNIQUE INDEX idx_bay_assignments_module ON public.bay_assignments(module_id) WHERE moved_from IS NULL;

ALTER TABLE public.bay_assignments ENABLE ROW LEVEL SECURITY;

-- Read access for relevant roles
CREATE POLICY "Floor map viewers can read bay assignments"
ON public.bay_assignments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'production_head') OR
  public.has_role(auth.uid(), 'factory_floor_supervisor') OR
  public.has_role(auth.uid(), 'planning_engineer') OR
  public.is_director(auth.uid())
);

-- Write access for production_head and factory_floor_supervisor
CREATE POLICY "Production staff can manage bay assignments"
ON public.bay_assignments FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'production_head') OR
  public.has_role(auth.uid(), 'factory_floor_supervisor')
);

CREATE POLICY "Production staff can update bay assignments"
ON public.bay_assignments FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'production_head') OR
  public.has_role(auth.uid(), 'factory_floor_supervisor')
);

-- Trigger for updated_at
CREATE TRIGGER update_bay_assignments_updated_at
BEFORE UPDATE ON public.bay_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
