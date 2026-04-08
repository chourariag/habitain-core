import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuotationVersionsPanel } from "./QuotationVersionsPanel";
import { ECVisitLogger } from "./ECVisitLogger";
import { HandoverChecklist } from "./HandoverChecklist";

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
              <TabsTrigger value="quotations" className="flex-1 text-xs">Quotes</TabsTrigger>
              <TabsTrigger value="ec" className="flex-1 text-xs">EC Visit</TabsTrigger>
              {deal.stage === "Won" && <TabsTrigger value="handover" className="flex-1 text-xs">Handover</TabsTrigger>}
            </TabsList>

            <TabsContent value="details">
              <DealForm form={form} set={set} deal={deal} saving={saving} onSave={handleSave} onMarkLost={handleMarkLost} onDelete={handleDelete} />
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
