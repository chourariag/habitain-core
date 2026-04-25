import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Lock, Search } from "lucide-react";
import { toast } from "sonner";

const WORK_TYPES = [
  "Painting","Tiling","Wooden Flooring","Fabrication","Electrical Works","False Ceiling",
  "Wall Panelling","Waterproofing","Civil — Foundation","Civil — Flooring","Plastering",
  "Cladding — External","Glazing and Aluminium","MEP — Plumbing","HVAC Installation",
  "Carpentry","Landscaping","Crane and Lifting","Transport","Other",
];
const PRICING_TYPES = ["Piece Rate","Daily Rate","Fixed Lump Sum","Per Running Foot","Per KG","Per Unit"];

const VIEW_ROLES = ["super_admin","managing_director","finance_director","sales_director","architecture_director","finance_manager","accounts_executive","production_head","site_installation_mgr","procurement","stores_executive","planning_engineer"];
const MANAGE_ROLES = ["super_admin","managing_director","finance_director","production_head","site_installation_mgr","procurement"];

type Sub = {
  id: string; sub_id: string; company_name: string | null; contact_person: string;
  phone: string; email: string | null; work_type: string; factory_or_site: string;
  pricing_type: string; typical_rate: number | null; rate_unit: string | null;
  status: string; notes: string | null;
};

export function SubcontractorsTab({ readOnly = false }: { readOnly?: boolean }) {
  const { role } = useUserRole();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterWork, setFilterWork] = useState<string>("all");
  const [filterLoc, setFilterLoc] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Sub | null>(null);

  const canView = VIEW_ROLES.includes(role ?? "");
  const canManage = !readOnly && MANAGE_ROLES.includes(role ?? "");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("subcontractors").select("*").order("sub_id");
    setSubs((data ?? []) as Sub[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (canView) fetchAll(); }, [fetchAll, canView]);

  const filtered = useMemo(() => subs.filter(s => {
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (filterWork !== "all" && s.work_type !== filterWork) return false;
    if (filterLoc !== "all" && s.factory_or_site !== filterLoc && s.factory_or_site !== "both") return false;
    if (search) {
      const q = search.toLowerCase();
      return (s.contact_person?.toLowerCase().includes(q) || s.company_name?.toLowerCase().includes(q) || s.phone?.includes(q) || s.work_type?.toLowerCase().includes(q));
    }
    return true;
  }), [subs, search, filterWork, filterLoc, filterStatus]);

  if (!canView) {
    return (
      <Card><CardContent className="p-12 text-center">
        <Lock className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <h3 className="font-semibold">Restricted</h3>
      </CardContent></Card>
    );
  }
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-3 relative pb-20">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name, phone, work type..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterWork} onValueChange={setFilterWork}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Work Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All work types</SelectItem>
            {WORK_TYPES.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterLoc} onValueChange={setFilterLoc}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            <SelectItem value="factory">Factory</SelectItem>
            <SelectItem value="site">Site</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sub ID</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Work Type</TableHead>
              <TableHead>Loc</TableHead>
              <TableHead>Pricing</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.sub_id}</TableCell>
                <TableCell>{s.company_name ?? <span className="text-muted-foreground italic">individual</span>}</TableCell>
                <TableCell>{s.contact_person}</TableCell>
                <TableCell>{s.phone}</TableCell>
                <TableCell>{s.work_type}</TableCell>
                <TableCell className="capitalize">{s.factory_or_site}</TableCell>
                <TableCell>{s.pricing_type}</TableCell>
                <TableCell>{s.typical_rate ? `₹${s.typical_rate} ${s.rate_unit ?? ""}` : (s.rate_unit ?? "—")}</TableCell>
                <TableCell>
                  <Badge style={{ background: s.status === "active" ? "#E8F2ED" : "#E0E0E0", color: s.status === "active" ? "#006039" : "#666" }} className="border-0">{s.status}</Badge>
                </TableCell>
                {canManage && (
                  <TableCell>
                    <Button size="sm" variant="outline" className="h-7" onClick={() => setEditing(s)}>Edit</Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={canManage ? 10 : 9} className="text-center text-sm text-muted-foreground py-8">No subcontractors found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {canManage && (
        <Button onClick={() => setAddOpen(true)} className="fixed bottom-6 right-6 rounded-full shadow-lg h-14 w-14 p-0 z-40" style={{ background: "#006039" }}>
          <Plus className="w-6 h-6" />
        </Button>
      )}

      <SubFormDialog open={addOpen} onOpenChange={setAddOpen} onSaved={fetchAll} />
      {editing && <SubFormDialog open onOpenChange={(o) => { if (!o) setEditing(null); }} initial={editing} onSaved={() => { setEditing(null); fetchAll(); }} />}
    </div>
  );
}

function SubFormDialog({ open, onOpenChange, onSaved, initial }: any) {
  const [form, setForm] = useState({
    company_name: initial?.company_name ?? "", contact_person: initial?.contact_person ?? "",
    phone: initial?.phone ?? "", email: initial?.email ?? "",
    work_type: initial?.work_type ?? "", factory_or_site: initial?.factory_or_site ?? "both",
    pricing_type: initial?.pricing_type ?? "Piece Rate",
    typical_rate: initial?.typical_rate ?? "", rate_unit: initial?.rate_unit ?? "",
    status: initial?.status ?? "active", notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.contact_person.trim() || !form.phone.trim() || !form.work_type) {
      toast.error("Contact, phone, and work type required"); return;
    }
    setSaving(true);
    try {
      const payload: any = {
        company_name: form.company_name.trim() || null,
        contact_person: form.contact_person.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        work_type: form.work_type,
        factory_or_site: form.factory_or_site,
        pricing_type: form.pricing_type,
        typical_rate: form.typical_rate ? Number(form.typical_rate) : null,
        rate_unit: form.rate_unit.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
      };
      const { error } = initial
        ? await supabase.from("subcontractors").update(payload).eq("id", initial.id)
        : await supabase.from("subcontractors").insert(payload);
      if (error) throw error;
      toast.success(initial ? "Updated" : "Subcontractor added");
      onOpenChange(false); onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? `Edit ${initial.sub_id}` : "New Subcontractor"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Company Name (leave blank for individuals)</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Contact Person *</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
            <div><Label>Phone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Work Type *</Label>
              <Select value={form.work_type} onValueChange={(v) => setForm({ ...form, work_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{WORK_TYPES.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Factory / Site *</Label>
              <Select value={form.factory_or_site} onValueChange={(v) => setForm({ ...form, factory_or_site: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="factory">Factory</SelectItem>
                  <SelectItem value="site">Site</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Pricing *</Label>
              <Select value={form.pricing_type} onValueChange={(v) => setForm({ ...form, pricing_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRICING_TYPES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Typical Rate ₹</Label><Input type="number" value={form.typical_rate} onChange={(e) => setForm({ ...form, typical_rate: e.target.value })} /></div>
            <div><Label>Rate Unit</Label><Input placeholder="per SFT" value={form.rate_unit} onChange={(e) => setForm({ ...form, rate_unit: e.target.value })} /></div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} style={{ background: "#006039" }}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
