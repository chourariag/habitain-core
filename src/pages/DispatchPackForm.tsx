import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { insertNotifications } from "@/lib/notifications";

const LOADING_CHECKLIST = [
  "Modules/Panels physically verified at loading bay",
  "Quantity matches dispatch order",
  "All panels wrapped and protected",
  "Electrical connections capped and taped",
  "MEP penetrations sealed",
  "Structural bolts and connectors packed separately and labelled",
  "Tools and consumables loaded",
  "Driver briefed on site address and contact",
  "POD document printed and handed to driver",
  "Factory Supervisor sign-off complete",
];

const VEHICLE_TYPES = ["Tempo", "Mini Truck", "Large Truck", "Crane Truck"];

interface StoresItem {
  id: string;
  material_name: string;
  unit: string;
  available_qty: number;
}

interface MaterialRow extends StoresItem {
  dispatching_qty: number;
  note: string;
}

export default function DispatchPackForm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const projectId = params.get("projectId") ?? "";
  const projectName = params.get("projectName") ?? "";

  const [vehicleType, setVehicleType] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [siteManagerId, setSiteManagerId] = useState("");
  const [siteManagers, setSiteManagers] = useState<{ id: string; name: string }[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string[]>([]);
  const [supervisorAccompanying, setSupervisorAccompanying] = useState(false);
  const [checklist, setChecklist] = useState<boolean[]>(new Array(10).fill(false));
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const allChecked = checklist.every(Boolean);
  const today = format(new Date(), "dd/MM/yyyy");

  const fetchFormData = useCallback(async () => {
    setLoading(true);
    const [managersRes, teamRes, inventoryRes] = await Promise.all([
      supabase.from("profiles").select("auth_user_id,display_name,role").eq("is_active", true).eq("role", "site_installation_mgr" as any),
      supabase.from("profiles").select("auth_user_id,display_name,role").eq("is_active", true).in("role", ["site_engineer", "fabrication_foreman"] as any),
      (supabase.from("stores_inventory") as any).select("*").eq("project_id", projectId).gt("available_qty", 0),
    ]);

    setSiteManagers((managersRes.data ?? []).map((p: any) => ({ id: p.auth_user_id, name: p.display_name || p.email || "Unknown" })));
    setTeamMembers((teamRes.data ?? []).map((p: any) => ({
      id: p.auth_user_id,
      name: p.display_name || "Unknown",
      role: String(p.role).replace(/_/g, " "),
    })));
    setMaterials((inventoryRes.data ?? []).map((item: any) => ({
      id: item.id,
      material_name: item.material_name,
      unit: item.unit,
      available_qty: Number(item.available_qty),
      dispatching_qty: 0,
      note: "",
    })));
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchFormData(); }, [fetchFormData]);

  const toggleTeamMember = (id: string) => {
    setSelectedTeam((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const updateMaterialQty = (idx: number, val: string) => {
    const num = Number(val) || 0;
    setMaterials((prev) => prev.map((m, i) => i === idx ? { ...m, dispatching_qty: num } : m));
  };

  const updateMaterialNote = (idx: number, val: string) => {
    setMaterials((prev) => prev.map((m, i) => i === idx ? { ...m, note: val } : m));
  };

  const handleSave = async () => {
    if (!vehicleType || !vehicleNumber.trim() || !driverName.trim() || !driverPhone.trim()) {
      toast.error("Please fill all required vehicle details.");
      return;
    }
    if (driverPhone.replace(/\D/g, "").length !== 10) {
      toast.error("Driver phone must be 10 digits.");
      return;
    }
    if (!allChecked) {
      toast.error("All loading checklist items must be checked.");
      return;
    }

    const overBudget = materials.find((m) => m.dispatching_qty > m.available_qty);
    if (overBudget) {
      toast.error(`${overBudget.material_name}: dispatching qty exceeds available.`);
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Generate dispatch pack ID: DP-YYYYMMDD-SEQ
      const dateStr = format(new Date(), "yyyyMMdd");
      const { data: existingPacks } = await (supabase.from("dispatch_packs") as any)
        .select("dispatch_pack_id")
        .like("dispatch_pack_id", `DP-${dateStr}-%`);
      const seq = (existingPacks?.length ?? 0) + 1;
      const packId = `DP-${dateStr}-${String(seq).padStart(3, "0")}`;

      // 1. Create dispatch pack
      const { error: packErr } = await (supabase.from("dispatch_packs") as any).insert({
        dispatch_pack_id: packId,
        project_id: projectId,
        dispatch_date: new Date().toISOString().split("T")[0],
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber.trim(),
        driver_name: driverName.trim(),
        driver_phone: driverPhone.trim(),
        transporter_name: transporterName.trim() || null,
        site_installation_manager_id: siteManagerId || null,
        team_member_ids: selectedTeam,
        supervisor_accompanying: supervisorAccompanying,
        loading_checklist_complete: true,
        notes: notes.trim() || null,
        created_by: user.id,
        status: "dispatched",
      });
      if (packErr) throw packErr;

      // 2. Log materials and update inventory
      const dispatchedMaterials = materials.filter((m) => m.dispatching_qty > 0);
      if (dispatchedMaterials.length) {
        const logRows = dispatchedMaterials.map((m) => ({
          dispatch_pack_id: packId,
          project_id: projectId,
          material_name: m.material_name,
          unit: m.unit,
          qty_dispatched: m.dispatching_qty,
          note: m.note || null,
        }));
        const { error: logErr } = await (supabase.from("dispatch_material_log") as any).insert(logRows);
        if (logErr) throw logErr;

        // Reduce inventory
        for (const m of dispatchedMaterials) {
          const newQty = m.available_qty - m.dispatching_qty;
          await (supabase.from("stores_inventory") as any)
            .update({ available_qty: newQty })
            .eq("id", m.id);
        }
      }

      // 3. Notify site installation manager
      if (siteManagerId) {
        await insertNotifications({
          recipient_id: siteManagerId,
          title: "Dispatch Pack Confirmed",
          body: `Dispatch Pack ${packId} confirmed. Vehicle ${vehicleNumber.trim()} is on the way.`,
          category: "dispatch",
          related_table: "dispatch_packs",
          navigate_to: "/site-hub",
        });
      }

      toast.success("Dispatch Pack saved. Inventory updated.");
      navigate("/site-hub");
    } catch (err: any) {
      toast.error(err.message || "Failed to save dispatch pack.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FFFFFF" }}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/site-hub")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-display text-xl md:text-2xl font-bold" style={{ color: "#1A1A1A" }}>
              Create Dispatch Pack
            </h1>
            <p className="text-sm" style={{ color: "#666666" }}>{projectName}</p>
          </div>
        </div>

        {/* Section 1: Dispatch Details */}
        <section className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: "#F7F7F7" }}>
          <h2 className="font-display text-sm font-bold uppercase" style={{ color: "#006039" }}>
            Dispatch Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Project Name</Label>
              <Input value={projectName} disabled className="mt-1 text-sm bg-white" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Dispatch Date</Label>
              <Input value={today} disabled className="mt-1 text-sm bg-white" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Dispatch Pack ID</Label>
              <Input value="Auto-generated on save" disabled className="mt-1 text-sm bg-white italic text-muted-foreground" />
            </div>
          </div>
        </section>

        {/* Section 2: Vehicle Details */}
        <section className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: "#F7F7F7" }}>
          <h2 className="font-display text-sm font-bold uppercase" style={{ color: "#006039" }}>
            Vehicle Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Vehicle Type <span style={{ color: "#F40009" }}>*</span></Label>
              <Select value={vehicleType} onValueChange={setVehicleType}>
                <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Vehicle Number <span style={{ color: "#F40009" }}>*</span></Label>
              <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="e.g. KA01AB1234" className="mt-1 text-sm bg-white" />
            </div>
            <div>
              <Label className="text-xs">Driver Name <span style={{ color: "#F40009" }}>*</span></Label>
              <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Full name" className="mt-1 text-sm bg-white" />
            </div>
            <div>
              <Label className="text-xs">Driver Phone <span style={{ color: "#F40009" }}>*</span></Label>
              <Input type="tel" maxLength={10} value={driverPhone} onChange={(e) => setDriverPhone(e.target.value.replace(/\D/g, ""))} placeholder="10-digit number" className="mt-1 text-sm bg-white" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Transporter Name (optional)</Label>
              <Input value={transporterName} onChange={(e) => setTransporterName(e.target.value)} placeholder="Transport company" className="mt-1 text-sm bg-white" />
            </div>
          </div>
        </section>

        {/* Section 3: Team Assignment */}
        <section className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: "#F7F7F7" }}>
          <h2 className="font-display text-sm font-bold uppercase" style={{ color: "#006039" }}>
            Team Assignment
          </h2>
          <div>
            <Label className="text-xs">Site Installation Manager</Label>
            <Select value={siteManagerId} onValueChange={setSiteManagerId}>
              <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Select manager" /></SelectTrigger>
              <SelectContent>
                {siteManagers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-2 block">Team Members</Label>
            {teamMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No team members available.</p>
            ) : (
              <div className="grid gap-2 max-h-40 overflow-y-auto">
                {teamMembers.map((tm) => (
                  <label key={tm.id} className="flex items-center gap-2 rounded-md border p-2 bg-white cursor-pointer text-sm">
                    <Checkbox checked={selectedTeam.includes(tm.id)} onCheckedChange={() => toggleTeamMember(tm.id)} />
                    <span className="font-medium" style={{ color: "#1A1A1A" }}>{tm.name}</span>
                    <span className="text-xs capitalize" style={{ color: "#666666" }}>({tm.role})</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-xs">Supervisor Accompanying</Label>
            <Switch checked={supervisorAccompanying} onCheckedChange={setSupervisorAccompanying} />
            <span className="text-xs" style={{ color: "#666666" }}>{supervisorAccompanying ? "Yes" : "No"}</span>
          </div>
        </section>

        {/* Section 4: Loading Checklist */}
        <section className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: "#F7F7F7" }}>
          <h2 className="font-display text-sm font-bold uppercase" style={{ color: "#006039" }}>
            Loading Checklist
          </h2>
          <p className="text-xs" style={{ color: "#999" }}>All items must be checked before submission.</p>
          <div className="space-y-2">
            {LOADING_CHECKLIST.map((item, idx) => (
              <label key={idx} className="flex items-start gap-3 rounded-md border p-3 bg-white cursor-pointer">
                <Checkbox
                  checked={checklist[idx]}
                  onCheckedChange={(v) => {
                    setChecklist((prev) => prev.map((c, i) => i === idx ? Boolean(v) : c));
                  }}
                  className="mt-0.5"
                />
                <span className="text-sm" style={{ color: "#1A1A1A" }}>{idx + 1}. {item}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Section 5: Materials */}
        <section className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: "#F7F7F7" }}>
          <h2 className="font-display text-sm font-bold uppercase" style={{ color: "#006039" }}>
            Materials in this Dispatch
          </h2>
          {materials.length === 0 ? (
            <p className="text-xs text-muted-foreground">No materials in stores inventory for this project.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs" style={{ color: "#666666" }}>
                    <th className="pb-2">Material</th>
                    <th className="pb-2">Unit</th>
                    <th className="pb-2 text-right">Available</th>
                    <th className="pb-2 text-right">Dispatching</th>
                    <th className="pb-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m, idx) => {
                    const overLimit = m.dispatching_qty > m.available_qty;
                    return (
                      <tr key={m.id} className="border-t">
                        <td className="py-2 font-medium" style={{ color: "#1A1A1A" }}>{m.material_name}</td>
                        <td className="py-2" style={{ color: "#666" }}>{m.unit}</td>
                        <td className="py-2 text-right" style={{ color: "#666" }}>{m.available_qty}</td>
                        <td className="py-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            max={m.available_qty}
                            value={m.dispatching_qty || ""}
                            onChange={(e) => updateMaterialQty(idx, e.target.value)}
                            className={`w-20 text-right text-sm ml-auto bg-white ${overLimit ? "border-[#F40009] ring-1 ring-[#F40009]" : ""}`}
                          />
                          {overLimit && <p className="text-[10px] text-right mt-0.5" style={{ color: "#F40009" }}>Exceeds available</p>}
                        </td>
                        <td className="py-2">
                          <Input
                            value={m.note}
                            onChange={(e) => updateMaterialNote(idx, e.target.value)}
                            placeholder="e.g. 3 panels in bundle 2"
                            className="text-xs bg-white w-40"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Notes */}
        <section className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: "#F7F7F7" }}>
          <Label className="text-xs">Additional Notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any extra notes..." className="bg-white text-sm" rows={3} />
        </section>

        {/* Save Button */}
        <div className="sticky bottom-0 bg-white border-t py-3 -mx-4 px-4" style={{ borderColor: "#E5E7EB" }}>
          <Button
            className="w-full font-display"
            style={{ backgroundColor: "#006039" }}
            disabled={saving || !allChecked}
            onClick={handleSave}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Dispatch Pack
          </Button>
          {!allChecked && (
            <p className="text-xs text-center mt-1" style={{ color: "#D4860A" }}>
              Complete all loading checklist items to enable saving.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
