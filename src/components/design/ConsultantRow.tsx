import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getAuthedClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const CONSULTANT_TYPES = ["Structural Engineer", "MEP Consultant", "Landscape", "Geotechnical", "Fire Safety", "Other"];
const CONSULTANT_STATUSES = ["awaiting_brief", "brief_issued", "drawings_received", "under_review", "revisions_requested", "approved"];

const consultantStatusLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

interface Props {
  consultant: any;
  canEdit: boolean;
  onSaved: () => void;
}

export function ConsultantRow({ consultant, canEdit, onSaved }: Props) {
  const [local, setLocal] = useState({
    consultant_type: "",
    name: "",
    firm: "",
    phone: "",
    email: "",
    status: "",
    drawings_uploaded: false,
    review_complete: false,
    approved: false,
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLocal({
      consultant_type: consultant.consultant_type ?? "Other",
      name: consultant.name ?? "",
      firm: consultant.firm ?? "",
      phone: consultant.phone ?? "",
      email: consultant.email ?? "",
      status: consultant.status ?? "awaiting_brief",
      drawings_uploaded: consultant.drawings_uploaded ?? false,
      review_complete: consultant.review_complete ?? false,
      approved: consultant.approved ?? false,
    });
    setDirty(false);
  }, [consultant.id, consultant.updated_at]);

  const update = (field: string, value: any) => {
    setLocal((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSave = useCallback(async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const updates: any = { ...local };
      if (local.status === "brief_issued" && !consultant.brief_issued_at) {
        updates.brief_issued_at = new Date().toISOString();
      }
      const { client } = await getAuthedClient();
      await (client.from("design_consultants") as any).update(updates).eq("id", consultant.id);
      setDirty(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }, [local, dirty, consultant.id, consultant.brief_issued_at, onSaved]);

  const statusBadgeStyle =
    local.status === "approved" ? { backgroundColor: "#E8F2ED", color: "#006039", border: "none" } :
    local.status === "revisions_requested" ? { backgroundColor: "#FFF0F0", color: "#F40009", border: "none" } :
    local.status === "under_review" ? { backgroundColor: "#FFF8E8", color: "#D4860A", border: "none" } :
    local.status === "drawings_received" ? { backgroundColor: "#E8F0FE", color: "#1A73E8", border: "none" } :
    { backgroundColor: "#F5F5F5", color: "#666666", border: "none" };

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm">{local.name || "Unnamed"}</span>
          <span className="text-xs text-muted-foreground">({local.consultant_type})</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" style={statusBadgeStyle}>{consultantStatusLabel(local.status)}</Badge>
          {dirty && (
            <Button size="sm" variant="outline" onClick={handleSave} disabled={saving} className="text-xs h-7">
              {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Save
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px]">Type</Label>
          <Select value={local.consultant_type} onValueChange={(v) => update("consultant_type", v)} disabled={!canEdit}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{CONSULTANT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px]">Name</Label>
          <Input className="h-8 text-xs" value={local.name} onChange={(e) => update("name", e.target.value)} onBlur={handleSave} disabled={!canEdit} />
        </div>
        <div>
          <Label className="text-[10px]">Firm</Label>
          <Input className="h-8 text-xs" value={local.firm} onChange={(e) => update("firm", e.target.value)} onBlur={handleSave} disabled={!canEdit} />
        </div>
        <div>
          <Label className="text-[10px]">Phone</Label>
          <Input className="h-8 text-xs" value={local.phone} onChange={(e) => update("phone", e.target.value)} onBlur={handleSave} disabled={!canEdit} />
        </div>
        <div>
          <Label className="text-[10px]">Email</Label>
          <Input className="h-8 text-xs" value={local.email} onChange={(e) => update("email", e.target.value)} onBlur={handleSave} disabled={!canEdit} />
        </div>
        <div>
          <Label className="text-[10px]">Status</Label>
          <Select value={local.status} onValueChange={(v) => { update("status", v); }} disabled={!canEdit}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{CONSULTANT_STATUSES.map((s) => <SelectItem key={s} value={s}>{consultantStatusLabel(s)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-border">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <Checkbox checked={local.drawings_uploaded} onCheckedChange={(v) => update("drawings_uploaded", !!v)} disabled={!canEdit} />
          <span>Drawings Received</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <Checkbox checked={local.review_complete} onCheckedChange={(v) => update("review_complete", !!v)} disabled={!canEdit} />
          <span>Review Complete</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <Checkbox checked={local.approved} onCheckedChange={(v) => update("approved", !!v)} disabled={!canEdit} />
          <span>Approved</span>
        </label>
      </div>
    </div>
  );
}
