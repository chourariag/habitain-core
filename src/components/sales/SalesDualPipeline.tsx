import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { DealCard } from "./DealCard";
import { DealCardActions } from "./DealCardActions";
import { DealDrawer } from "./DealDrawer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Home } from "lucide-react";

const STAGES = ["Inquiry", "Site Visit Done", "Proposal Sent", "Negotiation", "Won", "Lost"];

const DIVISION_CONFIG = {
  habitainer: {
    label: "Habitainer",
    color: "#006039",
    bg: "#E8F2ED",
    icon: Home,
  },
  ads: {
    label: "ADS",
    color: "#4F46E5",
    bg: "#EEF2FF",
    icon: Building2,
  },
};

const fmt = (v: number) => {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
};

function SalespersonProgress({ name, deals, color }: { name: string; deals: any[]; color: string }) {
  const won = deals.filter((d) => d.stage === "Won");
  const total = deals.length;
  const wonValue = won.reduce((s: number, d: any) => s + (d.contract_value || 0), 0);
  const pct = total > 0 ? Math.round((won.length / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-24 shrink-0">
        <p className="text-xs font-medium truncate" style={{ color: "#1A1A1A" }}>{name}</p>
        <p className="text-[10px]" style={{ color: "#999" }}>{won.length}/{total} won · {fmt(wonValue)}</p>
      </div>
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-semibold w-8 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

function DivisionKanban({
  division,
  deals,
  onRefresh,
}: {
  division: "habitainer" | "ads";
  deals: any[];
  onRefresh: () => void;
}) {
  const config = DIVISION_CONFIG[division];
  const [selectedDeal, setSelectedDeal] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dragDealId, setDragDealId] = useState<string | null>(null);

  const handleDrop = async (targetStage: string) => {
    if (!dragDealId) return;
    const deal = deals.find((d) => d.id === dragDealId);
    if (!deal || deal.stage === targetStage) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("sales_stage_history").insert({
      deal_id: deal.id,
      from_stage: deal.stage,
      to_stage: targetStage,
      changed_by: user?.id,
    });
    const { error } = await supabase.from("sales_deals").update({ stage: targetStage }).eq("id", deal.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Moved to ${targetStage}`);
      onRefresh();
    }
    setDragDealId(null);
  };

  // Per-salesperson summary
  const byPerson = useMemo(() => {
    const map: Record<string, any[]> = {};
    deals.forEach((d) => {
      const name = d.assigned_to || "Unassigned";
      if (!map[name]) map[name] = [];
      map[name].push(d);
    });
    return map;
  }, [deals]);

  const totalValue = deals.reduce((s, d) => s + (d.contract_value || 0), 0);
  const wonCount = deals.filter((d) => d.stage === "Won").length;

  return (
    <div className="space-y-4">
      {/* Division header */}
      <div className="flex items-center justify-between rounded-lg p-3" style={{ backgroundColor: config.bg }}>
        <div className="flex items-center gap-2">
          <config.icon className="h-5 w-5" style={{ color: config.color }} />
          <div>
            <p className="font-bold text-sm" style={{ color: config.color }}>{config.label} Division</p>
            <p className="text-[11px]" style={{ color: config.color + "99" }}>
              {deals.length} deals · {wonCount} won · {fmt(totalValue)} pipeline
            </p>
          </div>
        </div>
        <Badge variant="outline" style={{ color: config.color, borderColor: config.color }}>
          {wonCount} Won
        </Badge>
      </div>

      {/* Per-salesperson progress */}
      {Object.keys(byPerson).length > 0 && (
        <div className="rounded-lg border border-border p-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#999" }}>
            Salesperson Performance
          </p>
          {Object.entries(byPerson).map(([name, personDeals]) => (
            <SalespersonProgress key={name} name={name} deals={personDeals} color={config.color} />
          ))}
        </div>
      )}

      {/* Kanban columns */}
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-none">
        {STAGES.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage === stage);
          const stageValue = stageDeals.reduce((s, d) => s + (d.contract_value || 0), 0);
          return (
            <div
              key={stage}
              className="flex-shrink-0 rounded-lg flex flex-col"
              style={{ width: 220, minWidth: 220, background: "#F7F7F7" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage)}
            >
              <div className="rounded-t-lg px-3 py-2" style={{ background: config.color }}>
                <span className="text-white font-bold text-xs">{stage}</span>
                <span className="text-white/80 text-[10px] ml-1">
                  — {stageDeals.length} · {fmt(stageValue)}
                </span>
              </div>
              <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 450 }}>
                {stageDeals.map((deal) => (
                  <div key={deal.id} draggable onDragStart={() => setDragDealId(deal.id)}>
                    <DealCardActions
                      deal={deal}
                      onRefresh={onRefresh}
                      onEdit={() => {
                        setSelectedDeal(deal);
                        setDrawerOpen(true);
                      }}
                    >
                      <DealCard
                        deal={deal}
                        onClick={() => {
                          setSelectedDeal(deal);
                          setDrawerOpen(true);
                        }}
                      />
                    </DealCardActions>
                  </div>
                ))}
                {stageDeals.length === 0 && (
                  <div className="text-center py-6 text-xs" style={{ color: "#999" }}>No deals</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <DealDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        deal={selectedDeal}
        onSaved={onRefresh}
      />
    </div>
  );
}

export function SalesDualPipeline({ deals, onRefresh }: { deals: any[]; onRefresh: () => void }) {
  const habitainerDeals = deals.filter((d) => !d.division || d.division === "habitainer");
  const adsDeals = deals.filter((d) => d.division === "ads");

  return (
    <div className="space-y-8">
      <DivisionKanban division="habitainer" deals={habitainerDeals} onRefresh={onRefresh} />
      <div className="border-t border-border" />
      <DivisionKanban division="ads" deals={adsDeals} onRefresh={onRefresh} />
    </div>
  );
}
