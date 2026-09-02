-- Offboarding workflow + sole role holder visibility

CREATE TABLE public.offboarding_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_working_day date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'reassignment_pending'
    CHECK (status IN ('reassignment_pending','clearance_pending','completed','cancelled')),
  exit_reason_category text,
  exit_interview_notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.offboarding_impact_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offboarding_record_id uuid NOT NULL REFERENCES public.offboarding_records(id) ON DELETE CASCADE,
  item_type text NOT NULL
    CHECK (item_type IN ('role_holder','project_assignment','direct_report','open_approval','open_task','gate_owner')),
  entity_table text,
  entity_id text,
  field_name text,
  old_value text,
  new_value text,
  resolution_status text NOT NULL DEFAULT 'pending'
    CHECK (resolution_status IN ('pending','resolved','leave_vacant')),
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.offboarding_clearance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offboarding_record_id uuid NOT NULL REFERENCES public.offboarding_records(id) ON DELETE CASCADE,
  checklist_item text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','waived')),
  completed_by uuid REFERENCES auth.users(id),
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.offboarding_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.offboarding_impact_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.offboarding_clearance_items TO authenticated;
GRANT ALL ON public.offboarding_records TO service_role;
GRANT ALL ON public.offboarding_impact_items TO service_role;
GRANT ALL ON public.offboarding_clearance_items TO service_role;

ALTER TABLE public.offboarding_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offboarding_impact_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offboarding_clearance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Offboarding records visible to director tier"
  ON public.offboarding_records FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'managing_director')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'finance_director')
      OR public.has_role(auth.uid(), 'sales_director')
      OR public.has_role(auth.uid(), 'architecture_director')
      OR public.has_role(auth.uid(), 'chairman')
      OR created_by = auth.uid());

CREATE POLICY "Offboarding records editable by director tier or creator"
  ON public.offboarding_records FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'managing_director')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'finance_director')
      OR public.has_role(auth.uid(), 'sales_director')
      OR public.has_role(auth.uid(), 'architecture_director')
      OR public.has_role(auth.uid(), 'chairman')
      OR created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'managing_director')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'finance_director')
      OR public.has_role(auth.uid(), 'sales_director')
      OR public.has_role(auth.uid(), 'architecture_director')
      OR public.has_role(auth.uid(), 'chairman')
      OR created_by = auth.uid());

CREATE POLICY "Offboarding records insertable by director tier"
  ON public.offboarding_records FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'managing_director')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'finance_director')
      OR public.has_role(auth.uid(), 'sales_director')
      OR public.has_role(auth.uid(), 'architecture_director')
      OR public.has_role(auth.uid(), 'chairman'));

CREATE POLICY "Impact items visible to director tier"
  ON public.offboarding_impact_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.offboarding_records r
    WHERE r.id = offboarding_impact_items.offboarding_record_id
      AND (public.has_role(auth.uid(), 'managing_director')
        OR public.has_role(auth.uid(), 'super_admin')
        OR public.has_role(auth.uid(), 'finance_director')
        OR public.has_role(auth.uid(), 'sales_director')
        OR public.has_role(auth.uid(), 'architecture_director')
        OR public.has_role(auth.uid(), 'chairman')
        OR r.created_by = auth.uid())
  ));

CREATE POLICY "Impact items editable by director tier"
  ON public.offboarding_impact_items FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.offboarding_records r
    WHERE r.id = offboarding_impact_items.offboarding_record_id
      AND (public.has_role(auth.uid(), 'managing_director')
        OR public.has_role(auth.uid(), 'super_admin')
        OR public.has_role(auth.uid(), 'finance_director')
        OR public.has_role(auth.uid(), 'sales_director')
        OR public.has_role(auth.uid(), 'architecture_director')
        OR public.has_role(auth.uid(), 'chairman'))
  ));

CREATE POLICY "Clearance items visible to director tier"
  ON public.offboarding_clearance_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.offboarding_records r
    WHERE r.id = offboarding_clearance_items.offboarding_record_id
      AND (public.has_role(auth.uid(), 'managing_director')
        OR public.has_role(auth.uid(), 'super_admin')
        OR public.has_role(auth.uid(), 'finance_director')
        OR public.has_role(auth.uid(), 'sales_director')
        OR public.has_role(auth.uid(), 'architecture_director')
        OR public.has_role(auth.uid(), 'chairman')
        OR r.created_by = auth.uid())
  ));

CREATE POLICY "Clearance items editable by director tier"
  ON public.offboarding_clearance_items FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.offboarding_records r
    WHERE r.id = offboarding_clearance_items.offboarding_record_id
      AND (public.has_role(auth.uid(), 'managing_director')
        OR public.has_role(auth.uid(), 'super_admin')
        OR public.has_role(auth.uid(), 'finance_director')
        OR public.has_role(auth.uid(), 'sales_director')
        OR public.has_role(auth.uid(), 'architecture_director')
        OR public.has_role(auth.uid(), 'chairman'))
  ));

