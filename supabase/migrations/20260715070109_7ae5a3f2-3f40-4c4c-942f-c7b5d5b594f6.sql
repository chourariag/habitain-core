
-- W) Scope signoff finalize (order-independent)
CREATE OR REPLACE FUNCTION public.trg_scope_signoff_finalize()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.client_signed_at IS NOT NULL
     AND NEW.sales_director_signed_at IS NOT NULL
     AND COALESCE(NEW.status,'') <> 'signed' THEN
    NEW.status := 'signed';
    NEW.locked := true;
    INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
    SELECT p.auth_user_id, 'info', 'scope',
           'Scope of Work signed — generate PDF',
           'Both parties have signed. Open the Scope tab to auto-generate and store the signed PDF.',
           'Both parties have signed. Open the Scope tab to auto-generate and store the signed PDF.',
           '/projects/' || NEW.project_id || '?tab=scope', 'normal'
      FROM public.profiles p
     WHERE p.is_active = true
       AND p.role IN ('sales_director','planning_head','head_operations','managing_director','super_admin')
       AND NEW.scope_pdf_url IS NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_scope_signoff_finalize ON public.project_scope_of_work;
CREATE TRIGGER trg_scope_signoff_finalize
  BEFORE UPDATE ON public.project_scope_of_work
  FOR EACH ROW EXECUTE FUNCTION public.trg_scope_signoff_finalize();

-- L+H3) Module stage gate
CREATE OR REPLACE FUNCTION public.required_gfc_for_stage(_stage text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _stage IS NULL THEN NULL
    WHEN lower(_stage) ~ 'joinery|carpent|paint|interior|tiling|cladding|habit\s*board|sanitary fixture|finishing|finish' THEN 'H3'
    WHEN lower(_stage) ~ 'mep|electrical|plumb|hvac|sanitary|pressure\s*test|second\s*fix|rough[-\s]?in' THEN 'H2'
    WHEN lower(_stage) ~ 'sub[-\s]?frame|frame\s*fab|frame\s*assembly|deck|anti[-\s]?corros|lgsf|moisture|cera\s*board|insulation|drywall' THEN 'H1'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.trg_modules_stage_gate_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  need text; gfc_stage_needed text; gfc_ok boolean; setup_ok boolean;
BEGIN
  IF NEW.current_stage IS NULL
     OR (TG_OP='UPDATE' AND NEW.current_stage IS NOT DISTINCT FROM OLD.current_stage) THEN
    RETURN NEW;
  END IF;
  need := public.required_gfc_for_stage(NEW.current_stage);
  IF need IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(project_setup_approved, false) INTO setup_ok
    FROM public.projects WHERE id = NEW.project_id;
  IF NOT COALESCE(setup_ok, false) THEN
    RAISE EXCEPTION 'Stage-gate: Project Setup not approved (blocked module stage transition to %)', NEW.current_stage;
  END IF;

  gfc_stage_needed := CASE need
    WHEN 'H1' THEN 'advance_h1'
    WHEN 'H2' THEN 'final_h2'
    WHEN 'H3' THEN 'interior_h3'
  END;
  SELECT EXISTS (
    SELECT 1 FROM public.gfc_records
     WHERE project_id = NEW.project_id
       AND gfc_stage = gfc_stage_needed
       AND status = 'approved'
  ) INTO gfc_ok;
  IF NOT gfc_ok THEN
    RAISE EXCEPTION 'Stage-gate: GFC % not approved — cannot advance module to stage "%"', need, NEW.current_stage;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_modules_stage_gate_guard ON public.modules;
CREATE TRIGGER trg_modules_stage_gate_guard
  BEFORE INSERT OR UPDATE OF current_stage ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.trg_modules_stage_gate_guard();

-- D) GFC drawings visibility
DROP POLICY IF EXISTS "Authenticated can view drawings" ON public.drawings;
CREATE POLICY "Authenticated can view drawings"
ON public.drawings FOR SELECT TO authenticated
USING (
  (
    COALESCE(drawing_type,'') NOT ILIKE 'gfc%'
    AND NOT ('gfc' = ANY(COALESCE(category_tags, ARRAY[]::text[])))
    AND NOT ('GFC' = ANY(COALESCE(category_tags, ARRAY[]::text[])))
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
     WHERE p.id = drawings.project_id
       AND COALESCE(p.project_setup_approved, false) = true
  )
  OR public.is_director(auth.uid())
  OR public.user_has_any_role(auth.uid(),
       ARRAY['principal_architect','project_architect','structural_architect','planning_head','head_operations']::app_role[])
);

