
-- 1. client_portal_tokens table
CREATE TABLE IF NOT EXISTS public.client_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  client_name TEXT,
  client_email TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_cpt_project ON public.client_portal_tokens(project_id);
CREATE INDEX IF NOT EXISTS idx_cpt_token ON public.client_portal_tokens(token);

GRANT SELECT, INSERT, UPDATE ON public.client_portal_tokens TO authenticated;
GRANT ALL ON public.client_portal_tokens TO service_role;

ALTER TABLE public.client_portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can view portal tokens"
  ON public.client_portal_tokens FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authorized roles can manage portal tokens"
  ON public.client_portal_tokens FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(),
    ARRAY['super_admin','managing_director','sales_director','planning_head','finance_director']::app_role[]));

CREATE POLICY "Authorized roles can update portal tokens"
  ON public.client_portal_tokens FOR UPDATE
  TO authenticated
  USING (public.user_has_any_role(auth.uid(),
    ARRAY['super_admin','managing_director','sales_director','planning_head','finance_director']::app_role[]))
  WITH CHECK (public.user_has_any_role(auth.uid(),
    ARRAY['super_admin','managing_director','sales_director','planning_head','finance_director']::app_role[]));

-- 2. Lookup RPC for portal access (public — no JWT required)
CREATE OR REPLACE FUNCTION public.get_project_by_client_portal_token(_token UUID)
RETURNS TABLE (
  project_id UUID,
  project_name TEXT,
  project_code TEXT,
  client_name TEXT,
  client_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  SELECT t.*, p.project_name AS pname, p.project_code AS pcode
    INTO rec
  FROM public.client_portal_tokens t
  JOIN public.projects p ON p.id = t.project_id
  WHERE t.token = _token
    AND t.is_active = true
    AND (t.expires_at IS NULL OR t.expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.client_portal_tokens
    SET last_accessed_at = now()
    WHERE id = rec.id;

  project_id := rec.project_id;
  project_name := rec.pname;
  project_code := rec.pcode;
  client_name := rec.client_name;
  client_email := rec.client_email;
  RETURN NEXT;
END $$;

GRANT EXECUTE ON FUNCTION public.get_project_by_client_portal_token(UUID) TO anon, authenticated;

-- 3. Client approve / request-changes RPCs (notify design team)
CREATE OR REPLACE FUNCTION public._cpt_validate(_token UUID)
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT project_id FROM public.client_portal_tokens
  WHERE token = _token AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public._cpt_validate(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.client_approve_design_stage(_token UUID, _stage_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
  stage RECORD;
  pname TEXT;
  cname TEXT;
  recip RECORD;
BEGIN
  pid := public._cpt_validate(_token);
  IF pid IS NULL THEN RETURN false; END IF;

  SELECT * INTO stage FROM public.design_stages WHERE id = _stage_id AND project_id = pid;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.design_stages
     SET status = 'client_approved',
         approval_date = CURRENT_DATE,
         approval_method = 'client_portal',
         actual_end_date = COALESCE(actual_end_date, CURRENT_DATE),
         updated_at = now()
   WHERE id = _stage_id;

  SELECT project_name INTO pname FROM public.projects WHERE id = pid;
  SELECT client_name INTO cname FROM public.client_portal_tokens WHERE token = _token LIMIT 1;

  FOR recip IN
    SELECT auth_user_id FROM public.profiles
    WHERE is_active = true AND role IN ('operations_architect','principal_architect')
  LOOP
    INSERT INTO public.notifications(recipient_id, category, title, message, navigate_to, priority)
    VALUES (recip.auth_user_id, 'approval',
            'Client approved design stage',
            COALESCE(cname,'Client') || ' approved "' || stage.stage_name || '" for ' || COALESCE(pname,'project') || '.',
            '/projects/' || pid || '/design',
            'normal');
  END LOOP;

  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.client_approve_design_stage(UUID, UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.client_request_design_changes(_token UUID, _stage_id UUID, _comment TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
  stage RECORD;
  pname TEXT;
  cname TEXT;
  recip RECORD;
BEGIN
  pid := public._cpt_validate(_token);
  IF pid IS NULL THEN RETURN false; END IF;
  IF _comment IS NULL OR length(trim(_comment)) = 0 THEN RETURN false; END IF;

  SELECT * INTO stage FROM public.design_stages WHERE id = _stage_id AND project_id = pid;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.design_stages
     SET status = 'revision_requested',
         revision_comments = _comment,
         updated_at = now()
   WHERE id = _stage_id;

  SELECT project_name INTO pname FROM public.projects WHERE id = pid;
  SELECT client_name INTO cname FROM public.client_portal_tokens WHERE token = _token LIMIT 1;

  FOR recip IN
    SELECT auth_user_id FROM public.profiles
    WHERE is_active = true AND role IN ('operations_architect','principal_architect','project_architect')
  LOOP
    INSERT INTO public.notifications(recipient_id, category, title, message, navigate_to, priority)
    VALUES (recip.auth_user_id, 'approval',
            'Client requested design changes',
            COALESCE(cname,'Client') || ' requested changes on "' || stage.stage_name || '" (' || COALESCE(pname,'project') || '): ' || _comment,
            '/projects/' || pid || '/design',
            'high');
  END LOOP;

  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.client_request_design_changes(UUID, UUID, TEXT) TO anon, authenticated;
