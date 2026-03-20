import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STAGES = ["Inquiry", "Site Visit Done", "Proposal Sent", "Negotiation", "Won", "Lost"];
const LOST_REASONS = ["Price Too High", "Went with Competitor", "Project Cancelled", "No Response", "Budget Cut", "Other"];

interface Deal {
  id: string;
  client_name: string;
  stage: string;
  [key: string]: any;
}

interface DealCardActionsProps {
  deal: Deal;
  children: React.ReactNode;
  onRefresh: () => void;
  onEdit: () => void;
}

export function DealCardActions({ deal, children, onRefresh, onEdit }: DealCardActionsProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lostConfirm, setLostConfirm] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const longPressTimer = { current: null as ReturnType<typeof setTimeout> | null };

  const currentIdx = STAGES.indexOf(deal.stage);
  const nextStage = currentIdx >= 0 && currentIdx < STAGES.length - 1 ? STAGES[currentIdx + 1] : null;

  const moveToStage = async (targetStage: string) => {
    if (targetStage === deal.stage) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("sales_stage_history").insert({
      deal_id: deal.id, from_stage: deal.stage, to_stage: targetStage, changed_by: user?.id,
    });
    const updateData: any = { stage: targetStage };
    if (targetStage === "Lost" && lostReason) updateData.lost_reason = lostReason;
    const { error } = await supabase.from("sales_deals").update(updateData).eq("id", deal.id);
    if (error) toast.error(error.message);
    else { toast.success(`${deal.client_name} moved to ${targetStage}`); onRefresh(); }
    setMobileOpen(false);
    setLostConfirm(false);
    setLostReason("");
  };

  const handleMarkLost = () => {
    setLostConfirm(true);
  };

  const confirmLost = () => {
    if (!lostReason) { toast.error("Select a reason"); return; }
    moveToStage("Lost");
  };

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => setMobileOpen(true), 400);
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  return (
    <>
      {/* Desktop: right-click context menu */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            {children}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52 bg-white rounded-lg shadow-lg border" style={{ borderColor: "#E5E7EB" }}>
          {nextStage && nextStage !== "Lost" && (
            <ContextMenuItem
              onClick={() => moveToStage(nextStage)}
              className="font-semibold"
              style={{ color: "#006039" }}
            >
              Move to {nextStage}
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => setMobileOpen(true)}>
            Move to…
          </ContextMenuItem>
          <ContextMenuSeparator />
          {deal.stage !== "Lost" && (
            <ContextMenuItem onClick={handleMarkLost} style={{ color: "#F40009" }}>
              Mark as Lost
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={onEdit}>
            Edit Details
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Mobile bottom sheet + Lost confirmation */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => { setMobileOpen(false); setLostConfirm(false); }}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative bg-white w-full max-w-md rounded-t-2xl p-4 pb-8 space-y-2 animate-in slide-in-from-bottom"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />

            {!lostConfirm ? (
              <>
                {nextStage && nextStage !== "Lost" && (
                  <Button
                    className="w-full justify-start font-semibold text-left"
                    variant="ghost"
                    style={{ color: "#006039" }}
                    onClick={() => moveToStage(nextStage)}
                  >
                    Move to {nextStage}
                  </Button>
                )}

                <div className="space-y-1">
                  <p className="text-xs font-medium px-3 pt-2" style={{ color: "#666666" }}>Move to…</p>
                  {STAGES.filter(s => s !== deal.stage).map(s => (
                    <Button
                      key={s}
                      variant="ghost"
                      className="w-full justify-start text-left"
                      style={{ color: s === "Lost" ? "#F40009" : "#1A1A1A" }}
                      onClick={() => s === "Lost" ? handleMarkLost() : moveToStage(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>

                {deal.stage !== "Lost" && (
                  <>
                    <div className="border-t my-2" style={{ borderColor: "#E5E7EB" }} />
                    <Button variant="ghost" className="w-full justify-start" style={{ color: "#F40009" }} onClick={handleMarkLost}>
                      Mark as Lost
                    </Button>
                  </>
                )}

                <Button variant="ghost" className="w-full justify-start" onClick={onEdit}>
                  Edit Details
                </Button>

                <div className="border-t my-2" style={{ borderColor: "#E5E7EB" }} />
                <Button variant="ghost" className="w-full justify-start" style={{ color: "#666666" }} onClick={() => setMobileOpen(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <p className="font-semibold text-sm" style={{ color: "#1A1A1A" }}>Mark "{deal.client_name}" as Lost</p>
                <Select value={lostReason} onValueChange={setLostReason}>
                  <SelectTrigger><SelectValue placeholder="Select reason…" /></SelectTrigger>
                  <SelectContent>
                    {LOST_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button className="w-full" style={{ background: "#F40009", color: "#fff" }} onClick={confirmLost}>
                  Confirm Lost
                </Button>
                <button className="w-full text-center text-sm underline" style={{ color: "#666666" }} onClick={() => setLostConfirm(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
