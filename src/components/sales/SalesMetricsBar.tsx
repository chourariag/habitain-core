import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Flame, Handshake, TrendingUp, Target, Trophy } from "lucide-react";

interface Deal {
  id: string;
  contract_value: number;
  temperature: string;
  stage: string;
  created_at: string;
}

export function SalesMetricsBar({ deals }: { deals: Deal[] }) {
  const metrics = useMemo(() => {
    const active = deals.filter(d => d.stage !== "Lost");
    const totalPipeline = active.reduce((s, d) => s + (d.contract_value || 0), 0);
    const hotCount = deals.filter(d => d.temperature === "hot" && d.stage !== "Lost").length;
    const negotiation = deals.filter(d => d.stage === "Negotiation");
    const negCount = negotiation.length;
    const negValue = negotiation.reduce((s, d) => s + (d.contract_value || 0), 0);
    const won = deals.filter(d => d.stage === "Won").length;
    const lost = deals.filter(d => d.stage === "Lost").length;
    const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const wonThisMonth = deals
      .filter(d => d.stage === "Won" && new Date(d.created_at) >= monthStart)
      .reduce((s, d) => s + (d.contract_value || 0), 0);

    return { totalPipeline, hotCount, negCount, negValue, winRate, wonThisMonth };
  }, [deals]);

  const fmt = (v: number) => {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
    return `₹${v}`;
  };

  const tiles = [
    { label: "Pipeline Value", value: fmt(metrics.totalPipeline), icon: TrendingUp },
    { label: "Hot Deals 🔥", value: String(metrics.hotCount), icon: Flame },
    { label: "In Negotiation", value: `${metrics.negCount} · ${fmt(metrics.negValue)}`, icon: Handshake },
    { label: "Win Rate", value: `${metrics.winRate}%`, icon: Target },
    { label: "Won This Month", value: fmt(metrics.wonThisMonth), icon: Trophy },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {tiles.map(t => (
        <Card key={t.label} className="p-3" style={{ background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <div className="flex items-center gap-2 mb-1">
            <t.icon className="h-4 w-4" style={{ color: "#006039" }} />
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#666666" }}>{t.label}</span>
          </div>
          <span className="text-lg font-bold" style={{ color: "#006039" }}>{t.value}</span>
        </Card>
      ))}
    </div>
  );
}
