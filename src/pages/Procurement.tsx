import { useCallback, useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Package, FileText, Plus, AlertTriangle, ClipboardList, LayoutDashboard, Truck, Info, FileSpreadsheet, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { NewMaterialRequestDialog } from "@/components/materials/NewMaterialRequestDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TransfersTab } from "@/components/procurement/TransfersTab";
import { TallyPOUploadTab } from "@/components/procurement/TallyPOUploadTab";
import { MaterialAvailabilityGate } from "@/components/procurement/MaterialAvailabilityGate";
import { ThirtyDayPlanTab } from "@/components/procurement/ThirtyDayPlanTab";
import { ProcurementDashboardStrip } from "@/components/procurement/ProcurementDashboardStrip";
import { AssetRegisterTab } from "@/components/procurement/AssetRegisterTab";
import { SupplierIntelligenceTab } from "@/components/procurement/SupplierIntelligenceTab";
import { format, addDays, isBefore, isAfter, subDays } from "date-fns";
import { Calendar, Hammer } from "lucide-react";

const STOCK_CREATOR_ROLES = ["stores_executive", "managing_director", "super_admin"];
const PO_CREATOR_ROLES = ["procurement", "stores_executive", "managing_director", "super_admin"];
const PLANNER_ROLES = ["planning_engineer", "super_admin", "managing_director"];
const REQUESTOR_ROLES = [
  "super_admin", "managing_director", "site_installation_mgr", "site_engineer",
  "factory_floor_supervisor", "fabrication_foreman", "production_head", "head_operations",
];
const APPROVER_ROLES = [
  "super_admin", "managing_director", "finance_director", "costing_engineer",
  "procurement", "stores_executive", "head_operations", "production_head",
];

const STATUS_CONFIG: Record<string, { label: string; style: React.CSSProperties }> = {
  pending_budget: { label: "Pending Budget Review", style: { backgroundColor: "#FFF8E8", color: "#D4860A" } },
  pending_director_approval: { label: "Pending Director Approval", style: { backgroundColor: "#FFF8E8", color: "#D4860A" } },
  pending_po: { label: "Pending PO", style: { backgroundColor: "#E8F2ED", color: "#006039" } },
  po_raised: { label: "PO Raised", style: { backgroundColor: "#E8F2ED", color: "#006039" } },
  received: { label: "Received", style: { backgroundColor: "#E0E0E0", color: "#666666" } },
  rejected: { label: "Rejected", style: { backgroundColor: "#FFF0F0", color: "#F40009" } },
};

const PLAN_STATUS_CONFIG: Record<string, { label: string; style: React.CSSProperties }> = {
  planned: { label: "Planned", style: { backgroundColor: "#FFF8E8", color: "#D4860A" } },
  po_raised: { label: "PO Raised", style: { backgroundColor: "#E8F2ED", color: "#006039" } },
  delivered: { label: "Delivered", style: { backgroundColor: "#E0E0E0", color: "#666666" } },
  delayed: { label: "Delayed", style: { backgroundColor: "#FFF0F0", color: "#F40009" } },
};

function isBlockedBySoD(request: any, userId: string | null, action: string): string | null {
  if (!userId) return null;
  if ((action === "approve_budget" || action === "over_budget") && request.requested_by === userId) return "You cannot approve your own request";
  if (action === "raise_po" && request.budget_approved_by === userId) return "You cannot raise a PO for a request you approved";
  if (action === "raise_po" && request.director_approved_by === userId) return "You cannot raise a PO for a request you approved";
  if (action === "mark_received" && request.po_raised_by === userId) return "You cannot receive materials for a PO you raised";
  if (action === "director_approve" && request.requested_by === userId) return "You cannot approve your own request";
  if (action === "director_approve" && request.budget_approved_by === userId) return "You already reviewed this request's budget";
  return null;
}

function SoDButton({ label, onClick, sodReason }: { label: string; onClick: () => void; sodReason: string | null }) {
  if (sodReason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span><Button size="sm" variant="outline" disabled className="opacity-50 cursor-not-allowed">{label}</Button></span>
        </TooltipTrigger>
        <TooltipContent><p className="text-xs">{sodReason}</p></TooltipContent>
      </Tooltip>
    );
  }
  return <Button size="sm" variant="outline" onClick={onClick}>{label}</Button>;
}

