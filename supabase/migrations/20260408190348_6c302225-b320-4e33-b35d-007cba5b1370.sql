
-- Variation Orders table
CREATE TABLE public.variation_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vo_code text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  description text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  client_approved_at timestamptz,
  client_response_note text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.variation_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage variation orders"
  ON public.variation_orders FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Anon can read variation orders"
  ON public.variation_orders FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon can update variation orders"
  ON public.variation_orders FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_variation_orders_updated_at
  BEFORE UPDATE ON public.variation_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add client sign-off columns to handover_pack
ALTER TABLE public.handover_pack
  ADD COLUMN IF NOT EXISTS client_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_signed_name text,
  ADD COLUMN IF NOT EXISTS dlp_start_date date;

-- Add client approval columns to drawings
ALTER TABLE public.drawings
  ADD COLUMN IF NOT EXISTS client_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_approved_name text,
  ADD COLUMN IF NOT EXISTS client_query_text text;
