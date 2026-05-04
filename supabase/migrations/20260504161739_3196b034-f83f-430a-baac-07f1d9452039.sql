-- Update raiser helper (enum value already committed in previous migration)
CREATE OR REPLACE FUNCTION public.can_raise_approval_request(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role::text IN (
        'super_admin','managing_director','finance_director','sales_director',
        'architecture_director','head_operations','hr_executive','planning_head'
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_approve_request(_user_id uuid, _row public.approval_requests)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_md(_user_id)
    OR (
      _row.request_type = 'create_project'
      AND (
        (COALESCE(_row.payload->>'division','Habitainer') = 'Habitainer'
          AND public.has_role(_user_id, 'sales_director'))
        OR (COALESCE(_row.payload->>'division','') = 'ADS'
          AND public.has_role(_user_id, 'principal_architect'))
      )
    )
$$;

DROP POLICY IF EXISTS "md_can_update" ON public.approval_requests;
CREATE POLICY "approver_can_update" ON public.approval_requests
FOR UPDATE TO authenticated
USING (public.can_approve_request(auth.uid(), approval_requests))
WITH CHECK (public.can_approve_request(auth.uid(), approval_requests));

DROP POLICY IF EXISTS "raise_can_view_own_or_md_all" ON public.approval_requests;
CREATE POLICY "view_own_or_raiser_or_approver" ON public.approval_requests
FOR SELECT TO authenticated
USING (
  requested_by = auth.uid()
  OR public.can_raise_approval_request(auth.uid())
  OR public.is_md(auth.uid())
  OR public.has_role(auth.uid(), 'sales_director')
  OR public.has_role(auth.uid(), 'principal_architect')
);

-- Update the Create Project threshold notes to reflect new flow
UPDATE public.approval_thresholds
SET tier1_approver_role = 'sales_director / principal_architect',
    notes = 'Raised by Planning Head only. Approved by Sales Director (Habitainer) or Principal Architect (ADS). Division determines approver.'
WHERE approval_type = 'Create Project';