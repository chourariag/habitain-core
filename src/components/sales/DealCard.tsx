import { GripVertical } from "lucide-react";

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

  return (
    <div
      onClick={onClick}
      className="rounded-lg p-3 cursor-pointer transition-shadow hover:shadow-md"
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderLeft: isWon ? "3px solid #006039" : "1px solid #E5E7EB",
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
      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#F7F7F7", color: "#666666" }}>
        {TYPE_LABELS[deal.project_type] || deal.project_type}
      </span>
      <div className="mt-2 font-bold text-base" style={{ color: "#006039" }}>{fmt(deal.contract_value)}</div>
      <div className="mt-1 text-[10px]" style={{ color: "#999" }}>
        {daysAgo === 0 ? "Today" : `${daysAgo}d ago`}
      </div>
    </div>
  );
}
