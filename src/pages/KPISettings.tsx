import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { DIRECTORS_AND_MD } from "@/lib/kpi-helpers";
import { toast } from "sonner";

export default function KPISettings() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const userRole = role as AppRole | null;
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDef, setEditDef] = useState<any | null>(null);
  const [targetValue, setTargetValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterRole, setFilterRole] = useState("all");

  const canEdit = userRole && DIRECTORS_AND_MD.includes(userRole);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from("kpi_definitions").select("*").eq("is_active", true).order("role").order("kpi_name");
    setDefinitions(data ?? []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!editDef || !user) return;
    setSaving(true);

    const newTarget = parseFloat(targetValue);
    if (isNaN(newTarget)) { toast.error("Invalid target value"); setSaving(false); return; }

    // Update definition
    const { error } = await supabase.from("kpi_definitions").update({
      target_value: newTarget,
      effective_from: new Date().toISOString().split("T")[0],
    }).eq("id", editDef.id);

    if (error) { toast.error("Failed to save"); setSaving(false); return; }

    // Log history
    await supabase.from("kpi_targets_history").insert({
      kpi_key: editDef.kpi_key,
      role: editDef.role,
      old_target: editDef.target_value,
      new_target: newTarget,
      changed_by: user.id,
      reason: note || null,
    });

    toast.success("Target saved");
    setEditDef(null);
    setTargetValue("");
    setNote("");
    setSaving(false);
    fetchData();
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const roles = [...new Set(definitions.map((d: any) => d.role))];
  const filtered = filterRole === "all" ? definitions : definitions.filter((d: any) => d.role === filterRole);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">KPI Settings</h1>
      <p className="text-sm text-muted-foreground">Configure KPI targets for each role. Targets activate immediately upon saving.</p>

      <Select value={filterRole} onValueChange={setFilterRole}>
        <SelectTrigger className="w-56"><SelectValue placeholder="Filter by role" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Roles</SelectItem>
          {roles.map((r: string) => <SelectItem key={r} value={r}>{ROLE_LABELS[r as AppRole] || r}</SelectItem>)}
        </SelectContent>
      </Select>

      <div className="rounded-lg border border-border overflow-x-auto bg-background">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#F7F7F7" }}>
              {["Role", "KPI Name", "Target", "Unit", "Period", "Data Source", "Active", ""].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d: any) => (
              <tr key={d.id} className="border-t border-border">
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{ROLE_LABELS[d.role as AppRole] || d.role}</td>
                <td className="px-4 py-2.5 font-medium text-foreground">{d.kpi_name}</td>
                <td className="px-4 py-2.5 font-mono text-sm">
                  {d.target_value !== null ? (
                    <span style={{ color: "#006039" }}>{d.target_value}</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "#FFF8E8", color: "#D4860A" }}>
                      Set during Phase 5
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{d.unit}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground capitalize">{d.measurement_period}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{d.data_source_table || "—"}</td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline" className="text-[10px]" style={{ color: "#006039", borderColor: "#006039" }}>Yes</Badge>
                </td>
                <td className="px-4 py-2.5">
                  {canEdit && (
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" style={{ color: "#006039" }}
                      onClick={() => { setEditDef(d); setTargetValue(d.target_value?.toString() || ""); setNote(""); }}>
                      <Pencil className="h-3 w-3" /> Edit Target
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Drawer */}
      <Drawer open={!!editDef} onOpenChange={(v) => { if (!v) setEditDef(null); }}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Edit KPI Target</DrawerTitle>
          </DrawerHeader>
          {editDef && (
            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="rounded-lg p-3" style={{ backgroundColor: "#F7F7F7" }}>
                <p className="text-sm font-medium text-foreground">{editDef.kpi_name}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[editDef.role as AppRole] || editDef.role} · {editDef.measurement_period}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs" style={{ color: "#666" }}>Target Value ({editDef.unit})</Label>
                <Input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="Enter target" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs" style={{ color: "#666" }}>Note for employee (shown in scorecard)</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" rows={2} maxLength={200} />
              </div>

              <div className="flex gap-2 pt-2">
                <Button className="flex-1 text-white" style={{ backgroundColor: "#006039" }} onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Target"}
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline" className="flex-1">Cancel</Button>
                </DrawerClose>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
