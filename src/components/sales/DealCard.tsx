import { GripVertical, Clock, AlertTriangle } from "lucide-react";

const TEMP_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  hot: { bg: "#F40009", text: "#FFFFFF", label: "🔥 Hot" },
  warm: { bg: "#D4860A", text: "#FFFFFF", label: "~ Warm" },
  cold: { bg: "#666666", text: "#FFFFFF", label: "❄ Cold" },
};

const TYPE_LABELS: Record<string, string> = {
  "Residential Modular": "Res. Modular",
  "Residential Panel": "Res. Panel",
  Villa: "Villa",
  Commercial: "Commercial",
  Other: "Other",
};

const STAGNATION_THRESHOLDS: Record<string, number> = {
  b2b_corporate: 45,
  resort_hospitality: 180,
  b2c_home: 90,
  developer: 90,
  other: 90,
};

interface DealCardProps {
  deal: {
    id: string;
    client_name: string;
    project_type: string;
    contract_value: number;
    temperature: string;
    stage: string;
    assigned_to: string | null;
    updated_at: string;
    division?: string;
    client_type?: string;
    re_engaged_at?: string | null;
  };
  onClick: () => void;
}

export function DealCard({ deal, onClick }: DealCardProps) {
  const temp = TEMP_STYLES[deal.temperature] || TEMP_STYLES.warm;
  const isWon = deal.stage === "Won";
  const isLost = deal.stage === "Lost";

  const fmt = (v: number) => {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
    return `₹${v}`;
  };

  const daysAgo = Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / 86400000);
  const threshold = STAGNATION_THRESHOLDS[deal.client_type || "other"] || 90;
  const isStagnant = !isWon && !isLost && daysAgo > threshold;

  return (
    <div
      onClick={onClick}
      className="rounded-lg p-3 cursor-pointer transition-shadow hover:shadow-md"
      style={{
        background: isStagnant ? "#FFF8F8" : "#FFFFFF",
        border: isStagnant ? "1px solid #F40009" : isWon ? "1px solid #006039" : "1px solid #E5E7EB",
        borderLeft: isWon ? "3px solid #006039" : isStagnant ? "3px solid #F40009" : "1px solid #E5E7EB",
        opacity: isLost ? 0.6 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="font-bold text-sm" style={{ color: "#1A1A1A" }}>{deal.client_name}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
          style={{ background: temp.bg, color: temp.text }}>
          {temp.label}
        </span>
      </div>

      <div className="flex items-center gap-1 flex-wrap mb-1">
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#F7F7F7", color: "#666666" }}>
          {TYPE_LABELS[deal.project_type] || deal.project_type}
        </span>
        {deal.division && deal.division !== "habitainer" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
            style={{ background: deal.division === "ads" ? "#D4860A" : "#006039", color: "#fff" }}>
            {deal.division === "ads" ? "ADS" : "H+ADS"}
          </span>
        )}
        {deal.re_engaged_at && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#006039", color: "#fff" }}>
            Re-engaged
          </span>
        )}
      </div>

      <div className="mt-1 font-bold text-base" style={{ color: "#006039" }}>{fmt(deal.contract_value)}</div>

      <div className="mt-1 flex items-center gap-2">
        <span className="text-[10px]" style={{ color: isStagnant ? "#F40009" : "#999" }}>
          {daysAgo === 0 ? "Today" : `${daysAgo}d ago`}
        </span>
        {isStagnant && (
          <span className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: "#F40009" }}>
            <AlertTriangle className="h-3 w-3" /> Stagnant
          </span>
        )}
      </div>
    </div>
  );
}
