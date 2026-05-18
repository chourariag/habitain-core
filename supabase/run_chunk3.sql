-- === 20260317164228_fb9f67b0-2549-4683-8919-489a87365a10.sql ===

-- Enable realtime for modules and production_stages
ALTER PUBLICATION supabase_realtime ADD TABLE public.modules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_stages;

-- === 20260318141519_fa2f4a80-f720-4b45-bb99-fd0f18458082.sql ===

ALTER TABLE public.site_readiness
  ADD COLUMN IF NOT EXISTS dry_run_video_url text,
  ADD COLUMN IF NOT EXISTS labour_stay boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS labour_stay_notes text,
  ADD COLUMN IF NOT EXISTS labour_food boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS labour_food_notes text,
  ADD COLUMN IF NOT EXISTS dg_generator boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dg_generator_notes text,
  ADD COLUMN IF NOT EXISTS nearest_hardware_shop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shop_name text,
  ADD COLUMN IF NOT EXISTS shop_address text,
  ADD COLUMN IF NOT EXISTS shop_phone text,
  ADD COLUMN IF NOT EXISTS supervisor_stay boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supervisor_stay_notes text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('dry-run-videos', 'dry-run-videos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload dry-run-videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'dry-run-videos');

CREATE POLICY "Public can view dry-run-videos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'dry-run-videos');

-- === 20260318143724_2eff4a53-6b16-4a5b-9998-52dd9838bf4e.sql ===
-- Add project_id to site_readiness
ALTER TABLE public.site_readiness ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);

-- Add principal_architect role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'principal_architect';
-- === 20260318143941_f9e7b2d1-75c5-469a-a16e-58d8745f1e0b.sql ===
-- Create drawings table
CREATE TABLE IF NOT EXISTS public.drawings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  module_id uuid REFERENCES public.modules(id),
  drawing_id_code text NOT NULL,
  drawing_type text NOT NULL DEFAULT 'Architectural',
  revision integer NOT NULL DEFAULT 1,
  file_url text NOT NULL,
  file_name text,
  uploaded_by uuid NOT NULL,
  uploaded_by_name text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drawings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view drawings"
ON public.drawings FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Architects can insert drawings"
ON public.drawings FOR INSERT TO authenticated
WITH CHECK (
  get_user_role(auth.uid()) = ANY (ARRAY[
    'principal_architect'::app_role, 'project_architect'::app_role, 
    'structural_architect'::app_role, 'super_admin'::app_role, 'managing_director'::app_role
  ])
);

CREATE POLICY "Architects can update drawings"
ON public.drawings FOR UPDATE TO authenticated
USING (
  get_user_role(auth.uid()) = ANY (ARRAY[
    'principal_architect'::app_role, 'project_architect'::app_role, 
    'structural_architect'::app_role, 'super_admin'::app_role, 'managing_director'::app_role
  ])
);

-- Create design_queries table
CREATE TABLE IF NOT EXISTS public.design_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  module_id uuid REFERENCES public.modules(id),
  dq_code text NOT NULL,
  drawing_id uuid REFERENCES public.drawings(id),
  description text NOT NULL,
  photo_url text,
  voice_note_url text,
  status text NOT NULL DEFAULT 'open',
  raised_by uuid NOT NULL,
  raised_by_name text,
  assigned_architect_id uuid,
  response_text text,
  response_drawing_id uuid REFERENCES public.drawings(id),
  responded_by uuid,
  responded_by_name text,
  responded_at timestamptz,
  resolved_at timestamptz,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.design_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view design_queries"
ON public.design_queries FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert design_queries"
ON public.design_queries FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authorized can update design_queries"
ON public.design_queries FOR UPDATE TO authenticated
USING (
  raised_by = auth.uid() OR
  assigned_architect_id = auth.uid() OR
  get_user_role(auth.uid()) = ANY (ARRAY[
    'principal_architect'::app_role, 'super_admin'::app_role, 'managing_director'::app_role
  ])
);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('drawings', 'drawings', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-notes', 'voice-notes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload drawings"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'drawings');

CREATE POLICY "Public can view drawings"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'drawings');

CREATE POLICY "Authenticated users can upload voice-notes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'voice-notes');

CREATE POLICY "Public can view voice-notes"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'voice-notes');

-- Enable realtime for design_queries
ALTER PUBLICATION supabase_realtime ADD TABLE public.design_queries;
-- === 20260318183855_ff008157-a709-4ca7-98dd-c91eb31778d4.sql ===

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

-- === 20260320120621_8cbcbde3-0118-42f8-87b6-e1a3a6c3f63a.sql ===
ALTER PUBLICATION supabase_realtime ADD TABLE public.design_stages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_design_files;
-- === 20260320142338_96427da5-98b7-4fac-a362-53e65cde1c51.sql ===
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  posted_by uuid NOT NULL,
  posted_at timestamptz NOT NULL DEFAULT now(),
  pinned boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view announcements"
ON public.announcements FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Directors can manage announcements"
ON public.announcements FOR ALL TO authenticated
USING (is_director(auth.uid()))
WITH CHECK (is_director(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
-- === 20260320145355_beb15f47-460f-4d89-a1ba-8fb0dd7b674f.sql ===

CREATE TABLE public.material_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  material_name text NOT NULL,
  category text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'units',
  required_by date,
  lead_time_days integer NOT NULL DEFAULT 7,
  supplier text,
  status text NOT NULL DEFAULT 'planned',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.material_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view material_plan_items"
  ON public.material_plan_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Planners can insert material_plan_items"
  ON public.material_plan_items FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('planning_engineer','super_admin','managing_director'));

CREATE POLICY "Planners can update material_plan_items"
  ON public.material_plan_items FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('planning_engineer','super_admin','managing_director','procurement'));

