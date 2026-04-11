import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, AlertTriangle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STAGES = ["Inquiry", "Site Visit Done", "Proposal Sent", "Negotiation", "Won", "Lost"];
const PROJECT_TYPES = ["Residential Modular", "Residential Panel", "Villa", "Commercial", "Other"];
const LEAD_SOURCES = [
  "Referral", "Instagram", "YouTube", "Google", "Architect Partner",
  "Cold Outreach", "Exhibition", "Direct Call", "WhatsApp Marketing", "Other",
];
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
  { value: "b2c", label: "B2C (Individual)" },
  { value: "b2b", label: "B2B (Corporate)" },
  { value: "resort", label: "Resort / Hospitality" },
];
const DIVISIONS = [
  { value: "habitainer", label: "Habitainer" },
  { value: "ads", label: "ADS" },
];

// Stagnation thresholds per client type (days)
const STAGNATION_DAYS: Record<string, number> = { b2b: 45, b2c: 90, resort: 180 };

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
    client_type: "b2c",
    experience_centre_visit: false,
    division: "habitainer",
  });
  const [saving, setSaving] = useState(false);

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
        client_type: deal.client_type || "b2c",
        experience_centre_visit: deal.experience_centre_visit || false,
        division: deal.division || "habitainer",
      });
    } else {
      setForm({
        client_name: "", contact_number: "", email: "", project_type: "Other",
        temperature: "warm", lead_source: "Other", estimated_sqft: "",
        contract_value: "", stage: "Inquiry", notes: "", amc_interest: "not_discussed",
        lost_reason: "", next_followup_date: null, client_type: "b2c",
        experience_centre_visit: false, division: "habitainer",
      });
    }
  }, [deal, open]);

  // Stagnation detection
  const stagnationDays = deal?.updated_at
    ? differenceInDays(new Date(), new Date(deal.updated_at))
    : 0;
  const stagnationThreshold = STAGNATION_DAYS[form.client_type] ?? 90;
  const isStagnant = deal && stagnationDays >= stagnationThreshold && !["Won", "Lost"].includes(form.stage);

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
      client_type: form.client_type,
      experience_centre_visit: form.experience_centre_visit,
      division: form.division,
    };

    if (deal) {
      // Track stage change
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
      <SheetContent className="w-[380px] sm:max-w-[380px] overflow-y-auto" style={{ background: "#FFFFFF" }}>
        <SheetHeader>
          <SheetTitle style={{ color: "#1A1A1A" }}>{deal ? "Edit Deal" : "New Deal"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 mt-4">
          {/* Stagnation warning */}
          {isStagnant && (
            <div className="rounded-md p-2 flex items-start gap-2 text-xs" style={{ backgroundColor: "#FFF8E8", color: "#D4860A", border: "1px solid #F5C842" }}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Deal stagnant for <strong>{stagnationDays} days</strong> (threshold: {stagnationThreshold}d for {form.client_type.toUpperCase()}). Action needed.</span>
            </div>
          )}

          <div><Label>Client Name *</Label><Input value={form.client_name} onChange={e => set("client_name", e.target.value)} /></div>
          <div><Label>Contact Number</Label><Input value={form.contact_number} onChange={e => set("contact_number", e.target.value)} /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={e => set("email", e.target.value)} /></div>

          <div><Label>Client Type</Label>
            <Select value={form.client_type} onValueChange={v => set("client_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CLIENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div><Label>Division</Label>
            <Select value={form.division} onValueChange={v => set("division", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DIVISIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div><Label>Project Type</Label>
            <Select value={form.project_type} onValueChange={v => set("project_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROJECT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>

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

          <div className="flex items-center gap-2">
            <input
              id="exp-centre-visit"
              type="checkbox"
              checked={form.experience_centre_visit}
              onChange={e => set("experience_centre_visit", e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="exp-centre-visit" className="cursor-pointer">Experience Centre Visit Done</Label>
          </div>

          <div><Label>Estimated sqft</Label><Input type="number" value={form.estimated_sqft} onChange={e => set("estimated_sqft", e.target.value)} /></div>
          <div><Label>Contract Value ₹ *</Label><Input type="number" value={form.contract_value} onChange={e => set("contract_value", e.target.value)} /></div>

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

          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} /></div>

          <div><Label>AMC Interest</Label>
            <Select value={form.amc_interest} onValueChange={v => set("amc_interest", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{AMC_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {form.stage === "Lost" && (
            <div><Label>Lost Reason *</Label>
              <Select value={form.lost_reason} onValueChange={v => set("lost_reason", v)}>
                <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>{LOST_REASONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full" style={{ background: "#006039", color: "#fff" }}>
            {saving ? "Saving…" : "Save"}
          </Button>

          {deal && form.stage !== "Lost" && (
            <Button variant="destructive" onClick={handleMarkLost} className="w-full" style={{ background: "#F40009" }}>
              Mark as Lost
            </Button>
          )}

          {deal && (
            <button onClick={handleDelete} className="w-full text-center text-xs mt-1" style={{ color: "#F40009" }}>
              Delete Deal
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
