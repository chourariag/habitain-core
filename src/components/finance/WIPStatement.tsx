import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";

interface WIPProject {
  id: string;
  name: string;
  division: string;
  wip_start_date: string | null;
  wip_close_date: string | null;
  wip_status: string;
  materialCost: number;
  labourCost: number;
  overheadCost: number;
  totalCost: number;
  invoicedToDate: number;
  netWIP: number;
  billingMilestone: string;
}

const FULL_ACCESS_ROLES = [
  "super_admin", "managing_director", "finance_director", "finance_manager",
];
const SUMMARY_ONLY_ROLES = [
  "sales_director", "architecture_director",
];

function formatINR(v: number) {
  return `₹${Math.abs(v).toLocaleString("en-IN")}`;
}

export function WIPStatement() {
  const { role, loading: roleLoading } = useUserRole();
  const [projects, setProjects] = useState<WIPProject[]>([]);
  const [loading, setLoading] = useState(true);

  const hasFullAccess = FULL_ACCESS_ROLES.includes(role || "");
  const hasSummaryAccess = SUMMARY_ONLY_ROLES.includes(role || "");
  const hasAnyAccess = hasFullAccess || hasSummaryAccess;

  useEffect(() => {
    if (roleLoading || !hasAnyAccess) return;
    fetchWIPData();
  }, [roleLoading, hasAnyAccess]);

  async function fetchWIPData() {
    setLoading(true);
    try {
      // Fetch projects with WIP status active or dispatched
      const { data: wipProjects } = await supabase
        .from("projects")
        .select("id, name, wip_start_date, wip_close_date, wip_status")
        .in("wip_status", ["active", "dispatched", "closed"]);

      if (!wipProjects || wipProjects.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      const projectIds = wipProjects.map(p => p.id);

      // Fetch costs in parallel — using existing tables
      const [
        { data: budgets },
        { data: expenses },
        { data: payments },
        { data: modules },
      ] = await Promise.all([
        supabase.from("finance_project_budgets").select("*").in("project_id", projectIds),
        supabase.from("expense_entries").select("project_id, amount, expense_type, category").in("project_id", projectIds),
        supabase.from("finance_payments").select("*").in("status", ["paid"]),
        supabase.from("modules").select("id, project_id, current_stage").in("project_id", projectIds),
      ]);

      const result: WIPProject[] = wipProjects.map(p => {
        // Material costs from expense entries tagged as material
        const projExpenses = (expenses || []).filter(e => e.project_id === p.id);
        const materialCost = projExpenses
          .filter(e => e.category === "material" || e.expense_type === "material")
          .reduce((s, e) => s + (e.amount || 0), 0);

        // Labour costs from expense entries tagged as labour
        const labourCost = projExpenses
          .filter(e => e.category === "labour" || e.expense_type === "labour")
          .reduce((s, e) => s + (e.amount || 0), 0);

        const overhead = (materialCost + labourCost) * 0.05;
        const totalCost = materialCost + labourCost + overhead;

        // Invoiced amounts from payments matched by project name
        const invoiced = (payments || [])
          .filter(pm => pm.project_name === p.name)
          .reduce((s, pm) => s + (pm.amount || 0), 0);

        const netWIP = totalCost - invoiced;

        // Billing milestone: 10% per stage, based on max stage across modules
        const projModules = (modules || []).filter(m => m.project_id === p.id);
        const maxStage = projModules.reduce((mx, m) => Math.max(mx, Number(m.current_stage) || 0), 0);
        const billingPct = Math.min(maxStage * 10, 100);

        return {
          id: p.id,
          name: p.name,
          division: "Habitainer",
          wip_start_date: p.wip_start_date,
          wip_close_date: p.wip_close_date,
          wip_status: p.wip_status || "active",
          materialCost,
          labourCost,
          overheadCost: overhead,
          totalCost,
          invoicedToDate: invoiced,
          netWIP,
          billingMilestone: `${billingPct}%`,
        };
      });

      setProjects(result);
    } catch (err) {
      console.error("WIP fetch error:", err);
    }
    setLoading(false);
  }

  if (roleLoading) return null;
  if (!hasAnyAccess) return null;

  const activeProjects = projects.filter(p => p.wip_status !== "closed");
  const totalWIP = activeProjects.reduce((s, p) => s + p.netWIP, 0);
  const largestWIP = activeProjects.length > 0
    ? activeProjects.reduce((a, b) => a.netWIP > b.netWIP ? a : b)
    : null;

  const now = new Date();
  const closedThisMonth = projects
    .filter(p => p.wip_status === "closed" && p.wip_close_date &&
      new Date(p.wip_close_date).getMonth() === now.getMonth() &&
      new Date(p.wip_close_date).getFullYear() === now.getFullYear())
    .reduce((s, p) => s + p.totalCost, 0);

  const statusColor = (status: string) => {
    if (status === "active") return { bg: "#E8F2ED", text: "#006039" };
    if (status === "dispatched") return { bg: "#FFF8E1", text: "#D4860A" };
    return { bg: "#F0F0F0", text: "#666666" };
  };

  return (
    <div className="space-y-4 mt-6">
      <h2 className="text-lg font-display font-bold" style={{ color: "#1A1A1A" }}>
        Work In Progress (Live)
      </h2>

      {/* Summary Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card style={{ backgroundColor: "#E8F2ED", borderColor: "#006039" }}>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-display font-semibold" style={{ color: "#006039" }}>Total WIP</p>
            <p className="text-xl font-mono font-bold mt-1" style={{ color: "#006039" }}>{formatINR(totalWIP)}</p>
            <p className="text-xs mt-0.5" style={{ color: "#006039" }}>{activeProjects.length} active project{activeProjects.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card style={{ backgroundColor: "#FFF8E1", borderColor: "#D4860A" }}>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-display font-semibold" style={{ color: "#D4860A" }}>Largest Single Project WIP</p>
            <p className="text-xl font-mono font-bold mt-1" style={{ color: "#D4860A" }}>{largestWIP ? formatINR(largestWIP.netWIP) : "—"}</p>
            <p className="text-xs mt-0.5" style={{ color: "#D4860A" }}>{largestWIP?.name || "—"}</p>
          </CardContent>
        </Card>
        <Card style={{ backgroundColor: "#E8F2ED", borderColor: "#006039" }}>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-display font-semibold" style={{ color: "#006039" }}>Closed This Month</p>
            <p className="text-xl font-mono font-bold mt-1" style={{ color: "#006039" }}>{formatINR(closedThisMonth)}</p>
            <p className="text-xs mt-0.5" style={{ color: "#006039" }}>WIP → Revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* WIP Table — full access only */}
      {hasFullAccess && (
        <Card>
          <CardContent className="pt-4 px-0">
            {loading ? (
              <p className="text-sm text-center py-8" style={{ color: "#666" }}>Loading WIP data…</p>
            ) : projects.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "#666" }}>
                No projects with active WIP. WIP begins when GFC is issued and production starts.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-display text-xs" style={{ color: "#006039" }}>Project</TableHead>
                      <TableHead className="font-display text-xs" style={{ color: "#006039" }}>Division</TableHead>
                      <TableHead className="font-display text-xs" style={{ color: "#006039" }}>WIP Start</TableHead>
                      <TableHead className="font-display text-xs text-right" style={{ color: "#006039" }}>Material (₹)</TableHead>
                      <TableHead className="font-display text-xs text-right" style={{ color: "#006039" }}>Labour (₹)</TableHead>
                      <TableHead className="font-display text-xs text-right" style={{ color: "#006039" }}>OH 5% (₹)</TableHead>
                      <TableHead className="font-display text-xs text-right" style={{ color: "#006039" }}>Total Cost (₹)</TableHead>
                      <TableHead className="font-display text-xs text-right" style={{ color: "#006039" }}>Invoiced (₹)</TableHead>
                      <TableHead className="font-display text-xs text-right" style={{ color: "#006039" }}>Net WIP (₹)</TableHead>
                      <TableHead className="font-display text-xs text-center" style={{ color: "#006039" }}>Billing</TableHead>
                      <TableHead className="font-display text-xs text-center" style={{ color: "#006039" }}>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map(p => {
                      const sc = statusColor(p.wip_status);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-display font-medium text-xs" style={{ color: "#1A1A1A" }}>{p.name}</TableCell>
                          <TableCell className="text-xs">{p.division}</TableCell>
                          <TableCell className="text-xs font-mono">
                            {p.wip_start_date ? format(new Date(p.wip_start_date), "dd/MM/yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono">{formatINR(p.materialCost)}</TableCell>
                          <TableCell className="text-right text-xs font-mono">{formatINR(p.labourCost)}</TableCell>
                          <TableCell className="text-right text-xs font-mono">{formatINR(p.overheadCost)}</TableCell>
                          <TableCell className="text-right text-xs font-mono font-semibold">{formatINR(p.totalCost)}</TableCell>
                          <TableCell className="text-right text-xs font-mono">{formatINR(p.invoicedToDate)}</TableCell>
                          <TableCell className="text-right text-xs font-mono font-bold" style={{ color: p.netWIP > 0 ? "#D4860A" : "#006039" }}>
                            {formatINR(p.netWIP)}
                          </TableCell>
                          <TableCell className="text-center text-xs font-mono">{p.billingMilestone}</TableCell>
                          <TableCell className="text-center">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                              style={{ backgroundColor: sc.bg, color: sc.text }}>
                              {p.wip_status}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Totals row */}
                    <TableRow style={{ backgroundColor: "#F7F7F7" }}>
                      <TableCell className="font-display font-bold text-xs" colSpan={3} style={{ color: "#006039" }}>TOTAL</TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold">{formatINR(projects.reduce((s, p) => s + p.materialCost, 0))}</TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold">{formatINR(projects.reduce((s, p) => s + p.labourCost, 0))}</TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold">{formatINR(projects.reduce((s, p) => s + p.overheadCost, 0))}</TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold">{formatINR(projects.reduce((s, p) => s + p.totalCost, 0))}</TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold">{formatINR(projects.reduce((s, p) => s + p.invoicedToDate, 0))}</TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold" style={{ color: "#006039" }}>
                        {formatINR(projects.reduce((s, p) => s + p.netWIP, 0))}
                      </TableCell>
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {hasSummaryAccess && !hasFullAccess && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-xs" style={{ color: "#666" }}>
              Detailed WIP breakdown is available to Finance Director, Finance Manager, and MD only.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
