import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Upload, Image as ImageIcon, X, Truck, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import { insertNotifications } from "@/lib/notifications";

interface Item { description: string; qty: number; unit: string; weight: number; notes: string; }
interface Photo { name: string; url: string; }

interface Props {
  projectId: string;
  projectName: string;
}

const CREATE_ROLES = ["super_admin", "managing_director", "production_head", "factory_floor_supervisor", "head_operations"];
const VEHICLE_TYPES = ["Truck (16ft)", "Truck (20ft)", "Truck (24ft)", "Trailer (32ft)", "Trailer (40ft)", "LCV", "Other"];

export function DispatchPackFormV2({ projectId, projectName }: Props) {
  const { role } = useUserRole();
  const canCreate = CREATE_ROLES.includes(role ?? "");

  const [packId, setPackId] = useState<string | null>(null);
  const [moduleNo, setModuleNo] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [plannedDate, setPlannedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [items, setItems] = useState<Item[]>([{ description: "", qty: 1, unit: "pcs", weight: 0, notes: "" }]);
  const [factoryStages, setFactoryStages] = useState<{ name: string; done: boolean }[]>([]);
  const [siteWorksPending, setSiteWorksPending] = useState("");
  const [connectionPhotos, setConnectionPhotos] = useState<Photo[]>([]);
  const [specialHandling, setSpecialHandling] = useState("");
  const [status, setStatus] = useState<"draft" | "ready_to_dispatch" | "dispatched">("draft");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // Load latest in-progress (draft / ready) pack for project
    const { data } = await (supabase.from("dispatch_packs") as any)
      .select("*")
      .eq("project_id", projectId)
      .in("status", ["draft", "ready_to_dispatch"])
      .order("created_at", { ascending: false })
      .limit(1);
    const r = (data as any[])?.[0];
    if (r) {
      setPackId(r.id);
      setModuleNo(r.module_id ?? "");
      setModuleName(r.module_name ?? "");
      setPlannedDate(r.planned_dispatch_date ?? r.dispatch_date ?? format(new Date(), "yyyy-MM-dd"));
      setVehicleType(r.vehicle_type ?? "");
      setVehicleNumber(r.vehicle_number ?? "");
      setDriverName(r.driver_name ?? "");
      setDriverPhone(r.driver_phone ?? "");
      if (Array.isArray(r.items_table) && r.items_table.length) setItems(r.items_table);
      if (Array.isArray(r.factory_works_completed) && r.factory_works_completed.length) setFactoryStages(r.factory_works_completed);
      setSiteWorksPending(r.site_works_pending ?? "");
      if (Array.isArray(r.connection_photos)) setConnectionPhotos(r.connection_photos);
      setSpecialHandling(r.special_handling ?? "");
      setStatus(r.status ?? "draft");
    }
    // Load completed factory stages from project_tasks (non-N/A)
    if (!r || !r.factory_works_completed || (Array.isArray(r.factory_works_completed) && r.factory_works_completed.length === 0)) {
      const { data: tasks } = await supabase
        .from("project_tasks")
        .select("task_name,phase,status,completion_percentage")
        .eq("project_id", projectId)
        .order("display_order");
      const factory = (tasks ?? []).filter((t: any) => (t.phase ?? "").toLowerCase().includes("factory") || (t.phase ?? "").toLowerCase().includes("production"));
      setFactoryStages(factory.map((t: any) => ({ name: t.task_name, done: (t.completion_percentage ?? 0) >= 100 })));
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const addItem = () => setItems((s) => [...s, { description: "", qty: 1, unit: "pcs", weight: 0, notes: "" }]);
  const updateItem = (i: number, k: keyof Item, v: any) => setItems((s) => s.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const removeItem = (i: number) => setItems((s) => s.filter((_, idx) => idx !== i));

  const uploadPhotos = async (files: FileList) => {
    setUploading(true);
    try {
      const out: Photo[] = [];
      for (const f of Array.from(files)) {
        const ext = f.name.split(".").pop();
        const path = `dispatch-packs/${projectId}/connection_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("site-photos").upload(path, f, { upsert: true });
        if (error) throw error;
        const url = supabase.storage.from("site-photos").getPublicUrl(path).data.publicUrl;
        out.push({ name: f.name, url });
      }
      setConnectionPhotos((p) => [...p, ...out]);
      toast.success("Photos uploaded");
    } catch (e: any) { toast.error(e.message); } finally { setUploading(false); }
  };

  const removePhoto = (url: string) => setConnectionPhotos((p) => p.filter((x) => x.url !== url));

  const validate = (markReady: boolean) => {
    if (!moduleNo.trim()) return toast.error("Module number is required"), false;
    if (!moduleName.trim()) return toast.error("Module name is required"), false;
    if (!plannedDate) return toast.error("Planned dispatch date is required"), false;
    if (!vehicleType) return toast.error("Vehicle type is required"), false;
    if (!vehicleNumber.trim()) return toast.error("Vehicle registration is required"), false;
    if (!driverName.trim()) return toast.error("Driver name is required"), false;
    if (driverPhone.replace(/\D/g, "").length !== 10) return toast.error("Driver contact must be 10 digits"), false;
    if (items.filter((i) => i.description.trim()).length === 0) return toast.error("At least one item is required"), false;
    if (markReady) {
      if (connectionPhotos.length < 2) return toast.error("At least 2 connection photos are mandatory"), false;
    }
    return true;
  };

  const save = async (markReady: boolean) => {
    if (!canCreate) return toast.error("Not authorised");
    if (!validate(markReady)) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();
      const newStatus = markReady ? "ready_to_dispatch" : "draft";
      const totalWeight = items.reduce((s, i) => s + (Number(i.weight) || 0) * (Number(i.qty) || 0), 0);
      const totalPieces = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);

      const payload: any = {
        project_id: projectId,
        module_id: moduleNo.trim(),
        module_name: moduleName.trim(),
        dispatch_date: plannedDate,
        planned_dispatch_date: plannedDate,
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber.trim().toUpperCase(),
        driver_name: driverName.trim(),
        driver_phone: driverPhone.trim(),
        items_table: items.filter((i) => i.description.trim()),
        factory_works_completed: factoryStages,
        site_works_pending: siteWorksPending.trim() || null,
        connection_photos: connectionPhotos,
        special_handling: specialHandling.trim() || null,
        weight_kg: totalWeight || null,
        pieces_count: totalPieces || null,
        status: newStatus,
      };

      let savedId = packId;
      if (packId) {
        const { error } = await (client.from("dispatch_packs") as any).update(payload).eq("id", packId);
        if (error) throw error;
      } else {
        const dateStr = plannedDate.replace(/-/g, "");
        const { data: existing } = await (supabase.from("dispatch_packs") as any)
          .select("dispatch_pack_id").like("dispatch_pack_id", `DP-${dateStr}-%`);
        const seq = (existing?.length ?? 0) + 1;
        payload.dispatch_pack_id = `DP-${dateStr}-${String(seq).padStart(3, "0")}`;
        payload.created_by = user.id;
        const { data, error } = await (client.from("dispatch_packs") as any).insert(payload).select("id").single();
        if (error) throw error;
        savedId = data.id;
        setPackId(data.id);
      }
      setStatus(newStatus);

      if (markReady) {
        // Notify the 3 sign-off parties
        const { data: parties } = await supabase
          .from("profiles")
          .select("auth_user_id, role")
          .in("role", ["factory_floor_supervisor", "stores_executive", "site_installation_mgr"] as any)
          .eq("is_active", true);
        if (parties?.length) {
          await insertNotifications(parties.map((r: any) => ({
            recipient_id: r.auth_user_id,
            title: "Dispatch Pack Ready — Sign-off needed",
            body: `${moduleNo} (${moduleName}) for ${projectName}. Please complete your section of the Delivery Checklist.`,
            category: "Production",
            related_table: "dispatch_packs",
            related_id: savedId ?? undefined,
            navigate_to: "/dispatch-delivery",
          })));
        }
      }

      toast.success(markReady ? "Marked Ready for Delivery Checklist" : "Saved as draft");
    } catch (e: any) { toast.error(e.message || "Save failed"); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5" style={{ color: "#006039" }} />
          <h2 className="font-display text-lg font-bold" style={{ color: "#1A1A1A" }}>Dispatch Pack — Stage 1</h2>
        </div>
        <Badge variant="outline" style={{
          backgroundColor: status === "ready_to_dispatch" ? "#E8F2ED" : status === "dispatched" ? "#E8F2ED" : "#FFF8E8",
          color: status === "draft" ? "#D4860A" : "#006039", border: "none",
        }}>
          {status === "draft" ? "Draft" : status === "ready_to_dispatch" ? "Ready for Delivery Checklist" : "Dispatched"}
        </Badge>
      </div>

      {/* Module & Vehicle */}
      <Card><CardHeader className="py-3"><CardTitle className="text-sm">Module & Vehicle</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label className="text-xs">Module No.*</Label><Input value={moduleNo} onChange={(e) => setModuleNo(e.target.value)} className="mt-1 text-sm" /></div>
          <div><Label className="text-xs">Module Name*</Label><Input value={moduleName} onChange={(e) => setModuleName(e.target.value)} className="mt-1 text-sm" /></div>
          <div><Label className="text-xs">Planned Dispatch Date*</Label><Input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} className="mt-1 text-sm" /></div>
          <div><Label className="text-xs">Vehicle Type*</Label>
            <Select value={vehicleType} onValueChange={setVehicleType}>
              <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>{VEHICLE_TYPES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Registration*</Label><Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="KA01AB1234" className="mt-1 text-sm" /></div>
          <div><Label className="text-xs">Driver Name*</Label><Input value={driverName} onChange={(e) => setDriverName(e.target.value)} className="mt-1 text-sm" /></div>
          <div><Label className="text-xs">Driver Contact*</Label><Input maxLength={10} value={driverPhone} onChange={(e) => setDriverPhone(e.target.value.replace(/\D/g, ""))} placeholder="10 digits" className="mt-1 text-sm" /></div>
        </CardContent></Card>

      {/* Items table */}
      <Card><CardHeader className="py-3 flex flex-row items-center justify-between"><CardTitle className="text-sm">Items in this Dispatch</CardTitle>
        <Button size="sm" variant="outline" onClick={addItem} className="gap-1"><Plus className="h-3 w-3" /> Add Item</Button>
      </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-left" style={{ color: "#666" }}>
              <th className="py-1 pr-2">Description</th><th className="py-1 pr-2">Qty</th><th className="py-1 pr-2">Unit</th><th className="py-1 pr-2">Weight (kg)</th><th className="py-1 pr-2">Notes</th><th></th>
            </tr></thead>
            <tbody>{items.map((it, i) => (
              <tr key={i} className="border-b">
                <td className="py-1 pr-2"><Input value={it.description} onChange={(e) => updateItem(i, "description", e.target.value)} className="h-7 text-xs" /></td>
                <td className="py-1 pr-2"><Input type="number" min={0} value={it.qty} onChange={(e) => updateItem(i, "qty", Number(e.target.value))} className="h-7 text-xs w-16" /></td>
                <td className="py-1 pr-2"><Input value={it.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} className="h-7 text-xs w-20" /></td>
                <td className="py-1 pr-2"><Input type="number" min={0} value={it.weight} onChange={(e) => updateItem(i, "weight", Number(e.target.value))} className="h-7 text-xs w-20" /></td>
                <td className="py-1 pr-2"><Input value={it.notes} onChange={(e) => updateItem(i, "notes", e.target.value)} className="h-7 text-xs" /></td>
                <td className="py-1">{items.length > 1 && <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeItem(i)}><Trash2 className="h-3 w-3" /></Button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </CardContent></Card>

      {/* Factory works completed */}
      <Card><CardHeader className="py-3"><CardTitle className="text-sm">Works Completed in Factory</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {factoryStages.length === 0 ? <p className="text-xs text-muted-foreground">No factory stages found for this project.</p> :
            factoryStages.map((s, i) => (
              <label key={i} className="flex items-center gap-2 text-sm">
                <Checkbox checked={s.done} onCheckedChange={(v) => setFactoryStages((arr) => arr.map((x, idx) => idx === i ? { ...x, done: !!v } : x))} />
                <span style={{ color: "#1A1A1A" }}>{s.name}</span>
              </label>
            ))
          }
        </CardContent></Card>

      {/* Pending site works */}
      <Card><CardHeader className="py-3"><CardTitle className="text-sm">Works Pending on Site</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={3} value={siteWorksPending} onChange={(e) => setSiteWorksPending(e.target.value)} placeholder="One per line" className="text-sm" />
        </CardContent></Card>

      {/* Connection photos */}
      <Card><CardHeader className="py-3"><CardTitle className="text-sm">Connection Detail Photographs <span style={{ color: "#F40009" }}>* (min 2)</span></CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">Used by site team to install connections. Photos should clearly show connection points.</p>
          <label className="cursor-pointer inline-block">
            <Button size="sm" variant="outline" className="gap-1" disabled={uploading} asChild>
              <span>{uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Upload Photos</span>
            </Button>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && e.target.files.length && uploadPhotos(e.target.files)} />
          </label>
          {connectionPhotos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {connectionPhotos.map((p) => (
                <div key={p.url} className="relative rounded border overflow-hidden">
                  <img src={p.url} alt={p.name} className="w-full h-24 object-cover" />
                  <button onClick={() => removePhoto(p.url)} className="absolute top-1 right-1 bg-white/90 rounded p-0.5"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px]" style={{ color: connectionPhotos.length >= 2 ? "#006039" : "#D4860A" }}>
            {connectionPhotos.length} / 2 minimum
          </p>
        </CardContent></Card>

      {/* Special handling */}
      <Card><CardHeader className="py-3"><CardTitle className="text-sm">Special Handling Instructions</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={2} value={specialHandling} onChange={(e) => setSpecialHandling(e.target.value)} className="text-sm" />
        </CardContent></Card>

      {/* Actions */}
      {canCreate && (
        <div className="flex flex-col sm:flex-row gap-2 sticky bottom-0 bg-white py-3 border-t">
          <Button variant="outline" className="flex-1 gap-1" onClick={() => save(false)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Draft
          </Button>
          <Button className="flex-1 gap-1" style={{ backgroundColor: "#006039", color: "#FFFFFF" }} onClick={() => save(true)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Mark Ready for Delivery Checklist
          </Button>
        </div>
      )}
    </div>
  );
}
