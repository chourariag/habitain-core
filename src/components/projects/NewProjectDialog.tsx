import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, MapPin, Info } from "lucide-react";
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

const PROJECT_TYPES = ["Residential", "Commercial", "Hospitality"];
const CONSTRUCTION_TYPES = ["Modular", "Panel-based"];
const PRODUCTION_SYSTEMS: { value: "modular" | "panelised" | "hybrid"; label: string; hint: string }[] = [
  { value: "modular", label: "Modular", hint: "Complete module built in one bay" },
  { value: "panelised", label: "Panelised", hint: "LGSF panels to site, erected on site" },
  { value: "hybrid", label: "Hybrid", hint: "LGSF panels from Panel Bay installed into Module Bay" },
];

const ALLOWED_RAISERS = ["planning_head", "managing_director", "super_admin"];

export function NewProjectDialog({ open, onOpenChange, onCreated }: NewProjectDialogProps) {
  const { role } = useUserRole();
  const canRaise = !!role && ALLOWED_RAISERS.includes(role);
  const requiresApproval = !!role && !["managing_director", "super_admin"].includes(role);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [projectType, setProjectType] = useState("");
  const [constructionType, setConstructionType] = useState("");
  const [moduleCount, setModuleCount] = useState("");
  const [panelCount, setPanelCount] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [estCompletion, setEstCompletion] = useState<Date>();
  const [siteLat, setSiteLat] = useState("");
  const [siteLng, setSiteLng] = useState("");
  const [siteRadius, setSiteRadius] = useState("300");
  const [loadingGps, setLoadingGps] = useState(false);
  const [division, setDivision] = useState("Habitainer");
  const [isDesignOnly, setIsDesignOnly] = useState(false);
  const [productionSystem, setProductionSystem] = useState<"modular" | "panelised" | "hybrid">("modular");

  const resetForm = () => {
    setName(""); setClientName(""); setClientPhone(""); setClientEmail("");
    setCity(""); setState(""); setProjectType(""); setConstructionType("");
    setModuleCount(""); setPanelCount(""); setStartDate(undefined); setEstCompletion(undefined);
    setSiteLat(""); setSiteLng(""); setSiteRadius("300");
    setDivision("Habitainer"); setIsDesignOnly(false);
    setProductionSystem("modular");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Project name is required"); return; }
    if (!canRaise) {
      toast.error("Only the Planning Head can raise a project creation request.");
      return;
    }

    setLoading(true);
    try {
      const { client, session } = await getAuthedClient();
      const location = [city, state].filter(Boolean).join(", ") || null;

      // Non-MD users must raise an approval request instead of creating directly
      if (requiresApproval) {
        const reqRow: any = await raiseApprovalRequest("create_project", {
          name: name.trim(),
          client_name: clientName.trim() || null,
          client_phone: clientPhone.trim() || null,
          client_email: clientEmail.trim() || null,
          location,
          type: projectType || null,
          construction_type: isDesignOnly ? null : (constructionType || null),
          start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
          est_completion: estCompletion ? format(estCompletion, "yyyy-MM-dd") : null,
          site_lat: isDesignOnly ? null : (siteLat ? parseFloat(siteLat) : null),
          site_lng: isDesignOnly ? null : (siteLng ? parseFloat(siteLng) : null),
          site_radius: isDesignOnly ? null : (siteRadius ? parseInt(siteRadius) : 300),
          division,
          is_design_only: isDesignOnly,
          production_system: isDesignOnly ? "modular" : productionSystem,
          module_count: parseInt(moduleCount) || 0,
          panel_count: parseInt(panelCount) || 0,
        });

        // Notify the appropriate approver based on division
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
            const body = division === "ADS"
              ? `${clientName || "Client TBD"} | Design-Only\nRaised by ${session.user.email || "Planning Head"}. Tap to review and approve.`
              : `${clientName || "Client TBD"} | ${(productionSystem || "").toUpperCase()} | ${parseInt(moduleCount) || 0} modules / ${parseInt(panelCount) || 0} panels\nRaised by ${session.user.email || "Planning Head"}. Tap to review and approve.`;
            const { insertNotifications } = await import("@/lib/notifications");
            await insertNotifications(recipients.map((rid) => ({
              recipient_id: rid,
              title,
              body,
              category: "approval_request",
              related_table: "approval_requests",
              related_id: (reqRow as any)?.id,
              navigate_to: "/users",
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

      const { data: project, error } = await client.from("projects").insert({
        name: name.trim(),
        client_name: clientName.trim() || null,
        client_phone: clientPhone.trim() || null,
        client_email: clientEmail.trim() || null,
        location,
        type: projectType || null,
        construction_type: isDesignOnly ? null : (constructionType || null),
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        est_completion: estCompletion ? format(estCompletion, "yyyy-MM-dd") : null,
        created_by: session.user.id,
        updated_by: session.user.id,
        site_lat: isDesignOnly ? null : (siteLat ? parseFloat(siteLat) : null),
        site_lng: isDesignOnly ? null : (siteLng ? parseFloat(siteLng) : null),
        site_radius: isDesignOnly ? null : (siteRadius ? parseInt(siteRadius) : 300),
        division,
        is_design_only: isDesignOnly,
        production_system: isDesignOnly ? "modular" : productionSystem,
      } as any).select("id").single();

      if (error) throw error;
      const projectId = (project as any).id;

      // Auto-create modules or panels (only for non-design-only projects)
      const mCount = parseInt(moduleCount) || 0;
      const pCount = parseInt(panelCount) || 0;
      if (!isDesignOnly && projectId) {
        // Create modules
        if (mCount > 0) {
          const moduleInserts = Array.from({ length: mCount }, (_, i) => ({
            project_id: projectId,
            name: `Module ${i + 1}`,
            module_type: "standard",
            current_stage: "Sub-Frame",
            production_status: "not_started",
            created_by: session.user.id,
          }));
          const { error: mErr } = await client.from("modules").insert(moduleInserts as any);
          if (mErr) console.error("Failed to create modules:", mErr);

          const { data: createdModules } = await client.from("modules")
            .select("id").eq("project_id", projectId);
          if (createdModules) {
            const stageInserts = (createdModules as any[]).flatMap((m: any) =>
              PRODUCTION_STAGES.map((stage, idx) => ({
                module_id: m.id,
                stage_name: stage,
                stage_order: idx + 1,
                status: "pending",
              }))
            );
            await client.from("production_stages").insert(stageInserts as any);
          }
        }
        // Create panels
        if (pCount > 0) {
          const { data: parentModule } = await client.from("modules").insert({
            project_id: projectId,
            name: "Panel Production",
            module_type: "standard",
            current_stage: "Sub-Frame",
            production_status: "not_started",
            created_by: session.user.id,
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
      }

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
        <form onSubmit={handleSubmit} className="flex max-h-[85vh] sm:max-h-[80vh] flex-col">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="font-display text-xl">New Project</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-2 pb-20 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="projName">Project Name *</Label>
              <Input id="projName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Altree Villas Phase 2" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Prestige Group" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="clientPhone">Client Phone</Label>
                <Input id="clientPhone" type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+91XXXXXXXXXX" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientEmail">Client Email</Label>
                <Input id="clientEmail" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@email.com" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bengaluru" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" value={state} onChange={(e) => setState(e.target.value)} placeholder="Karnataka" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Project Type</Label>
                <Select value={projectType} onValueChange={setProjectType}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              {!isDesignOnly && (
                <div className="space-y-2">
                  <Label>Construction Type</Label>
                  <Select value={constructionType} onValueChange={setConstructionType}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {CONSTRUCTION_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {!isDesignOnly && (
              <div className="space-y-2">
                <Label>Production System *</Label>
                <Select value={productionSystem} onValueChange={(v) => setProductionSystem(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCTION_SYSTEMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{p.label}</span>
                          <span className="text-[10px] text-muted-foreground">{p.hint}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Determines the factory workflow. Hybrid creates a Panel Bay → Module Bay dependency.
                </p>
              </div>
            )}

            {/* Division */}
            <div className="space-y-2">
              <Label>Division</Label>
              <Select value={division} onValueChange={setDivision}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Habitainer">Habitainer</SelectItem>
                  <SelectItem value="ADS">ADS (Architectural Design Services)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Design Only Toggle */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="designOnly">Design Only Project</Label>
                <Switch id="designOnly" checked={isDesignOnly} onCheckedChange={setIsDesignOnly} />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Turn on if this project has no production component — it will only appear in the Design Portal, not in Factory Floor or Site Hub.
              </p>
            </div>

            {isDesignOnly ? (
              <div className="rounded-md p-3 text-sm flex items-start gap-2" style={{ backgroundColor: "hsl(210 100% 96%)", color: "hsl(210 80% 40%)" }}>
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>This project will appear in the Design Portal only. Production and Site Hub teams will not see it.</span>
              </div>
            ) : (
              <>
                {(productionSystem === "modular" || productionSystem === "hybrid") && (
                  <div className="space-y-2">
                    <Label htmlFor="moduleCount">Number of Modules</Label>
                    <Input
                      id="moduleCount"
                      type="number"
                      min="1"
                      value={moduleCount}
                      onChange={(e) => setModuleCount(e.target.value)}
                      placeholder="e.g. 12"
                    />
                  </div>
                )}
                {(productionSystem === "panelised" || productionSystem === "hybrid") && (
                  <div className="space-y-2">
                    <Label htmlFor="panelCount">Number of Panels</Label>
                    <Input
                      id="panelCount"
                      type="number"
                      min="1"
                      value={panelCount}
                      onChange={(e) => setPanelCount(e.target.value)}
                      placeholder="e.g. 36"
                    />
                  </div>
                )}

                {/* Site Location */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Site Location (for attendance GPS)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="font-inter text-[11px] text-muted-foreground">Latitude</Label>
                      <Input type="number" step="0.000001" value={siteLat} onChange={(e) => setSiteLat(e.target.value)} placeholder="13.3622" className="font-inter text-[15px]" />
                    </div>
                    <div className="space-y-1">
                      <Label className="font-inter text-[11px] text-muted-foreground">Longitude</Label>
                      <Input type="number" step="0.000001" value={siteLng} onChange={(e) => setSiteLng(e.target.value)} placeholder="77.5401" className="font-inter text-[15px]" />
                    </div>
                    <div className="space-y-1">
                      <Label className="font-inter text-[11px] text-muted-foreground">Radius (m)</Label>
                      <Input type="number" min="50" value={siteRadius} onChange={(e) => setSiteRadius(e.target.value)} placeholder="300" className="font-inter text-[15px]" />
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={async () => {
                    setLoadingGps(true);
                    try {
                      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 }));
                      setSiteLat(pos.coords.latitude.toFixed(6));
                      setSiteLng(pos.coords.longitude.toFixed(6));
                      toast.success("Location captured");
                    } catch { toast.error("Could not get GPS"); }
                    setLoadingGps(false);
                  }} disabled={loadingGps}>
                    {loadingGps ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                    Use My Current Location
                  </Button>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Est. Completion</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !estCompletion && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {estCompletion ? format(estCompletion, "PPP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={estCompletion} onSelect={setEstCompletion} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 border-t bg-background px-4 py-3 flex justify-end gap-2" style={{ borderColor: "#E5E7EB" }}>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {loading ? (requiresApproval ? "Sending…" : "Creating…") : (requiresApproval ? "Send for MD Approval" : "Create Project")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
