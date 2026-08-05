-- 1. admin_audit_log: require performed_by = auth.uid()
DROP POLICY IF EXISTS "Insert audit log" ON public.admin_audit_log;
CREATE POLICY "Insert audit log" ON public.admin_audit_log
FOR INSERT TO authenticated
WITH CHECK (
  performed_by = auth.uid()
  AND (
    is_director(auth.uid())
    OR get_user_role(auth.uid()) = ANY (ARRAY['head_operations'::app_role,'production_head'::app_role,'finance_manager'::app_role,'hr_executive'::app_role])
  )
);

-- 2. sop_view_log: require viewed_by = auth.uid()
DROP POLICY IF EXISTS "Anyone signed in can log a view" ON public.sop_view_log;
CREATE POLICY "Users log their own SOP views" ON public.sop_view_log
FOR INSERT TO authenticated
WITH CHECK (viewed_by = auth.uid());

-- 3. storage: scope chat-media / voice-notes uploads to project folder membership
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
CREATE POLICY "Project members can upload chat media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND owner = auth.uid()
  AND (
    is_director(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_team_members ptm
      JOIN public.profiles pr ON pr.id = ptm.profile_id
      WHERE pr.auth_user_id = auth.uid()
        AND ptm.project_id::text = (storage.foldername(name))[1]
    )
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload voice-notes" ON storage.objects;
CREATE POLICY "Project members can upload voice-notes" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'voice-notes'
  AND owner = auth.uid()
  AND (
    is_director(auth.uid())
    OR user_has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'managing_director'::app_role,'architecture_director'::app_role,'head_operations'::app_role,'principal_architect'::app_role,'project_architect'::app_role,'structural_architect'::app_role,'planning_head'::app_role,'planning_engineer'::app_role,'operations_architect'::app_role])
    OR EXISTS (
      SELECT 1 FROM public.project_team_members ptm
      JOIN public.profiles pr ON pr.id = ptm.profile_id
      WHERE pr.auth_user_id = auth.uid()
        AND ptm.project_id::text = (storage.foldername(name))[1]
    )
  )
);

-- 4. realtime.messages: remove non-UUID topic open fallback
DROP POLICY IF EXISTS "Realtime scoped to project membership - select" ON realtime.messages;
CREATE POLICY "Realtime scoped to project membership - select" ON realtime.messages
FOR SELECT TO authenticated
USING (
  is_full_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.project_team_members ptm
    JOIN public.profiles p ON p.id = ptm.profile_id
    WHERE p.auth_user_id = auth.uid()
      AND ptm.is_active = true
      AND POSITION(ptm.project_id::text IN realtime.topic()) > 0
  )
);

DROP POLICY IF EXISTS "Realtime scoped to project membership - insert" ON realtime.messages;
CREATE POLICY "Realtime scoped to project membership - insert" ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (
  is_full_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.project_team_members ptm
    JOIN public.profiles p ON p.id = ptm.profile_id
    WHERE p.auth_user_id = auth.uid()
      AND ptm.is_active = true
      AND POSITION(ptm.project_id::text IN realtime.topic()) > 0
  )
);