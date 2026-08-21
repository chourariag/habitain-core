ALTER TABLE public.project_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.project_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mentioned_ids uuid[] DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS idx_project_messages_reply_to ON public.project_messages (reply_to_id);