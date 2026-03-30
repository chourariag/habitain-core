import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { insertNotifications } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Check, ClipboardCheck, Lock, Loader2, Package, Wrench, Plus, Trash2, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";

const MODULES_ITEMS = [
  "All modules and panels physically present at loading bay",
  "Quantity matches the approved dispatch order",
  "Each module/panel ID verified against project register",
  "All panels wrapped and edge-protected",
  "Electrical connections capped and taped at all penetrations",
  "MEP penetrations sealed with fire-rated sealant",
  "Structural bolts, connectors, and brackets packed separately and labelled",
  "Glass and window units padded and secured",
  "Finish surfaces protected with foam or bubble wrap",
  "All panels labelled with project name, module ID, and installation sequence",
  "Loading sequence planned and marked on panels",
  "Driver briefed on handling instructions and site address",
  "Dispatch order document printed and signed by supervisor",
];

const TOOLS_ITEMS = [
  "Power drill with full battery and spare battery",
  "Impact wrench and socket set",
  "Angle grinder with cutting and grinding discs",
  "Spirit level — 1 metre and 2 metre",
  "Measuring tape — 5 metre and 30 metre",
  "Plumb bob",
  "Hammer drill with masonry bits set",
  "Screwdriver set — flathead and Phillips",
  "Spanner set — open-ended and ring",
  "Allen key set — metric",
  "Pipe wrench",
  "Wire stripper and crimping tool",
  "Multimeter and voltage tester",
  "Scaffolding frames and cross braces — quantity as per site plan",
  "Safety harnesses — one per team member",
  "Ladders — 6ft and 12ft",
  "Extension cords — 25 metre minimum",
  "Work lights — battery powered",
  "Trolley and sack barrow",
  "Manual chain pulley block",
  "Self-tapping screws — assorted sizes, minimum 500 pieces",
  "Anchor bolts and rawl plugs — assorted",
  "Silicone sealant — white and grey — minimum 10 tubes each",
  "Duct tape and masking tape",
  "Cable ties — assorted sizes",
  "Wire connectors and terminal blocks",
  "Safety gloves — one pair per team member",
  "Safety helmets — one per team member",
  "First aid kit — stocked and verified",
  "Fire extinguisher — charged and in date",
];

type AdditionalMaterial = {
  description: string;
  qty: number;
  unit: string;
  source: string;
  notes: string;
};

