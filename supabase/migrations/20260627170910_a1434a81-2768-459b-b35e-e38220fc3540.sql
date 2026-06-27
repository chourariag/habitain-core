
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS email_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical'));

CREATE INDEX IF NOT EXISTS idx_notifications_email_pending
  ON public.notifications(created_at)
  WHERE email_sent = false AND priority IN ('high','critical');
