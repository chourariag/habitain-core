import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { format } from "date-fns";

type Task = { id: string; label: string; to: string };

export function HomeTaskList({ userRole }: { userRole: string | null }) {
  const { user } = useAuth();
  const flags = useFeatureFlags();
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user || flags.isLoading) return;
      const next: Task[] = [];
      const today = format(new Date(), "yyyy-MM-dd");

      if (flags.isEnabled("attendance")) {
        const { data } = await supabase
          .from("attendance_records")
          .select("id,name")
          .eq("user_id", user.id)
          .eq("date", today)
          .maybeSingle();
        if (!data) next.push({ id: "attendance", label: "Attendance check-in due", to: "/attendance" });
      }

      const siteRoles = ["site_installation_mgr", "site_engineer", "super_admin", "managing_director"];
      if (flags.isEnabled("site_report") && userRole && siteRoles.includes(userRole)) {
        const { data: projects } = await supabase.from("projects").select("id,name").eq("is_archived", false);
        const projectIds = (projects ?? []).map((project) => project.id);
        let submittedIds = new Set<string>();
        if (projectIds.length) {
          const { data: entries } = await (supabase.from("site_diary") as any)
            .select("project_id")
            .in("project_id", projectIds)
            .eq("submitted_by_user_id", user.id)
            .eq("entry_date", today);
          submittedIds = new Set((entries ?? []).map((entry: { project_id: string }) => entry.project_id));
        }
        const dueProject = (projects ?? []).find((project) => !submittedIds.has(project.id));
        if (dueProject) next.push({ id: "site-report", label: `Today's site report due · ${dueProject.name}`, to: `/site-hub?projectId=${dueProject.id}&tab=diary` });
      }

      if (flags.isEnabled("project_setup") && userRole && ["planning_engineer", "planning_head", "super_admin", "managing_director"].includes(userRole)) {
        const { data: projects } = await supabase
          .from("projects")
          .select("id")
          .eq("is_archived", false)
          .is("setup_uploaded_at", null)
          .limit(1);
        const pendingProject = projects?.[0];
        if (pendingProject) next.push({ id: "project-setup", label: "Project setup upload pending", to: `/projects/${pendingProject.id}` });
      }

      if (!cancelled) setTasks(next);
    };
    void load();
    return () => { cancelled = true; };
  }, [flags.isLoading, flags.flags, user, userRole]);

  if (flags.isLoading) return <p className="text-sm text-muted-foreground">Loading your tasks…</p>;

  return (
    <section className="space-y-3" aria-labelledby="home-tasks-heading">
      <h2 id="home-tasks-heading" className="font-display text-lg font-bold text-foreground">Today</h2>
      {tasks.length === 0 ? (
        <p className="border-y border-border py-4 text-sm text-muted-foreground">No tasks due right now.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link to={task.to} className="block py-3 text-sm font-medium text-foreground underline-offset-4 hover:underline">
                {task.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}