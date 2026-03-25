import { Badge } from "@/components/ui/badge";

interface Props {
  dqs: any[];
}

export function DQStatsBar({ dqs }: Props) {
  const openCount = dqs.filter((d: any) => d.status === "open").length;
  const inReviewCount = dqs.filter((d: any) => d.status === "under_review").length;
  const resolvedCount = dqs.filter((d: any) => d.status === "resolved" || d.status === "closed").length;
  const escalatedCount = dqs.filter((d: any) => {
    if (d.status === "resolved" || d.status === "closed") return false;
    const hoursOpen = (Date.now() - new Date(d.created_at).getTime()) / (1000 * 60 * 60);
    return hoursOpen > 24;
  }).length;

  const tiles = [
    { label: "Open", count: openCount, bg: "hsl(359 100% 48% / 0.1)", color: "hsl(var(--destructive))" },
    { label: "In Review", count: inReviewCount, bg: "hsl(36 88% 44% / 0.1)", color: "hsl(var(--warning))" },
    { label: "Resolved", count: resolvedCount, bg: "hsl(var(--accent))", color: "hsl(var(--primary))" },
    { label: "Escalated", count: escalatedCount, bg: "hsl(359 100% 48% / 0.1)", color: "hsl(var(--destructive))" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tiles.map((t) => (
        <div key={t.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ backgroundColor: t.bg }}>
          <span className="text-lg font-bold" style={{ color: t.color }}>{t.count}</span>
          <span className="text-xs font-medium" style={{ color: t.color }}>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

export function DQEscalationBadge({ dq }: { dq: any }) {
  if (dq.status === "resolved" || dq.status === "closed") return null;
  const hoursOpen = (Date.now() - new Date(dq.created_at).getTime()) / (1000 * 60 * 60);
  if (hoursOpen > 24) {
    return <Badge variant="outline" className="text-[9px]" style={{ backgroundColor: "hsl(359 100% 48% / 0.1)", color: "hsl(var(--destructive))", border: "none" }}>ESCALATED</Badge>;
  }
  if (hoursOpen > 18) {
    const remaining = Math.ceil(24 - hoursOpen);
    return <span className="text-[9px]" style={{ color: "hsl(var(--warning))" }}>Escalates in {remaining}h</span>;
  }
  return null;
}
