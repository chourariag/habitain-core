
-- =========================================
-- DESIGN SCHEDULE: TABLES
-- =========================================

CREATE TABLE IF NOT EXISTS public.design_stage_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_code TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  stage_order INTEGER NOT NULL,
  pipeline_type TEXT NOT NULL CHECK (pipeline_type IN ('habitainer','ads')),
  stage_group TEXT,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  is_production_gate BOOLEAN NOT NULL DEFAULT false,
  is_read_only BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pipeline_type, stage_code)
);

GRANT SELECT ON public.design_stage_definitions TO authenticated;
GRANT ALL ON public.design_stage_definitions TO service_role;
ALTER TABLE public.design_stage_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view stage defs"
  ON public.design_stage_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage stage defs"
  ON public.design_stage_definitions FOR ALL TO authenticated
  USING (public.is_md(auth.uid())) WITH CHECK (public.is_md(auth.uid()));


CREATE TABLE IF NOT EXISTS public.project_design_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_definition_id UUID NOT NULL REFERENCES public.design_stage_definitions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Not Started'
    CHECK (status IN ('Not Started','In Progress','Completed','Blocked','Skipped')),
  planned_date DATE,
  actual_date DATE,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, stage_definition_id)
);

CREATE INDEX IF NOT EXISTS idx_pds_project ON public.project_design_stages(project_id);
CREATE INDEX IF NOT EXISTS idx_pds_status ON public.project_design_stages(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_design_stages TO authenticated;
GRANT ALL ON public.project_design_stages TO service_role;
ALTER TABLE public.project_design_stages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_edit_design_schedule(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN (
        'super_admin','managing_director','finance_director','sales_director',
        'architecture_director','principal_architect','project_architect',
        'planning_head','planning_engineer','head_operations','operations_architect'
      )
  )
$$;

CREATE POLICY "All authenticated view design stages"
  ON public.project_design_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Design leads manage stages"
  ON public.project_design_stages FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_design_schedule(auth.uid()));
CREATE POLICY "Design leads update stages"
  ON public.project_design_stages FOR UPDATE TO authenticated
  USING (public.can_edit_design_schedule(auth.uid()))
  WITH CHECK (public.can_edit_design_schedule(auth.uid()));
CREATE POLICY "Design leads delete stages"
  ON public.project_design_stages FOR DELETE TO authenticated
  USING (public.can_edit_design_schedule(auth.uid()));

CREATE TRIGGER trg_pds_updated_at
  BEFORE UPDATE ON public.project_design_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  enquiry_shared_by TEXT,
  drawings_shared TEXT,
  date_of_release DATE,
  status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending','Released','Won','Lost','On Hold')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated;
GRANT ALL ON public.quotations TO service_role;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated view quotations"
  ON public.quotations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Design leads manage quotations"
  ON public.quotations FOR ALL TO authenticated
  USING (public.can_edit_design_schedule(auth.uid()))
  WITH CHECK (public.can_edit_design_schedule(auth.uid()));

CREATE TRIGGER trg_quotations_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =========================================
-- SEED STAGE DEFINITIONS
-- =========================================

INSERT INTO public.design_stage_definitions
  (stage_code, stage_name, stage_order, pipeline_type, stage_group, is_mandatory, is_production_gate, is_read_only)
