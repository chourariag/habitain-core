-- Revert project_messages SELECT policy to unrestricted for authenticated users,
-- matching the INSERT policy and fixing the bug where project_team_members is never populated.
DROP POLICY IF EXISTS "Project members and management can read messages" ON public.project_messages;
DROP POLICY IF EXISTS "Authenticated can read messages" ON public.project_messages;

CREATE POLICY "Authenticated can read messages"
ON public.project_messages
FOR SELECT
TO authenticated
USING (true);