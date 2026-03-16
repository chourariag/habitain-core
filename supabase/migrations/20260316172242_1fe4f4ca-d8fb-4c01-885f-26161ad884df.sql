-- Fix permissive INSERT policies

-- Dispute log: only the worker or supervisor can insert
DROP POLICY "Insert disputes" ON public.dispute_log;
CREATE POLICY "Insert disputes" ON public.dispute_log FOR INSERT TO authenticated
  WITH CHECK (worker_id = auth.uid() OR public.get_user_role(auth.uid()) IN (
    'factory_floor_supervisor', 'production_head', 'head_operations'
  ));

-- Notifications: restrict insert to management roles and system
DROP POLICY "System can create notifications" ON public.notifications;
CREATE POLICY "Insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN (
    'finance_director', 'sales_director', 'architecture_director',
    'head_operations', 'production_head', 'finance_manager',
    'factory_floor_supervisor', 'qc_inspector', 'hr_executive',
    'planning_engineer', 'costing_engineer', 'procurement'
  ));

-- Audit log: only directors and management can insert
DROP POLICY "System can insert audit log" ON public.admin_audit_log;
CREATE POLICY "Insert audit log" ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_director(auth.uid()) OR public.get_user_role(auth.uid()) IN (
    'head_operations', 'production_head', 'finance_manager', 'hr_executive'
  ));