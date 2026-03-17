import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Truck, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  moduleId: string;
  moduleCode: string | null;
  userRole: string | null;
  siteReady: boolean;
  onDispatched: () => void;
}

export function DispatchLogForm({ moduleId, moduleCode, userRole, siteReady, onDispatched }: Props) {
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canDispatch = ["delivery_rm_lead", "super_admin", "managing_director"].includes(userRole ?? "");

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

      // Insert dispatch log
      const { error: logErr } = await (client.from("dispatch_log" as any) as any).insert({
        module_id: moduleId,
        vehicle_number: vehicleNumber.trim(),
        driver_name: driverName.trim(),
        transporter_name: transporterName.trim(),
        dispatched_by: user.id,
      });
      if (logErr) throw logErr;

      // Update module status to dispatched
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

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2 text-card-foreground">
          <Truck className="h-4 w-4" />
          Log Dispatch
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        <div>
          <label className="text-xs font-medium text-card-foreground/70">Module ID</label>
          <Input value={moduleCode || "—"} disabled className="mt-1 text-sm bg-muted/30" />
        </div>
        <div>
          <label className="text-xs font-medium text-card-foreground/70">Vehicle Number</label>
          <Input
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value)}
            placeholder="e.g. KA01AB1234"
            className="mt-1 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-card-foreground/70">Driver Name</label>
          <Input
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="Driver full name"
            className="mt-1 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-card-foreground/70">Transporter Name</label>
          <Input
            value={transporterName}
            onChange={(e) => setTransporterName(e.target.value)}
            placeholder="Transport company"
            className="mt-1 text-sm"
          />
        </div>

        {siteReady ? (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Dispatch Module
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="w-full">
                <Button size="sm" disabled className="w-full opacity-50">
                  Dispatch Module
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Complete site readiness checklist first.</TooltipContent>
          </Tooltip>
        )}
      </CardContent>
    </Card>
  );
}
