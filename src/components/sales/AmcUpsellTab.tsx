import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Deal {
  id: string;
  client_name: string;
  project_type: string;
  contract_value: number;
  amc_interest: string;
}

export function AmcUpsellTab({ deals }: { deals: Deal[] }) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [followup, setFollowup] = useState<Date | null>(null);

  const wonDeals = useMemo(() => deals.filter(d => d.amc_interest !== "active_contract"), [deals]);

  useEffect(() => {
    supabase.from("sales_amc_contacts").select("*").then(({ data }) => setContacts(data || []));
  }, []);

  const lastContact = (dealId: string) => {
    const c = contacts.filter(c => c.deal_id === dealId).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return c[0]?.created_at ? format(new Date(c[0].created_at), "dd/MM/yyyy") : "—";
  };

  const contactedThisMonth = useMemo(() => {
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    return new Set(contacts.filter(c => new Date(c.created_at) >= start).map(c => c.deal_id)).size;
  }, [contacts]);

  const potentialRevenue = wonDeals.reduce((s, d) => s + (d.contract_value || 0) * 0.02, 0);

  const fmt = (v: number) => {
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    return `₹${v.toLocaleString()}`;
  };

  const handleSaveContact = async () => {
    if (!selectedDealId || !note) { toast.error("Notes required"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("sales_amc_contacts").insert({
      deal_id: selectedDealId,
      contacted_by: user?.id,
      notes: note,
      followup_date: followup ? format(followup, "yyyy-MM-dd") : null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Contact logged");
      const { data } = await supabase.from("sales_amc_contacts").select("*");
      setContacts(data || []);
      setDrawerOpen(false);
      setNote("");
      setFollowup(null);
    }
  };

  const amcBadge = (v: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      yes: { bg: "#006039", text: "#fff", label: "Yes" },
      no: { bg: "#666", text: "#fff", label: "No" },
      not_discussed: { bg: "#D4860A", text: "#fff", label: "Not Discussed" },
    };
    const s = map[v] || map.not_discussed;
    return <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: s.bg, color: s.text }}>{s.label}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-3" style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#666" }}>AMC Opportunities</span>
          <div className="text-lg font-bold" style={{ color: "#006039" }}>{wonDeals.length}</div>
        </Card>
        <Card className="p-3" style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#666" }}>Potential Revenue</span>
          <div className="text-lg font-bold" style={{ color: "#006039" }}>{fmt(potentialRevenue)}</div>
        </Card>
        <Card className="p-3" style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#666" }}>Contacted This Month</span>
          <div className="text-lg font-bold" style={{ color: "#006039" }}>{contactedThisMonth}</div>
        </Card>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Project Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>AMC Interest</TableHead>
              <TableHead>Last Contacted</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {wonDeals.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.client_name}</TableCell>
                <TableCell>{d.project_type}</TableCell>
                <TableCell>{fmt(d.contract_value)}</TableCell>
                <TableCell>{amcBadge(d.amc_interest)}</TableCell>
                <TableCell>{lastContact(d.id)}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedDealId(d.id); setDrawerOpen(true); }}
                    style={{ borderColor: "#006039", color: "#006039" }}>
                    Log Contact
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {wonDeals.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8" style={{ color: "#999" }}>No AMC opportunities</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={drawerOpen} onOpenChange={o => !o && setDrawerOpen(false)}>
        <SheetContent style={{ background: "#fff" }}>
          <SheetHeader><SheetTitle>Log Contact</SheetTitle></SheetHeader>
          <div className="space-y-3 mt-4">
            <div><Label>Notes *</Label><Textarea value={note} onChange={e => setNote(e.target.value)} rows={4} /></div>
            <div><Label>Follow-Up Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !followup && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {followup ? format(followup, "dd/MM/yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={followup || undefined} onSelect={d => setFollowup(d || null)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={handleSaveContact} className="w-full" style={{ background: "#006039", color: "#fff" }}>Save</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
