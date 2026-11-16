-- Site Readiness redesign: detailed Foundation checks, tolerances, crane booking, crane cost, change log, Foundation escalation.

CREATE TABLE public.site_readiness_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  section text NOT NULL,
  item_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok','not_ok','na')),
  value_numeric numeric,
  value_text text,
  comment text,
  photo_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  checked_by uuid DEFAULT auth.uid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, item_key)
);

CREATE TABLE public.site_readiness_tolerances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id),
  allowed_level_diff_mm numeric NOT NULL CHECK (allowed_level_diff_mm >= 0),
  allowed_diagonal_diff_mm numeric NOT NULL CHECK (allowed_diagonal_diff_mm >= 0),
  allowed_spacing_dev_mm numeric NOT NULL CHECK (allowed_spacing_dev_mm >= 0),
  set_by uuid DEFAULT auth.uid(),
  set_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.site_readiness_crane (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id),
  vendor_name text,
  vendor_contact_phone text,
  operator_name text,
  operator_phone text,
  capacity_tonnes numeric CHECK (capacity_tonnes IS NULL OR capacity_tonnes > 0),
  booked_for_date date,
  slot_hours numeric CHECK (slot_hours IS NULL OR slot_hours > 0),
  operator_site_visit_done boolean NOT NULL DEFAULT false,
  operator_visit_date date,
  comment text,
  photo_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.site_readiness_crane_cost (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id),
  rate_inr numeric CHECK (rate_inr IS NULL OR rate_inr >= 0),
  rate_basis text,
  total_cost_inr numeric CHECK (total_cost_inr IS NULL OR total_cost_inr >= 0),
  advance_paid_inr numeric CHECK (advance_paid_inr IS NULL OR advance_paid_inr >= 0),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.site_readiness_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  source_table text NOT NULL,
  item_key text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_srcl_project ON public.site_readiness_change_log(project_id, changed_at DESC);

CREATE TABLE public.site_readiness_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  escalation_date date NOT NULL,
  recipient_ids uuid[] NOT NULL DEFAULT '{}',
  item_keys text[] NOT NULL DEFAULT '{}',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, escalation_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_readiness_checks, public.site_readiness_tolerances, public.site_readiness_crane, public.site_readiness_crane_cost TO authenticated;
GRANT SELECT ON public.site_readiness_change_log, public.site_readiness_escalations TO authenticated;
GRANT ALL ON public.site_readiness_checks, public.site_readiness_tolerances, public.site_readiness_crane, public.site_readiness_crane_cost, public.site_readiness_change_log, public.site_readiness_escalations TO service_role;

ALTER TABLE public.site_readiness_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_readiness_tolerances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_readiness_crane ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_readiness_crane_cost ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_readiness_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_readiness_escalations ENABLE ROW LEVEL SECURITY;

