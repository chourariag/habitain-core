
-- labour_teams
CREATE TABLE public.labour_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name text NOT NULL,
  team_head_id uuid NOT NULL REFERENCES public.labour_workers(id) ON DELETE RESTRICT,
  specialisation text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_labour_teams_status ON public.labour_teams(status);
CREATE INDEX idx_labour_teams_head ON public.labour_teams(team_head_id);

ALTER TABLE public.labour_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View labour teams" ON public.labour_teams FOR SELECT
  USING (public.can_access_labour_register(auth.uid()));
CREATE POLICY "Manage labour teams" ON public.labour_teams FOR ALL
  USING (public.can_manage_labour_register(auth.uid()))
  WITH CHECK (public.can_manage_labour_register(auth.uid()));
CREATE TRIGGER trg_labour_teams_updated BEFORE UPDATE ON public.labour_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- labour_team_members
CREATE TABLE public.labour_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.labour_teams(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.labour_workers(id) ON DELETE CASCADE,
  joined_date date NOT NULL DEFAULT CURRENT_DATE,
  left_date date,
  reassign_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_labour_team_members_team ON public.labour_team_members(team_id);
CREATE INDEX idx_labour_team_members_worker ON public.labour_team_members(worker_id);
-- Worker can be in only ONE active team (left_date IS NULL) at a time
CREATE UNIQUE INDEX uq_labour_team_members_worker_active
  ON public.labour_team_members(worker_id) WHERE left_date IS NULL;

ALTER TABLE public.labour_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View labour team members" ON public.labour_team_members FOR SELECT
  USING (public.can_access_labour_register(auth.uid()));
CREATE POLICY "Manage labour team members" ON public.labour_team_members FOR ALL
  USING (public.can_manage_labour_register(auth.uid()))
  WITH CHECK (public.can_manage_labour_register(auth.uid()));

-- module_team_assignments (daily)
CREATE TABLE public.module_team_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.labour_teams(id) ON DELETE RESTRICT,
  stage text,
  assignment_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_tasks text,
  notes text,
  assigned_by uuid REFERENCES auth.users(id),
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, assignment_date)
);
CREATE INDEX idx_module_team_assignments_date ON public.module_team_assignments(assignment_date DESC);
CREATE INDEX idx_module_team_assignments_project ON public.module_team_assignments(project_id);
CREATE INDEX idx_module_team_assignments_team ON public.module_team_assignments(team_id);

ALTER TABLE public.module_team_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View module team assignments" ON public.module_team_assignments FOR SELECT
  USING (public.can_access_labour_register(auth.uid()));
CREATE POLICY "Insert module team assignments" ON public.module_team_assignments FOR INSERT
  WITH CHECK (
    auth.uid() = assigned_by AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE auth_user_id = auth.uid() AND is_active = true
        AND role IN ('super_admin','managing_director','head_operations','production_head','factory_floor_supervisor','fabrication_foreman')
    )
  );
CREATE POLICY "Update module team assignments" ON public.module_team_assignments FOR UPDATE
  USING (public.can_manage_labour_register(auth.uid()))
  WITH CHECK (public.can_manage_labour_register(auth.uid()));
CREATE TRIGGER trg_module_team_assignments_updated BEFORE UPDATE ON public.module_team_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add team_id to existing module_schedule
ALTER TABLE public.module_schedule ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.labour_teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_module_schedule_team ON public.module_schedule(team_id);
