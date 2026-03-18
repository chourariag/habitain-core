
-- Project Design Files table (one per project)
CREATE TABLE public.project_design_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_brief_url TEXT,
  site_area_sqft NUMERIC,
  num_floors INTEGER,
  special_requirements TEXT,
  site_visit_done BOOLEAN NOT NULL DEFAULT false,
  measurements_confirmed BOOLEAN NOT NULL DEFAULT false,
  survey_report_uploaded BOOLEAN NOT NULL DEFAULT false,
  client_requirements_documented BOOLEAN NOT NULL DEFAULT false,
  budget_discussed BOOLEAN NOT NULL DEFAULT false,
  design_stage TEXT NOT NULL DEFAULT 'brief',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

ALTER TABLE public.project_design_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view project_design_files" ON public.project_design_files
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Architects can insert project_design_files" ON public.project_design_files
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY(ARRAY['principal_architect','project_architect','super_admin','managing_director']::app_role[]));

CREATE POLICY "Architects can update project_design_files" ON public.project_design_files
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = ANY(ARRAY['principal_architect','project_architect','super_admin','managing_director']::app_role[]));

-- Design Stages table (5 stages per project)
CREATE TABLE public.design_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  stage_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  drawing_urls TEXT[] NOT NULL DEFAULT '{}',
  approval_date DATE,
  approval_method TEXT,
  approval_proof_url TEXT,
  revision_comments TEXT,
  revision_changes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.design_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view design_stages" ON public.design_stages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Architects can insert design_stages" ON public.design_stages
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY(ARRAY['principal_architect','project_architect','super_admin','managing_director']::app_role[]));

CREATE POLICY "Architects can update design_stages" ON public.design_stages
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = ANY(ARRAY['principal_architect','project_architect','super_admin','managing_director']::app_role[]));

-- Design Consultants table
CREATE TABLE public.design_consultants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  consultant_type TEXT NOT NULL DEFAULT 'Other',
  name TEXT NOT NULL,
  firm TEXT,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'awaiting_brief',
  drawings_uploaded BOOLEAN NOT NULL DEFAULT false,
  review_complete BOOLEAN NOT NULL DEFAULT false,
  revisions_text TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  brief_issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.design_consultants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view design_consultants" ON public.design_consultants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Architects can manage design_consultants" ON public.design_consultants
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = ANY(ARRAY['principal_architect','project_architect','super_admin','managing_director']::app_role[]));

-- Add urgency and query_type columns to design_queries
ALTER TABLE public.design_queries ADD COLUMN IF NOT EXISTS urgency TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE public.design_queries ADD COLUMN IF NOT EXISTS query_type TEXT NOT NULL DEFAULT 'Other';
ALTER TABLE public.design_queries ADD COLUMN IF NOT EXISTS affected_area TEXT;

-- Storage bucket for client briefs
INSERT INTO storage.buckets (id, name, public) VALUES ('design-files', 'design-files', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload design-files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'design-files');

CREATE POLICY "Public can read design-files" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'design-files');
