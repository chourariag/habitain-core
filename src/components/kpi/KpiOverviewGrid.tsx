import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { KPI_EMPLOYEES, ragColor, ragLabel, rollUpStatus, type RagStatus } from "@/lib/kpi-metrics";
import type { AppRole } from "@/lib/roles";

interface Props {
  onSelect: (userId: string, role: AppRole) => void;
}

interface CardData {
  user_id: string | null;
  name: string;
  role: AppRole;
  subtitle: string;
  overall: RagStatus;
  metrics: { kpi_name: string; status: RagStatus; actual: number | null; target: number; unit: string }[];
}

export function KpiOverviewGrid({ onSelect }: Props) {
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: profs }, { data: defs }, { data: snaps }] = await Promise.all([
      supabase.from("profiles").select("auth_user_id, display_name, role").eq("is_active", true),
      supabase.from("kpi_definitions").select("kpi_key, kpi_name, role, target_value, unit").eq("is_active", true),
      supabase.from("kpi_snapshots").select("user_id, kpi_key, status, actual_value, target_value")
        .eq("period_type", "daily").eq("period_date", today),
    ]);

    const built = KPI_EMPLOYEES.map((e) => {
      const prof = (profs ?? []).find((p: any) =>
        p.display_name?.toLowerCase().includes(e.name.toLowerCase().split(" ")[0])
        && p.role === e.role
      );
      const userId: string | null = prof?.auth_user_id ?? null;
      const myDefs = (defs ?? []).filter((d: any) => d.role === e.role).slice(0, 3);
      const metrics = myDefs.map((d: any) => {
        const s = (snaps ?? []).find((x: any) => x.user_id === userId && x.kpi_key === d.kpi_key);
        const status: RagStatus = (s?.status as RagStatus) ?? "no_data";
        return { kpi_name: d.kpi_name, status, actual: s?.actual_value ?? null, target: Number(d.target_value ?? 0), unit: d.unit };
      });
      const overall = rollUpStatus(metrics.map((m) => m.status));
      return { user_id: userId, name: e.name, role: e.role, subtitle: e.subtitle, overall, metrics };
    });
    setCards(built);
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-xl font-bold text-foreground">KPI Overview — 12 Tracked Employees</h2>
        <span className="text-xs text-muted-foreground">Auto-RAG · refreshed daily</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {cards.map((c) => (
          <button
            key={c.name}
            onClick={() => c.user_id && onSelect(c.user_id, c.role)}
            disabled={!c.user_id}
            className="text-left rounded-lg border border-border p-4 bg-background hover:shadow-md transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-display font-semibold text-foreground truncate">{c.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{c.subtitle}</div>
              </div>
              <span
                className="inline-block w-3 h-3 rounded-full shrink-0 mt-1"
                style={{ backgroundColor: ragColor(c.overall) }}
                title={ragLabel(c.overall)}
              />
            </div>
            {!c.user_id ? (
              <div className="text-[11px] text-muted-foreground mt-3">Account not yet created</div>
            ) : c.metrics.length === 0 ? (
              <div className="text-[11px] text-muted-foreground mt-3">No KPIs defined</div>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {c.metrics.map((m) => (
                  <li key={m.kpi_name} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ragColor(m.status) }} />
                      <span className="text-foreground truncate">{m.kpi_name}</span>
                    </span>
                    <span className="font-mono text-muted-foreground shrink-0">
                      {m.actual !== null ? `${Math.round(m.actual * 10) / 10}` : "—"}/{m.target}{m.unit === "%" ? "%" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div
              className="mt-3 inline-block text-[10px] font-semibold px-2 py-0.5 rounded"
              style={{ color: ragColor(c.overall), backgroundColor: ragColor(c.overall) + "1A" }}
            >
              {ragLabel(c.overall)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
