
CREATE TABLE public.installation_sequence_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) NOT NULL UNIQUE,
  document_url text,
  video_url text,
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz,
  azad_signed_at timestamptz,
  azad_signed_by uuid REFERENCES auth.users(id),
  awaiz_signed_at timestamptz,
  awaiz_signed_by uuid REFERENCES auth.users(id),
  karthik_signed_at timestamptz,
  karthik_signed_by uuid REFERENCES auth.users(id),
  reminder_7d_sent boolean DEFAULT false,
  escalation_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.installation_sequence_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view installation_sequence_docs"
  ON public.installation_sequence_docs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized roles can insert installation_sequence_docs"
  ON public.installation_sequence_docs FOR INSERT TO authenticated
  WITH CHECK (
    public.is_full_admin(auth.uid())
    OR public.has_role(auth.uid(), 'site_installation_mgr')
    OR public.has_role(auth.uid(), 'head_operations')
    OR public.has_role(auth.uid(), 'production_head')
    OR public.has_role(auth.uid(), 'site_engineer')
  );

CREATE POLICY "Authorized roles can update installation_sequence_docs"
  ON public.installation_sequence_docs FOR UPDATE TO authenticated
  USING (
    public.is_full_admin(auth.uid())
    OR public.has_role(auth.uid(), 'site_installation_mgr')
    OR public.has_role(auth.uid(), 'head_operations')
    OR public.has_role(auth.uid(), 'production_head')
    OR public.has_role(auth.uid(), 'site_engineer')
  );

CREATE TRIGGER update_installation_sequence_docs_updated_at
  BEFORE UPDATE ON public.installation_sequence_docs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.site_factory_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id text NOT NULL,
  project_id uuid REFERENCES public.projects(id) NOT NULL,
  module_id text,
  issue_type text NOT NULL,
  description text NOT NULL,
  photos text[] DEFAULT '{}',
  severity text DEFAULT 'minor',
  raised_by uuid REFERENCES auth.users(id),
  raised_by_name text,
  raised_at timestamptz DEFAULT now(),
  azad_response text,
  azad_explanation text,
  azad_responded_at timestamptz,
  linked_ncr_id text,
  escalated boolean DEFAULT false,
  escalation_sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.site_factory_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view site_factory_feedback"
  ON public.site_factory_feedback FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized roles can insert site_factory_feedback"
  ON public.site_factory_feedback FOR INSERT TO authenticated
  WITH CHECK (
    public.is_full_admin(auth.uid())
    OR public.has_role(auth.uid(), 'site_installation_mgr')
    OR public.has_role(auth.uid(), 'site_engineer')
  );

CREATE POLICY "Authorized roles can update site_factory_feedback"
  ON public.site_factory_feedback FOR UPDATE TO authenticated
  USING (
    public.is_full_admin(auth.uid())
    OR public.has_role(auth.uid(), 'site_installation_mgr')
    OR public.has_role(auth.uid(), 'site_engineer')
    OR public.has_role(auth.uid(), 'head_operations')
    OR public.has_role(auth.uid(), 'production_head')
  );

CREATE TRIGGER update_site_factory_feedback_updated_at
  BEFORE UPDATE ON public.site_factory_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