-- Helpers mirroring the site_readiness policies exactly.
CREATE OR REPLACE FUNCTION public.can_read_site_readiness(_uid uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_tier1_or_super(_uid)
    OR public.user_has_any_role(_uid, '{planning_head,planning_engineer,head_of_projects,production_head,head_operations,senior_factory_supervisor,factory_floor_supervisor,fabrication_foreman,site_engineer,site_installation_mgr,delivery_rm_lead}'::app_role[])
    OR public.user_can_access_project(_uid, _project_id)
$$;
CREATE OR REPLACE FUNCTION public.can_write_site_readiness(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_has_any_role(_uid, ARRAY['super_admin','managing_director','head_operations','site_installation_mgr','site_engineer','planning_engineer','delivery_rm_lead','finance_director','sales_director','architecture_director']::app_role[])
$$;
CREATE OR REPLACE FUNCTION public.can_delete_site_readiness(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (public.get_user_role(_uid))::text = ANY (ARRAY['super_admin','managing_director','head_operations','finance_director','sales_director','architecture_director'])
$$;
CREATE OR REPLACE FUNCTION public.can_read_crane_cost(_uid uuid, _entered_by uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_tier1_or_super(_uid)
    OR public.user_has_any_role(_uid, '{finance_manager,head_of_projects,planning_head}'::app_role[])
    OR (_entered_by IS NOT NULL AND _entered_by = _uid)
$$;
GRANT EXECUTE ON FUNCTION public.can_read_site_readiness(uuid, uuid), public.can_write_site_readiness(uuid), public.can_delete_site_readiness(uuid), public.can_read_crane_cost(uuid, uuid) TO authenticated;

CREATE POLICY "Site readiness readers view checks" ON public.site_readiness_checks FOR SELECT TO authenticated USING (public.can_read_site_readiness(auth.uid(), project_id));
CREATE POLICY "Site readiness writers insert checks" ON public.site_readiness_checks FOR INSERT TO authenticated WITH CHECK (public.can_write_site_readiness(auth.uid()));
CREATE POLICY "Site readiness writers update checks" ON public.site_readiness_checks FOR UPDATE TO authenticated USING (public.can_write_site_readiness(auth.uid())) WITH CHECK (public.can_write_site_readiness(auth.uid()));
CREATE POLICY "Operations delete checks" ON public.site_readiness_checks FOR DELETE TO authenticated USING (public.can_delete_site_readiness(auth.uid()));

CREATE POLICY "Site readiness readers view tolerances" ON public.site_readiness_tolerances FOR SELECT TO authenticated USING (public.can_read_site_readiness(auth.uid(), project_id));
CREATE POLICY "Site readiness writers insert tolerances" ON public.site_readiness_tolerances FOR INSERT TO authenticated WITH CHECK (public.can_write_site_readiness(auth.uid()));
CREATE POLICY "Site readiness writers update tolerances" ON public.site_readiness_tolerances FOR UPDATE TO authenticated USING (public.can_write_site_readiness(auth.uid())) WITH CHECK (public.can_write_site_readiness(auth.uid()));
CREATE POLICY "Operations delete tolerances" ON public.site_readiness_tolerances FOR DELETE TO authenticated USING (public.can_delete_site_readiness(auth.uid()));

CREATE POLICY "Site readiness readers view crane" ON public.site_readiness_crane FOR SELECT TO authenticated USING (public.can_read_site_readiness(auth.uid(), project_id));
CREATE POLICY "Site readiness writers insert crane" ON public.site_readiness_crane FOR INSERT TO authenticated WITH CHECK (public.can_write_site_readiness(auth.uid()));
CREATE POLICY "Site readiness writers update crane" ON public.site_readiness_crane FOR UPDATE TO authenticated USING (public.can_write_site_readiness(auth.uid())) WITH CHECK (public.can_write_site_readiness(auth.uid()));
CREATE POLICY "Operations delete crane" ON public.site_readiness_crane FOR DELETE TO authenticated USING (public.can_delete_site_readiness(auth.uid()));

CREATE POLICY "Cost readers view crane cost" ON public.site_readiness_crane_cost FOR SELECT TO authenticated USING (public.can_read_crane_cost(auth.uid(), created_by));
CREATE POLICY "Site readiness writers insert crane cost" ON public.site_readiness_crane_cost FOR INSERT TO authenticated WITH CHECK (public.can_write_site_readiness(auth.uid()));
CREATE POLICY "Site readiness writers update crane cost" ON public.site_readiness_crane_cost FOR UPDATE TO authenticated USING (public.can_write_site_readiness(auth.uid())) WITH CHECK (public.can_write_site_readiness(auth.uid()));

CREATE POLICY "Readers view readiness change log" ON public.site_readiness_change_log FOR SELECT TO authenticated
  USING (public.can_read_site_readiness(auth.uid(), project_id)
    AND (source_table <> 'site_readiness_crane_cost' OR public.can_read_crane_cost(auth.uid(), NULL)));
CREATE POLICY "Readers view readiness escalations" ON public.site_readiness_escalations FOR SELECT TO authenticated
  USING (public.can_read_site_readiness(auth.uid(), project_id));

CREATE OR REPLACE FUNCTION public.site_readiness_stamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'site_readiness_checks' THEN
    NEW.checked_by := auth.uid(); NEW.checked_at := now();
    IF TG_OP = 'UPDATE' THEN NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at; END IF;
  ELSIF TG_TABLE_NAME = 'site_readiness_tolerances' THEN
    NEW.set_by := auth.uid(); NEW.set_at := now();
  ELSE
    NEW.updated_by := auth.uid(); NEW.updated_at := now();
    IF TG_OP = 'UPDATE' THEN NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
    ELSE NEW.created_by := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.site_readiness_validate_check()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE t public.site_readiness_tolerances; lim numeric; tol_col text;
BEGIN
  tol_col := CASE NEW.item_key
    WHEN 'B1' THEN 'level' WHEN 'A5' THEN 'diagonal' WHEN 'A6' THEN 'diagonal'
    WHEN 'A4' THEN 'spacing' WHEN 'C2' THEN 'spacing' ELSE NULL END;
  IF NEW.section = 'foundation' AND tol_col IS NOT NULL THEN
    SELECT * INTO t FROM public.site_readiness_tolerances WHERE project_id = NEW.project_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Enter the allowed tolerances from the GFC drawing before saving measured items.'; END IF;
    lim := CASE tol_col WHEN 'level' THEN t.allowed_level_diff_mm WHEN 'diagonal' THEN t.allowed_diagonal_diff_mm ELSE t.allowed_spacing_dev_mm END;
    IF NEW.value_numeric IS NOT NULL AND abs(NEW.value_numeric) > lim THEN NEW.status := 'not_ok'; END IF;
  END IF;
  IF NEW.section = 'foundation' AND NEW.item_key = 'A3' AND NEW.value_numeric IS NOT NULL
     AND NEW.value_text ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' AND NEW.value_numeric <> trim(NEW.value_text)::numeric THEN
    NEW.status := 'not_ok';
  END IF;
  IF NEW.status = 'not_ok' AND coalesce(btrim(NEW.comment), '') = '' THEN
    RAISE EXCEPTION 'A Not ok item needs a comment.';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.site_readiness_log_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o jsonb; n jsonb; k text; pid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN o := NULL; ELSE o := to_jsonb(OLD); END IF;
  IF TG_OP = 'DELETE' THEN n := NULL; ELSE n := to_jsonb(NEW); END IF;
  pid := coalesce((n->>'project_id')::uuid, (o->>'project_id')::uuid);
  IF TG_TABLE_NAME = 'site_readiness_checks' THEN k := coalesce(n->>'item_key', o->>'item_key'); ELSE k := TG_TABLE_NAME; END IF;
  INSERT INTO public.site_readiness_change_log(project_id, source_table, item_key, old_value, new_value, changed_by)
  VALUES (pid, TG_TABLE_NAME, k, o, n, auth.uid());
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_srchk_validate BEFORE INSERT OR UPDATE ON public.site_readiness_checks FOR EACH ROW EXECUTE FUNCTION public.site_readiness_validate_check();
CREATE TRIGGER trg_srchk_stamp BEFORE INSERT OR UPDATE ON public.site_readiness_checks FOR EACH ROW EXECUTE FUNCTION public.site_readiness_stamp();
CREATE TRIGGER trg_srtol_stamp BEFORE INSERT OR UPDATE ON public.site_readiness_tolerances FOR EACH ROW EXECUTE FUNCTION public.site_readiness_stamp();
CREATE TRIGGER trg_srcrane_stamp BEFORE INSERT OR UPDATE ON public.site_readiness_crane FOR EACH ROW EXECUTE FUNCTION public.site_readiness_stamp();
CREATE TRIGGER trg_srcost_stamp BEFORE INSERT OR UPDATE ON public.site_readiness_crane_cost FOR EACH ROW EXECUTE FUNCTION public.site_readiness_stamp();
CREATE TRIGGER trg_srchk_log AFTER INSERT OR UPDATE OR DELETE ON public.site_readiness_checks FOR EACH ROW EXECUTE FUNCTION public.site_readiness_log_change();
CREATE TRIGGER trg_srtol_log AFTER INSERT OR UPDATE OR DELETE ON public.site_readiness_tolerances FOR EACH ROW EXECUTE FUNCTION public.site_readiness_log_change();
CREATE TRIGGER trg_srcrane_log AFTER INSERT OR UPDATE OR DELETE ON public.site_readiness_crane FOR EACH ROW EXECUTE FUNCTION public.site_readiness_log_change();
CREATE TRIGGER trg_srcost_log AFTER INSERT OR UPDATE OR DELETE ON public.site_readiness_crane_cost FOR EACH ROW EXECUTE FUNCTION public.site_readiness_log_change();

CREATE OR REPLACE FUNCTION public.escalate_foundation_issues(p_project_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d date := (now() AT TIME ZONE 'Asia/Kolkata')::date; keys text[]; recips uuid[]; pname text; esc_id uuid;
BEGIN
  IF NOT public.can_write_site_readiness(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT array_agg(item_key ORDER BY item_key) INTO keys FROM public.site_readiness_checks
   WHERE project_id = p_project_id AND section = 'foundation' AND status = 'not_ok';
  IF keys IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.site_readiness_escalations(project_id, escalation_date, item_keys)
  VALUES (p_project_id, d, keys) ON CONFLICT (project_id, escalation_date) DO NOTHING RETURNING id INTO esc_id;
  IF esc_id IS NULL THEN RETURN 0; END IF;
  SELECT array_agg(DISTINCT p.auth_user_id) INTO recips FROM public.project_team_members m
    JOIN public.profiles p ON p.id = m.profile_id
   WHERE m.project_id = p_project_id AND m.role::text = 'head_of_projects' AND coalesce(m.is_active, true) AND p.is_active AND p.auth_user_id IS NOT NULL;
  IF recips IS NULL THEN
    SELECT array_agg(DISTINCT p.auth_user_id) INTO recips FROM public.profiles p
     WHERE p.role::text = 'head_of_projects' AND p.is_active AND p.auth_user_id IS NOT NULL;
  END IF;
  UPDATE public.site_readiness_escalations SET recipient_ids = coalesce(recips, '{}') WHERE id = esc_id;
  IF recips IS NULL THEN RETURN 0; END IF;
  SELECT name INTO pname FROM public.projects WHERE id = p_project_id;
  INSERT INTO public.notifications(recipient_id, title, body, category, type, content, related_table, related_id, linked_entity_type, linked_entity_id, navigate_to, priority)
  SELECT r, 'Foundation not ready', format('%s: %s Foundation item(s) Not ok or out of tolerance (%s). Check Site Readiness.', coalesce(pname,'Project'), array_length(keys,1), array_to_string(keys, ', ')),
         'Site', 'Site', format('%s: Foundation items Not ok (%s).', coalesce(pname,'Project'), array_to_string(keys, ', ')),
         'projects', p_project_id, 'projects', p_project_id, '/site-hub?tab=site-readiness', 'high'
    FROM unnest(recips) r;
  RETURN array_length(recips, 1);
END $$;
REVOKE ALL ON FUNCTION public.escalate_foundation_issues(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.escalate_foundation_issues(uuid) TO authenticated;