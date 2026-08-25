
CREATE OR REPLACE FUNCTION public.is_operations_reader(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _uid AND is_active = true
      AND role IN ('super_admin','managing_director','chairman','director','finance_director','sales_director','architecture_director','principal_architect','head_operations','head_of_projects','production_head','planning_head','planning_engineer','qc_inspector','site_installation_mgr','site_engineer','factory_supervisor','senior_factory_supervisor','factory_floor_supervisor','fabrication_foreman','delivery_rm_lead','logistics_manager','project_architect','operations_architect','structural_architect','senior_architect','quantity_surveyor','costing_engineer','stores_executive','procurement')
  )
$$;

CREATE OR REPLACE FUNCTION public.user_is_project_participant(_uid uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.user_can_access_project(_uid, _project_id)
    OR EXISTS (
      SELECT 1 FROM public.project_tasks t
      JOIN public.profiles p ON p.auth_user_id = _uid AND p.is_active = true
      WHERE t.project_id = _project_id
        AND t.responsible_role IS NOT NULL
        AND t.responsible_role::text = p.role::text
    )
    OR EXISTS (
      SELECT 1 FROM public.project_messages m
      WHERE m.project_id = _project_id AND m.sender_id = _uid
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_operations_reader(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_project_participant(uuid, uuid) TO authenticated;

-- clients_master
DROP POLICY IF EXISTS "Sales and Finance can view clients_master" ON public.clients_master;
CREATE POLICY "Leadership can view clients_master" ON public.clients_master
FOR SELECT TO authenticated
USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'managing_director'::app_role,'chairman'::app_role,'finance_director'::app_role,'sales_director'::app_role]));

-- project_messages
DROP POLICY IF EXISTS "Authenticated can read messages" ON public.project_messages;
CREATE POLICY "Project participants can read messages" ON public.project_messages
FOR SELECT TO authenticated
USING (
  sender_id = auth.uid()
  OR (mentioned_ids IS NOT NULL AND auth.uid() = ANY (mentioned_ids))
  OR public.user_is_project_participant(auth.uid(), project_id)
);

-- installation_sequence_docs
DROP POLICY IF EXISTS "Authenticated users can view installation_sequence_docs" ON public.installation_sequence_docs;
CREATE POLICY "Operations can view installation_sequence_docs" ON public.installation_sequence_docs
FOR SELECT TO authenticated USING (public.is_operations_reader(auth.uid()));

-- ncr_register
DROP POLICY IF EXISTS "View NCRs" ON public.ncr_register;
CREATE POLICY "Operations can view NCRs" ON public.ncr_register
FOR SELECT TO authenticated USING (public.is_operations_reader(auth.uid()));

-- qc_inspections / items
DROP POLICY IF EXISTS "View inspections" ON public.qc_inspections;
CREATE POLICY "Operations can view inspections" ON public.qc_inspections
FOR SELECT TO authenticated USING (public.is_operations_reader(auth.uid()));

DROP POLICY IF EXISTS "View inspection items" ON public.qc_inspection_items;
CREATE POLICY "Operations can view inspection items" ON public.qc_inspection_items
FOR SELECT TO authenticated USING (public.is_operations_reader(auth.uid()));

-- site_factory_feedback
DROP POLICY IF EXISTS "Authenticated users can view site_factory_feedback" ON public.site_factory_feedback;
CREATE POLICY "Operations can view site_factory_feedback" ON public.site_factory_feedback
FOR SELECT TO authenticated USING (public.is_operations_reader(auth.uid()));

-- punch_list_items
DROP POLICY IF EXISTS "Authenticated users can view punch_list_items" ON public.punch_list_items;
CREATE POLICY "Operations can view punch_list_items" ON public.punch_list_items
FOR SELECT TO authenticated USING (public.is_operations_reader(auth.uid()));

-- task_lock_overrides
DROP POLICY IF EXISTS "Authenticated users can view lock overrides" ON public.task_lock_overrides;
CREATE POLICY "Operations can view lock overrides" ON public.task_lock_overrides
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_operations_reader(auth.uid()));

-- labour_approvals
DROP POLICY IF EXISTS "View approvals" ON public.labour_approvals;
CREATE POLICY "Supervisors and finance can view labour approvals" ON public.labour_approvals
FOR SELECT TO authenticated
USING (
  approved_by = auth.uid()
  OR public.user_has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'managing_director'::app_role,'chairman'::app_role,'director'::app_role,'finance_director'::app_role,'sales_director'::app_role,'architecture_director'::app_role,'head_operations'::app_role,'head_of_projects'::app_role,'production_head'::app_role,'planning_head'::app_role,'finance_manager'::app_role,'accounts_executive'::app_role,'quantity_surveyor'::app_role,'site_installation_mgr'::app_role,'site_engineer'::app_role,'factory_supervisor'::app_role,'senior_factory_supervisor'::app_role,'factory_floor_supervisor'::app_role])
);

-- sales_targets
DROP POLICY IF EXISTS "Authenticated users can view sales targets" ON public.sales_targets;
CREATE POLICY "Directors and owners can view sales targets" ON public.sales_targets
FOR SELECT TO authenticated
USING (
  public.is_director(auth.uid())
  OR public.has_role(auth.uid(), 'chairman'::app_role)
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_user_id = auth.uid() AND p.id = sales_targets.salesperson_id)
);

-- sales_win_sync_log
DROP POLICY IF EXISTS "Staff can read win sync log" ON public.sales_win_sync_log;
CREATE POLICY "Sales and leadership can read win sync log" ON public.sales_win_sync_log
FOR SELECT TO authenticated
USING (
  performed_by = auth.uid()
  OR public.user_has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'managing_director'::app_role,'chairman'::app_role,'director'::app_role,'sales_director'::app_role,'finance_director'::app_role,'architecture_director'::app_role,'sales_executive'::app_role,'sales_associate'::app_role,'marketing'::app_role,'planning_head'::app_role,'head_of_projects'::app_role])
);
