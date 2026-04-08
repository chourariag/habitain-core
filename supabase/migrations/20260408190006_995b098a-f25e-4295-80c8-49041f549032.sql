
-- Add client portal columns to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_portal_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS client_portal_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_portal_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_portal_status_message text;

-- Create index on token for fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_client_portal_token
  ON public.projects (client_portal_token) WHERE client_portal_token IS NOT NULL;

-- Client portal access log
CREATE TABLE public.client_portal_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token_used text NOT NULL,
  action text NOT NULL DEFAULT 'page_view',
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_portal_access_log ENABLE ROW LEVEL SECURITY;

-- Authenticated users (HStack staff) can read all logs
CREATE POLICY "Staff can read all portal logs"
  ON public.client_portal_access_log
  FOR SELECT TO authenticated
  USING (true);

-- Allow anonymous inserts for logging client visits (token validated in app)
CREATE POLICY "Anyone can insert portal log"
  ON public.client_portal_access_log
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
