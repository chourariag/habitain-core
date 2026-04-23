
CREATE TABLE public.material_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'Nos',
  from_location TEXT NOT NULL,
  to_location TEXT NOT NULL,
  to_project_id UUID REFERENCES public.projects(id),
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  driver_details TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'in_transit',
  qty_received NUMERIC,
  condition TEXT,
  receipt_notes TEXT,
  received_at TIMESTAMPTZ,
  received_by UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.material_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view transfers"
  ON public.material_transfers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create transfers"
  ON public.material_transfers FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update transfers"
  ON public.material_transfers FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_material_transfers_updated_at
  BEFORE UPDATE ON public.material_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
