import { useNavigate } from "react-router-dom";
import { format, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";
import { computeProjectStatus, PROJECT_STATUS_CONFIG } from "@/lib/project-status";

const PRODUCTION_STAGES = [
  "Sub-Frame", "MEP Rough-In", "Insulation", "Drywall", "Paint",
  "MEP Final", "Windows & Doors", "Finishing", "QC Inspection", "Dispatch",
];
const PAST_DRYWALL = PRODUCTION_STAGES.slice(4); // Paint onwards

interface ProjectCommandCardProps {
  project: Tables<"projects">;
  modules: Pick<Tables<"modules">, "current_stage" | "production_status">[];
  hasHandover: boolean;
  delays: number;
  openNCRs: number;
  siteReady: boolean;
  pendingDQs: number;
  pendingApprovals: number;
}

export function ProjectCommandCard({
  project, modules, hasHandover, delays, openNCRs, siteReady, pendingDQs, pendingApprovals,
}: ProjectCommandCardProps) {
  const navigate = useNavigate();
  const status = computeProjectStatus(modules, hasHandover);
  const statusCfg = PROJECT_STATUS_CONFIG[status];

  // Health color for left border
  const healthColor = delays > 0 || openNCRs > 0 ? "#F40009" : !siteReady && modules.length > 0 ? "#D4860A" : "#006039";

  // Progress: % panels past Drywall
  const totalModules = modules.length;
  const pastDrywall = modules.filter((m) => PAST_DRYWALL.includes(m.current_stage ?? "")).length;
  const progressPct = totalModules > 0 ? Math.round((pastDrywall / totalModules) * 100) : 0;

  // Days remaining
  const daysLeft = project.est_completion
    ? differenceInDays(new Date(project.est_completion), new Date())
    : null;
  const daysColor = daysLeft === null ? "#999999" : daysLeft < 10 ? "#F40009" : daysLeft <= 30 ? "#D4860A" : "#006039";

  const Indicator = ({ count, label, bad }: { count: number; label: string; bad: boolean }) => (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="font-bold tabular-nums" style={{ color: bad && count > 0 ? "#F40009" : "#006039" }}>{count}</span>
      <span style={{ color: "#666666" }}>{label}</span>
    </div>
  );

  return (
    <div
      className="rounded-[10px] bg-background cursor-pointer transition-shadow hover:shadow-md overflow-hidden"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)", borderLeft: `4px solid ${healthColor}` }}
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <div className="p-4 space-y-3">
        {/* TOP ROW */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-base leading-tight" style={{ color: "#1A1A1A" }}>{project.name}</p>
            {project.client_name && <p className="text-xs mt-0.5" style={{ color: "#666666" }}>{project.client_name}</p>}
            <p className="text-[10px] mt-0.5" style={{ color: "#999999" }}>
              {[project.construction_type, project.location].filter(Boolean).join(" · ")}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "#999999" }}>
              {project.start_date ? format(new Date(project.start_date), "dd/MM/yyyy") : "TBD"}
              {" → "}
              {project.est_completion ? format(new Date(project.est_completion), "dd/MM/yyyy") : "TBD"}
            </p>
          </div>
          <Badge className={statusCfg.badgeClass + " shrink-0 text-[10px]"}>{statusCfg.label}</Badge>
        </div>

        {/* PROGRESS ROW */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "#666666" }}>
              {totalModules} module{totalModules !== 1 ? "s" : ""}
            </span>
            {daysLeft !== null && (
              <span className="text-xs font-bold tabular-nums" style={{ color: daysColor }}>
                {daysLeft > 0 ? `${daysLeft} days left` : daysLeft === 0 ? "Due today" : `${Math.abs(daysLeft)}d overdue`}
              </span>
            )}
          </div>
          <div className="h-1.5 rounded-full" style={{ backgroundColor: "#E5E7EB" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressPct}%`, backgroundColor: "#006039" }}
            />
          </div>
          <p className="text-[10px] text-right" style={{ color: "#999999" }}>{progressPct}% past Drywall</p>
        </div>

        {/* HEALTH ROW — 2x2 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <Indicator count={delays} label="Delays" bad />
          <Indicator count={openNCRs} label="Open NCRs" bad />
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-bold" style={{ color: siteReady ? "#006039" : "#D4860A" }}>
              {siteReady ? "✓" : "⚠"}
            </span>
            <span style={{ color: "#666666" }}>{siteReady ? "Site Ready" : "Site Incomplete"}</span>
          </div>
          <Indicator count={pendingDQs} label="DQs Pending" bad={false} />
        </div>

        {/* CLIENT ROW */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t" style={{ borderColor: "#E5E7EB" }}>
          <div className="flex items-center gap-1.5 text-xs">
            <span style={{ color: pendingApprovals > 0 ? "#D4860A" : "#006039" }} className="font-bold tabular-nums">{pendingApprovals}</span>
            <span style={{ color: "#666666" }}>Approvals Pending</span>
          </div>
        </div>
      </div>
    </div>
  );
}
