import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { GFC_QC_ITEMS } from "@/lib/gfc-qc-items";
import { format } from "date-fns";

interface Props {
  projectId: string;
  isArchitect: boolean;
  userId: string | null;
  userName: string;
  onChange?: (stats: { checked: number; total: number; allChecked: boolean }) => void;
}

interface ChecklistRow {
  id?: string;
  item_number: number;
  item_label: string;
  checked: boolean;
  note: string | null;
  checked_by_name: string | null;
  checked_at: string | null;
}

export function GFCQCChecklistSection({ projectId, isArchitect, userId, userName, onChange }: Props) {
  const [rows, setRows] = useState<ChecklistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  const fetchRows = useCallback(async () => {
    const { data } = await (supabase.from("gfc_qc_checklist") as any)
      .select("*")
      .eq("project_id", projectId)
      .order("item_number");
    const existing: ChecklistRow[] = data ?? [];
    // Merge with master list so we always show all 18, even before seeding
    const merged: ChecklistRow[] = GFC_QC_ITEMS.map((label, idx) => {
      const num = idx + 1;
      const found = existing.find((r) => r.item_number === num);
      return found ?? { item_number: num, item_label: label, checked: false, note: null, checked_by_name: null, checked_at: null };
    });
    setRows(merged);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  useEffect(() => {
    const checked = rows.filter((r) => r.checked).length;
    onChange?.({ checked, total: GFC_QC_ITEMS.length, allChecked: checked === GFC_QC_ITEMS.length });
  }, [rows, onChange]);

  const upsertRow = async (row: ChecklistRow, patch: Partial<ChecklistRow>) => {
    if (!isArchitect) return;
    setSaving(row.item_number);
    const next: ChecklistRow = { ...row, ...patch };
    const payload: any = {
      project_id: projectId,
      item_number: next.item_number,
      item_label: next.item_label,
      checked: next.checked,
      note: next.note,
      checked_by: next.checked ? userId : null,
      checked_by_name: next.checked ? userName : null,
      checked_at: next.checked ? new Date().toISOString() : null,
    };
    const { client } = await getAuthedClient();
    await (client.from("gfc_qc_checklist") as any).upsert(payload, { onConflict: "project_id,item_number" });
    setRows((prev) => prev.map((r) => r.item_number === next.item_number ? { ...next, checked_at: payload.checked_at, checked_by_name: payload.checked_by_name } : r));
    setSaving(null);
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const checkedCount = rows.filter((r) => r.checked).length;
  const allDone = checkedCount === GFC_QC_ITEMS.length;

  return (
    <Card className="border-[#006039]/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" style={{ color: "#006039" }} />
            <CardTitle className="text-base font-display">GFC QC Checklist — Karan's Sign-off</CardTitle>
          </div>
          <span
            className="text-xs px-2 py-1 rounded font-medium"
            style={{
              backgroundColor: allDone ? "#E8F2ED" : "#FFF8E8",
              color: allDone ? "#006039" : "#D4860A",
            }}
          >
            {checkedCount} / {GFC_QC_ITEMS.length} {allDone ? "complete — H1 unlocked" : "complete"}
          </span>
        </div>
        <p className="text-xs mt-1 text-muted-foreground">
          All 18 items must be checked before H1 sign-off can be issued.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {rows.map((r) => (
            <div key={r.item_number} className="flex items-start gap-2 p-2 rounded hover:bg-muted/30 border-b border-border/40 last:border-0">
              <div className="pt-0.5">
                <Checkbox
                  checked={r.checked}
                  disabled={!isArchitect || saving === r.item_number}
                  onCheckedChange={(v) => upsertRow(r, { checked: !!v })}
                />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono text-muted-foreground">{String(r.item_number).padStart(2, "0")}.</span>
                  <span className={`text-sm ${r.checked ? "line-through text-muted-foreground" : ""}`}>{r.item_label}</span>
                </div>
                <Input
                  className="h-7 text-xs"
                  placeholder="Optional note…"
                  defaultValue={r.note || ""}
                  disabled={!isArchitect}
                  onBlur={(e) => {
                    if (e.target.value !== (r.note || "")) {
                      upsertRow(r, { note: e.target.value || null });
                    }
                  }}
                />
                {r.checked && r.checked_by_name && r.checked_at && (
                  <p className="text-[10px] text-muted-foreground">
                    Checked by {r.checked_by_name} on {format(new Date(r.checked_at), "dd/MM/yyyy")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
