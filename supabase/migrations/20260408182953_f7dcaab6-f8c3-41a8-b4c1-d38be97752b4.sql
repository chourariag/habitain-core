
CREATE TABLE public.subcontractor_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) NOT NULL,
  company_name text NOT NULL,
  work_type text,
  scope text DEFAULT 'site',
  pricing_type text,
  contact_person text,
  phone text,
  scheduled_start date,
  scheduled_completion date,
  actual_start date,
  actual_completion date,
  status text DEFAULT 'scheduled',
  confirmed boolean DEFAULT false,
  confirmed_at timestamptz,
  reminder_14d_sent boolean DEFAULT false,
  reminder_5d_sent boolean DEFAULT false,
  reminder_1d_sent boolean DEFAULT false,
  escalation_sent boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.subcontractor_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view subcontractor_assignments"
  ON public.subcontractor_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized roles can insert subcontractor_assignments"
  ON public.subcontractor_assignments FOR INSERT TO authenticated
  WITH CHECK (
    public.is_full_admin(auth.uid())
    OR public.has_role(auth.uid(), 'site_installation_mgr')
    OR public.has_role(auth.uid(), 'head_operations')
    OR public.has_role(auth.uid(), 'production_head')
    OR public.has_role(auth.uid(), 'site_engineer')
  );

CREATE POLICY "Authorized roles can update subcontractor_assignments"
  ON public.subcontractor_assignments FOR UPDATE TO authenticated
  USING (
    public.is_full_admin(auth.uid())
    OR public.has_role(auth.uid(), 'site_installation_mgr')
    OR public.has_role(auth.uid(), 'head_operations')
    OR public.has_role(auth.uid(), 'production_head')
    OR public.has_role(auth.uid(), 'site_engineer')
  );

CREATE TRIGGER update_subcontractor_assignments_updated_at
  BEFORE UPDATE ON public.subcontractor_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.punch_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  punch_list_id text NOT NULL,
  project_id uuid REFERENCES public.projects(id) NOT NULL,
  description text NOT NULL,
  location text,
  category text DEFAULT 'cosmetic',
  before_photo_url text,
  after_photo_url text,
  responsible_party text DEFAULT 'Habitainer Team',
  target_close_date date,
  closed_by text,
  closed_at timestamptz,
  fix_description text,
  waived boolean DEFAULT false,
  waive_reason text,
  status text DEFAULT 'open',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.punch_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view punch_list_items"
  ON public.punch_list_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized roles can insert punch_list_items"
  ON public.punch_list_items FOR INSERT TO authenticated
  WITH CHECK (
    public.is_full_admin(auth.uid())
    OR public.has_role(auth.uid(), 'site_installation_mgr')
    OR public.has_role(auth.uid(), 'site_engineer')
    OR public.is_director(auth.uid())
  );

CREATE POLICY "Authorized roles can update punch_list_items"
  ON public.punch_list_items FOR UPDATE TO authenticated
  WITH CHECK (
    public.is_full_admin(auth.uid())
    OR public.has_role(auth.uid(), 'site_installation_mgr')
    OR public.has_role(auth.uid(), 'site_engineer')
    OR public.is_director(auth.uid())
  );

CREATE TRIGGER update_punch_list_items_updated_at
  BEFORE UPDATE ON public.punch_list_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
