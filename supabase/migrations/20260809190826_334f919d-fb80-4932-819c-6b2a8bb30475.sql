CREATE TABLE public.approval_rejection_dm_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id uuid NOT NULL UNIQUE REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  recipient_user_id uuid,
  slack_user_id text,
  dm_sent boolean NOT NULL DEFAULT false,
  skip_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.approval_rejection_dm_log TO service_role;
GRANT SELECT ON public.approval_rejection_dm_log TO authenticated;

ALTER TABLE public.approval_rejection_dm_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view rejection dm log"
ON public.approval_rejection_dm_log FOR SELECT TO authenticated
USING (public.is_full_admin(auth.uid()));

CREATE TRIGGER update_approval_rejection_dm_log_updated_at
BEFORE UPDATE ON public.approval_rejection_dm_log
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Baseline: never fire retroactively for already-rejected requests
INSERT INTO public.approval_rejection_dm_log (approval_request_id, recipient_user_id, dm_sent, skip_reason)
SELECT id, requested_by, false, 'baseline_pre_existing'
FROM public.approval_requests
WHERE status = 'rejected'
ON CONFLICT (approval_request_id) DO NOTHING;