VALUES
  -- HABITAINER: Sales
  ('S-1','Sign Up — Design Agreement + Site Visit',101,'habitainer','Sales',true,false,false),
  ('S-2','Requirements and Necessary Drawings',102,'habitainer','Sales',true,false,false),
  ('S-3','Initial Introduction / Client Meeting',103,'habitainer','Sales',true,false,false),
  ('S-4','Handover to Design',104,'habitainer','Sales',true,false,false),
  -- Design Concept
  ('D-1','Design Brief',201,'habitainer','Design Concept',true,false,false),
  ('D-2','Concept Design — 2D + Moodboard',202,'habitainer','Design Concept',true,false,false),
  ('D-3','Schematic Design — 2D + 3D + Tentative Budget',203,'habitainer','Design Concept',true,false,false),
  ('D-4','Detailed Budget / Quotation',204,'habitainer','Design Concept',true,false,false),
  ('D-5','Handover to Sales & Planning',205,'habitainer','Design Concept',true,false,false),
  -- Commercial
  ('C-1','Quotation',301,'habitainer','Commercial',true,false,false),
  ('C-2','Negotiations and Closure',302,'habitainer','Commercial',true,false,false),
  ('C-3','Sale Agreement',303,'habitainer','Commercial',true,false,false),
  ('C-4','Scope of Work Document',304,'habitainer','Commercial',true,false,false),
  -- Technical
  ('T-1','Soil Test — Drawing and Quotation',401,'habitainer','Technical',false,false,false),
  ('T-2','Engagement of Structural Engineer',402,'habitainer','Technical',true,false,false),
  ('T-3','Engagement of MEP Consultant',403,'habitainer','Technical',false,false,false),
  -- Design Execution
  ('E-1','Preliminary Design Sign-off — S1 and H1',501,'habitainer','Design Execution',true,false,false),
  ('E-2','Preliminary Design Sign-off — S2 and H2',502,'habitainer','Design Execution',true,false,false),
  ('E-3','S1 (Structural Drawing Set 1)',503,'habitainer','Design Execution',true,false,false),
  ('E-4','S2 (Structural Drawing Set 2)',504,'habitainer','Design Execution',true,false,false),
  ('E-5','H1 (Advance GFC — Architectural/Structural)',505,'habitainer','Design Execution',true,false,false),
  ('E-6','H2 (Final GFC — MEP/Complete)',506,'habitainer','Design Execution',true,false,false),
  ('E-7','H3 (Final GFC — Finishing)',507,'habitainer','Design Execution',true,false,false),
  ('E-8','GFC Budget',508,'habitainer','Design Execution',true,false,false),
  ('E-9','Variation (if any)',509,'habitainer','Design Execution',false,false,false),
  -- Handover to Planning (PRODUCTION GATE)
  ('P-1','Handover to Planning',601,'habitainer','Handover',true,true,false),
  -- Planning
  ('P-2','Contracts (Clients + Contractor)',602,'habitainer','Planning',true,false,false),
  ('P-3','GFC BOQ',603,'habitainer','Planning',true,false,false),
  ('P-4','Execution Plan',604,'habitainer','Planning',true,false,false),
  ('P-5','Material Plan',605,'habitainer','Planning',true,false,false),
  ('P-6','Procurement',606,'habitainer','Planning',true,false,false),
  -- Production (read-only)
  ('PR-1','Main Frame',701,'habitainer','Production',true,false,true),
  ('PR-2','Shell and Core',702,'habitainer','Production',true,false,true),
  ('PR-3','Builder Finish',703,'habitainer','Production',true,false,true),
  ('PR-4','Foundations',704,'habitainer','Production',true,false,true),
  ('PR-5','Delivery',705,'habitainer','Production',true,false,true),
  ('PR-6','Onsite Works',706,'habitainer','Production',true,false,true),
  ('PR-7','Handover',707,'habitainer','Production',true,false,true),

  -- ADS pipeline
  ('A-1','Sign Up — Design Agreement + Site Visit',1,'ads','Sales',true,false,false),
  ('A-2','Initial Introduction / Client Meeting',2,'ads','Sales',true,false,false),
  ('A-3','Design Brief',3,'ads','Design',true,false,false),
  ('A-4','Concept Design — 2D + Moodboard',4,'ads','Design',true,false,false),
  ('A-5','Schematic Design — 2D + 3D + Tentative Budget',5,'ads','Design',true,false,false),
  ('A-6','Detailed Budget / Quotation',6,'ads','Design',true,false,false),
  ('A-7','Tender Document',7,'ads','Commercial',true,false,false),
  ('A-8','Appointment of Structural Consultant',8,'ads','Technical',true,false,false),
  ('A-9','Appointment of MEP Consultant',9,'ads','Technical',false,false,false),
  ('A-10','Schematic Design Report — Detailed Architectural Drawings',10,'ads','Design Execution',true,false,false),
  ('A-11','GFC Drawings — Architecture',11,'ads','Design Execution',true,false,false),
  ('A-12','GFC Drawings — Structural',12,'ads','Design Execution',true,false,false),
  ('A-13','GFC Drawings — MEP',13,'ads','Design Execution',true,false,false),
  ('A-14','Site and Coordination Works',14,'ads','Execution',true,false,false)
ON CONFLICT (pipeline_type, stage_code) DO NOTHING;


-- =========================================
-- SEED PROJECT STAGES for existing projects
-- =========================================
-- Use project.type ILIKE 'ads%' to detect ADS projects; otherwise habitainer.

INSERT INTO public.project_design_stages (project_id, stage_definition_id, status)
SELECT p.id, d.id, 'Not Started'
FROM public.projects p
JOIN public.design_stage_definitions d
  ON d.pipeline_type = CASE
        WHEN LOWER(COALESCE(p.type,'')) LIKE 'ads%' THEN 'ads'
        ELSE 'habitainer'
     END
WHERE COALESCE(p.is_archived,false) = false
ON CONFLICT (project_id, stage_definition_id) DO NOTHING;