export default function DeliveryChecklist() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { role, userId } = useUserRole();

  const [projectName, setProjectName] = useState("");
  const [siteReady, setSiteReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checklist, setChecklist] = useState<any>(null);
  const [tab, setTab] = useState("modules");

  const [modulesChecked, setModulesChecked] = useState<boolean[]>(new Array(MODULES_ITEMS.length).fill(false));
  const [toolsChecked, setToolsChecked] = useState<boolean[]>(new Array(TOOLS_ITEMS.length).fill(false));
  const [additionalMaterials, setAdditionalMaterials] = useState<AdditionalMaterial[]>([]);

  const canEditModules = ["factory_floor_supervisor", "production_head", "super_admin", "managing_director"].includes(role ?? "");
  const canEditTools = ["stores_executive", "super_admin", "managing_director"].includes(role ?? "");
  const canEditAdditional = ["site_installation_mgr", "super_admin", "managing_director"].includes(role ?? "");

  const modulesSigned = !!checklist?.modules_signed_at;
  const toolsSigned = !!checklist?.tools_signed_at;
  const additionalSigned = !!checklist?.additional_signed_at;
  const allSigned = modulesSigned && toolsSigned && additionalSigned;
  const dispatched = checklist?.status === "dispatched";

  const sectionsComplete = [modulesSigned, toolsSigned, additionalSigned].filter(Boolean).length;

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const [{ data: proj }, { data: cl }] = await Promise.all([
      supabase.from("projects").select("name, site_ready_confirmed").eq("id", projectId).single(),
      (supabase.from("delivery_checklists") as any).select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1),
    ]);
    setProjectName((proj as any)?.name ?? "");
    setSiteReady((proj as any)?.site_ready_confirmed ?? false);
    const record = (cl as any[])?.[0] ?? null;
    setChecklist(record);
    if (record) {
      const mc = record.modules_checklist as boolean[] | null;
      if (mc && Array.isArray(mc)) setModulesChecked(mc.length === MODULES_ITEMS.length ? mc : new Array(MODULES_ITEMS.length).fill(false));
      const tc = record.tools_checklist as boolean[] | null;
      if (tc && Array.isArray(tc)) setToolsChecked(tc.length === TOOLS_ITEMS.length ? tc : new Array(TOOLS_ITEMS.length).fill(false));
      const am = record.additional_materials as AdditionalMaterial[] | null;
      if (am && Array.isArray(am)) setAdditionalMaterials(am);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Bug 16 fix: guard against direct URL access when site is not ready
  if (!loading && siteReady === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-8" style={{ backgroundColor: "#FFFFFF" }}>
        <AlertTriangle className="h-12 w-12" style={{ color: "#D4860A" }} />
        <div className="text-center space-y-1">
          <h2 className="font-display text-xl font-bold" style={{ color: "#1A1A1A" }}>Site Not Ready</h2>
          <p className="text-sm max-w-sm" style={{ color: "#666666" }}>
            The Site Readiness Checklist must be completed before the Delivery Checklist can be accessed.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/production")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Production
        </Button>
      </div>
    );
  }

  const ensureRecord = async () => {
    if (checklist) return checklist.id;
    const { client } = await getAuthedClient();
    const { data, error } = await (client.from("delivery_checklists") as any).insert({
      project_id: projectId,
      site_ready_confirmed_at: new Date().toISOString(),
      status: "in_progress",
    }).select("id").single();
    if (error) throw error;
    return data.id;
  };

  const handleSignOffModules = async () => {
    if (!modulesChecked.every(Boolean)) { toast.error("All items must be checked"); return; }
    setSaving(true);
    try {
      const recordId = await ensureRecord();
      const { client } = await getAuthedClient();
      const { error } = await (client.from("delivery_checklists") as any).update({
        modules_checklist: modulesChecked,
        modules_signed_by: userId,
        modules_signed_at: new Date().toISOString(),
        status: "in_progress",
      }).eq("id", recordId);
      if (error) throw error;
      toast.success("Modules & Panels section signed off");
      await loadData();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleSignOffTools = async () => {
    if (!toolsChecked.every(Boolean)) { toast.error("All items must be checked"); return; }
    setSaving(true);
    try {
      const recordId = await ensureRecord();
      const { client } = await getAuthedClient();
      const { error } = await (client.from("delivery_checklists") as any).update({
        tools_checklist: toolsChecked,
        tools_signed_by: userId,
        tools_signed_at: new Date().toISOString(),
      }).eq("id", recordId);
      if (error) throw error;
      toast.success("Tools & Equipment section signed off");
      await loadData();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleSignOffAdditional = async () => {
    setSaving(true);
    try {
      const recordId = await ensureRecord();
      const { client } = await getAuthedClient();
      const { error } = await (client.from("delivery_checklists") as any).update({
        additional_materials: additionalMaterials,
        additional_signed_by: userId,
        additional_signed_at: new Date().toISOString(),
      }).eq("id", recordId);
      if (error) throw error;
      toast.success("Additional Materials section signed off");
      await loadData();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleConfirmDispatch = async () => {
    setSaving(true);
    try {
      const recordId = checklist?.id;
      if (!recordId) throw new Error("No checklist record");
      const { client } = await getAuthedClient();

      // Update delivery checklist status
      const { error: clError } = await (client.from("delivery_checklists") as any).update({
        dispatch_confirmed_at: new Date().toISOString(),
        dispatch_confirmed_by: userId,
        status: "dispatched",
      }).eq("id", recordId);
      if (clError) throw clError;

      // Bug 12 fix: update project status to dispatched
      await (client.from("projects") as any).update({ status: "dispatched" }).eq("id", projectId);

      // Notify production_head and site_installation_mgr
      const { data: recipients } = await supabase
        .from("profiles")
        .select("auth_user_id, role")
        .in("role", ["production_head", "site_installation_mgr"] as any)
        .eq("is_active", true);
      if (recipients?.length) {
        await insertNotifications(recipients.map((r: any) => ({
          recipient_id: r.auth_user_id,
          title: "Dispatch Confirmed",
          body: `Dispatch confirmed for ${projectName}. Vehicle assignment to follow.`,
          category: "Production",
          related_table: "delivery_checklists",
          related_id: recordId,
          navigate_to: "/production",
        })));
      }

      toast.success("Dispatch confirmed!");
      navigate("/production");
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const addMaterialRow = () => {
    setAdditionalMaterials((prev) => [...prev, { description: "", qty: 1, unit: "pcs", source: "Factory Stock", notes: "" }]);
  };

  const updateMaterial = (idx: number, field: keyof AdditionalMaterial, value: any) => {
    setAdditionalMaterials((prev) => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const removeMaterial = (idx: number) => {
    setAdditionalMaterials((prev) => prev.filter((_, i) => i !== idx));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FFFFFF" }}>
      {/* Header */}
      <div className="border-b border-border p-4 md:p-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/production")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-xl md:text-2xl font-bold" style={{ color: "#1A1A1A" }}>
              Delivery Checklist
            </h1>
            <p className="text-sm mt-0.5">
              <span className="font-bold" style={{ color: "#006039" }}>{projectName}</span>
              <span style={{ color: "#666666" }}> — {format(new Date(), "dd/MM/yyyy")}</span>
            </p>
          </div>
        </div>

        {/* Overall progress */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs font-medium" style={{ color: "#666666" }}>Sections complete:</span>
          <div className="flex gap-1.5">
            {["Modules", "Tools", "Additional"].map((label, i) => {
              const done = [modulesSigned, toolsSigned, additionalSigned][i];
              return (
                <Badge key={label} variant="outline" className={done ? "border-primary/30" : ""}
                  style={done ? { backgroundColor: "#E8F2ED", color: "#006039" } : {}}>
                  {done && <Check className="h-3 w-3 mr-1" />}
                  {label}
                </Badge>
              );
            })}
          </div>
          <span className="text-xs font-bold ml-auto" style={{ color: sectionsComplete === 3 ? "#006039" : "#666666" }}>
            {sectionsComplete}/3
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="p-4 md:p-6 space-y-4">
        <Tabs value={tab} onValueChange={setTab}>
          <ScrollableTabsWrapper>
            <TabsList>
              <TabsTrigger value="modules" className="gap-1.5">
                <Package className="h-4 w-4" /> Modules & Panels
                {modulesSigned && <Check className="h-3.5 w-3.5 ml-1" style={{ color: "#006039" }} />}
              </TabsTrigger>
              <TabsTrigger value="tools" className="gap-1.5">
                <Wrench className="h-4 w-4" /> Tools & Equipment
                {toolsSigned && <Check className="h-3.5 w-3.5 ml-1" style={{ color: "#006039" }} />}
              </TabsTrigger>
              <TabsTrigger value="additional" className="gap-1.5">
                <Plus className="h-4 w-4" /> Additional Materials
                {additionalSigned && <Check className="h-3.5 w-3.5 ml-1" style={{ color: "#006039" }} />}
              </TabsTrigger>
            </TabsList>
          </ScrollableTabsWrapper>

          {/* TAB 1: Modules */}
          <TabsContent value="modules" className="space-y-3">
            <p className="text-xs" style={{ color: "#666666" }}>
              Done by: Factory Supervisor or Production Head.
              {!canEditModules && " (Read-only for your role)"}
            </p>
            {MODULES_ITEMS.map((item, idx) => (
              <Card key={idx} style={{ backgroundColor: "#F7F7F7" }}>
                <CardContent className="p-3 flex items-start gap-3">
                  <Checkbox
                    checked={modulesSigned ? (checklist?.modules_checklist as boolean[])?.[idx] ?? false : modulesChecked[idx]}
                    disabled={modulesSigned || !canEditModules}
                    onCheckedChange={(v) => {
                      if (modulesSigned || !canEditModules) return;
                      setModulesChecked((prev) => prev.map((c, i) => i === idx ? !!v : c));
                    }}
                  />
                  <span className="text-sm flex-1" style={{ color: "#1A1A1A" }}>{item}</span>
                  {(modulesSigned ? (checklist?.modules_checklist as boolean[])?.[idx] : modulesChecked[idx]) && (
                    <Check className="h-4 w-4 shrink-0" style={{ color: "#006039" }} />
                  )}
                </CardContent>
              </Card>
            ))}
            {modulesSigned ? (
              <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: "#E8F2ED" }}>
                <Lock className="h-4 w-4" style={{ color: "#006039" }} />
                <span className="text-sm font-medium" style={{ color: "#006039" }}>
                  Signed off {checklist?.modules_signed_at ? format(new Date(checklist.modules_signed_at), "dd/MM/yyyy HH:mm") : ""}
                </span>
              </div>
            ) : canEditModules ? (
              <Button
                onClick={handleSignOffModules}
                disabled={saving || !modulesChecked.every(Boolean)}
                className="w-full"
                style={modulesChecked.every(Boolean) ? { backgroundColor: "#006039", color: "#FFFFFF" } : {}}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Sign Off — Modules and Panels
              </Button>
            ) : null}
          </TabsContent>

          {/* TAB 2: Tools */}
          <TabsContent value="tools" className="space-y-3">
            <p className="text-xs" style={{ color: "#666666" }}>
              Done by: Stores Executive.
              {!canEditTools && " (Read-only for your role)"}
            </p>
            {TOOLS_ITEMS.map((item, idx) => (
              <Card key={idx} style={{ backgroundColor: "#F7F7F7" }}>
                <CardContent className="p-3 flex items-start gap-3">
                  <Checkbox
                    checked={toolsSigned ? (checklist?.tools_checklist as boolean[])?.[idx] ?? false : toolsChecked[idx]}
                    disabled={toolsSigned || !canEditTools}
                    onCheckedChange={(v) => {
                      if (toolsSigned || !canEditTools) return;
                      setToolsChecked((prev) => prev.map((c, i) => i === idx ? !!v : c));
                    }}
                  />
                  <span className="text-sm flex-1" style={{ color: "#1A1A1A" }}>{item}</span>
                  {(toolsSigned ? (checklist?.tools_checklist as boolean[])?.[idx] : toolsChecked[idx]) && (
                    <Check className="h-4 w-4 shrink-0" style={{ color: "#006039" }} />
                  )}
                </CardContent>
              </Card>
            ))}
            {toolsSigned ? (
              <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: "#E8F2ED" }}>
                <Lock className="h-4 w-4" style={{ color: "#006039" }} />
                <span className="text-sm font-medium" style={{ color: "#006039" }}>
                  Signed off {checklist?.tools_signed_at ? format(new Date(checklist.tools_signed_at), "dd/MM/yyyy HH:mm") : ""}
                </span>
              </div>
            ) : canEditTools ? (
              <Button
                onClick={handleSignOffTools}
                disabled={saving || !toolsChecked.every(Boolean)}
                className="w-full"
                style={toolsChecked.every(Boolean) ? { backgroundColor: "#006039", color: "#FFFFFF" } : {}}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Sign Off — Tools and Equipment
              </Button>
            ) : null}
          </TabsContent>

          {/* TAB 3: Additional Materials */}
          <TabsContent value="additional" className="space-y-3">
            <p className="text-xs" style={{ color: "#666666" }}>
              Done by: Site Installation Manager. Add any project-specific materials needed.
              {!canEditAdditional && " (Read-only for your role)"}
            </p>

            {additionalMaterials.length === 0 && additionalSigned && (
              <p className="text-sm italic" style={{ color: "#999999" }}>No additional materials required.</p>
            )}

            {additionalMaterials.map((m, idx) => (
              <Card key={idx} style={{ backgroundColor: "#F7F7F7" }}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Material description"
                      value={m.description}
                      onChange={(e) => updateMaterial(idx, "description", e.target.value)}
                      disabled={additionalSigned || !canEditAdditional}
                      className="flex-1 text-sm"
                    />
                    {!additionalSigned && canEditAdditional && (
                      <Button variant="ghost" size="icon" onClick={() => removeMaterial(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={m.qty}
                      onChange={(e) => updateMaterial(idx, "qty", Number(e.target.value))}
                      disabled={additionalSigned || !canEditAdditional}
                      className="text-sm"
                    />
                    <Input
                      placeholder="Unit"
                      value={m.unit}
                      onChange={(e) => updateMaterial(idx, "unit", e.target.value)}
                      disabled={additionalSigned || !canEditAdditional}
                      className="text-sm"
                    />
                    <Select
                      value={m.source}
                      onValueChange={(v) => updateMaterial(idx, "source", v)}
                      disabled={additionalSigned || !canEditAdditional}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Factory Stock">Factory Stock</SelectItem>
                        <SelectItem value="Procure Fresh">Procure Fresh</SelectItem>
                        <SelectItem value="Already on Site">Already on Site</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Notes"
                      value={m.notes}
                      onChange={(e) => updateMaterial(idx, "notes", e.target.value)}
                      disabled={additionalSigned || !canEditAdditional}
                      className="text-sm"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            {!additionalSigned && canEditAdditional && (
              <Button variant="outline" onClick={addMaterialRow} className="gap-1.5" style={{ borderColor: "#006039", color: "#006039" }}>
                <Plus className="h-4 w-4" /> Add Row
              </Button>
            )}

            {additionalSigned ? (
              <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: "#E8F2ED" }}>
                <Lock className="h-4 w-4" style={{ color: "#006039" }} />
                <span className="text-sm font-medium" style={{ color: "#006039" }}>
                  Signed off {checklist?.additional_signed_at ? format(new Date(checklist.additional_signed_at), "dd/MM/yyyy HH:mm") : ""}
                </span>
              </div>
            ) : canEditAdditional ? (
              <Button
                onClick={handleSignOffAdditional}
                disabled={saving}
                className="w-full"
                style={{ backgroundColor: "#006039", color: "#FFFFFF" }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Confirm Additional Materials
              </Button>
            ) : null}
          </TabsContent>
        </Tabs>

        {/* Confirm Dispatch banner */}
        {allSigned && !dispatched && (
          <Card className="border-2" style={{ borderColor: "#006039", backgroundColor: "#E8F2ED" }}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" style={{ color: "#006039" }} />
                <span className="font-semibold text-sm" style={{ color: "#006039" }}>
                  All sections complete. Ready to Dispatch.
                </span>
              </div>
              <Button
                onClick={handleConfirmDispatch}
                disabled={saving}
                className="w-full"
                style={{ backgroundColor: "#006039", color: "#FFFFFF" }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirm Dispatch
              </Button>
            </CardContent>
          </Card>
        )}

        {dispatched && (
          <Card style={{ backgroundColor: "#E8F2ED" }}>
            <CardContent className="p-4 flex items-center gap-2">
              <Lock className="h-4 w-4" style={{ color: "#006039" }} />
              <span className="font-semibold text-sm" style={{ color: "#006039" }}>
                Dispatch confirmed {checklist?.dispatch_confirmed_at ? format(new Date(checklist.dispatch_confirmed_at), "dd/MM/yyyy HH:mm") : ""}
              </span>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