CREATE OR REPLACE FUNCTION public.trg_guard_offboarding_status_advance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('clearance_pending','completed') AND OLD.status = 'reassignment_pending' THEN
    IF EXISTS (
      SELECT 1 FROM public.offboarding_impact_items
      WHERE offboarding_record_id = NEW.id
        AND resolution_status = 'pending'
    ) THEN
      RAISE EXCEPTION 'Cannot advance offboarding record %: unresolved impact items remain', NEW.id;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER offboarding_status_advance_guard
  BEFORE UPDATE ON public.offboarding_records
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_offboarding_status_advance();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_offboarding_records_updated_at
  BEFORE UPDATE ON public.offboarding_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.scan_offboarding_impact(_profile_id uuid)
RETURNS TABLE (
  item_type text,
  entity_table text,
  entity_id text,
  field_name text,
  old_value text,
  suggested_reassign_profile_id uuid,
  suggested_reassign_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
    SELECT p.id, p.auth_user_id, p.role, p.display_name
    FROM public.profiles p
    WHERE p.id = _profile_id
  ),
  same_role_others AS (
    SELECT p.id AS profile_id, p.display_name, p.role
    FROM public.profiles p, target t
    WHERE p.role::text = t.role::text
      AND p.is_active = true
      AND p.id <> t.id
    ORDER BY p.display_name
  ),
  sole_role AS (
    SELECT t.role::text AS rrole
    FROM target t
    WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role::text = t.role::text AND p.is_active = true AND p.id <> t.id
    )
  )
  SELECT 'role_holder'::text,
         'profiles'::text,
         t.id::text,
         'role'::text,
         t.role::text,
         (SELECT profile_id FROM same_role_others LIMIT 1),
         (SELECT display_name FROM same_role_others LIMIT 1)
  FROM target t
  WHERE EXISTS (SELECT 1 FROM sole_role sr WHERE sr.rrole = t.role::text)

  UNION ALL

  SELECT 'project_assignment'::text,
         'projects'::text,
         pr.id::text,
         'project_architect_id'::text,
         t.display_name::text,
         (SELECT profile_id FROM same_role_others LIMIT 1),
         (SELECT display_name FROM same_role_others LIMIT 1)
  FROM target t
  JOIN public.projects pr ON pr.project_architect_id = t.id
  WHERE pr.is_archived = false OR pr.is_archived IS NULL

  UNION ALL

  SELECT 'project_assignment'::text,
         'project_team_members'::text,
         ptm.id::text,
         'profile_id'::text,
         t.display_name::text,
         (SELECT profile_id FROM same_role_others LIMIT 1),
         (SELECT display_name FROM same_role_others LIMIT 1)
  FROM target t
  JOIN public.project_team_members ptm ON ptm.profile_id = t.id

  UNION ALL

  SELECT 'gate_owner'::text,
         'project_design_stages'::text,
         pds.id::text,
         'owner_id'::text,
         t.display_name::text,
         (SELECT profile_id FROM same_role_others LIMIT 1),
         (SELECT display_name FROM same_role_others LIMIT 1)
  FROM target t
  JOIN public.project_design_stages pds ON pds.owner_id = t.id

  UNION ALL

  SELECT 'direct_report'::text,
         'profiles'::text,
         rep.id::text,
         'reporting_manager_id'::text,
         t.display_name::text,
         NULL::uuid,
         NULL::text
  FROM target t
  JOIN public.profiles rep ON rep.reporting_manager_id = t.id
  WHERE rep.is_active = true

  UNION ALL

  SELECT 'open_approval'::text,
         'approval_requests'::text,
         ar.id::text,
         'requested_by'::text,
         t.display_name::text,
         NULL::uuid,
         NULL::text
  FROM target t
  JOIN public.approval_requests ar ON ar.requested_by = t.auth_user_id
  WHERE ar.status = 'pending'

  UNION ALL

  SELECT 'open_task'::text,
         'project_tasks'::text,
         pt.id::text,
         'responsible_role'::text,
         t.role::text,
         NULL::uuid,
         NULL::text
  FROM target t
  JOIN public.project_tasks pt ON pt.responsible_role = t.role::text
  WHERE pt.status IN ('Upcoming','In Progress','Blocked')
$$;

CREATE OR REPLACE FUNCTION public.get_sole_role_holders()
RETURNS TABLE (
  role text,
  role_label text,
  holder_profile_id uuid,
  holder_name text,
  holder_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.role::text AS role,
    p.role::text AS role_label,
    p.id AS holder_profile_id,
    p.display_name AS holder_name,
    p.email AS holder_email
  FROM public.profiles p
  WHERE p.is_active = true
    AND p.role IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.is_active = true
        AND p2.role::text = p.role::text
        AND p2.id <> p.id
    )
  ORDER BY p.role::text, p.display_name;
$$;

CREATE OR REPLACE FUNCTION public.log_offboarding_audit(
  _action text,
  _performed_by uuid,
  _entity_id uuid,
  _old_value jsonb DEFAULT NULL,
  _new_value jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.admin_audit_log (action, performed_by, entity_type, entity_id, old_value, new_value)
  VALUES (_action, _performed_by, 'offboarding_record', _entity_id, _old_value, _new_value);
$$;

GRANT EXECUTE ON FUNCTION public.scan_offboarding_impact(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sole_role_holders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_offboarding_audit(text, uuid, uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.scan_offboarding_impact(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_sole_role_holders() TO service_role;
GRANT EXECUTE ON FUNCTION public.log_offboarding_audit(text, uuid, uuid, jsonb, jsonb) TO service_role;
