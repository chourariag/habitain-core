import { useState } from "react";
import { DealCard } from "./DealCard";
import { DealDrawer } from "./DealDrawer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STAGES = ["Inquiry", "Site Visit Done", "Proposal Sent", "Negotiation", "Won", "Lost"];

interface Deal {
  id: string;
  client_name: string;
  project_type: string;
  contract_value: number;
  temperature: string;
  stage: string;
  assigned_to: string | null;
  updated_at: string;
  [key: string]: any;
}

export function PipelineKanban({ deals, onRefresh }: { deals: Deal[]; onRefresh: () => void }) {
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dragDealId, setDragDealId] = useState<string | null>(null);

  const fmt = (v: number) => {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
    return `₹${v}`;
  };

  const handleDrop = async (targetStage: string) => {
    if (!dragDealId) return;
    const deal = deals.find(d => d.id === dragDealId);
    if (!deal || deal.stage === targetStage) return;

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("sales_stage_history").insert({
      deal_id: deal.id, from_stage: deal.stage, to_stage: targetStage, changed_by: user?.id,
    });
    const { error } = await supabase.from("sales_deals").update({ stage: targetStage }).eq("id", deal.id);
    if (error) toast.error(error.message);
    else { toast.success(`Moved to ${targetStage}`); onRefresh(); }
    setDragDealId(null);
  };

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-none" style={{ minHeight: 400 }}>
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage);
          const total = stageDeals.reduce((s, d) => s + (d.contract_value || 0), 0);
          return (
            <div
              key={stage}
              className="flex-shrink-0 rounded-lg flex flex-col"
              style={{ width: 240, minWidth: 240, background: "#F7F7F7" }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(stage)}
            >
              <div className="rounded-t-lg px-3 py-2" style={{ background: "#006039" }}>
                <span className="text-white font-bold text-xs">{stage}</span>
                <span className="text-white/80 text-[10px] ml-1">— {stageDeals.length} · {fmt(total)}</span>
              </div>
              <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 500 }}>
                {stageDeals.map(deal => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => setDragDealId(deal.id)}
                  >
                    <DealCard deal={deal} onClick={() => { setSelectedDeal(deal); setDrawerOpen(true); }} />
                  </div>
                ))}
                {stageDeals.length === 0 && (
                  <div className="text-center py-8 text-xs" style={{ color: "#999" }}>No deals</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <DealDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} deal={selectedDeal} onSaved={onRefresh} />
    </>
  );
}
