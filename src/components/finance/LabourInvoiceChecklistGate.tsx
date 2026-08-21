import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

export type ChecklistItem = {
  id: string;
  labour_invoice_id: string;
  item_label: string;
  is_auto: boolean;
  is_met: boolean;
  evidence_url: string | null;
  ticked_by: string | null;
  ticked_at: string | null;
};

interface Props {
  invoiceId: string;
  projectId: string | null;
  workOrder: { id: string; status: string; project_id: string | null } | null;
  canTick: boolean;
  userId: string | null;
  locked?: boolean;
  onAllMetChange?: (allMet: boolean) => void;
}

export const CHECKLIST_TEMPLATE: { label: string; auto: boolean }[] = [
  { label: "Work order measured & signed off", auto: true },
  { label: "Site supervisor confirms quantity", auto: false },
  { label: "Quality/defects cleared", auto: false },
  { label: "No open disputes on this work order", auto: true },
];

export function LabourInvoiceChecklistGate({
  invoiceId, projectId, workOrder, canTick, userId, locked, onAllMetChange,
}: Props) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("labour_invoice_checklist_items")
      .select("*")
      .eq("labour_invoice_id", invoiceId)
      .order("created_at");
    let rows = (data ?? []) as ChecklistItem[];

    if (rows.length === 0) {
      const { data: inserted } = await supabase
        .from("labour_invoice_checklist_items")
        .insert(CHECKLIST_TEMPLATE.map((t) => ({
          labour_invoice_id: invoiceId,
          item_label: t.label,
          is_auto: t.auto,
          is_met: false,
        })))
        .select("*");
      rows = (inserted ?? []) as ChecklistItem[];
    }

    // Resolve auto-checks
    const measuredOk = workOrder?.status === "measured_signed_off" || workOrder?.status === "closed";

    let noDisputes = true;
    const pid = projectId ?? workOrder?.project_id ?? null;
    if (pid) {
      const { data: claims } = await supabase.from("labour_claims").select("id").eq("project_id", pid);
      const claimIds = (claims ?? []).map((c: any) => c.id);
      if (claimIds.length) {
        const { count } = await supabase
          .from("dispute_log")
          .select("id", { count: "exact", head: true })
          .in("claim_id", claimIds);
        noDisputes = (count ?? 0) === 0;
      }
    }

    const autoValue = (label: string) =>
      label === CHECKLIST_TEMPLATE[0].label ? measuredOk : noDisputes;

    const toSync = rows.filter((r) => r.is_auto && r.is_met !== autoValue(r.item_label));
    if (toSync.length) {
      await Promise.all(toSync.map((r) =>
        supabase.from("labour_invoice_checklist_items")
          .update({
            is_met: autoValue(r.item_label),
            ticked_at: autoValue(r.item_label) ? new Date().toISOString() : null,
          })
          .eq("id", r.id)
      ));
      rows = rows.map((r) => r.is_auto ? { ...r, is_met: autoValue(r.item_label) } : r);
    }

    setItems(rows);
    setLoading(false);
  }, [invoiceId, projectId, workOrder]);

  useEffect(() => { load(); }, [load]);

  const allMet = items.length > 0 && items.every((i) => i.is_met);
  useEffect(() => { onAllMetChange?.(allMet); }, [allMet, onAllMetChange]);

  const tickItem = async (item: ChecklistItem) => {
    const { error } = await supabase.from("labour_invoice_checklist_items").update({
      is_met: true, ticked_by: userId, ticked_at: new Date().toISOString(),
    }).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const uploadEvidence = async (item: ChecklistItem, file: File) => {
    setUploading(item.id);
    try {
      const pid = projectId ?? workOrder?.project_id ?? "unassigned";
      const path = `${pid}/labour-invoices/${invoiceId}/${item.id}-${Date.now()}.${file.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage.from("vendor-quotes").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("labour_invoice_checklist_items").update({
        evidence_url: path, is_met: true, ticked_by: userId, ticked_at: new Date().toISOString(),
      }).eq("id", item.id);
      if (error) throw error;
      toast.success("Evidence uploaded");
      load();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const viewEvidence = async (path: string) => {
    const { data, error } = await supabase.storage.from("vendor-quotes").createSignedUrl(path, 300);
    if (error || !data) { toast.error("Could not open evidence"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Pre-Billing Checklist</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading checklist…</p>
        ) : items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg border border-border">
            <div className="mt-0.5">
              {item.is_met
                ? <CheckCircle2 className="h-5 w-5" style={{ color: "#006039" }} />
                : <XCircle className="h-5 w-5" style={{ color: "#F40009" }} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: item.is_met ? "#1A1A1A" : "#666666" }}>{item.item_label}</p>
              {item.is_auto && <span className="text-[10px] text-muted-foreground">(auto-checked)</span>}
              {item.ticked_at && !item.is_auto && (
                <p className="text-[10px] text-muted-foreground">Ticked on {format(new Date(item.ticked_at), "dd/MM/yyyy")}</p>
              )}
              {item.evidence_url && (
                <button type="button" onClick={() => viewEvidence(item.evidence_url!)} className="text-[10px] underline" style={{ color: "#006039" }}>
                  View Evidence
                </button>
              )}
            </div>
            {!locked && canTick && !item.is_auto && (
              <div className="flex items-center gap-1 shrink-0">
                {!item.is_met && (
                  <Button size="sm" variant="ghost" className="text-[10px] h-7" onClick={() => tickItem(item)}>✓ Tick</Button>
                )}
                <Label className="cursor-pointer">
                  <div className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-border hover:bg-muted transition-colors">
                    {uploading === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    Evidence
                  </div>
                  <Input type="file" accept=".pdf,image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadEvidence(item, f); }} />
                </Label>
              </div>
            )}
          </div>
        ))}
        {!loading && !allMet && (
          <p className="text-[11px]" style={{ color: "#D4860A" }}>
            All items must be met before this labour invoice can be approved or sent.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
