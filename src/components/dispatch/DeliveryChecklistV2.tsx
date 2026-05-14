import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Check, Lock, ShieldCheck, AlertCircle, Truck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import { insertNotifications } from "@/lib/notifications";

interface Props { projectId: string; projectName: string; }

const RAKESH_ITEMS = [
  "All items in Dispatch Pack are loaded",
  "Packaging is complete (bubble wrap, edge guards)",
  "Connection photographs are attached to Dispatch Pack",
];
const SANDEEP_ITEMS = [
  "Inventory has been reduced for all dispatched items",
];
const AWAIZ_ITEMS = [
  "Site is ready to receive the module",
  "Crane arrangements are confirmed and in place",
  "Civil arrangements (foundation, access) are complete",
];

export function DeliveryChecklistV2({ projectId, projectName }: Props) {
  const { role, userId } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<null | "rakesh" | "sandeep" | "awaiz" | "confirm">(null);
  const [pack, setPack] = useState<any>(null);
  const [checklist, setChecklist] = useState<any>(null);
  const [rakeshChecks, setRakeshChecks] = useState<boolean[]>(new Array(RAKESH_ITEMS.length).fill(false));
  const [sandeepChecks, setSandeepChecks] = useState<boolean[]>(new Array(SANDEEP_ITEMS.length).fill(false));
  const [grnDestination, setGrnDestination] = useState<"factory" | "site" | "">("");
  const [awaizChecks, setAwaizChecks] = useState<boolean[]>(new Array(AWAIZ_ITEMS.length).fill(false));

  const isRakesh = ["factory_floor_supervisor", "production_head", "super_admin", "managing_director"].includes(role ?? "");
  const isSandeep = ["stores_executive", "super_admin", "managing_director"].includes(role ?? "");
  const isAwaiz = ["site_installation_mgr", "super_admin", "managing_director"].includes(role ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: packs } = await (supabase.from("dispatch_packs") as any)
      .select("*").eq("project_id", projectId)
      .in("status", ["ready_to_dispatch", "dispatched"])
      .order("created_at", { ascending: false }).limit(1);
    const p = (packs as any[])?.[0] ?? null;
    setPack(p);
    if (p) {
      const { data: cl } = await (supabase.from("delivery_checklists") as any)
        .select("*").eq("dispatch_pack_id", p.id).order("created_at", { ascending: false }).limit(1);
      const c = (cl as any[])?.[0] ?? null;
      setChecklist(c);
      if (c) {
        if (Array.isArray(c.modules_checklist)) setRakeshChecks(c.modules_checklist.length === RAKESH_ITEMS.length ? c.modules_checklist : new Array(RAKESH_ITEMS.length).fill(false));
        if (Array.isArray(c.tools_checklist)) setSandeepChecks(c.tools_checklist.length === SANDEEP_ITEMS.length ? c.tools_checklist : new Array(SANDEEP_ITEMS.length).fill(false));
        if (c.grn_destination) setGrnDestination(c.grn_destination);
        const am = c.additional_materials as any;
        if (Array.isArray(am)) setAwaizChecks(AWAIZ_ITEMS.map((_, i) => Boolean(am?.[i]?.checked)));
      }
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const ensureRecord = async () => {
    if (checklist) return checklist.id;
    if (!pack) throw new Error("No Ready dispatch pack found");
    const { client } = await getAuthedClient();
    const { data, error } = await (client.from("delivery_checklists") as any).insert({
      project_id: projectId, dispatch_pack_id: pack.id, status: "in_progress",
    }).select("id").single();
    if (error) throw error;
    return data.id;
  };

  const signRakesh = async () => {
    if (!rakeshChecks.every(Boolean)) return toast.error("Tick all items first");
    setSaving("rakesh");
    try {
      const id = await ensureRecord();
      const { client } = await getAuthedClient();
      const { error } = await (client.from("delivery_checklists") as any).update({
        modules_checklist: rakeshChecks,
        rakesh_signed_by: userId, rakesh_signed_at: new Date().toISOString(),
        modules_signed_by: userId, modules_signed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      toast.success("Signed off — Rakesh");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(null); }
  };

  const signSandeep = async () => {
    if (!sandeepChecks.every(Boolean)) return toast.error("Tick all items first");
    if (!grnDestination) return toast.error("Select GRN destination");
    setSaving("sandeep");
    try {
      const id = await ensureRecord();
      const { client } = await getAuthedClient();
      const { error } = await (client.from("delivery_checklists") as any).update({
        tools_checklist: sandeepChecks, grn_destination: grnDestination,
        sandeep_signed_by: userId, sandeep_signed_at: new Date().toISOString(),
        tools_signed_by: userId, tools_signed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      toast.success("Signed off — Sandeep");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(null); }
  };

  const signAwaiz = async () => {
    if (!awaizChecks.every(Boolean)) return toast.error("Tick all items first");
    setSaving("awaiz");
    try {
      const id = await ensureRecord();
      const { client } = await getAuthedClient();
      const am = AWAIZ_ITEMS.map((label, i) => ({ label, checked: awaizChecks[i] }));
      const { error } = await (client.from("delivery_checklists") as any).update({
        additional_materials: am,
        awaiz_signed_by: userId, awaiz_signed_at: new Date().toISOString(),
        additional_signed_by: userId, additional_signed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      toast.success("Signed off — Awaiz");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(null); }
  };

  const allSigned = !!checklist?.rakesh_signed_at && !!checklist?.sandeep_signed_at && !!checklist?.awaiz_signed_at;
  const dispatched = checklist?.status === "dispatched" || pack?.status === "dispatched";

  const confirmDispatch = async () => {
    if (!allSigned || !checklist) return;
    setSaving("confirm");
    try {
      const { client } = await getAuthedClient();
      await (client.from("delivery_checklists") as any).update({
        status: "dispatched", dispatch_confirmed_at: new Date().toISOString(), dispatch_confirmed_by: userId,
      }).eq("id", checklist.id);
      await (client.from("dispatch_packs") as any).update({ status: "dispatched" }).eq("id", pack.id);
      // Notify site team
      const { data: siteTeam } = await supabase.from("profiles").select("auth_user_id")
        .in("role", ["site_installation_mgr", "site_engineer", "delivery_rm_lead"] as any).eq("is_active", true);
      if (siteTeam?.length) {
        await insertNotifications(siteTeam.map((r: any) => ({
          recipient_id: r.auth_user_id,
          title: "Module In Transit",
          body: `${pack.module_id} (${pack.module_name ?? ""}) for ${projectName} dispatched. Vehicle ${pack.vehicle_number}.`,
          category: "Production", related_table: "dispatch_packs", related_id: pack.id,
          navigate_to: "/site-hub",
        })));
      }
      toast.success("Dispatch Confirmed — In Transit");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(null); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  if (!pack) return (
    <Card><CardContent className="py-10 text-center space-y-2">
      <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
      <p className="text-sm text-muted-foreground">No dispatch pack is Ready. Complete Stage 1 first.</p>
    </CardContent></Card>
  );

  const renderCard = (
    title: string, person: string, items: string[],
    checks: boolean[], setChecks: (v: boolean[]) => void,
    signedAt: string | null, canEdit: boolean, onSign: () => void,
    extra?: React.ReactNode,
  ) => {
    const signed = !!signedAt;
    return (
      <Card className="border-2" style={{ borderColor: signed ? "#006039" : "#E0E0E0" }}>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">{title}</CardTitle>
            {signed
              ? <Badge style={{ backgroundColor: "#E8F2ED", color: "#006039", border: "none" }} className="gap-1"><Check className="h-3 w-3" /> Signed</Badge>
              : <Badge style={{ backgroundColor: "#FDECEC", color: "#F40009", border: "none" }} className="gap-1">Pending</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{person}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, i) => (
            <label key={i} className="flex items-start gap-2 text-sm">
              <Checkbox checked={signed ? true : checks[i]} disabled={signed || !canEdit}
                onCheckedChange={(v) => setChecks(checks.map((c, idx) => idx === i ? !!v : c))} />
              <span style={{ color: "#1A1A1A" }}>{it}</span>
            </label>
          ))}
          {extra}
          {signed ? (
            <div className="flex items-center gap-2 text-xs p-2 rounded" style={{ backgroundColor: "#E8F2ED", color: "#006039" }}>
              <Lock className="h-3 w-3" /> Signed {format(new Date(signedAt!), "dd/MM/yyyy HH:mm")}
            </div>
          ) : canEdit ? (
            <Button size="sm" className="w-full gap-1" onClick={onSign} disabled={saving !== null}
              style={{ backgroundColor: "#006039", color: "#FFFFFF" }}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />} Sign Off
            </Button>
          ) : <p className="text-[11px] text-muted-foreground">Not assigned to your role.</p>}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Truck className="h-5 w-5" style={{ color: "#006039" }} />
        <h2 className="font-display text-lg font-bold">Delivery Checklist — Stage 2</h2>
        <span className="text-xs text-muted-foreground ml-auto">Pack: <strong>{pack.dispatch_pack_id}</strong> — {pack.module_id}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {renderCard("Party 1 — Loading", "Rakesh — Factory Supervisor", RAKESH_ITEMS, rakeshChecks, setRakeshChecks,
          checklist?.rakesh_signed_at ?? null, isRakesh && !dispatched, signRakesh)}

        {renderCard("Party 2 — Stores", "Sandeep — Stores Manager", SANDEEP_ITEMS, sandeepChecks, setSandeepChecks,
          checklist?.sandeep_signed_at ?? null, isSandeep && !dispatched, signSandeep,
          <div>
            <label className="text-xs font-medium" style={{ color: "#666" }}>GRN destination*</label>
            <Select value={grnDestination} onValueChange={(v: any) => setGrnDestination(v)} disabled={!!checklist?.sandeep_signed_at || !isSandeep}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="factory">Factory</SelectItem>
                <SelectItem value="site">Site</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {renderCard("Party 3 — Site Ready", "Awaiz — Site Installation Manager", AWAIZ_ITEMS, awaizChecks, setAwaizChecks,
          checklist?.awaiz_signed_at ?? null, isAwaiz && !dispatched, signAwaiz)}
      </div>

      {dispatched ? (
        <Card style={{ backgroundColor: "#E8F2ED" }}><CardContent className="p-4 flex items-center gap-2">
          <Lock className="h-4 w-4" style={{ color: "#006039" }} />
          <span className="font-semibold text-sm" style={{ color: "#006039" }}>Dispatch Confirmed — In Transit</span>
        </CardContent></Card>
      ) : (
        <Button className="w-full gap-2" disabled={!allSigned || saving !== null}
          style={{ backgroundColor: allSigned ? "#006039" : "#CCCCCC", color: "#FFFFFF" }}
          onClick={confirmDispatch}>
          {saving === "confirm" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Confirm Dispatch {allSigned ? "" : "(all 3 sign-offs required)"}
        </Button>
      )}
    </div>
  );
}
