
-- Add missing columns to notifications table
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS navigate_to text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_table text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_id uuid;

-- Backfill title/body/category from existing columns
UPDATE public.notifications SET
  title = COALESCE(title, type),
  body = COALESCE(body, content),
  category = COALESCE(category, 'system'),
  related_table = COALESCE(related_table, linked_entity_type),
  related_id = COALESCE(related_id, linked_entity_id);

-- Set NOT NULL after backfill
ALTER TABLE public.notifications ALTER COLUMN title SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN body SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN category SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN is_read SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN is_read SET DEFAULT false;

-- Add indexes if not exist
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications (recipient_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_feed ON public.notifications (recipient_id, created_at DESC);

-- Enable RLS (idempotent)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist and recreate
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
  DROP POLICY IF EXISTS "System insert notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
  DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
END $$;

CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "System insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
