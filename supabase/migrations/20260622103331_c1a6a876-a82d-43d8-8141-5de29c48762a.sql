
-- 1. advance_requests: restrict director view to finance roles only
DROP POLICY IF EXISTS "Directors can view advance requests" ON public.advance_requests;
CREATE POLICY "Finance leadership can view advance requests"
  ON public.advance_requests FOR SELECT
  USING (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['super_admin','managing_director','finance_director','finance_manager']::app_role[]
    )
  );

-- 2. clients_master: remove head_operations and architecture_director
DROP POLICY IF EXISTS "Sales/Finance can view clients_master" ON public.clients_master;
CREATE POLICY "Sales and Finance can view clients_master"
  ON public.clients_master FOR SELECT
  USING (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['super_admin','managing_director','finance_director','finance_manager','sales_director']::app_role[]
    )
  );

-- 3. design_consultants: limit view to architecture leadership + project architects
DROP POLICY IF EXISTS "Architects can view design_consultants" ON public.design_consultants;
CREATE POLICY "Architecture leadership can view design_consultants"
  ON public.design_consultants FOR SELECT
  USING (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['super_admin','managing_director','architecture_director','principal_architect','project_architect']::app_role[]
    )
  );

-- 4. subcontractors: tighten can_access function to exclude stores_executive
CREATE OR REPLACE FUNCTION public.can_access_subcontractors(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN (
        'super_admin','managing_director','finance_director','sales_director','architecture_director',
        'head_operations','finance_manager',
        'production_head','site_installation_mgr','procurement'
      )
  )
$function$;

-- 5. realtime.messages: require authenticated users for channel subscriptions
DO $$
BEGIN
  -- enable RLS if not already
  EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP POLICY IF EXISTS "Authenticated users can use realtime channels" ON realtime.messages;
CREATE POLICY "Authenticated users can use realtime channels"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can send realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated users can send realtime messages"
  ON realtime.messages FOR INSERT
  TO authenticated
  WITH CHECK (true);