export default function Procurement() {
  const [items, setItems] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [planItems, setPlanItems] = useState<any[]>([]);
  const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Add item dialog
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemForm, setItemForm] = useState({ material_name: "", category: "", current_stock: "", unit: "units", reorder_level: "", project_id: "", vendor_name: "", received_by_on_site: "", site_receipt_notes: "" });
  const [itemSaving, setItemSaving] = useState(false);
  const [itemDeliveryDest, setItemDeliveryDest] = useState<"factory" | "site_direct">("factory");
  const [siteReceipts, setSiteReceipts] = useState<any[]>([]);

  // Add PO dialog
  const [poDialogOpen, setPoDialogOpen] = useState(false);
  const [poForm, setPoForm] = useState({ vendor_name: "", items_summary: "", amount: "", po_date: new Date().toISOString().slice(0, 10) });
  const [poSaving, setPoSaving] = useState(false);

  // Add plan item dialog
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planForm, setPlanForm] = useState({ project_id: "", material_name: "", category: "", quantity: "", unit: "units", required_by: "", lead_time_days: "7", supplier: "" });
  const [planSaving, setPlanSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const rolePromise = supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return { role: null, id: null };
      const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
      return { role: data as string | null, id: user.id };
    });

    const [invRes, poRes, reqRes, projRes, planRes, siteRes, roleData] = await Promise.all([
      supabase.from("inventory_items").select("*").eq("is_archived", false).order("material_name"),
      supabase.from("purchase_orders").select("*").eq("is_archived", false).order("po_date", { ascending: false }),
      supabase.from("material_requests").select("*").eq("is_archived", false).order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name").eq("is_archived", false),
      (supabase.from("material_plan_items") as any).select("*").order("required_by", { ascending: true }),
      (supabase.from("site_direct_receipts" as any) as any).select("*").order("received_at", { ascending: false }),
      rolePromise,
    ]);

    setItems(invRes.data ?? []);
    setPurchaseOrders(poRes.data ?? []);
    setRequests(reqRes.data ?? []);
    setPlanItems(planRes.data ?? []);
    setSiteReceipts(siteRes.data ?? []);
    const pm: Record<string, string> = {};
    const projList = projRes.data ?? [];
    projList.forEach((p) => { pm[p.id] = p.name; });
    setProjectsMap(pm);
    setProjects(projList);
    setUserRole(roleData.role);
    setUserId(roleData.id);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const canAddItem = STOCK_CREATOR_ROLES.includes(userRole ?? "");
  const canAddPO = PO_CREATOR_ROLES.includes(userRole ?? "");
  const canRequest = REQUESTOR_ROLES.includes(userRole ?? "");
  const canApprove = APPROVER_ROLES.includes(userRole ?? "");
  const canPlan = PLANNER_ROLES.includes(userRole ?? "");

  // Dashboard counts
  const lowStockCount = items.filter((i) => Number(i.current_stock) <= Number(i.reorder_level)).length;
  const pendingReqCount = requests.filter((r) => ["pending_budget", "pending_director_approval"].includes(r.status)).length;
  const today = new Date();
  const overduePlanCount = planItems.filter((p) => {
    if (p.status !== "planned") return false;
    const orderBy = p.required_by ? subDays(new Date(p.required_by), Number(p.lead_time_days || 7)) : null;
    return orderBy && isBefore(orderBy, today);
  }).length;
  const pendingDirectorPOCount = purchaseOrders.filter((po) => po.status === "pending" && Number(po.amount) > 50000).length;

  // Upcoming order deadlines (next 7 days)
  const upcomingDeadlines = useMemo(() => {
    const next7 = addDays(today, 7);
    return planItems.filter((p) => {
      if (p.status !== "planned") return false;
      const orderBy = p.required_by ? subDays(new Date(p.required_by), Number(p.lead_time_days || 7)) : null;
      return orderBy && isAfter(orderBy, subDays(today, 1)) && isBefore(orderBy, next7);
    }).slice(0, 10);
  }, [planItems, today]);

  const handleSaveItem = async () => {
    if (!itemForm.material_name.trim() || !itemForm.category.trim()) { toast.error("Name and category required"); return; }
    if (itemDeliveryDest === "site_direct" && !itemForm.project_id) { toast.error("Project is required for site direct delivery."); return; }
    setItemSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();
      if (itemDeliveryDest === "site_direct") {
        const { error } = await (client.from("site_direct_receipts" as any) as any).insert({
          project_id: itemForm.project_id, material_name: itemForm.material_name.trim(), category: itemForm.category.trim(),
          qty: Number(itemForm.current_stock) || 0, unit: itemForm.unit.trim() || "units",
          vendor_name: itemForm.vendor_name.trim() || null, received_by_on_site: itemForm.received_by_on_site.trim() || null,
          site_receipt_notes: itemForm.site_receipt_notes.trim() || null, created_by: user.id,
        });
        if (error) throw error;
        toast.success("Logged to site inventory");
      } else {
        const { error } = await (client.from("inventory_items") as any).insert({
          material_name: itemForm.material_name.trim(), category: itemForm.category.trim(),
          current_stock: Number(itemForm.current_stock) || 0, unit: itemForm.unit.trim() || "units",
          reorder_level: Number(itemForm.reorder_level) || 0, delivery_destination: "factory",
          project_id: itemForm.project_id || null, created_by: user.id,
        });
        if (error) throw error;
        toast.success("Item added");
      }
      setItemDialogOpen(false);
      setItemForm({ material_name: "", category: "", current_stock: "", unit: "units", reorder_level: "", project_id: "", vendor_name: "", received_by_on_site: "", site_receipt_notes: "" });
      setItemDeliveryDest("factory");
      fetchData();
    } catch (err: any) { toast.error(err.message); } finally { setItemSaving(false); }
  };

  const handleSavePO = async () => {
    if (!poForm.vendor_name.trim() || !poForm.items_summary.trim()) { toast.error("Vendor and items required"); return; }
    setPoSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();
      const { error } = await (client.from("purchase_orders") as any).insert({
        vendor_name: poForm.vendor_name.trim(), items_summary: poForm.items_summary.trim(),
        amount: Number(poForm.amount) || 0, po_date: poForm.po_date, raised_by: user.id,
      });
      if (error) throw error;
      toast.success("PO added");
      setPoDialogOpen(false);
      setPoForm({ vendor_name: "", items_summary: "", amount: "", po_date: new Date().toISOString().slice(0, 10) });
      fetchData();
    } catch (err: any) { toast.error(err.message); } finally { setPoSaving(false); }
  };

  const handleSavePlanItem = async () => {
    if (!planForm.project_id || !planForm.material_name.trim()) { toast.error("Project and material required"); return; }
    setPlanSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();
      const { error } = await (client.from("material_plan_items") as any).insert({
        project_id: planForm.project_id,
        material_name: planForm.material_name.trim(),
        category: planForm.category.trim() || "General",
        quantity: Number(planForm.quantity) || 0,
        unit: planForm.unit.trim() || "units",
        required_by: planForm.required_by || null,
        lead_time_days: Number(planForm.lead_time_days) || 7,
        supplier: planForm.supplier.trim() || null,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("Plan item added");
      setPlanDialogOpen(false);
      setPlanForm({ project_id: "", material_name: "", category: "", quantity: "", unit: "units", required_by: "", lead_time_days: "7", supplier: "" });
      fetchData();
    } catch (err: any) { toast.error(err.message); } finally { setPlanSaving(false); }
  };

  const handleAction = async (requestId: string, action: string) => {
    try {
      const { client, session } = await getAuthedClient();
      let update: Record<string, any> = {};
      if (action === "approve_budget") update = { status: "pending_po", budget_approved_by: session.user.id, budget_approved_at: new Date().toISOString() };
      else if (action === "over_budget") update = { status: "pending_director_approval", is_over_budget: true, budget_approved_by: session.user.id, budget_approved_at: new Date().toISOString() };
      else if (action === "director_approve") update = { status: "pending_po", director_approved_by: session.user.id, director_approved_at: new Date().toISOString() };
      else if (action === "raise_po") update = { status: "po_raised", po_raised_by: session.user.id, po_raised_at: new Date().toISOString() };
      else if (action === "mark_received") update = { status: "received", received_by: session.user.id, received_at: new Date().toISOString() };
      else if (action === "reject") update = { status: "rejected", rejection_reason: "Rejected by approver" };
      const { error } = await (client.from("material_requests") as any).update(update).eq("id", requestId);
      if (error) throw error;
      toast.success("Updated");
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading) {
    return <div className="flex justify-center items-center py-24"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "#666666" }} /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A1A1A" }}>Procurement</h1>
        <p className="text-sm mt-1" style={{ color: "#666666" }}>Material planning, purchase orders & inventory</p>
      </div>

      {/* Vijay's Daily View Strip */}
      <ProcurementDashboardStrip userRole={userRole} />

      <Tabs defaultValue="dashboard" className="space-y-4">
        <ScrollableTabsWrapper>
          <TabsList>
            <TabsTrigger value="dashboard" className="gap-1.5"><LayoutDashboard className="h-4 w-4" /> Dashboard</TabsTrigger>
            <TabsTrigger value="material-plan" className="gap-1.5"><ClipboardList className="h-4 w-4" /> Material Plan</TabsTrigger>
            <TabsTrigger value="requests" className="gap-1.5"><AlertTriangle className="h-4 w-4" /> Requests</TabsTrigger>
            <TabsTrigger value="purchase-orders" className="gap-1.5"><FileText className="h-4 w-4" /> Purchase Orders</TabsTrigger>
            <TabsTrigger value="inventory" className="gap-1.5"><Package className="h-4 w-4" /> Inventory</TabsTrigger>
            <TabsTrigger value="transfers" className="gap-1.5"><Truck className="h-4 w-4" /> Transfers</TabsTrigger>
            <TabsTrigger value="30-day-plan" className="gap-1.5"><Calendar className="h-4 w-4" /> 30-Day Plan</TabsTrigger>
            <TabsTrigger value="asset-register" className="gap-1.5"><Hammer className="h-4 w-4" /> Asset Register</TabsTrigger>
            <TabsTrigger value="tally-po" className="gap-1.5"><FileSpreadsheet className="h-4 w-4" /> Tally PO Upload</TabsTrigger>
            <TabsTrigger value="supplier-intel" className="gap-1.5"><TrendingUp className="h-4 w-4" /> Supplier Intelligence</TabsTrigger>
          </TabsList>
        </ScrollableTabsWrapper>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Overdue Materials", count: overduePlanCount, alert: overduePlanCount > 0, bg: overduePlanCount > 0 ? "#FFF0F0" : "#F7F7F7", color: overduePlanCount > 0 ? "#F40009" : "#1A1A1A" },
              { label: "Pending Requests", count: pendingReqCount, alert: pendingReqCount > 0, bg: pendingReqCount > 0 ? "#FFF8E8" : "#F7F7F7", color: pendingReqCount > 0 ? "#D4860A" : "#1A1A1A" },
              { label: "Reorder Alerts", count: lowStockCount, alert: lowStockCount > 0, bg: lowStockCount > 0 ? "#FFF8E8" : "#F7F7F7", color: lowStockCount > 0 ? "#D4860A" : "#1A1A1A" },
              { label: "POs Pending Director", count: pendingDirectorPOCount, alert: pendingDirectorPOCount > 0, bg: pendingDirectorPOCount > 0 ? "#FFF0F0" : "#F7F7F7", color: pendingDirectorPOCount > 0 ? "#F40009" : "#1A1A1A" },
            ].map((tile) => (
              <div key={tile.label} className="rounded-lg p-4" style={{ backgroundColor: tile.bg, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <p className="text-2xl font-bold" style={{ color: tile.color }}>{tile.count}</p>
                <p className="text-xs font-medium mt-1" style={{ color: "#666666" }}>{tile.label}</p>
              </div>
            ))}
          </div>

          {upcomingDeadlines.length > 0 && (
            <div>
              <h2 className="font-display text-lg font-semibold mb-3" style={{ color: "#1A1A1A" }}>Upcoming Order Deadlines</h2>
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead><TableHead>Project</TableHead><TableHead>Qty</TableHead>
                        <TableHead>Required By</TableHead><TableHead>Order By</TableHead><TableHead>Supplier</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingDeadlines.map((item: any) => {
                        const orderBy = item.required_by ? subDays(new Date(item.required_by), Number(item.lead_time_days || 7)) : null;
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium" style={{ color: "#1A1A1A" }}>{item.material_name}</TableCell>
                            <TableCell style={{ color: "#666666" }}>{projectsMap[item.project_id] ?? "—"}</TableCell>
                            <TableCell>{item.quantity} {item.unit}</TableCell>
                            <TableCell>{item.required_by ? format(new Date(item.required_by), "dd MMM yyyy") : "—"}</TableCell>
                            <TableCell style={{ color: orderBy && isBefore(orderBy, today) ? "#F40009" : "#1A1A1A", fontWeight: 600 }}>
                              {orderBy ? format(orderBy, "dd MMM yyyy") : "—"}
                            </TableCell>
                            <TableCell style={{ color: "#666666" }}>{item.supplier ?? "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Material Availability Gate */}
          <MaterialAvailabilityGate />
        </TabsContent>

        {/* Material Plan Tab */}
        <TabsContent value="material-plan" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold" style={{ color: "#1A1A1A" }}>Material Plan</h2>
            {canPlan && (
              <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
                <DialogTrigger asChild><Button style={{ backgroundColor: "#006039" }}><Plus className="h-4 w-4 mr-1" /> Add Item</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Material Plan Item</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Project</Label>
                      <Select value={planForm.project_id} onValueChange={(v) => setPlanForm((p) => ({ ...p, project_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                        <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label className="text-xs">Material Name</Label><Input value={planForm.material_name} onChange={(e) => setPlanForm((p) => ({ ...p, material_name: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Category</Label><Input value={planForm.category} onChange={(e) => setPlanForm((p) => ({ ...p, category: e.target.value }))} /></div>
                      <div className="space-y-1"><Label className="text-xs">Quantity</Label><Input type="number" value={planForm.quantity} onChange={(e) => setPlanForm((p) => ({ ...p, quantity: e.target.value }))} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Unit</Label><Input value={planForm.unit} onChange={(e) => setPlanForm((p) => ({ ...p, unit: e.target.value }))} /></div>
                      <div className="space-y-1"><Label className="text-xs">Required By</Label><Input type="date" value={planForm.required_by} onChange={(e) => setPlanForm((p) => ({ ...p, required_by: e.target.value }))} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label className="text-xs">Lead Time (days)</Label><Input type="number" value={planForm.lead_time_days} onChange={(e) => setPlanForm((p) => ({ ...p, lead_time_days: e.target.value }))} /></div>
                      <div className="space-y-1"><Label className="text-xs">Supplier</Label><Input value={planForm.supplier} onChange={(e) => setPlanForm((p) => ({ ...p, supplier: e.target.value }))} placeholder="Optional" /></div>
                    </div>
                    <Button onClick={handleSavePlanItem} disabled={planSaving} className="w-full" style={{ backgroundColor: "#006039" }}>
                      {planSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          {planItems.length === 0 ? (
            <Card><CardContent className="py-10 text-center"><p className="text-sm" style={{ color: "#666666" }}>No material plan items yet.</p></CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead><TableHead>Project</TableHead><TableHead>Qty</TableHead>
                      <TableHead>Required By</TableHead><TableHead>Lead Time</TableHead><TableHead>Order By</TableHead>
                      <TableHead>Supplier</TableHead><TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {planItems.map((item: any) => {
                      const orderBy = item.required_by ? subDays(new Date(item.required_by), Number(item.lead_time_days || 7)) : null;
                      const isOverdue = item.status === "planned" && orderBy && isBefore(orderBy, today);
                      const cfg = isOverdue ? PLAN_STATUS_CONFIG.delayed : (PLAN_STATUS_CONFIG[item.status] ?? PLAN_STATUS_CONFIG.planned);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium" style={{ color: "#1A1A1A" }}>{item.material_name}</TableCell>
                          <TableCell style={{ color: "#666666" }}>{projectsMap[item.project_id] ?? "—"}</TableCell>
                          <TableCell>{item.quantity} {item.unit}</TableCell>
                          <TableCell>{item.required_by ? format(new Date(item.required_by), "dd MMM") : "—"}</TableCell>
                          <TableCell>{item.lead_time_days}d</TableCell>
                          <TableCell style={{ color: isOverdue ? "#F40009" : "#1A1A1A", fontWeight: isOverdue ? 600 : 400 }}>
                            {orderBy ? format(orderBy, "dd MMM") : "—"}
                          </TableCell>
                          <TableCell style={{ color: "#666666" }}>{item.supplier ?? "—"}</TableCell>
                          <TableCell><span className="text-xs font-medium px-2 py-0.5 rounded-full" style={cfg.style}>{cfg.label}</span></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold" style={{ color: "#1A1A1A" }}>Material Requests</h2>
            {canRequest && <Button onClick={() => setAddOpen(true)} style={{ backgroundColor: "#006039" }}><Plus className="h-4 w-4 mr-1" /> New Request</Button>}
          </div>
          {requests.length === 0 ? (
            <Card><CardContent className="py-10 text-center"><p className="text-sm" style={{ color: "#666666" }}>No material requests yet.</p></CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead><TableHead>Qty</TableHead><TableHead>Project</TableHead>
                      <TableHead>Urgency</TableHead><TableHead>Status</TableHead>
                      {canApprove && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((r) => {
                      const cfg = STATUS_CONFIG[r.status] ?? { label: r.status, style: { backgroundColor: "#F7F7F7", color: "#666666" } };
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium" style={{ color: "#1A1A1A" }}>{r.material_name}</TableCell>
                          <TableCell>{r.quantity} {r.unit}</TableCell>
                          <TableCell style={{ color: "#666666" }}>{projectsMap[r.project_id] ?? "—"}</TableCell>
                          <TableCell>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={r.urgency === "urgent" ? { backgroundColor: "#FFF0F0", color: "#F40009" } : { backgroundColor: "#F7F7F7", color: "#666666" }}>
                              {r.urgency}
                            </span>
                          </TableCell>
                          <TableCell><span className="text-xs font-medium px-2 py-0.5 rounded-full" style={cfg.style}>{cfg.label}</span></TableCell>
                          {canApprove && (
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {r.status === "pending_budget" && ["costing_engineer", "super_admin", "managing_director"].includes(userRole ?? "") && (
                                  <>
                                    <SoDButton label="Approve" onClick={() => handleAction(r.id, "approve_budget")} sodReason={isBlockedBySoD(r, userId, "approve_budget")} />
                                    <SoDButton label="Over Budget" onClick={() => handleAction(r.id, "over_budget")} sodReason={isBlockedBySoD(r, userId, "over_budget")} />
                                  </>
                                )}
                                {r.status === "pending_director_approval" && ["managing_director", "finance_director", "super_admin"].includes(userRole ?? "") && (
                                  <SoDButton label="Approve" onClick={() => handleAction(r.id, "director_approve")} sodReason={isBlockedBySoD(r, userId, "director_approve")} />
                                )}
                                {r.status === "pending_po" && ["procurement", "super_admin", "managing_director"].includes(userRole ?? "") && (
                                  <SoDButton label="Raise PO" onClick={() => handleAction(r.id, "raise_po")} sodReason={isBlockedBySoD(r, userId, "raise_po")} />
                                )}
                                {r.status === "po_raised" && ["stores_executive", "super_admin", "managing_director"].includes(userRole ?? "") && (
                                  <SoDButton label="Received" onClick={() => handleAction(r.id, "mark_received")} sodReason={isBlockedBySoD(r, userId, "mark_received")} />
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Purchase Orders Tab */}
        <TabsContent value="purchase-orders" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold" style={{ color: "#1A1A1A" }}>Purchase Orders</h2>
            {canAddPO && (
              <Dialog open={poDialogOpen} onOpenChange={setPoDialogOpen}>
                <DialogTrigger asChild><Button style={{ backgroundColor: "#006039" }}><Plus className="h-4 w-4 mr-1" /> Add PO</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Purchase Order</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2"><Label>Vendor</Label><Input value={poForm.vendor_name} onChange={(e) => setPoForm((p) => ({ ...p, vendor_name: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Items</Label><Input value={poForm.items_summary} onChange={(e) => setPoForm((p) => ({ ...p, items_summary: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" value={poForm.amount} onChange={(e) => setPoForm((p) => ({ ...p, amount: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>Date</Label><Input type="date" value={poForm.po_date} onChange={(e) => setPoForm((p) => ({ ...p, po_date: e.target.value }))} /></div>
                    </div>
                    <Button onClick={handleSavePO} disabled={poSaving} className="w-full" style={{ backgroundColor: "#006039" }}>
                      {poSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save PO
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          {purchaseOrders.length === 0 ? (
            <Card><CardContent className="py-10 text-center"><p className="text-sm" style={{ color: "#666666" }}>No purchase orders yet.</p></CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Vendor</TableHead><TableHead>Items</TableHead><TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead><TableHead>Date</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {purchaseOrders.map((po) => (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium" style={{ color: "#1A1A1A" }}>{po.vendor_name}</TableCell>
                        <TableCell className="max-w-[280px] truncate">{po.items_summary}</TableCell>
                        <TableCell>₹{Number(po.amount).toLocaleString("en-IN")}</TableCell>
                        <TableCell><span className="text-xs font-medium px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: "#E8F2ED", color: "#006039" }}>{po.status}</span></TableCell>
                        <TableCell>{new Date(po.po_date).toLocaleDateString("en-GB")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold" style={{ color: "#1A1A1A" }}>Inventory</h2>
            {canAddItem && (
              <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
                <DialogTrigger asChild><Button style={{ backgroundColor: "#006039" }}><Plus className="h-4 w-4 mr-1" /> Add Item</Button></DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    {/* Delivery Destination Radio */}
                    <div className="space-y-2">
                      <Label className="font-display text-sm font-bold">Delivery Destination</Label>
                      <RadioGroup value={itemDeliveryDest} onValueChange={(v) => setItemDeliveryDest(v as "factory" | "site_direct")} className="flex gap-3">
                        <label className={`flex items-center gap-2 rounded-lg border px-4 py-3 cursor-pointer transition-all ${itemDeliveryDest === "factory" ? "border-[#006039] bg-[#E8F2ED]" : "border-border bg-card"}`}>
                          <RadioGroupItem value="factory" />
                          <span className="text-sm font-medium">Factory / Stores</span>
                        </label>
                        <label className={`flex items-center gap-2 rounded-lg border px-4 py-3 cursor-pointer transition-all ${itemDeliveryDest === "site_direct" ? "border-[#D4860A] bg-[#FFF8E8]" : "border-border bg-card"}`}>
                          <RadioGroupItem value="site_direct" />
                          <span className="text-sm font-medium">Direct to Site</span>
                        </label>
                      </RadioGroup>
                    </div>
                    {itemDeliveryDest === "site_direct" && (
                      <div className="flex items-start gap-2 rounded-lg p-3" style={{ backgroundColor: "#FFF8E8", border: "1px solid #D4860A33" }}>
                        <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#D4860A" }} />
                        <p className="text-xs" style={{ color: "#D4860A" }}>This item will not be added to factory inventory. It will be logged directly to the site inventory for this project.</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>{itemDeliveryDest === "site_direct" ? "Project *" : "Project (optional)"}</Label>
                      <Select value={itemForm.project_id} onValueChange={(v) => setItemForm((p) => ({ ...p, project_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                        <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Material Name</Label><Input value={itemForm.material_name} onChange={(e) => setItemForm((p) => ({ ...p, material_name: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Category</Label><Input value={itemForm.category} onChange={(e) => setItemForm((p) => ({ ...p, category: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>{itemDeliveryDest === "site_direct" ? "Quantity" : "Current Stock"}</Label><Input type="number" value={itemForm.current_stock} onChange={(e) => setItemForm((p) => ({ ...p, current_stock: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>Unit</Label><Input value={itemForm.unit} onChange={(e) => setItemForm((p) => ({ ...p, unit: e.target.value }))} /></div>
                    </div>
                    {itemDeliveryDest === "factory" && (
                      <div className="space-y-2"><Label>Reorder Level</Label><Input type="number" value={itemForm.reorder_level} onChange={(e) => setItemForm((p) => ({ ...p, reorder_level: e.target.value }))} /></div>
                    )}
                    {itemDeliveryDest === "site_direct" && (
                      <>
                        <div className="space-y-2"><Label>Vendor Name (optional)</Label><Input value={itemForm.vendor_name} onChange={(e) => setItemForm((p) => ({ ...p, vendor_name: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>Received By on Site</Label><Input value={itemForm.received_by_on_site} onChange={(e) => setItemForm((p) => ({ ...p, received_by_on_site: e.target.value }))} placeholder="Name of person who received on site" /></div>
                        <div className="space-y-2"><Label>Site Receipt Notes (optional)</Label><Textarea value={itemForm.site_receipt_notes} onChange={(e) => setItemForm((p) => ({ ...p, site_receipt_notes: e.target.value }))} placeholder="Any notes about this delivery" rows={2} /></div>
                      </>
                    )}
                    <Button onClick={handleSaveItem} disabled={itemSaving} className="w-full" style={{ backgroundColor: "#006039" }}>
                      {itemSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                      {itemDeliveryDest === "site_direct" ? "Log Site Receipt" : "Save Item"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          {items.length === 0 && siteReceipts.length === 0 ? (
            <Card><CardContent className="py-10 text-center"><p className="text-sm" style={{ color: "#666666" }}>No inventory items yet.</p></CardContent></Card>
          ) : (
            <>
              {items.length > 0 && (
                <Card>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Material</TableHead><TableHead>Category</TableHead><TableHead>Stock</TableHead>
                        <TableHead>Unit</TableHead><TableHead>Reorder</TableHead><TableHead>Destination</TableHead><TableHead>Status</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {items.map((item) => {
                          const low = Number(item.current_stock) <= Number(item.reorder_level);
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium" style={{ color: "#1A1A1A" }}>{item.material_name}</TableCell>
                              <TableCell>{item.category}</TableCell>
                              <TableCell>{item.current_stock}</TableCell>
                              <TableCell>{item.unit}</TableCell>
                              <TableCell>{item.reorder_level}</TableCell>
                              <TableCell><span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "#E8F2ED", color: "#006039" }}>Factory</span></TableCell>
                              <TableCell>
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={low ? { backgroundColor: "#FFF0F0", color: "#F40009" } : { backgroundColor: "#E8F2ED", color: "#006039" }}>
                                  {low ? "LOW STOCK" : "Healthy"}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
              {siteReceipts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-display text-sm font-semibold" style={{ color: "#1A1A1A" }}>Direct to Site Receipts</h3>
                  <Card>
                    <CardContent className="p-0 overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>Material</TableHead><TableHead>Project</TableHead><TableHead>Qty</TableHead>
                          <TableHead>Unit</TableHead><TableHead>Vendor</TableHead><TableHead>Destination</TableHead><TableHead>Received At</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {siteReceipts.map((r: any) => (
                            <TableRow key={r.id}>
                              <TableCell className="font-medium" style={{ color: "#1A1A1A" }}>{r.material_name}</TableCell>
                              <TableCell>{projectsMap[r.project_id] ?? "—"}</TableCell>
                              <TableCell>{r.qty}</TableCell>
                              <TableCell>{r.unit}</TableCell>
                              <TableCell>{r.vendor_name ?? "—"}</TableCell>
                              <TableCell><span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: "#D4860A" }}>Site Direct</span></TableCell>
                              <TableCell>{new Date(r.received_at).toLocaleDateString("en-GB")}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Transfers Tab */}
        <TabsContent value="transfers">
          <TransfersTab />
        </TabsContent>

        <TabsContent value="30-day-plan">
          <ThirtyDayPlanTab />
        </TabsContent>

        <TabsContent value="asset-register">
          <AssetRegisterTab userRole={userRole} />
        </TabsContent>

        <TabsContent value="tally-po">
          <TallyPOUploadTab />
        </TabsContent>
      </Tabs>

      <NewMaterialRequestDialog open={addOpen} onOpenChange={setAddOpen} onCreated={fetchData} />
    </div>
  );
}
