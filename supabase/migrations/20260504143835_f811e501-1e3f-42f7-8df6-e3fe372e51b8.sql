
-- ============================================================
-- approval_requests : unified table for every approval workflow
-- ============================================================
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL CHECK (request_type IN (
    'add_user','deactivate_user','create_project','archive_project'
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_by uuid NOT NULL,
  requested_by_name text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_by_name text,
  approved_at timestamptz,
  rejected_reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  audit_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_type ON public.approval_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_by ON public.approval_requests(requested_by);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- helper: can the user raise approval requests?
CREATE OR REPLACE FUNCTION public.can_raise_approval_request(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN (
        'super_admin','managing_director','finance_director','sales_director',
        'architecture_director','head_operations','hr_executive','planning_engineer'
      )
  )
$$;

CREATE POLICY "raise_can_view_own_or_md_all" ON public.approval_requests
FOR SELECT TO authenticated
USING (
  requested_by = auth.uid()
  OR public.can_raise_approval_request(auth.uid())
  OR public.is_md(auth.uid())
);

CREATE POLICY "raise_insert_self" ON public.approval_requests
FOR INSERT TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND public.can_raise_approval_request(auth.uid())
);

CREATE POLICY "md_can_update" ON public.approval_requests
FOR UPDATE TO authenticated
USING (public.is_md(auth.uid()))
WITH CHECK (public.is_md(auth.uid()));

-- updated_at trigger
CREATE TRIGGER trg_approval_requests_updated_at
BEFORE UPDATE ON public.approval_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- projects: add archived_at for visibility of archive date
-- ============================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_reason text;

-- ============================================================
-- Seed 4 new rules in approval_thresholds
-- ============================================================
INSERT INTO public.approval_thresholds (approval_type, tier1_approver_role, notes)
VALUES
  ('Add New User',     'managing_director', 'Raised by HR Admin or Director. Account is created only after MD approves.'),
  ('Deactivate User',  'managing_director', 'Raised by HR Admin or Director. Open tasks must be reassigned before deactivation.'),
  ('Create Project',   'managing_director', 'Raised by Director or Planning Engineer. Project stays Pending until MD approves.'),
  ('Archive Project',  'managing_director', 'Raised by Directors only. Hard delete is never permitted — archive only.')
ON CONFLICT (approval_type) DO NOTHING;
