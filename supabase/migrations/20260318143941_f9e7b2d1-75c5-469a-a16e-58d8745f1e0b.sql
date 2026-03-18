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