CREATE TABLE public.error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  error_message text NOT NULL,
  error_stack text,
  request_path text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notified boolean NOT NULL DEFAULT false,
  notified_at timestamptz,
  notify_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_error_log_pending ON public.error_log (notified, created_at) WHERE notified = false;
CREATE INDEX idx_error_log_created_at ON public.error_log (created_at DESC);
CREATE INDEX idx_error_log_user ON public.error_log (user_id);

GRANT SELECT ON public.error_log TO authenticated;
GRANT ALL ON public.error_log TO service_role;

ALTER TABLE public.error_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leadership can view error log"
ON public.error_log FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'managing_director')
  OR public.has_role(auth.uid(), 'chairman')
  OR public.has_role(auth.uid(), 'finance_director')
  OR public.has_role(auth.uid(), 'sales_director')
  OR public.has_role(auth.uid(), 'architecture_director')
  OR public.has_role(auth.uid(), 'director')
);