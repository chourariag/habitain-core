import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Upload, Download, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuotationVersionsPanel } from "./QuotationVersionsPanel";
import { ECVisitLogger } from "./ECVisitLogger";
import { HandoverChecklist } from "./HandoverChecklist";
import { downloadXlsxTemplate, TEMPLATES } from "@/lib/xlsx-templates";
import * as XLSX from "xlsx";

const STAGES = ["Inquiry", "Site Visit Done", "Proposal Sent", "Negotiation", "Won", "Lost"];
const PROJECT_TYPES = ["Residential Modular", "Residential Panel", "Villa", "Commercial", "Other"];
const LEAD_SOURCES = ["Instagram", "YouTube", "Google", "Direct Call", "Referral", "WhatsApp Marketing", "Exhibition", "Partner / Architect", "Other"];
const TEMPERATURES = [
  { value: "hot", label: "🔥 Hot" },
  { value: "warm", label: "~ Warm" },
  { value: "cold", label: "❄ Cold" },
];
const AMC_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not_discussed", label: "Not Discussed" },
];
const LOST_REASONS = ["Price Too High", "Went with Competitor", "Project Cancelled", "No Response", "Budget Cut", "Other"];
const CLIENT_TYPES = [
  { value: "b2c_home", label: "B2C — Home" },
  { value: "b2b_corporate", label: "B2B — Corporate Office" },
  { value: "resort_hospitality", label: "Resort / Hospitality" },
  { value: "developer", label: "Developer" },
  { value: "other", label: "Other" },
];
const DIVISIONS = [
  { value: "habitainer", label: "Habitainer" },
  { value: "ads", label: "ADS" },
  { value: "both", label: "Both" },
];
const PERSONA_TAGS = ["Home Owner", "Developer", "Corporate", "Resort Owner", "Other"];

interface DealDrawerProps {
  open: boolean;
  onClose: () => void;
  deal: any | null;
  onSaved: () => void;
}

