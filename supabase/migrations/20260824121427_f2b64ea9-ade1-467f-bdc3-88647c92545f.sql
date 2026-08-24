ALTER TABLE public.statutory_calendar
  ADD COLUMN IF NOT EXISTS due_months integer[],
  ADD COLUMN IF NOT EXISTS last_day_of_month boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_confirmation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.statutory_calendar TO authenticated;
GRANT ALL ON public.statutory_calendar TO service_role;

DROP POLICY IF EXISTS "Leadership read statutory" ON public.statutory_calendar;
CREATE POLICY "Leadership read statutory" ON public.statutory_calendar
FOR SELECT TO authenticated
USING (
  public.is_md(auth.uid()) OR public.is_full_admin(auth.uid()) OR public.is_director(auth.uid())
  OR public.user_has_any_role(auth.uid(), ARRAY['finance_manager'::app_role,'accounts_executive'::app_role,'hr_executive'::app_role,'hr_admin'::app_role])
);

DROP POLICY IF EXISTS "MD manages statutory" ON public.statutory_calendar;
CREATE POLICY "Finance leadership manages statutory" ON public.statutory_calendar
FOR ALL TO authenticated
USING (
  public.is_md(auth.uid()) OR public.is_full_admin(auth.uid())
  OR public.user_has_any_role(auth.uid(), ARRAY['finance_director'::app_role,'finance_manager'::app_role,'accounts_executive'::app_role])
)
WITH CHECK (
  public.is_md(auth.uid()) OR public.is_full_admin(auth.uid())
  OR public.user_has_any_role(auth.uid(), ARRAY['finance_director'::app_role,'finance_manager'::app_role,'accounts_executive'::app_role])
);

-- Reset and seed the correct calendar
DELETE FROM public.statutory_calendar;

INSERT INTO public.statutory_calendar (filing_name, due_day, due_month, due_months, last_day_of_month, recurrence, applies_to, notes, active, needs_confirmation) VALUES
('TDS Monthly Payment', 7, NULL, NULL, false, 'monthly', 'Finance', 'TDS payment due on the 7th of every month', true, false),
('TDS Quarterly Return - Q1 (Apr-Jun)', NULL, 7, NULL, true, 'annual', 'Finance', 'Due last day of the month following quarter end (31 Jul)', true, false),
('TDS Quarterly Return - Q2 (Jul-Sep)', NULL, 10, NULL, true, 'annual', 'Finance', 'Due last day of the month following quarter end (31 Oct)', true, false),
('TDS Quarterly Return - Q3 (Oct-Dec)', NULL, 1, NULL, true, 'annual', 'Finance', 'Due last day of the month following quarter end (31 Jan)', true, false),
('TDS Quarterly Return - Q4 (Jan-Mar)', NULL, 4, NULL, true, 'annual', 'Finance', 'NEEDS CONFIRMATION: stated rule gives 30 Apr; standard Indian due date for Q4 is 31 May. Inactive until confirmed.', false, true),
('PF Filing and Payment', 15, NULL, NULL, false, 'monthly', 'HR', 'Provident Fund filing and payment due 15th of every month', true, false),
('ESI Filing', 15, NULL, NULL, false, 'monthly', 'HR', 'ESI filing due 15th of every month', true, false),
('PT Filing and Payment', 20, NULL, NULL, false, 'monthly', 'HR', 'Professional Tax filing and payment due 20th of every month', true, false),
('PT Annual Return', 30, 4, NULL, false, 'annual', 'HR', 'Professional Tax annual return due 30 April', true, false),
('MSME Half-Yearly Return', 30, NULL, ARRAY[4,10], false, 'multi_annual', 'Finance', 'MSME (MSME-1) filing due 30 April and 30 October every year', true, false),
('GSTR 9 / 9C Annual Return', 31, 12, NULL, false, 'annual', 'Finance', 'GST annual return and reconciliation due 31 December', true, false);

COMMENT ON TABLE public.statutory_calendar IS 'Single source of truth for recurring statutory filing due dates. finance_statutory only records filing status per generated occurrence.';