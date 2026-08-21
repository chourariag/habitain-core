
CREATE OR REPLACE FUNCTION public.is_variation_approver(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_user_role(_uid) = ANY (ARRAY['super_admin','managing_director','finance_director',
    'finance_manager','sales_director','architecture_director','head_operations','principal_architect']::app_role[]);
$$;

CREATE OR REPLACE FUNCTION public.guard_variation_self_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_variation_approver(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Initiator (non-approver) path: draft/pending rows only, no approval fields, no status change
  IF coalesce(OLD.status,'Draft') NOT IN ('Draft','Pending') THEN
    RAISE EXCEPTION 'Only an approver can modify a variation once it has left Draft/Pending';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only an approver can change the status of a variation';
  END IF;
  IF NEW.scope_approved_by IS DISTINCT FROM OLD.scope_approved_by
     OR NEW.scope_approved_at IS DISTINCT FROM OLD.scope_approved_at
     OR NEW.finance_approved_by IS DISTINCT FROM OLD.finance_approved_by
     OR NEW.finance_approved_at IS DISTINCT FROM OLD.finance_approved_at
     OR NEW.md_approved_by IS DISTINCT FROM OLD.md_approved_by
     OR NEW.md_approved_at IS DISTINCT FROM OLD.md_approved_at THEN
    RAISE EXCEPTION 'You cannot approve your own cost variation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_variation_self_approval ON public.project_variations;
CREATE TRIGGER trg_guard_variation_self_approval
  BEFORE UPDATE ON public.project_variations
  FOR EACH ROW EXECUTE FUNCTION public.guard_variation_self_approval();

DROP POLICY IF EXISTS "Approvers can update variations" ON public.project_variations;
CREATE POLICY "Approvers can update variations" ON public.project_variations
  FOR UPDATE TO authenticated
  USING (
    public.is_variation_approver(auth.uid())
    OR (auth.uid() = initiated_by AND coalesce(status,'Draft') IN ('Draft','Pending'))
  )
  WITH CHECK (
    public.is_variation_approver(auth.uid())
    OR (
      auth.uid() = initiated_by
      AND coalesce(status,'Draft') IN ('Draft','Pending')
      AND scope_approved_by IS NULL
      AND finance_approved_by IS NULL
      AND md_approved_by IS NULL
      AND md_approved_at IS NULL
    )
  );
