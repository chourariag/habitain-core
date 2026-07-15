
-- 1) Fix mutable search_path on function
ALTER FUNCTION public.required_gfc_for_stage(text) SET search_path = public;

-- 2) Scope realtime.messages topic access to project team members
DROP POLICY IF EXISTS "Authenticated users can use realtime channels" ON realtime.messages;

CREATE POLICY "Realtime scoped to project membership - select"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Non-project topics (no UUID in topic name) remain open to authenticated users
  realtime.topic() !~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  OR public.is_full_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.project_team_members ptm
    JOIN public.profiles p ON p.id = ptm.profile_id
    WHERE p.auth_user_id = auth.uid()
      AND ptm.is_active = true
      AND position(ptm.project_id::text in realtime.topic()) > 0
  )
);

CREATE POLICY "Realtime scoped to project membership - insert"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() !~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  OR public.is_full_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.project_team_members ptm
    JOIN public.profiles p ON p.id = ptm.profile_id
    WHERE p.auth_user_id = auth.uid()
      AND ptm.is_active = true
      AND position(ptm.project_id::text in realtime.topic()) > 0
  )
);
