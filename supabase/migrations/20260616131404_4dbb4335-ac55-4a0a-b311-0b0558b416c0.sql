
-- RBAC: MANAGE access on HR records for direct reportees.
-- Adds additive SELECT/UPDATE policies on attendance_records and leave_requests
-- so a reporting manager can see and approve HR records for their direct reports.

CREATE OR REPLACE FUNCTION public.is_reporting_manager_of(_manager_auth_id uuid, _employee_auth_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles emp
      JOIN public.profiles mgr ON mgr.id = emp.reporting_manager_id
     WHERE emp.auth_user_id = _employee_auth_id
       AND mgr.auth_user_id = _manager_auth_id
       AND emp.is_active = true
  )
$$;

-- attendance_records: managers can see their team's rows
DROP POLICY IF EXISTS "Managers can view team attendance" ON public.attendance_records;
CREATE POLICY "Managers can view team attendance"
  ON public.attendance_records FOR SELECT
  TO authenticated
  USING (public.is_reporting_manager_of(auth.uid(), user_id));

-- attendance_records: managers can update their team's rows (approve / correct)
DROP POLICY IF EXISTS "Managers can update team attendance" ON public.attendance_records;
CREATE POLICY "Managers can update team attendance"
  ON public.attendance_records FOR UPDATE
  TO authenticated
  USING (public.is_reporting_manager_of(auth.uid(), user_id))
  WITH CHECK (public.is_reporting_manager_of(auth.uid(), user_id));

-- leave_requests: managers can see their team's rows
DROP POLICY IF EXISTS "Managers can view team leave" ON public.leave_requests;
CREATE POLICY "Managers can view team leave"
  ON public.leave_requests FOR SELECT
  TO authenticated
  USING (public.is_reporting_manager_of(auth.uid(), user_id));

-- leave_requests: managers can approve / update their team's requests
DROP POLICY IF EXISTS "Managers can update team leave" ON public.leave_requests;
CREATE POLICY "Managers can update team leave"
  ON public.leave_requests FOR UPDATE
  TO authenticated
  USING (public.is_reporting_manager_of(auth.uid(), user_id))
  WITH CHECK (public.is_reporting_manager_of(auth.uid(), user_id));
