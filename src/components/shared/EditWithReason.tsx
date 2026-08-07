import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, History, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export type EditableTable =
  | "site_diary"
  | "daily_measurements"
  | "measurement_line_items"
  | "qc_inspections"
  | "qc_inspection_items";

export interface EditableField {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select";
  options?: { value: string; label: string }[];
}

export const REASON_CATEGORIES = [
  { value: "mistyped", label: "Mistyped" },
  { value: "misread_instrument", label: "Misread instrument" },
  { value: "wrong_unit", label: "Wrong unit" },
  { value: "forgot_to_update", label: "Forgot to update" },
  { value: "other", label: "Other" },
];

/** Permission check: submitter within 48h, or their manager / role owner any time. */
export function useCanEditRecord(table: EditableTable, recordId?: string | null) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!recordId) { setAllowed(false); return; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // line items inherit permission from their parent record
      const parentTable: EditableTable =
        table === "measurement_line_items" ? "daily_measurements"
        : table === "qc_inspection_items" ? "qc_inspections"
        : table;
      const { data } = await (supabase as any).rpc("can_edit_with_reason", {
        _user_id: user.id,
        _table: parentTable,
        _record_id: recordId,
      });
      if (active) setAllowed(Boolean(data));
    })();
    return () => { active = false; };
  }, [table, recordId]);

  return allowed;
}

interface EditDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  table: EditableTable;
  /** For line items, pass the parent id so permissions resolve correctly. */
  parentRecordId?: string;
  recordId: string;
  record: Record<string, any>;
  fields: EditableField[];
  title?: string;
  onSaved?: () => void;
}

export function EditWithReasonDialog({
  open, onOpenChange, table, recordId, record, fields, title, onSaved,
}: EditDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [category, setCategory] = useState("");
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      fields.forEach((f) => { initial[f.name] = record?.[f.name] == null ? "" : String(record[f.name]); });
      setValues(initial);
      setCategory("");
      setDetail("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recordId]);

  const changed = fields.filter((f) => {
    const original = record?.[f.name] == null ? "" : String(record[f.name]);
    return (values[f.name] ?? "") !== original;
  });

  const handleSave = async () => {
    if (!category) { toast.error("Select a reason category"); return; }
    if (changed.length === 0) { toast.error("No changes to save"); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      changed.forEach((f) => {
        payload[f.name] = {
          old: record?.[f.name] == null ? null : String(record[f.name]),
          new: values[f.name] === "" ? null : values[f.name],
        };
      });
      const { data, error } = await (supabase as any).rpc("apply_record_edit", {
        _table: table,
        _record_id: recordId,
        _changes: payload,
        _reason_category: category,
        _reason_detail: detail.trim() || null,
      });
      if (error) throw error;
      if (data?.downstream_flagged) {
        toast.warning("Edit saved. Billing was already finalized — flagged for manual review.");
      } else {
        toast.success("Edit saved and logged");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message || "Could not save edit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title || "Edit record"}</DialogTitle>
          <DialogDescription>
            Every change is logged with your name, the old value and the reason.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.name}>
              <Label className="text-xs">{f.label}</Label>
              {f.type === "textarea" ? (
                <Textarea
                  rows={3}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  className="mt-1 text-sm"
                />
              ) : f.type === "select" ? (
                <Select value={values[f.name] ?? ""} onValueChange={(val) => setValues((v) => ({ ...v, [f.name]: val }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {(f.options || []).map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={f.type === "number" ? "number" : "text"}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  className="mt-1 text-sm"
                />
              )}
            </div>
          ))}

          <div>
            <Label className="text-xs">Reason category <span className="text-destructive">*</span></Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Why is this being changed?" /></SelectTrigger>
              <SelectContent>
                {REASON_CATEGORIES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Detail (optional)</Label>
            <Textarea rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} className="mt-1 text-sm" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !category || changed.length === 0}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Small "Edit" trigger button, only rendered when the user is permitted. */
export function EditRecordButton({
  table, recordId, record, fields, title, onSaved, parentRecordId, size = "sm",
}: Omit<EditDialogProps, "open" | "onOpenChange"> & { size?: "sm" | "icon" }) {
  const [open, setOpen] = useState(false);
  const allowed = useCanEditRecord(table, parentRecordId || recordId);
  if (!allowed) return null;
  return (
    <>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setOpen(true)}>
        <Pencil className="h-3 w-3 mr-1" /> Edit
      </Button>
      <EditWithReasonDialog
        open={open} onOpenChange={setOpen}
        table={table} recordId={recordId} record={record}
        fields={fields} title={title} onSaved={onSaved}
      />
    </>
  );
}

const REASON_LABEL: Record<string, string> = Object.fromEntries(
  REASON_CATEGORIES.map((r) => [r.value, r.label])
);

/** Visible "Edited" badge with the full field-level history — shown to everyone. */
export function EditedIndicator({
  table, recordId, refreshKey,
}: { table: EditableTable; recordId: string; refreshKey?: number }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("edit_history")
        .select("*")
        .eq("record_table", table)
        .eq("record_id", recordId)
        .order("edited_at", { ascending: false });
      if (!active) return;
      setRows(data || []);
      const ids = [...new Set((data || []).map((r: any) => r.edited_by))];
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles").select("auth_user_id, display_name").in("auth_user_id", ids as string[]);
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => { map[p.auth_user_id] = p.display_name; });
        if (active) setNames(map);
      }
    })();
    return () => { active = false; };
  }, [table, recordId, refreshKey]);

  if (!rows || rows.length === 0) return null;
  const flagged = rows.some((r) => r.downstream_flagged);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className="cursor-pointer gap-1 text-[10px] border-warning/50 text-warning-foreground bg-warning/10"
        >
          <History className="h-3 w-3" />
          Edited ({rows.length})
          {flagged && <AlertTriangle className="h-3 w-3 text-destructive" />}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-80 overflow-y-auto p-3" align="start">
        <p className="text-xs font-semibold mb-2">Edit history</p>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="text-[11px] border-b border-border pb-2 last:border-0">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{r.field_name}</span>
                <span className="text-muted-foreground">
                  {format(new Date(r.edited_at), "dd/MM/yyyy HH:mm")}
                </span>
              </div>
              <p className="text-muted-foreground">
                <span className="line-through">{r.old_value ?? "—"}</span> → <span className="text-foreground">{r.new_value ?? "—"}</span>
              </p>
              <p className="text-muted-foreground">
                {REASON_LABEL[r.reason_category] || r.reason_category}
                {r.reason_detail ? ` — ${r.reason_detail}` : ""}
              </p>
              <p className="text-muted-foreground">by {names[r.edited_by] || "Unknown"}</p>
              {r.downstream_flagged && (
                <p className="text-destructive">Downstream billing flagged for manual review</p>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
