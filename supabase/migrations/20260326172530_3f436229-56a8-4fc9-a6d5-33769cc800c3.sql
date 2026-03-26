
-- Create project_messages table
CREATE TABLE public.project_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  project_type text NOT NULL DEFAULT 'production',
  sender_id uuid NOT NULL,
  sender_name text NOT NULL,
  message_text text,
  attachment_urls text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  read_by uuid[] DEFAULT '{}'
);

-- Index for fast feed queries
CREATE INDEX idx_project_messages_feed ON public.project_messages (project_id, project_type, created_at DESC);

-- Enable RLS
ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;

-- Users can insert their own messages
CREATE POLICY "Users can insert own messages"
ON public.project_messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid());

-- Authenticated users can read messages (scoping done in app)
CREATE POLICY "Authenticated can read messages"
ON public.project_messages FOR SELECT TO authenticated
USING (true);

-- Users can update read_by on any message (to mark as read)
CREATE POLICY "Users can update read_by"
ON public.project_messages FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_messages;

-- Create chat-media storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat-media
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-media');

CREATE POLICY "Anyone can view chat media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-media');
