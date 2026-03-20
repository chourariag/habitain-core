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