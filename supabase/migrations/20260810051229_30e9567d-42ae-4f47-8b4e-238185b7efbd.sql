-- contracts_register: editors cannot amend executed contracts outside an unlock window
DROP POLICY IF EXISTS "Contracts: editors update" ON public.contracts_register;
CREATE POLICY "Contracts: editors update"
ON public.contracts_register
FOR UPDATE
TO authenticated
USING (
  user_has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'managing_director'::app_role, 'finance_director'::app_role, 'sales_director'::app_role, 'architecture_director'::app_role, 'head_operations'::app_role, 'procurement'::app_role, 'planning_head'::app_role, 'sales_executive'::app_role, 'sales_associate'::app_role])
  AND (
    external_execution_date IS NULL
    OR (unlocked_until IS NOT NULL AND unlocked_until > now())
  )
);

-- gfc_records: issued records immutable outside an unlock window
DROP POLICY IF EXISTS "Principal architects and directors can update GFC" ON public.gfc_records;
CREATE POLICY "Principal architects and directors can update GFC"
ON public.gfc_records
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'principal_architect'::app_role) OR is_director(auth.uid()))
  AND (
    issued_at IS NULL
    OR (unlocked_until IS NOT NULL AND unlocked_until > now())
  )
);

-- project_scope_of_work: locked scope immutable outside an unlock window
DROP POLICY IF EXISTS "Architects/planning can update scope" ON public.project_scope_of_work;
CREATE POLICY "Architects/planning can update scope"
ON public.project_scope_of_work
FOR UPDATE
TO authenticated
USING (
  user_has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'managing_director'::app_role, 'chairman'::app_role, 'architecture_director'::app_role, 'sales_director'::app_role, 'principal_architect'::app_role, 'senior_architect'::app_role, 'project_architect'::app_role, 'structural_architect'::app_role, 'operations_architect'::app_role, 'planning_head'::app_role, 'planning_engineer'::app_role, 'head_operations'::app_role])
  AND (
    COALESCE(locked, false) = false
    OR can_unlock_locked_document(auth.uid())
  )
);