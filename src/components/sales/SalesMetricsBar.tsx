import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Flame, Handshake, TrendingUp, Target, Trophy, Star, BarChart3, ArrowRightLeft } from "lucide-react";

interface Deal {
  id: string;
  contract_value: number;
  temperature: string;
  stage: string;
  created_at: string;
  division?: string;
  lead_source?: string;
  [key: string]: any;
}

const ANNUAL_TARGET = 300000000;

export function SalesMetricsBar({ deals }: { deals: Deal[] }) {
  const metrics = useMemo(() => {
    const active = deals.filter(d => d.stage !== "Lost");
    const totalPipeline = active.reduce((s, d) => s + (d.contract_value || 0), 0);
    const hotCount = deals.filter(d => d.temperature === "hot" && d.stage !== "Lost").length;
    const negotiation = deals.filter(d => d.stage === "Negotiation");
    const negCount = negotiation.length;
    const negValue = negotiation.reduce((s, d) => s + (d.contract_value || 0), 0);
    const won = deals.filter(d => d.stage === "Won");
    const lost = deals.filter(d => d.stage === "Lost");
    const winRate = won.length + lost.length > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : 0;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const wonThisMonth = deals
      .filter(d => d.stage === "Won" && new Date(d.created_at) >= monthStart)
      .reduce((s, d) => s + (d.contract_value || 0), 0);

    const habitainerWon = won.filter(d => d.division !== "ads").reduce((s, d) => s + (d.contract_value || 0), 0);
    const adsWon = won.filter(d => d.division === "ads").reduce((s, d) => s + (d.contract_value || 0), 0);
    const adsConverted = won.filter(d => d.converted_from_ads_deal_id).length;
    const adsTotal = deals.filter(d => d.division === "ads").length;
    const conversionRate = adsTotal > 0 ? Math.round((adsConverted / adsTotal) * 100) : 0;

    // Lead channel this month
    const thisMonthDeals = deals.filter(d => new Date(d.created_at) >= monthStart);
    const referralCount = thisMonthDeals.filter(d => d.lead_source === "Referral").length;

    return { totalPipeline, hotCount, negCount, negValue, winRate, wonThisMonth, habitainerWon, adsWon, conversionRate, referralCount };
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
    <div className="space-y-3">
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

      {/* Division progress + conversion */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-3" style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4" style={{ color: "#006039" }} />
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#666" }}>Habitainer Won</span>
          </div>
          <div className="text-sm font-bold" style={{ color: "#006039" }}>{fmt(metrics.habitainerWon)}</div>
          <Progress value={Math.min(100, (metrics.habitainerWon / (ANNUAL_TARGET * 0.967)) * 100)} className="h-1.5 mt-1" />
        </Card>
        <Card className="p-3" style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4" style={{ color: "#D4860A" }} />
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#666" }}>ADS Won</span>
          </div>
          <div className="text-sm font-bold" style={{ color: "#D4860A" }}>{fmt(metrics.adsWon)}</div>
          <Progress value={Math.min(100, (metrics.adsWon / 10000000) * 100)} className="h-1.5 mt-1" />
        </Card>
        <Card className="p-3" style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <div className="flex items-center gap-2 mb-1">
            <ArrowRightLeft className="h-4 w-4" style={{ color: "#006039" }} />
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#666" }}>ADS→H Conversion</span>
          </div>
          <div className="text-sm font-bold" style={{ color: "#006039" }}>{metrics.conversionRate}%</div>
          <span className="text-[10px]" style={{ color: "#666" }}>Target: 60%</span>
        </Card>
      </div>

      {/* Referral badge */}
      {metrics.referralCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded" style={{ background: "#FFF8E1" }}>
          <Star className="h-4 w-4" style={{ color: "#D4860A" }} />
          <span className="text-xs font-semibold" style={{ color: "#D4860A" }}>{metrics.referralCount} referral leads this month</span>
        </div>
      )}
    </div>
  );
}
