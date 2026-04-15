import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Shield, Wrench, Calendar, Clock, Send, Camera, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

interface AMCContract {
  id: string;
  tier: string;
  start_date: string;
  end_date: string;
  annual_fee: number;
  status: string;
}

interface Props {
  projectId: string;
  projectName: string;
  clientName: string;
  handover: any;
  amcContract: AMCContract | null;
}

const WARRANTY_ITEMS = [
  { component: "Structural Frame", period: "10 years" },
  { component: "Electrical Wiring", period: "5 years" },
  { component: "Plumbing", period: "5 years" },
  { component: "Waterproofing", period: "5 years" },
  { component: "Doors & Windows", period: "3 years" },
  { component: "Interior Finishes", period: "1 year" },
  { component: "External Cladding", period: "5 years" },
  { component: "MEP Equipment", period: "2 years (manufacturer warranty)" },
];

export function ClientPostHandover({ projectId, projectName, clientName, handover, amcContract }: Props) {
  const [showRMForm, setShowRMForm] = useState(false);
  const [rmDesc, setRmDesc] = useState("");
  const [rmSubmitting, setRmSubmitting] = useState(false);

  const fmtDate = (d: string | null) => d ? format(new Date(d), "dd/MM/yyyy") : "—";
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const handleSubmitRM = async () => {
    if (rmDesc.trim().length < 10) {
      toast.error("Please describe the issue in more detail");
      return;
    }
    setRmSubmitting(true);

    const { error } = await (supabase.from("rm_tickets" as any) as any).insert({
      project_id: projectId,
      client_name: clientName,
      issue_description: rmDesc.trim(),
      priority: "normal",
      status: "open",
    });

    if (error) {
      toast.error("Failed to submit. Please try again.");
    } else {
      toast.success("Your issue has been reported. Our team will contact you shortly.");
      setRmDesc("");
      setShowRMForm(false);
    }
    setRmSubmitting(false);
  };

  return (
    <div className="space-y-4">
      {/* AMC Details */}
      {amcContract && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Annual Maintenance Contract
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-[11px] font-body text-muted-foreground">Tier</p>
                <p className="text-sm font-heading font-bold text-foreground capitalize">{amcContract.tier}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[11px] font-body text-muted-foreground">Status</p>
                <Badge className={amcContract.status === "active" ? "bg-primary text-primary-foreground" : ""}>
                  {amcContract.status === "active" ? "Active" : amcContract.status}
                </Badge>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[11px] font-body text-muted-foreground">Start Date</p>
                <p className="text-sm font-heading font-semibold text-foreground">{fmtDate(amcContract.start_date)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[11px] font-body text-muted-foreground">End Date</p>
                <p className="text-sm font-heading font-semibold text-foreground">{fmtDate(amcContract.end_date)}</p>
              </div>
              <div className="rounded-lg border p-3 col-span-2">
                <p className="text-[11px] font-body text-muted-foreground">Annual Fee</p>
                <p className="text-lg font-heading font-bold text-foreground">{fmt(amcContract.annual_fee)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report an Issue */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
            <Wrench className="h-4 w-4" /> Repair & Maintenance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showRMForm ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-body text-muted-foreground block mb-1">
                  Describe the issue
                </label>
                <Textarea
                  placeholder="E.g., Water leak near the kitchen window on the ground floor..."
                  value={rmDesc}
                  onChange={(e) => setRmDesc(e.target.value)}
                  className="text-sm"
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSubmitRM} disabled={rmSubmitting || rmDesc.trim().length < 10}>
                  <Send className="h-3 w-3 mr-1" /> Submit Issue
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowRMForm(false); setRmDesc(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-3">
              <p className="text-sm font-body text-muted-foreground mb-3">
                Need something fixed? Report an issue and our team will get back to you.
              </p>
              <Button onClick={() => setShowRMForm(true)}>
                <AlertCircle className="h-4 w-4 mr-1" /> Report an Issue
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warranty Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Warranty Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs font-body text-muted-foreground mb-3">
            Standard warranty periods from handover date ({fmtDate(handover?.handover_date || handover?.client_signed_at)})
          </p>
          <div className="space-y-2">
            {WARRANTY_ITEMS.map((item) => (
              <div key={item.component} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <span className="text-sm font-body text-foreground">{item.component}</span>
                <Badge variant="outline" className="text-xs">{item.period}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
