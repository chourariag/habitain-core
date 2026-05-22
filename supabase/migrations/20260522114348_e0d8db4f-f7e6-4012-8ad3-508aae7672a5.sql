
-- 3A: Privilege-escalation fix on profiles INSERT
DROP POLICY IF EXISTS "Directors can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can insert any role profile" ON public.profiles;

CREATE POLICY "Directors can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (
  is_director(auth.uid())
  AND role NOT IN ('super_admin'::app_role, 'managing_director'::app_role)
);

CREATE POLICY "Super admin can insert any role profile"
ON public.profiles FOR INSERT
WITH CHECK (
  get_user_role(auth.uid()) IN ('super_admin'::app_role, 'managing_director'::app_role)
);

-- 3B: Finance tables — only add DELETE (SELECT/INSERT/UPDATE already exist)
DROP POLICY IF EXISTS "Finance directors can delete project budgets" ON public.finance_project_budgets;
CREATE POLICY "Finance directors can delete project budgets"
ON public.finance_project_budgets FOR DELETE
USING (get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role,'finance_director'::app_role));

DROP POLICY IF EXISTS "Finance directors can delete expense reports" ON public.expense_reports;
CREATE POLICY "Finance directors can delete expense reports"
ON public.expense_reports FOR DELETE
USING (get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role,'finance_director'::app_role));

DROP POLICY IF EXISTS "Finance directors can delete expense entries" ON public.expense_entries;
CREATE POLICY "Finance directors can delete expense entries"
ON public.expense_entries FOR DELETE
USING (get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role,'finance_director'::app_role));

-- 3C: hr_settings — replace loose SELECT, add DELETE (UPDATE/INSERT already exist)
DROP POLICY IF EXISTS "All authenticated read hr_settings" ON public.hr_settings;
DROP POLICY IF EXISTS "HR can view hr_settings" ON public.hr_settings;
CREATE POLICY "HR can view hr_settings"
ON public.hr_settings FOR SELECT
USING (get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role,'finance_director'::app_role,'hr_executive'::app_role,'hr_admin'::app_role));

DROP POLICY IF EXISTS "HR can delete hr_settings" ON public.hr_settings;
CREATE POLICY "HR can delete hr_settings"
ON public.hr_settings FOR DELETE
USING (get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role));

-- 3D: attendance_records — SELECT/INSERT/UPDATE/DELETE policies already exist; no changes needed.

-- 3E: app_settings — replace loose SELECT with admin-only
DROP POLICY IF EXISTS "All authenticated can read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can view app settings" ON public.app_settings;
CREATE POLICY "Admins can view app settings"
ON public.app_settings FOR SELECT
USING (get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role));
-- (INSERT/UPDATE/DELETE already covered by existing "Admin can write settings" + delete policy)

-- 3F: attendance_exports — replace blanket ALL with granular policies
DROP POLICY IF EXISTS "HR and finance can manage exports" ON public.attendance_exports;
DROP POLICY IF EXISTS "Finance roles can view attendance exports" ON public.attendance_exports;
DROP POLICY IF EXISTS "HR can insert attendance exports" ON public.attendance_exports;
DROP POLICY IF EXISTS "HR can delete attendance exports" ON public.attendance_exports;

CREATE POLICY "Finance roles can view attendance exports"
ON public.attendance_exports FOR SELECT
USING (get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role,'finance_director'::app_role,'finance_manager'::app_role,'hr_executive'::app_role,'hr_admin'::app_role));

CREATE POLICY "HR can insert attendance exports"
ON public.attendance_exports FOR INSERT
WITH CHECK (get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role,'hr_executive'::app_role,'hr_admin'::app_role,'finance_director'::app_role));

CREATE POLICY "HR can delete attendance exports"
ON public.attendance_exports FOR DELETE
USING (get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role,'hr_executive'::app_role,'hr_admin'::app_role));
