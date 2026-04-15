-- Create client_portal_documents table
CREATE TABLE public.client_portal_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Handover',
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_portal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view portal documents"
ON public.client_portal_documents FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Directors can manage portal documents"
ON public.client_portal_documents FOR INSERT TO authenticated
WITH CHECK (public.is_director(auth.uid()));

CREATE POLICY "Directors can update portal documents"
ON public.client_portal_documents FOR UPDATE TO authenticated
USING (public.is_director(auth.uid()));

CREATE POLICY "Directors can delete portal documents"
ON public.client_portal_documents FOR DELETE TO authenticated
USING (public.is_director(auth.uid()));

-- Allow anonymous access for client portal (token-based)
CREATE POLICY "Anon can view portal documents"
ON public.client_portal_documents FOR SELECT TO anon
USING (true);

CREATE INDEX idx_client_portal_documents_project ON public.client_portal_documents(project_id);

CREATE TRIGGER update_client_portal_documents_updated_at
BEFORE UPDATE ON public.client_portal_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add invoice URL and number to billing milestones
ALTER TABLE public.project_billing_milestones 
  ADD COLUMN IF NOT EXISTS invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;