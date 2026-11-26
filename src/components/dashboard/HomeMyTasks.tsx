import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TaskUpdateSheet } from "@/components/tasks/TaskUpdateSheet";
import { responsibleRolesFor, TASK_UPDATE_ROLES } from "@/lib/my-tasks-roles";
import { GROUP_LABEL, GROUP_ORDER, groupFor, ddmmyyyy, type HomeTaskGroup } from "@/lib/my-tasks-groups";

const CAP = 20;

export function HomeMyTasks({ userRole }: { userRole: string | null }) {
  const roles = responsibleRolesFor(userRole);
  const [tasks, setTasks] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [open, setOpen] = useState<Record<HomeTaskGroup, boolean>>({ overdue: true, in_progress: true, next7: true, later: false });
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!roles) { setLoading(false); return; }
    setLoading(true);
    let q = supabase
      .from("project_tasks")
      .select("*, projects:project_id(name)")
      .eq("is_removed", false)
      .neq("status", "Completed")
      .or("unit_label.not.is.null,actual_start_date.not.is.null,completion_percentage.gt.0");
    if (roles !== "all") q = q.in("responsible_role", roles);
    const { data } = await q.order("planned_finish_date", { ascending: true, nullsFirst: false }).limit(500);
    const rows = (data ?? []).map((r: any) => ({ ...r, predecessor_ids: r.predecessor_ids ?? [], project_name: r.projects?.name ?? "" }));
    setTasks(rows);
    const ids = [...new Set(rows.map((r: any) => r.project_id))];
    if (ids.length) {
      const { data: all } = await supabase.from("project_tasks")
        .select("id,project_id,task_id_in_schedule,task_name,completion_percentage").eq("is_removed", false).in("project_id", ids);
      setAllTasks(all ?? []);
    } else setAllTasks([]);
    setLoading(false);
  }, [JSON.stringify(roles)]);

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const g: Record<HomeTaskGroup, any[]> = { overdue: [], in_progress: [], next7: [], later: [] };
    for (const t of tasks) g[groupFor(t, today)].push(t);
    return g;
  }, [tasks]);

  if (!roles) return null;

  const canEdit = TASK_UPDATE_ROLES.includes(userRole ?? "");

  return (
    <section className="space-y-3" aria-labelledby="home-mytasks-heading">
      <h2 id="home-mytasks-heading" className="font-display text-lg font-bold text-foreground">My Tasks</h2>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your tasks…</p>
      ) : tasks.length === 0 ? (
        <p className="border-y border-border py-4 text-sm text-muted-foreground">No scheduled tasks for you right now.</p>
      ) : (
        <div className="divide-y divide-border border-y border-border">
          {GROUP_ORDER.map((key) => {
            const list = grouped[key];
            if (!list.length) return null;
            const visible = showAll[key] ? list : list.slice(0, CAP);
            return (
              <div key={key}>
                <button type="button" onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}
                  className="flex min-h-11 w-full items-center gap-2 py-2 text-left text-sm font-semibold text-foreground"
                  aria-expanded={open[key]}>
                  {open[key] ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <span className={key === "overdue" ? "text-destructive" : ""}>{GROUP_LABEL[key]}</span>
                  <span className="rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">{list.length}</span>
                </button>
                {open[key] && (
                  <ul className="divide-y divide-border pb-2">
                    {visible.map((t) => (
                      <li key={t.id}>
                        <button type="button" onClick={() => setSelected(t)}
                          className="block min-h-11 w-full py-2.5 text-left hover:bg-muted/50">
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 break-words text-sm font-medium text-foreground">
                              <span className="font-mono text-xs text-muted-foreground">{t.task_id_in_schedule}</span> {t.task_name}
                            </p>
                            <span className="shrink-0 text-sm font-semibold text-foreground">{t.completion_percentage ?? 0}%</span>
                          </div>
                          <p className="mt-0.5 break-words text-xs text-muted-foreground">
                            {[t.unit_label, t.project_name].filter(Boolean).join(" · ")}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {ddmmyyyy(t.planned_start_date)} – {ddmmyyyy(t.planned_finish_date)} · {t.status}
                          </p>
                        </button>
                      </li>
                    ))}
                    {list.length > CAP && (
                      <li>
                        <button type="button" onClick={() => setShowAll((s) => ({ ...s, [key]: !s[key] }))}
                          className="min-h-11 w-full text-center text-sm font-medium text-primary">
                          {showAll[key] ? "Show fewer" : `Show all (${list.length})`}
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
      <TaskUpdateSheet
        task={selected}
        open={!!selected}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
        onUpdated={() => { setSelected(null); void load(); }}
        allTasks={allTasks as any}
        canEdit={canEdit}
        userRole={userRole}
        canAddSubtasks={false}
      />
    </section>
  );
}
