
CREATE TABLE public.board_papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date DATE NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'monthly',
  generated_by UUID NOT NULL,
  generated_by_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  sections_data JSONB NOT NULL DEFAULT '{}',
  commentary JSONB DEFAULT '{}',
  pdf_url TEXT,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.board_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors can view board papers"
ON public.board_papers FOR SELECT
TO authenticated
USING (public.is_director(auth.uid()));

CREATE POLICY "Directors can create board papers"
ON public.board_papers FOR INSERT
TO authenticated
WITH CHECK (public.is_director(auth.uid()));

CREATE POLICY "Directors can update board papers"
ON public.board_papers FOR UPDATE
TO authenticated
USING (public.is_director(auth.uid()));

CREATE POLICY "Directors can delete board papers"
ON public.board_papers FOR DELETE
TO authenticated
USING (public.is_director(auth.uid()));

CREATE TRIGGER update_board_papers_updated_at
BEFORE UPDATE ON public.board_papers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
