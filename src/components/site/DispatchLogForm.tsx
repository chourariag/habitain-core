import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Truck, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  moduleId: string;
  moduleCode: string | null;
  userRole: string | null;
  siteReady: boolean;
  onDispatched: () => void;
}

interface DispatchConditions {
  qcPassed: boolean;
  finalInspection: boolean;
  siteReadiness: boolean;
  productionHeadSignoff: boolean;
}

export function DispatchLogForm({ moduleId, moduleCode, userRole, siteReady, onDispatched }: Props) {
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [conditions, setConditions] = useState<DispatchConditions>({
    qcPassed: false,
    finalInspection: false,
    siteReadiness: siteReady,
    productionHeadSignoff: false,
  });
  const [loadingConditions, setLoadingConditions] = useState(true);

  const canDispatch = ["delivery_rm_lead", "super_admin", "managing_director"].includes(userRole ?? "");

  useEffect(() => {
    const checkConditions = async () => {
      setLoadingConditions(true);

      // 1. Check open NCRs
      const { data: inspections } = await supabase
        .from("qc_inspections").select("id").eq("module_id", moduleId);
      const inspectionIds = inspections?.map((i) => i.id) ?? [];
      let qcPassed = true;
      if (inspectionIds.length > 0) {
        const { count } = await supabase
          .from("ncr_register")
          .select("id", { count: "exact", head: true })
          .eq("is_archived", false)
          .in("status", ["open", "critical_open"])
          .in("inspection_id", inspectionIds);
        qcPassed = (count ?? 0) === 0;
      }

      // 2. Final QC inspection with PASS STAGE
      let finalInspection = false;
      if (inspectionIds.length > 0) {
        const { data: passInspections } = await supabase
          .from("qc_inspections")
          .select("id")
          .eq("module_id", moduleId)
          .eq("dispatch_decision", "PASS STAGE")
          .limit(1);
        finalInspection = (passInspections?.length ?? 0) > 0;
      }

      // 3. Site readiness
      const { data: readiness } = await (supabase.from("site_readiness") as any)
        .select("is_complete").eq("module_id", moduleId).eq("is_complete", true).limit(1);
      const siteReadiness = (readiness?.length ?? 0) > 0;

      // 4. Production Head sign-off
      const { data: signoffs } = await supabase
        .from("dispatch_signoffs")
        .select("id").eq("module_id", moduleId).limit(1);
      const productionHeadSignoff = (signoffs?.length ?? 0) > 0;

      setConditions({ qcPassed, finalInspection, siteReadiness, productionHeadSignoff });
      setLoadingConditions(false);
    };
    checkConditions();
  }, [moduleId, siteReady]);

  const allConditionsMet = conditions.qcPassed && conditions.finalInspection && conditions.siteReadiness && conditions.productionHeadSignoff;

  const pendingConditions = [
    !conditions.qcPassed && "Open Critical/Major NCRs must be closed",
    !conditions.finalInspection && "Final QC inspection must pass",
    !conditions.siteReadiness && "Site Readiness Checklist must be completed",
    !conditions.productionHeadSignoff && "Production Head sign-off required",
  ].filter(Boolean);

  if (!canDispatch) return null;

  const handleSubmit = async () => {
    if (!vehicleNumber.trim() || !driverName.trim() || !transporterName.trim()) {
      toast.error("All fields are required.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();

      const { error: logErr } = await (client.from("dispatch_log") as any).insert({
        module_id: moduleId,
        vehicle_number: vehicleNumber.trim(),
        driver_name: driverName.trim(),
        transporter_name: transporterName.trim(),
        dispatched_by: user.id,
      });
      if (logErr) throw logErr;

      const { error: modErr } = await client.from("modules").update({
        production_status: "dispatched",
        current_stage: "Dispatch",
      } as any).eq("id", moduleId);
      if (modErr) throw modErr;

      toast.success("Module dispatched successfully!");
      onDispatched();
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch");
    } finally {
      setSubmitting(false);
    }
  };

  const ConditionCheck = ({ met, label }: { met: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-xs">
      {met ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
      <span className={met ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2 text-card-foreground">
          <Truck className="h-4 w-4" /> Dispatch Gate
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        {/* 4-condition checklist */}
        <div className="bg-background rounded-md border border-border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">Dispatch Conditions</p>
          {loadingConditions ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              <ConditionCheck met={conditions.qcPassed} label="QC Passed — No open Critical/Major NCRs" />
              <ConditionCheck met={conditions.finalInspection} label="Final QC Inspection — PASS STAGE" />
              <ConditionCheck met={conditions.siteReadiness} label="Site Readiness Checklist — Complete" />
              <ConditionCheck met={conditions.productionHeadSignoff} label="Production Head Sign-off" />
            </>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Vehicle Number</label>
          <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="e.g. KA01AB1234" className="mt-1 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Driver Name</label>
          <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Driver full name" className="mt-1 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Transporter Name</label>
          <Input value={transporterName} onChange={(e) => setTransporterName(e.target.value)} placeholder="Transport company" className="mt-1 text-sm" />
        </div>

        {allConditionsMet ? (
          <Button size="sm" onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Dispatch Module
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="w-full">
                <Button size="sm" disabled className="w-full opacity-50">Dispatch Module</Button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-medium mb-1">Pending conditions:</p>
              <ul className="text-xs space-y-0.5">
                {pendingConditions.map((c, i) => <li key={i}>• {c}</li>)}
              </ul>
            </TooltipContent>
          </Tooltip>
        )}
      </CardContent>
    </Card>
  );
}
