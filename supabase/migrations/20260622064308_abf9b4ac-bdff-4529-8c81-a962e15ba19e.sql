
-- ============== project_messages: restrict SELECT to project members + senior management ==============
DROP POLICY IF EXISTS "Authenticated can read messages" ON public.project_messages;

CREATE POLICY "Project members and management can read messages"
ON public.project_messages
FOR SELECT
TO authenticated
USING (
  sender_id = auth.uid()
  OR public.is_director(auth.uid())
  OR public.user_has_any_role(auth.uid(), ARRAY['head_operations']::app_role[])
  OR EXISTS (
    SELECT 1
    FROM public.project_team_members ptm
    JOIN public.profiles p ON p.id = ptm.profile_id
    WHERE ptm.project_id = project_messages.project_id
      AND ptm.is_active = true
      AND p.auth_user_id = auth.uid()
  )
);

-- ============== payroll_config: split ALL policy so HR/accounts execs cannot bulk-read sensitive fields ==============
DROP POLICY IF EXISTS "HR manages payroll_config" ON public.payroll_config;

-- HR roles can insert/update/delete (manage), but bulk SELECT is constrained by the separate SELECT policy
CREATE POLICY "HR can insert payroll_config"
ON public.payroll_config
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_hr_documents(auth.uid()));

CREATE POLICY "HR can update payroll_config"
ON public.payroll_config
FOR UPDATE
TO authenticated
USING (public.can_manage_hr_documents(auth.uid()))
WITH CHECK (public.can_manage_hr_documents(auth.uid()));

CREATE POLICY "HR can delete payroll_config"
ON public.payroll_config
FOR DELETE
TO authenticated
USING (public.can_manage_hr_documents(auth.uid()));
