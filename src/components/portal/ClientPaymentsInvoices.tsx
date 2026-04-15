import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IndianRupee, Download, ChevronDown, Check, Clock, FileText } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

interface BillingMilestone {
  id: string;
  milestone_number: number;
  description: string;
  percentage: number;
  amount_excl_gst: number;
  gst_amount: number;
  amount_incl_gst: number;
  status: string;
  invoice_url?: string | null;
  invoice_number?: string | null;
  billed_date?: string | null;
  received_date?: string | null;
}

interface Props {
  milestones: BillingMilestone[];
  projectName: string;
}

export function ClientPaymentsInvoices({ milestones, projectName }: Props) {
  const [gstOpen, setGstOpen] = useState(false);

  if (milestones.length === 0) return null;

  const totalContract = milestones.reduce((s, m) => s + Number(m.amount_incl_gst || 0), 0);
  const totalPaid = milestones.filter(m => m.status === "received").reduce((s, m) => s + Number(m.amount_incl_gst || 0), 0);
  const balance = totalContract - totalPaid;
  const nextDue = milestones.find(m => m.status !== "received");

  const totalExclGst = milestones.reduce((s, m) => s + Number(m.amount_excl_gst || 0), 0);
  const totalGst = milestones.reduce((s, m) => s + Number(m.gst_amount || 0), 0);

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  const fmtDate = (d: string | null | undefined) => d ? format(new Date(d), "dd/MM/yyyy") : "—";

  const statusPill = (status: string) => {
    if (status === "received") return <Badge className="bg-primary text-primary-foreground text-[10px]">Paid</Badge>;
    if (status === "billed") return <Badge className="bg-warning/20 text-warning text-[10px]">Invoice Raised</Badge>;
    return <Badge variant="muted" className="text-[10px]">Upcoming</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
          <IndianRupee className="h-4 w-4" /> Payments & Invoices
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Payment Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-[11px] font-body text-muted-foreground">Total Contract (incl. GST)</p>
            <p className="text-lg font-heading font-bold text-foreground">{fmt(totalContract)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[11px] font-body text-muted-foreground">Paid to Date</p>
            <p className="text-lg font-heading font-bold text-primary">{fmt(totalPaid)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[11px] font-body text-muted-foreground">Balance Remaining</p>
            <p className="text-lg font-heading font-bold text-foreground">{fmt(balance)}</p>
          </div>
          {nextDue && (
            <div className="rounded-lg border p-3 border-warning/30">
              <p className="text-[11px] font-body text-muted-foreground">Next Payment Due</p>
              <p className="text-sm font-heading font-bold text-foreground">
                M{nextDue.milestone_number} — {fmt(Number(nextDue.amount_incl_gst))}
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Payment Schedule Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">#</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs text-right">Amount (incl. GST)</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Invoice</TableHead>
                <TableHead className="text-xs">Date Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {milestones.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm font-heading font-semibold">{m.milestone_number}</TableCell>
                  <TableCell className="text-sm font-body">{m.description}</TableCell>
                  <TableCell className="text-sm font-heading font-semibold text-right">
                    {fmt(Number(m.amount_incl_gst))}
                  </TableCell>
                  <TableCell>{statusPill(m.status)}</TableCell>
                  <TableCell>
                    {m.invoice_url ? (
                      <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                        <a href={m.invoice_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3 w-3 mr-1" /> Invoice
                        </a>
                      </Button>
                    ) : m.invoice_number ? (
                      <span className="text-xs font-body text-muted-foreground">{m.invoice_number}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-body text-muted-foreground">
                    {fmtDate(m.received_date)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* GST Summary - Collapsible */}
        <Collapsible open={gstOpen} onOpenChange={setGstOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-sm font-heading">
              GST Summary
              <ChevronDown className={`h-4 w-4 transition-transform ${gstOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-lg border p-4 mt-2 space-y-2">
              <div className="flex items-center justify-between text-sm font-body">
                <span className="text-muted-foreground">Total invoiced (excl. GST)</span>
                <span className="font-heading font-semibold text-foreground">{fmt(totalExclGst)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-body">
                <span className="text-muted-foreground">Total GST (18%)</span>
                <span className="font-heading font-semibold text-foreground">{fmt(totalGst)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm font-body">
                <span className="font-heading font-bold text-foreground">Total invoiced (incl. GST)</span>
                <span className="font-heading font-bold text-foreground">{fmt(totalContract)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                This summary is provided for your GST input credit reference.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
