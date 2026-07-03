
-- 1. Profiles: tighten directory SELECT + reassert PII column revocations
DROP POLICY IF EXISTS "Authenticated users can view profile directory" ON public.profiles;

CREATE POLICY "Users can view own profile row"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Directory view of active non-archived profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (is_active = true AND COALESCE(is_archived, false) = false);

-- Defense-in-depth: keep PII columns revoked from authenticated
REVOKE SELECT (phone, email, date_of_birth, wedding_anniversary, children, home_base)
  ON public.profiles FROM authenticated;
REVOKE SELECT (phone, email, date_of_birth, wedding_anniversary, children, home_base)
  ON public.profiles FROM anon;

-- 2. Quality flags: scope SELECT to reporter / action owners / management
DROP POLICY IF EXISTS "view quality flags" ON public.quality_flags;
CREATE POLICY "view quality flags scoped"
  ON public.quality_flags FOR SELECT TO authenticated
  USING (
    flagged_by = auth.uid()
    OR public.can_action_quality_flag(auth.uid())
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['super_admin','managing_director','head_operations']::app_role[]
    )
  );

-- 3. Safety incidents: scope SELECT to reporter / safety managers / directors
DROP POLICY IF EXISTS "anyone view safety" ON public.safety_incidents;
CREATE POLICY "view safety scoped"
  ON public.safety_incidents FOR SELECT TO authenticated
  USING (
    reported_by = auth.uid()
    OR public.can_manage_safety(auth.uid())
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['super_admin','managing_director','head_operations']::app_role[]
    )
  );

-- 4. Site diary INSERT: require site/ops role
DROP POLICY IF EXISTS "Authenticated users can insert site_diary" ON public.site_diary;
CREATE POLICY "Site staff can insert site_diary"
  ON public.site_diary FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['super_admin','managing_director','head_operations','site_installation_mgr','site_engineer','planning_engineer','delivery_rm_lead']::app_role[]
    )
  );

-- 5. Installation checklist INSERT: require site/ops role
DROP POLICY IF EXISTS "Authenticated users can insert installation_checklist" ON public.installation_checklist;
CREATE POLICY "Site staff can insert installation_checklist"
  ON public.installation_checklist FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['super_admin','managing_director','head_operations','site_installation_mgr','site_engineer']::app_role[]
    )
  );

-- 6. Site readiness INSERT: require site/ops role
DROP POLICY IF EXISTS "Authenticated users can insert site_readiness" ON public.site_readiness;
CREATE POLICY "Site staff can insert site_readiness"
  ON public.site_readiness FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_any_role(
      auth.uid(),
      ARRAY['super_admin','managing_director','head_operations','site_installation_mgr','site_engineer','planning_engineer','delivery_rm_lead']::app_role[]
    )
  );
