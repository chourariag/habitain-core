import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["Submitted", "Approved", "Rejected", "Under Review"] as const;

export interface VariationRow {
  id: string;
  project_id: string;
  variation_number: string;
  description: string | null;
  status: string;
  valuation_excl_gst: number;
  previous_claim_excl_gst: number;
  this_claim_excl_gst: number;
}

interface Props {
  projectId: string;
  canEdit: boolean;
  onChange?: () => void;
}

const fmt = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export function VariationRegister({ projectId, canEdit, onChange }: Props) {
  const [rows, setRows] = useState<VariationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase.from("variation_register" as any) as any)
      .select("*").eq("project_id", projectId).order("variation_number", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data as VariationRow[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function addRow() {
    setSaving(true);
    const nextSeq = rows.length + 1;
    const variation_number = `VAR-${String(nextSeq).padStart(3, "0")}`;
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await (supabase.from("variation_register" as any) as any).insert({
      project_id: projectId, variation_number, status: "Submitted",
      valuation_excl_gst: 0, previous_claim_excl_gst: 0, this_claim_excl_gst: 0,
      created_by: userRes.user?.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Variation added");
    load();
    onChange?.();
  }

  async function updateField(id: string, patch: Partial<VariationRow>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    const { error } = await (supabase.from("variation_register" as any) as any).update(patch).eq("id", id);
    if (error) { toast.error(error.message); load(); return; }
    onChange?.();
  }

  async function removeRow(id: string) {
    if (!confirm("Delete this variation?")) return;
    const { error } = await (supabase.from("variation_register" as any) as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
    onChange?.();
  }

  return (
    <div className="p-3 bg-muted/20 border-t" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-foreground">Variation Register</h4>
        {canEdit && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addRow} disabled={saving}>
            <Plus className="h-3 w-3 mr-1" /> Add Variation
          </Button>
        )}
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground py-3 flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No variations yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-background border-b">
                <th className="px-2 py-1 text-left">No.</th>
                <th className="px-2 py-1 text-left">Description</th>
                <th className="px-2 py-1 text-left">Status</th>
                <th className="px-2 py-1 text-right">Valuation</th>
                <th className="px-2 py-1 text-right">Prev. Claim</th>
                <th className="px-2 py-1 text-right">This Claim</th>
                <th className="px-2 py-1 text-right">Remaining</th>
                {canEdit && <th className="px-2 py-1 w-8" />}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const remaining = (r.valuation_excl_gst || 0) - (r.previous_claim_excl_gst || 0) - (r.this_claim_excl_gst || 0);
                return (
                  <tr key={r.id} className="border-b">
                    <td className="px-2 py-1 font-mono">{r.variation_number}</td>
                    <td className="px-2 py-1">
                      {canEdit ? (
                        <Input className="h-7 text-[11px]" defaultValue={r.description ?? ""}
                          onBlur={(e) => e.target.value !== (r.description ?? "") && updateField(r.id, { description: e.target.value })}
                        />
                      ) : (r.description || "—")}
                    </td>
                    <td className="px-2 py-1">
                      {canEdit ? (
                        <Select value={r.status} onValueChange={(v) => updateField(r.id, { status: v })}>
                          <SelectTrigger className="h-7 text-[11px] w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : r.status}
                    </td>
                    {(["valuation_excl_gst","previous_claim_excl_gst","this_claim_excl_gst"] as const).map(k => (
                      <td key={k} className="px-2 py-1 text-right">
                        {canEdit ? (
                          <Input type="number" className="h-7 text-[11px] text-right w-24"
                            defaultValue={r[k]}
                            onBlur={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              if (v !== r[k]) updateField(r.id, { [k]: v } as any);
                            }}
                          />
                        ) : fmt(r[k])}
                      </td>
                    ))}
                    <td className="px-2 py-1 text-right font-semibold">{fmt(remaining)}</td>
                    {canEdit && (
                      <td className="px-2 py-1">
                        <button onClick={() => removeRow(r.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
