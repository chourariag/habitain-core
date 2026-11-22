import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCanCreateProject } from "@/hooks/useCanCreateProject";
import { SiteLocationFields } from "@/components/projects/SiteLocationFields";
import { ClientContactFields } from "@/components/projects/ClientContactFields";
import { emptySiteLocation, normaliseClientPhone, validClientEmail, validateSiteLocation } from "@/lib/project-location";
import { listClientWorkOrders, type ClientWorkOrder } from "@/lib/contractor-wo";
import { fetchArchitectCandidates, type ArchitectProfile } from "@/hooks/useProjectArchitect";
import { ROLE_LABELS } from "@/lib/roles";
import { useEffect } from "react";


interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const PRODUCTION_SYSTEMS: { value: "modular" | "panelised" | "hybrid"; label: string }[] = [
  { value: "modular", label: "Modular" },
  { value: "panelised", label: "Panelised" },
  { value: "hybrid", label: "Hybrid" },
];

export function NewProjectDialog({ open, onOpenChange, onCreated }: NewProjectDialogProps) {
  const { allowed } = useCanCreateProject();
  return allowed ? <AllowedNewProjectDialog open={open} onOpenChange={onOpenChange} onCreated={onCreated} /> : null;
}

function AllowedNewProjectDialog({ open, onOpenChange, onCreated }: NewProjectDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [division, setDivision] = useState("Habitainer");
  const [productionSystem, setProductionSystem] = useState<"modular" | "panelised" | "hybrid">("modular");
  const [moduleCount, setModuleCount] = useState("");
  const [panelCount, setPanelCount] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [estCompletion, setEstCompletion] = useState<Date>();
  const [workOrders, setWorkOrders] = useState<ClientWorkOrder[]>([]);
  const [workOrderId, setWorkOrderId] = useState<string>("");
  const [woLineItemRef, setWoLineItemRef] = useState("");
  const [architects, setArchitects] = useState<ArchitectProfile[]>([]);
  const [architectId, setArchitectId] = useState("");
  const [site, setSite] = useState(emptySiteLocation);
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");


  const isContractorWo = division === "Contractor WO";

  useEffect(() => {
    if (open && isContractorWo && workOrders.length === 0) {
      listClientWorkOrders().then(setWorkOrders);
    }
  }, [open, isContractorWo, workOrders.length]);

  useEffect(() => {
    if (open && architects.length === 0) fetchArchitectCandidates().then(setArchitects);
  }, [open, architects.length]);

  const resetForm = () => {
    setName(""); setClientName("");
    setDivision("Habitainer"); setProductionSystem("modular");
    setModuleCount(""); setPanelCount(""); setContractValue("");
    setStartDate(undefined); setEstCompletion(undefined);
    setWorkOrderId(""); setWoLineItemRef(""); setArchitectId("");
    setSite(emptySiteLocation()); setClientPhone(""); setClientEmail("");
  };


  const showModules = productionSystem === "modular" || productionSystem === "hybrid";
  const showPanels = productionSystem === "panelised" || productionSystem === "hybrid";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Project name is required"); return; }
    if (!clientName.trim()) { toast.error("Client name is required"); return; }
    const siteError = validateSiteLocation(site);
    if (siteError) { toast.error(siteError); return; }
    const phone = normaliseClientPhone(clientPhone);
    if (!phone) { toast.error("Enter a valid 10-digit Indian mobile number, optionally prefixed with +91"); return; }
    if (!validClientEmail(clientEmail)) { toast.error("Enter a valid client email address"); return; }
    if (!startDate || !estCompletion) { toast.error("Contract Start and Expected Delivery dates are required"); return; }
    if (!architectId) { toast.error("Assign a Project Architect — this owns the S-1 and E-5 gates"); return; }

    if (isContractorWo) {
      if (!workOrderId) { toast.error("Select the Contractor Work Order this project sits under"); return; }
      const wo = workOrders.find((w) => w.id === workOrderId);
      if (!wo?.acceptance_signed) {
        toast.error("Acceptance Statement is not signed on this Work Order — projects cannot be submitted yet.");
        return;
      }
    }

    setLoading(true);
    try {
      const { client } = await getAuthedClient();

      const corePayload = {
        name: name.trim(),
        client_name: clientName.trim(),
        location: site.location.trim(), site_lat: Number(site.site_lat), site_lng: Number(site.site_lng), site_radius: Number(site.site_radius),
        project_architect_id: architectId || null,
        division,


        production_system: productionSystem,
        module_count: parseInt(moduleCount) || 0,
        panel_count: parseInt(panelCount) || 0,
        contract_value: contractValue ? parseFloat(contractValue) : 0,
        start_date: format(startDate, "yyyy-MM-dd"),
        est_completion: format(estCompletion, "yyyy-MM-dd"),
        ...(isContractorWo
          ? { client_work_order_id: workOrderId, wo_line_item_ref: woLineItemRef.trim() || null }
          : {}),
      };

      // The server checks the caller and creates all initial records in one transaction.
      const { data: projectId, error } = await client.rpc("create_project", {
        p_payload: corePayload, p_phone: phone, p_email: clientEmail.trim(),
      });
      if (error) throw error;
      if (!projectId) throw new Error("Project creation returned no project");

      // Notify planning engineers (Karthik) to upload the Project Setup Template
      try {
        const { data: planners } = await supabase
          .from("profiles").select("auth_user_id")
          .eq("role", "planning_engineer" as any).eq("is_active", true);
        const recipients = (planners || []).map((p: any) => p.auth_user_id);
        if (recipients.length > 0) {
          const { insertNotifications } = await import("@/lib/notifications");
          await insertNotifications(recipients.map((rid) => ({
            recipient_id: rid,
            title: `Upload Project Setup Template — ${name.trim()}`,
            body: `New project is active. Download the pre-filled template from the project Overview, complete planning details, and upload back.`,
            category: "task",
            related_table: "projects", related_id: projectId,
            navigate_to: `/projects/${projectId}`,
          })));
        }
      } catch { /* ignore */ }

      toast.success("Project created");
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) { setClientPhone(""); setClientEmail(""); } onOpenChange(next); }}>
      <DialogContent className="p-0 sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="font-display text-xl">New Project</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Planning details (BOQ, schedule, materials)
              come from the Project Setup Template upload.
            </p>
          </DialogHeader>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="projName">Project Name *</Label>
              <Input id="projName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Altree Villas Phase 2" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name *</Label>
              <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Prestige Group" required />
            </div>

            <div className="space-y-2">
              <Label>Project Architect *</Label>
              <Select value={architectId} onValueChange={setArchitectId}>
                <SelectTrigger><SelectValue placeholder="Select the assigned architect" /></SelectTrigger>
                <SelectContent>
                  {architects.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.display_name || "—"}{a.role ? ` · ${ROLE_LABELS[a.role] ?? a.role.replace(/_/g, " ")}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Owns the S-1 (Sign-off) and E-5 (H1 Advance GFC) gates. Can be reassigned later from the project page.</p>
            </div>



            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Division *</Label>
                <Select value={division} onValueChange={setDivision}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Habitainer">Habitainer</SelectItem>
                    <SelectItem value="ADS">ADS</SelectItem>
                    <SelectItem value="Contractor WO">Contractor WO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Production System *</Label>
                <Select value={productionSystem} onValueChange={(v) => setProductionSystem(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCTION_SYSTEMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {showModules && (
                <div className="space-y-2">
                  <Label htmlFor="moduleCount">Number of Modules</Label>
                  <Input id="moduleCount" type="number" min="0" value={moduleCount} onChange={(e) => setModuleCount(e.target.value)} placeholder="e.g. 12" />
                </div>
              )}
              {showPanels && (
                <div className="space-y-2">
                  <Label htmlFor="panelCount">Number of Panels</Label>
                  <Input id="panelCount" type="number" min="0" value={panelCount} onChange={(e) => setPanelCount(e.target.value)} placeholder="e.g. 36" />
                </div>
              )}
            </div>

            {isContractorWo && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Work Order *</Label>
                  <Select value={workOrderId} onValueChange={setWorkOrderId}>
                    <SelectTrigger><SelectValue placeholder="Select Work Order" /></SelectTrigger>
                    <SelectContent>
                      {workOrders.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.wo_number} — {w.client_company_name}{w.acceptance_signed ? "" : " (acceptance pending)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Commercial terms (payment stages, retention, DLP, delay damages) come from the Work Order.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="woLine">WO Line Item / Unit Ref</Label>
                  <Input id="woLine" value={woLineItemRef} onChange={(e) => setWoLineItemRef(e.target.value)} placeholder="e.g. Unit 3" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="contractValue">Contract Value (₹) *</Label>
              <Input id="contractValue" type="number" min="0" value={contractValue} onChange={(e) => setContractValue(e.target.value)} placeholder="e.g. 12500000" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contract Start Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Expected Delivery Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className={cn("w-full justify-start text-left font-normal", !estCompletion && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {estCompletion ? format(estCompletion, "dd/MM/yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={estCompletion} onSelect={setEstCompletion} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <SiteLocationFields value={site} onChange={setSite} />
            <ClientContactFields phone={clientPhone} email={clientEmail} onPhone={setClientPhone} onEmail={setClientEmail} />
          </div>

          <div className="flex items-center justify-end gap-2 border-t bg-background px-4 py-3">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => { setClientPhone(""); setClientEmail(""); onOpenChange(false); }} disabled={loading}>Cancel</Button>
            <Button type="submit" className="min-h-11" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Project
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
