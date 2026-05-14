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
import { PRODUCTION_STAGES } from "@/components/projects/ProductionStageTracker";
import { useUserRole } from "@/hooks/useUserRole";
import { raiseApprovalRequest } from "@/lib/approval-requests";

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

const ALLOWED_RAISERS = ["planning_head", "managing_director", "super_admin"];

export function NewProjectDialog({ open, onOpenChange, onCreated }: NewProjectDialogProps) {
  const { role } = useUserRole();
  const canRaise = !!role && ALLOWED_RAISERS.includes(role);
  const requiresApproval = !!role && !["managing_director", "super_admin"].includes(role);
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

  const resetForm = () => {
    setName(""); setClientName("");
    setDivision("Habitainer"); setProductionSystem("modular");
    setModuleCount(""); setPanelCount(""); setContractValue("");
    setStartDate(undefined); setEstCompletion(undefined);
  };

  const showModules = productionSystem === "modular" || productionSystem === "hybrid";
  const showPanels = productionSystem === "panelised" || productionSystem === "hybrid";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Project name is required"); return; }
    if (!clientName.trim()) { toast.error("Client name is required"); return; }
    if (!startDate || !estCompletion) { toast.error("Contract Start and Expected Delivery dates are required"); return; }
    if (!canRaise) { toast.error("Only the Planning Head can raise a project creation request."); return; }

    setLoading(true);
    try {
      const { client, session } = await getAuthedClient();

      const corePayload = {
        name: name.trim(),
        client_name: clientName.trim(),
        division,
        production_system: productionSystem,
        module_count: parseInt(moduleCount) || 0,
        panel_count: parseInt(panelCount) || 0,
        contract_value: contractValue ? parseFloat(contractValue) : 0,
        start_date: format(startDate, "yyyy-MM-dd"),
        est_completion: format(estCompletion, "yyyy-MM-dd"),
      };

      // Non-MD users → approval request
      if (requiresApproval) {
        const reqRow: any = await raiseApprovalRequest("create_project", corePayload);

        try {
          const approverRole = division === "ADS" ? "principal_architect" : "sales_director";
          const { data: approvers } = await supabase
            .from("profiles")
            .select("auth_user_id")
            .eq("role", approverRole as any)
            .eq("is_active", true);
          const recipients = (approvers || []).map((a: any) => a.auth_user_id);
          if (recipients.length > 0) {
            const title = division === "ADS"
              ? `New ADS project request — ${name.trim()}`
              : `New project request — ${name.trim()}`;
            const body = `${clientName.trim()} | ${productionSystem.toUpperCase()} | ${corePayload.module_count} modules / ${corePayload.panel_count} panels | ₹${corePayload.contract_value.toLocaleString("en-IN")}\nRaised by ${session.user.email || "Project Manager"}. Tap to review and approve.`;
            const { insertNotifications } = await import("@/lib/notifications");
            await insertNotifications(recipients.map((rid) => ({
              recipient_id: rid,
              title,
              body,
              category: "approval_request",
              related_table: "approval_requests",
              related_id: reqRow?.id,
              navigate_to: `/approvals?id=${reqRow?.id}`,
            })));
          }
        } catch (notifyErr) { console.warn("notify approver failed", notifyErr); }

        toast.success(
          division === "ADS"
            ? "Project request sent to Principal Architect (Karan) for approval"
            : "Project request sent to Sales Director (John) for approval"
        );
        resetForm();
        onOpenChange(false);
        onCreated();
        setLoading(false);
        return;
      }

      // MD / super_admin: direct create
      const { data: project, error } = await client.from("projects").insert({
        ...corePayload,
        created_by: session.user.id,
        updated_by: session.user.id,
        status: "Active",
      } as any).select("id").single();

      if (error) throw error;
      const projectId = (project as any).id;

      // Auto-create modules / panels
      const mCount = corePayload.module_count;
      const pCount = corePayload.panel_count;
      if (mCount > 0 && projectId) {
        const moduleInserts = Array.from({ length: mCount }, (_, i) => ({
          project_id: projectId,
          name: `Module ${i + 1}`,
          module_type: "standard",
          current_stage: "Sub-Frame",
          production_status: "not_started",
          created_by: session.user.id,
        }));
        await client.from("modules").insert(moduleInserts as any);
        const { data: createdModules } = await client.from("modules").select("id").eq("project_id", projectId);
        if (createdModules) {
          const stageInserts = (createdModules as any[]).flatMap((m: any) =>
            PRODUCTION_STAGES.map((stage, idx) => ({
              module_id: m.id, stage_name: stage, stage_order: idx + 1, status: "pending",
            }))
          );
          await client.from("production_stages").insert(stageInserts as any);
        }
      }
      if (pCount > 0 && projectId) {
        const { data: parentModule } = await client.from("modules").insert({
          project_id: projectId, name: "Panel Production", module_type: "standard",
          current_stage: "Sub-Frame", production_status: "not_started", created_by: session.user.id,
        } as any).select("id").single();
        if (parentModule) {
          const panelInserts = Array.from({ length: pCount }, (_, i) => ({
            module_id: (parentModule as any).id,
            panel_code: `Panel ${i + 1}`,
            panel_type: "wall",
            current_stage: "Sub-Frame",
            production_status: "not_started",
            created_by: session.user.id,
          }));
          await (client.from("panels") as any).insert(panelInserts);
        }
      }

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="font-display text-xl">New Project</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Quick form. After approval, planning details (location, BOQ, schedule, materials)
              come from the Project Setup Template upload.
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-2 pb-20 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="projName">Project Name *</Label>
              <Input id="projName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Altree Villas Phase 2" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name *</Label>
              <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Prestige Group" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Division *</Label>
                <Select value={division} onValueChange={setDivision}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Habitainer">Habitainer</SelectItem>
                    <SelectItem value="ADS">ADS</SelectItem>
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
          </div>

          <div className="flex items-center justify-end gap-2 border-t bg-background px-4 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading} style={{ backgroundColor: "#006039", color: "white" }}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {requiresApproval ? "Send for Approval" : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