DROP POLICY IF EXISTS "Authenticated users can view GFC records" ON public.gfc_records;
CREATE POLICY "GFC records visible after project setup approved"
ON public.gfc_records FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
     WHERE p.id = gfc_records.project_id
       AND COALESCE(p.project_setup_approved, false) = true
  )
  OR public.is_director(auth.uid())
  OR public.user_has_any_role(auth.uid(),
       ARRAY['principal_architect','project_architect','structural_architect','planning_head','head_operations']::app_role[])
);

-- P) Handover pack INSERT tightened
DROP POLICY IF EXISTS "Authenticated users can insert handover_pack" ON public.handover_pack;
CREATE POLICY "Only head_of_projects can initiate handover_pack"
ON public.handover_pack FOR INSERT TO authenticated
WITH CHECK (
  public.user_has_any_role(auth.uid(),
    ARRAY['head_of_projects','super_admin','managing_director']::app_role[])
);

-- T) Wire 5 remaining billing-milestone triggers
CREATE OR REPLACE FUNCTION public.trg_site_readiness_fire_billing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid;
BEGIN
  IF COALESCE(NEW.is_complete, false) = true
     AND COALESCE(OLD.is_complete, false) = false THEN
    SELECT project_id INTO _pid FROM public.modules WHERE id = NEW.module_id;
    IF _pid IS NOT NULL THEN
      PERFORM public.fire_billing_milestone_event(_pid, 'site_readiness_confirmed', 'Site readiness confirmed');
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_site_readiness_fire_billing ON public.site_readiness;
CREATE TRIGGER trg_site_readiness_fire_billing
  AFTER INSERT OR UPDATE ON public.site_readiness
  FOR EACH ROW EXECUTE FUNCTION public.trg_site_readiness_fire_billing();

CREATE OR REPLACE FUNCTION public.trg_dispatch_fire_billing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND COALESCE(NEW.status,'') IN ('dispatched','confirmed'))
     OR (TG_OP = 'UPDATE'
         AND COALESCE(NEW.status,'') IN ('dispatched','confirmed')
         AND COALESCE(OLD.status,'') NOT IN ('dispatched','confirmed')) THEN
    IF NEW.project_id IS NOT NULL THEN
      PERFORM public.fire_billing_milestone_event(NEW.project_id, 'dispatch_confirmed', 'Dispatch confirmed');
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_dispatch_packs_fire_billing ON public.dispatch_packs;
CREATE TRIGGER trg_dispatch_packs_fire_billing
  AFTER INSERT OR UPDATE ON public.dispatch_packs
  FOR EACH ROW EXECUTE FUNCTION public.trg_dispatch_fire_billing();

CREATE OR REPLACE FUNCTION public.trg_installation_fire_billing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid;
BEGIN
  SELECT project_id INTO _pid FROM public.modules WHERE id = NEW.module_id;
  IF _pid IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.is_complete, false) = true
     AND COALESCE(OLD.is_complete, false) = false THEN
    PERFORM public.fire_billing_milestone_event(_pid, 'installation_complete', 'Installation complete');
  END IF;
  IF COALESCE(NEW.mep_stitching, false) = true
     AND COALESCE(OLD.mep_stitching, false) = false THEN
    PERFORM public.fire_billing_milestone_event(_pid, 'mep_complete', 'MEP complete');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_installation_checklist_fire_billing ON public.installation_checklist;
CREATE TRIGGER trg_installation_checklist_fire_billing
  AFTER INSERT OR UPDATE ON public.installation_checklist
  FOR EACH ROW EXECUTE FUNCTION public.trg_installation_fire_billing();

CREATE OR REPLACE FUNCTION public.trg_snagging_fire_billing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _open int;
BEGIN
  IF NEW.status = 'closed' AND COALESCE(OLD.status,'') <> 'closed' AND NEW.project_id IS NOT NULL THEN
    SELECT count(*) INTO _open FROM public.punch_list_items
     WHERE project_id = NEW.project_id AND status <> 'closed';
    IF _open = 0 THEN
      PERFORM public.fire_billing_milestone_event(NEW.project_id, 'snagging_complete', 'Snagging complete');
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_punch_list_items_fire_billing ON public.punch_list_items;
CREATE TRIGGER trg_punch_list_items_fire_billing
  AFTER UPDATE ON public.punch_list_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_snagging_fire_billing();