export function DealDrawer({ open, onClose, deal, onSaved }: DealDrawerProps) {
  const [form, setForm] = useState({
    client_name: "",
    contact_number: "",
    email: "",
    project_type: "Other",
    temperature: "warm",
    lead_source: "Other",
    estimated_sqft: "",
    contract_value: "",
    stage: "Inquiry",
    notes: "",
    amc_interest: "not_discussed",
    lost_reason: "",
    next_followup_date: null as Date | null,
    division: "habitainer",
    client_type: "other",
    persona_tag: "",
    delivery_city: "",
    within_350km: false,
  });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    if (deal) {
      setForm({
        client_name: deal.client_name || "",
        contact_number: deal.contact_number || "",
        email: deal.email || "",
        project_type: deal.project_type || "Other",
        temperature: deal.temperature || "warm",
        lead_source: deal.lead_source || "Other",
        estimated_sqft: deal.estimated_sqft ? String(deal.estimated_sqft) : "",
        contract_value: deal.contract_value ? String(deal.contract_value) : "",
        stage: deal.stage || "Inquiry",
        notes: deal.notes || "",
        amc_interest: deal.amc_interest || "not_discussed",
        lost_reason: deal.lost_reason || "",
        next_followup_date: deal.next_followup_date ? new Date(deal.next_followup_date) : null,
        division: deal.division || "habitainer",
        client_type: deal.client_type || "other",
        persona_tag: deal.persona_tag || "",
        delivery_city: deal.delivery_city || "",
        within_350km: deal.within_350km ?? false,
      });
    } else {
      setForm({
        client_name: "", contact_number: "", email: "", project_type: "Other",
        temperature: "warm", lead_source: "Other", estimated_sqft: "",
        contract_value: "", stage: "Inquiry", notes: "", amc_interest: "not_discussed",
        lost_reason: "", next_followup_date: null, division: "habitainer",
        client_type: "other", persona_tag: "", delivery_city: "", within_350km: false,
      });
      setActiveTab("details");
    }
  }, [deal, open]);

  const handleSave = async () => {
    if (!form.client_name || !form.contract_value) {
      toast.error("Client name and contract value are required");
      return;
    }
    if (form.stage === "Lost" && !form.lost_reason) {
      toast.error("Lost reason is required");
      return;
    }
    // Block Won if large discount not approved
    if (form.stage === "Won" && deal?.final_agreed_price) {
      const boq = Number(form.contract_value) || 0;
      const final = Number(deal.final_agreed_price) || 0;
      const pct = boq > 0 ? ((final - boq) / boq) * 100 : 0;
      if (pct < -15 && !deal.discount_approved_by) {
        toast.error("Discount >15% requires director approval before marking Won");
        return;
      }
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      client_name: form.client_name,
      contact_number: form.contact_number || null,
      email: form.email || null,
      project_type: form.project_type,
      temperature: form.temperature,
      lead_source: form.lead_source,
      estimated_sqft: form.estimated_sqft ? Number(form.estimated_sqft) : null,
      contract_value: Number(form.contract_value),
      stage: form.stage,
      notes: form.notes || null,
      amc_interest: form.amc_interest,
      lost_reason: form.stage === "Lost" ? form.lost_reason : null,
      next_followup_date: form.next_followup_date ? format(form.next_followup_date, "yyyy-MM-dd") : null,
      division: form.division,
      client_type: form.client_type,
      persona_tag: form.persona_tag || null,
      delivery_city: form.delivery_city || null,
      within_350km: form.within_350km,
    };

    // When marking Won, use final_agreed_price as contract_value if set
    if (form.stage === "Won" && deal?.final_agreed_price) {
      payload.contract_value = Number(deal.final_agreed_price);
    }

    if (deal) {
      if (deal.stage !== form.stage) {
        await supabase.from("sales_stage_history").insert({
          deal_id: deal.id,
          from_stage: deal.stage,
          to_stage: form.stage,
          changed_by: user?.id,
        });
      }
      const { error } = await supabase.from("sales_deals").update(payload).eq("id", deal.id);
      if (error) toast.error(error.message);
      else { toast.success("Deal updated"); onSaved(); onClose(); }
    } else {
      payload.created_by = user?.id;
      const { error } = await supabase.from("sales_deals").insert(payload);
      if (error) toast.error(error.message);
      else { toast.success("Deal created"); onSaved(); onClose(); }
    }
    setSaving(false);
  };

  const handleMarkLost = () => {
    setForm(f => ({ ...f, stage: "Lost" }));
  };

  const handleDelete = async () => {
    if (!deal) return;
    if (!confirm("Delete this deal permanently?")) return;
    const { error } = await supabase.from("sales_deals").update({ is_archived: true }).eq("id", deal.id);
    if (error) toast.error(error.message);
    else { toast.success("Deal deleted"); onSaved(); onClose(); }
  };

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto" style={{ background: "#FFFFFF" }}>
        <SheetHeader>
          <SheetTitle style={{ color: "#1A1A1A" }}>{deal ? "Edit Deal" : "New Deal"}</SheetTitle>
        </SheetHeader>

        {deal ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-3">
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1 text-xs">Details</TabsTrigger>
              <TabsTrigger value="financial" className="flex-1 text-xs">Financial</TabsTrigger>
              <TabsTrigger value="quotations" className="flex-1 text-xs">Quotes</TabsTrigger>
              <TabsTrigger value="ec" className="flex-1 text-xs">EC Visit</TabsTrigger>
              {deal.stage === "Won" && <TabsTrigger value="handover" className="flex-1 text-xs">Handover</TabsTrigger>}
            </TabsList>

            <TabsContent value="details">
              <DealForm form={form} set={set} deal={deal} saving={saving} onSave={handleSave} onMarkLost={handleMarkLost} onDelete={handleDelete} />
            </TabsContent>
            <TabsContent value="financial">
              <TenderBudgetSection dealId={deal.id} projectId={deal.project_id} deal={deal} onSaved={onSaved} />
            </TabsContent>
            <TabsContent value="quotations">
              <QuotationVersionsPanel dealId={deal.id} />
            </TabsContent>
            <TabsContent value="ec">
              <ECVisitLogger dealId={deal.id} clientName={deal.client_name} />
            </TabsContent>
            {deal.stage === "Won" && (
              <TabsContent value="handover">
                <HandoverChecklist dealId={deal.id} dealName={deal.client_name} contractValue={deal.contract_value} onComplete={onSaved} />
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <div className="mt-4">
            <DealForm form={form} set={set} deal={deal} saving={saving} onSave={handleSave} onMarkLost={handleMarkLost} onDelete={handleDelete} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DealForm({ form, set, deal, saving, onSave, onMarkLost, onDelete }: any) {
  return (
    <div className="space-y-3 mt-2">
      <div><Label>Client Name *</Label><Input value={form.client_name} onChange={e => set("client_name", e.target.value)} /></div>
      <div><Label>Contact Number</Label><Input value={form.contact_number} onChange={e => set("contact_number", e.target.value)} /></div>
      <div><Label>Email</Label><Input value={form.email} onChange={e => set("email", e.target.value)} /></div>

      <div className="grid grid-cols-2 gap-2">
        <div><Label>Division *</Label>
          <Select value={form.division} onValueChange={v => set("division", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DIVISIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Client Type *</Label>
          <Select value={form.client_type} onValueChange={v => set("client_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CLIENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div><Label>Project Type</Label>
        <Select value={form.project_type} onValueChange={v => set("project_type", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{PROJECT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div><Label>Lead Temperature</Label>
          <Select value={form.temperature} onValueChange={v => set("temperature", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TEMPERATURES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Lead Source</Label>
          <Select value={form.lead_source} onValueChange={v => set("lead_source", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{LEAD_SOURCES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div><Label>Estimated sqft</Label><Input type="number" value={form.estimated_sqft} onChange={e => set("estimated_sqft", e.target.value)} /></div>
        <div><Label>Contract Value ₹ *</Label><Input type="number" value={form.contract_value} onChange={e => set("contract_value", e.target.value)} /></div>
      </div>

      <div><Label>Stage</Label>
        <Select value={form.stage} onValueChange={v => set("stage", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{STAGES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div><Label>Next Follow-Up Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.next_followup_date && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {form.next_followup_date ? format(form.next_followup_date, "dd/MM/yyyy") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={form.next_followup_date || undefined} onSelect={d => set("next_followup_date", d || null)} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>

      <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></div>

      <div className="grid grid-cols-2 gap-2">
        <div><Label>AMC Interest</Label>
          <Select value={form.amc_interest} onValueChange={v => set("amc_interest", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{AMC_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Persona Tag</Label>
          <Select value={form.persona_tag || ""} onValueChange={v => set("persona_tag", v)}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>{PERSONA_TAGS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div><Label>Delivery City</Label><Input value={form.delivery_city} onChange={e => set("delivery_city", e.target.value)} placeholder="City name" /></div>
        <div className="flex items-end gap-2 pb-1">
          <input type="checkbox" checked={form.within_350km} onChange={e => set("within_350km", e.target.checked)} id="within350" />
          <Label htmlFor="within350" className="text-xs">Within 350km</Label>
        </div>
      </div>

      {form.stage === "Lost" && (
        <div><Label>Lost Reason *</Label>
          <Select value={form.lost_reason} onValueChange={v => set("lost_reason", v)}>
            <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
            <SelectContent>{LOST_REASONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      <Button onClick={onSave} disabled={saving} className="w-full" style={{ background: "#006039", color: "#fff" }}>
        {saving ? "Saving…" : "Save"}
      </Button>

      {deal && form.stage !== "Lost" && (
        <Button variant="destructive" onClick={onMarkLost} className="w-full" style={{ background: "#F40009" }}>
          Mark as Lost
        </Button>
      )}

      {deal && (
        <button onClick={onDelete} className="w-full text-center text-xs mt-1" style={{ color: "#F40009" }}>
          Delete Deal
        </button>
      )}
    </div>
  );
}

function TenderBudgetSection({ dealId, projectId, deal, onSaved }: { dealId: string; projectId?: string; deal: any; onSaved: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [quotationValue, setQuotationValue] = useState("");
  const [itemCount, setItemCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [tenderTotal, setTenderTotal] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Negotiation state
  const [finalAgreedPrice, setFinalAgreedPrice] = useState(deal?.final_agreed_price ? String(deal.final_agreed_price) : "");
  const [adjustmentType, setAdjustmentType] = useState(deal?.adjustment_type || "");
  const [adjustmentNotes, setAdjustmentNotes] = useState(deal?.adjustment_notes || "");
  const [savingNeg, setSavingNeg] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
        setUserRole(data as string | null);
      }
    });
  }, []);

  useEffect(() => {
    (supabase as any).from("project_tender_budget")
      .select("quotation_value, id, total_tender_value")
      .eq("deal_id", dealId)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .then(({ data }: any) => {
        if (data && data.length > 0) {
          setQuotationValue(String(data[0].quotation_value || ""));
          setTenderTotal(Number(data[0].total_tender_value) || 0);
          (supabase as any).from("project_tender_budget_items")
            .select("id", { count: "exact", head: true })
            .eq("budget_id", data[0].id)
            .then(({ count }: any) => setItemCount(count || 0));
        }
      });
  }, [dealId]);

  useEffect(() => {
    if (deal) {
      setFinalAgreedPrice(deal.final_agreed_price ? String(deal.final_agreed_price) : "");
      setAdjustmentType(deal.adjustment_type || "");
      setAdjustmentNotes(deal.adjustment_notes || "");
    }
  }, [deal]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const items: any[] = [];
      let totalAmt = 0;
      for (const row of rows) {
        const tenderQty = Number(row["Tender Qty"] || 0);
        const gfcQtyRaw = row["GFC Qty"];
        const gfcQty = gfcQtyRaw === "" || gfcQtyRaw === undefined || gfcQtyRaw === null
          ? tenderQty
          : Number(gfcQtyRaw) || 0;
        const totalRate = Number(row["Total Rate (₹)"] || 0);
        // Total Amount = GFC Qty × Total Rate (recalculated to override any stale value in the file)
        const computedAmt = gfcQty * totalRate;
        const amt = computedAmt || Number(row["Total Amount (₹)"] || row["Total Amount"] || 0);
        if (!row["Category"] && !amt) continue;
        totalAmt += amt;
        items.push({
          category: row["Category"] || "",
          description: row["Description"] || "",
          tender_qty: tenderQty,
          gfc_qty: gfcQty,
          unit: row["Unit"] || "",
          material_rate: Number(row["Material Rate (₹)"] || 0),
          labour_rate: Number(row["Labour Rate (₹)"] || 0),
          oh_rate: Number(row["OH Rate (₹)"] || 0),
          total_rate: totalRate,
          total_amount: amt,
          margin_pct: Number(row["Margin %"] || 0),
          notes: row["Notes"] || "",
        });
      }

      if (items.length === 0) { toast.error("No items found"); setUploading(false); return; }

      const { data: { user } } = await supabase.auth.getUser();
      const { data: budget, error } = await (supabase as any).from("project_tender_budget").insert({
        deal_id: dealId,
        project_id: projectId || null,
        uploaded_by: user?.id,
        total_tender_value: totalAmt,
        quotation_value: Number(quotationValue) || 0,
      }).select("id").single();

      if (error) throw error;
      const budgetItems = items.map((i) => ({ budget_id: budget.id, ...i }));
      await (supabase as any).from("project_tender_budget_items").insert(budgetItems);

      setItemCount(items.length);
      setTenderTotal(totalAmt);
      toast.success(`${items.length} tender budget items uploaded`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveQuotation = async () => {
    setSaving(true);
    const { data: existing } = await (supabase as any).from("project_tender_budget")
      .select("id").eq("deal_id", dealId).order("uploaded_at", { ascending: false }).limit(1);
    if (existing && existing.length > 0) {
      await (supabase as any).from("project_tender_budget")
        .update({ quotation_value: Number(quotationValue) || 0 })
        .eq("id", existing[0].id);
      toast.success("Quotation value saved");
    } else {
      toast.error("Upload tender budget first");
    }
    setSaving(false);
  };

  const saveNegotiation = async () => {
    const finalNum = Number(finalAgreedPrice) || 0;
    const adj = finalNum - tenderTotal;
    if (finalNum > 0 && adj !== 0 && !adjustmentType) {
      toast.error("Adjustment type is required when price differs from BOQ total");
      return;
    }
    if (adjustmentType === "Other" && !adjustmentNotes.trim()) {
      toast.error("Notes required for 'Other' adjustment type");
      return;
    }
    setSavingNeg(true);
    const { error } = await supabase.from("sales_deals").update({
      final_agreed_price: finalNum || null,
      adjustment_type: adjustmentType || null,
      adjustment_notes: adjustmentNotes || null,
    } as any).eq("id", dealId);
    if (error) toast.error(error.message);
    else { toast.success("Negotiation saved"); onSaved(); }
    setSavingNeg(false);
  };

  const approveDiscount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("sales_deals").update({
      discount_approved_by: user?.id,
      discount_approved_at: new Date().toISOString(),
    } as any).eq("id", dealId);
    if (error) toast.error(error.message);
    else { toast.success("Discount approved"); onSaved(); }
  };

  const finalNum = Number(finalAgreedPrice) || 0;
  const adjustment = finalNum > 0 && tenderTotal > 0 ? finalNum - tenderTotal : 0;
  const adjustmentPct = tenderTotal > 0 && finalNum > 0 ? ((finalNum - tenderTotal) / tenderTotal) * 100 : 0;
  const revisedMargin = finalNum > 0 && tenderTotal > 0 ? ((finalNum - tenderTotal) / finalNum) * 100 : 0;
  const needsApproval = tenderTotal > 0 && finalNum > 0 && adjustmentPct < -15 && !deal?.discount_approved_by;
  const canApproveDiscount = ["super_admin", "managing_director", "finance_director", "sales_director", "architecture_director"].includes(userRole ?? "");

  const ADJUSTMENT_TYPES = [
    "Discount given — client negotiated lower price",
    "Scope reduction — client removed items from scope",
    "Scope addition — client added items, price increased",
    "Promotional pricing — special rate for this client",
    "Competitor price match — matched competitor quote",
    "Other",
  ];

  const fmtINR = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-4 mt-3">
      <h3 className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Tender / Project Budget</h3>
      <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleUpload} />

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => downloadXlsxTemplate(TEMPLATES.tenderBudget.filename, TEMPLATES.tenderBudget.sheet, TEMPLATES.tenderBudget.headers, TEMPLATES.tenderBudget.sample)}
          style={{ borderColor: "#006039", color: "#006039" }} className="text-xs gap-1">
          <Download className="h-3 w-3" /> Template
        </Button>
        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}
          style={{ backgroundColor: "#006039" }} className="text-white text-xs gap-1">
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          Upload Tender Budget
        </Button>
      </div>
      {itemCount > 0 && (
        <p className="text-xs" style={{ color: "#006039" }}>✓ {itemCount} budget items uploaded</p>
      )}

      <div className="space-y-2">
        <Label className="text-xs">Quotation Value (₹)</Label>
        <div className="flex gap-2">
          <Input type="number" value={quotationValue} onChange={(e) => setQuotationValue(e.target.value)} placeholder="Total contract value" className="text-sm" />
          <Button size="sm" onClick={saveQuotation} disabled={saving} style={{ backgroundColor: "#006039" }} className="text-white text-xs">
            {saving ? "…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Price Negotiation Section */}
      {tenderTotal > 0 && (
        <div className="space-y-3 border-t pt-3">
          <h4 className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>Price Negotiation</h4>

          <div className="rounded-lg p-3 space-y-2 text-xs" style={{ background: "#F7F7F7" }}>
            <div className="flex justify-between">
              <span style={{ color: "#666" }}>BOQ Calculated Total</span>
              <span className="font-mono font-semibold">{fmtINR(tenderTotal)}</span>
            </div>
            {Number(quotationValue) > 0 && (
              <div className="flex justify-between">
                <span style={{ color: "#666" }}>Quotation Sent</span>
                <span className="font-mono">{fmtINR(Number(quotationValue))}</span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Final Agreed Price (₹) *</Label>
            <Input type="number" value={finalAgreedPrice} onChange={(e) => setFinalAgreedPrice(e.target.value)} placeholder="What client agreed to pay" className="text-sm" />
          </div>

          {/* Adjustment display */}
          {finalNum > 0 && tenderTotal > 0 && (
            <div className="space-y-2">
              {adjustment === 0 ? (
                <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#006039" }}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> No adjustment
                </div>
              ) : (
                <div className="rounded-lg p-3 space-y-2 text-xs" style={{ background: adjustment > 0 ? "#E8F2ED" : "#FFF0F0" }}>
                  <div className="flex justify-between">
                    <span style={{ color: "#666" }}>Adjustment</span>
                    <span className="font-mono font-semibold" style={{ color: adjustment > 0 ? "#006039" : "#F40009" }}>
                      {adjustment > 0 ? "+" : ""}{fmtINR(adjustment)} ({adjustmentPct > 0 ? "+" : ""}{adjustmentPct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "#666" }}>Revised Margin %</span>
                    <span className="font-mono font-bold" style={{
                      color: revisedMargin >= 20 ? "#006039" : revisedMargin >= 10 ? "#D4860A" : "#F40009"
                    }}>
                      {revisedMargin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}

              {/* Discount warning */}
              {adjustmentPct < -15 && (
                <div className="rounded-lg p-2.5 text-xs flex items-start gap-2" style={{ background: "#FFF0F0", border: "1px solid #F40009" }}>
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#F40009" }} />
                  <div>
                    <p className="font-semibold" style={{ color: "#F40009" }}>
                      ⚠️ This discount reduces margin below 15%. Director approval required before marking Won.
                    </p>
                    {deal?.discount_approved_by ? (
                      <p className="mt-1" style={{ color: "#006039" }}>✓ Discount approved</p>
                    ) : canApproveDiscount ? (
                      <Button size="sm" onClick={approveDiscount} className="mt-2 text-xs" style={{ backgroundColor: "#D4860A" }}>
                        Approve Discount
                      </Button>
                    ) : (
                      <p className="mt-1" style={{ color: "#666" }}>Awaiting director approval</p>
                    )}
                  </div>
                </div>
              )}

              {/* Adjustment type (required when ≠ 0) */}
              {adjustment !== 0 && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Adjustment Type *</Label>
                    <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                      <SelectTrigger className="text-xs"><SelectValue placeholder="Select reason" /></SelectTrigger>
                      <SelectContent>
                        {ADJUSTMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {adjustmentType === "Other" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Adjustment Notes *</Label>
                      <Textarea rows={2} value={adjustmentNotes} onChange={(e) => setAdjustmentNotes(e.target.value)} placeholder="Explain the reason" className="text-xs" />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <Button size="sm" onClick={saveNegotiation} disabled={savingNeg} className="w-full text-xs" style={{ backgroundColor: "#006039" }}>
            {savingNeg ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Save Negotiation
          </Button>
        </div>
      )}
    </div>
  );
}
