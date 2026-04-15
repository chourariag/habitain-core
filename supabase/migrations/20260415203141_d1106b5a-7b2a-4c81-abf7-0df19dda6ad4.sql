
-- Task benchmarks: stores actual duration data per completed task
CREATE TABLE public.task_benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE NOT NULL,
  task_category TEXT NOT NULL,
  module_count INT NOT NULL DEFAULT 0,
  module_count_band TEXT NOT NULL,
  actual_duration_days INT NOT NULL,
  delay_days INT NOT NULL DEFAULT 0,
  cause_category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.task_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view benchmarks"
  ON public.task_benchmarks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert benchmarks"
  ON public.task_benchmarks FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_task_benchmarks_category_band ON public.task_benchmarks(task_category, module_count_band);

-- Red flag alerts for benchmark overruns
CREATE TABLE public.red_flag_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE NOT NULL,
  task_name TEXT NOT NULL,
  task_category TEXT NOT NULL,
  module_count_band TEXT NOT NULL,
  benchmark_avg NUMERIC NOT NULL,
  current_duration INT NOT NULL,
  days_over INT NOT NULL,
  most_common_cause TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  response_note TEXT,
  responded_by UUID,
  responded_at TIMESTAMPTZ,
  notified_user_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.red_flag_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view red flags"
  ON public.red_flag_alerts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert red flags"
  ON public.red_flag_alerts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update red flags"
  ON public.red_flag_alerts FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_red_flag_alerts_status ON public.red_flag_alerts(status);
CREATE INDEX idx_red_flag_alerts_project ON public.red_flag_alerts(project_id);

CREATE TRIGGER update_red_flag_alerts_updated_at
  BEFORE UPDATE ON public.red_flag_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
