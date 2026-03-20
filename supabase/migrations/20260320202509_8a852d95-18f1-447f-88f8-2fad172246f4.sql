
-- attendance_records
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in_time timestamptz,
  check_out_time timestamptz,
  location_type text NOT NULL DEFAULT 'office',
  project_id uuid REFERENCES public.projects(id),
  gps_lat numeric,
  gps_lng numeric,
  gps_verified boolean DEFAULT false,
  remote_reason text,
  hours_worked numeric,
  is_manual_override boolean DEFAULT false,
  override_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own attendance" ON public.attendance_records
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','hr_executive','finance_manager','head_operations','production_head')
  );

CREATE POLICY "Users can insert own attendance" ON public.attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR get_user_role(auth.uid()) IN ('super_admin','managing_director','hr_executive'));

CREATE POLICY "HR can update attendance" ON public.attendance_records
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','hr_executive'));

-- leave_requests
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  leave_type text NOT NULL DEFAULT 'casual',
  from_date date NOT NULL,
  to_date date NOT NULL,
  days_count numeric NOT NULL DEFAULT 1,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  rejection_reason text,
  requested_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own leave requests" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','hr_executive','finance_manager','head_operations','production_head')
  );

CREATE POLICY "Users can insert own leave" ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "HR and managers can update leave" ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('super_admin','managing_director','hr_executive','head_operations','production_head')
  );

-- app_settings
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  updated_by uuid,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can write settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (is_full_admin(auth.uid()))
  WITH CHECK (is_full_admin(auth.uid()));

-- Pre-seed factory coordinates
INSERT INTO public.app_settings (key, value) VALUES ('factory_lat', ''), ('factory_lng', '');

-- attendance_exports
CREATE TABLE public.attendance_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL,
  year integer NOT NULL,
  generated_by uuid,
  sent_to_finance_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.attendance_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR and finance can manage exports" ON public.attendance_exports
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','hr_executive','finance_manager'))
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','hr_executive','finance_manager'));
