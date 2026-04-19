import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Search, BookOpen, CheckCircle2, FileEdit } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";

const DEPARTMENTS = ["All", "Production", "Site", "Procurement", "QC", "HR", "Finance", "Design", "Sales"];

const SOP_SECTIONS = [
  "Purpose",
  "Scope",
  "Responsibilities",
  "Required Materials / Tools",
  "Procedure",
  "Quality Checks",
  "Safety Notes",
  "References / Related SOPs",
];

// Pre-seeded SOPs shown when DB is empty
const SEED_SOPS = [
  { title: "Module Bay Assignment", department: "Production", status: "approved", description: "How to assign and reassign modules to production bays" },
  { title: "Concrete Pouring Protocol", department: "Production", status: "approved", description: "Step-by-step procedure for module concrete deck pouring" },
  { title: "QC Pre-Dispatch Inspection", department: "QC", status: "approved", description: "Inspection checklist before module dispatch clearance" },
  { title: "NCR Raise & Resolution", department: "QC", status: "approved", description: "Non-conformance report lifecycle from open to close" },
  { title: "GRN Recording Procedure", department: "Procurement", status: "approved", description: "Goods received note entry and destination assignment" },
  { title: "Material Request Approval", department: "Procurement", status: "approved", description: "Approval chain for material requests by value threshold" },
  { title: "Site Diary Entry", department: "Site", status: "approved", description: "Daily site diary log requirements and sign-off" },
  { title: "Punch List Management", department: "Site", status: "approved", description: "Punch list creation, progress tracking and handover clearance" },
  { title: "Subcontractor Onboarding", department: "HR", status: "approved", description: "Steps to onboard a new subcontractor on site" },
  { title: "Attendance & Check-In", department: "HR", status: "approved", description: "Daily attendance recording via GPS check-in" },
  { title: "Invoice Raise & Dispatch", department: "Finance", status: "approved", description: "How to raise a client invoice and track payment" },
  { title: "GSTR Filing Calendar", department: "Finance", status: "approved", description: "Monthly GST filing schedule and responsibility matrix" },
  { title: "GFC Issuance Process", department: "Design", status: "approved", description: "Good For Construction drawing approval and issue workflow" },
  { title: "Drawing Revision Control", department: "Design", status: "approved", description: "Revision naming, clouding and supersession protocol" },
  { title: "Lead Qualification", department: "Sales", status: "approved", description: "Criteria and scoring for qualifying an incoming lead" },
  { title: "Proposal Preparation", department: "Sales", status: "approved", description: "Standard proposal format, pricing, and submission steps" },
  { title: "Variation Pricing", department: "Finance", status: "approved", description: "Formula and approval tiers for pricing client variations" },
  { title: "Rework Authorisation", department: "Production", status: "approved", description: "How to authorise and track a production rework" },
  { title: "Manpower Planning", department: "Production", status: "draft", description: "Weekly manpower plan submission and approval" },
  { title: "AMC Renewal Process", department: "Sales", status: "draft", description: "Procedure for AMC renewal follow-up and contract execution" },
];

export default function SOPLibrary() {
  const { role: userRole } = useUserRole();
  const [sops, setSops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    department: "Production",
    description: "",
    sections: Object.fromEntries(SOP_SECTIONS.map((s) => [s, ""])),
  });

  const canManage = ["super_admin", "managing_director", "head_operations"].includes(userRole ?? "");
  const canSeeDrafts = canManage || ["production_head", "site_installation_mgr", "qc_inspector"].includes(userRole ?? "");

  const fetch = useCallback(async () => {
    const { data } = await (supabase.from("sop_library" as any) as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (data && data.length > 0) {
      setSops(data);
    } else {
      // Show seed SOPs as static display
      setSops(SEED_SOPS.map((s, i) => ({ ...s, id: `seed-${i}`, created_at: new Date().toISOString(), content: null })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleCreate = async () => {
    if (!form.title) { toast.error("Title required"); return; }
    setSaving(true);
    const { error } = await (supabase.from("sop_library" as any) as any).insert({
      title: form.title,
      department: form.department,
      description: form.description,
      content: form.sections,
      status: "draft",
    });
    if (error) { toast.error(error.message); } else {
      toast.success("SOP draft created");
      setAddOpen(false);
      setForm({ title: "", department: "Production", description: "", sections: Object.fromEntries(SOP_SECTIONS.map((s) => [s, ""])) });
      fetch();
    }
    setSaving(false);
  };

  const handleApprove = async (id: string) => {
    if (id.startsWith("seed-")) { toast.info("This is a seeded SOP — save to database first"); return; }
    const { error } = await (supabase.from("sop_library" as any) as any).update({ status: "approved" }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("SOP approved"); fetch(); }
  };

  const filtered = sops.filter((s) => {
    if (!canSeeDrafts && s.status === "draft") return false;
    const matchDept = dept === "All" || s.department === dept;
    const matchSearch = !search || s.title.toLowerCase().includes(search.toLowerCase()) || (s.description ?? "").toLowerCase().includes(search.toLowerCase());
    return matchDept && matchSearch;
  });

  const approvedCount = sops.filter((s) => s.status === "approved").length;
  const draftCount = sops.filter((s) => s.status === "draft").length;

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl font-bold" style={{ color: "#1A1A1A" }}>SOP Library</h1>
        {canManage && (
          <Button onClick={() => setAddOpen(true)} style={{ backgroundColor: "#006039" }} className="text-white">
            <Plus className="h-4 w-4 mr-1" />New SOP
          </Button>
        )}
      </div>
      <p className="text-sm mb-4" style={{ color: "#666666" }}>Standard operating procedures across all departments</p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border border-border p-3 text-center" style={{ backgroundColor: "#E8F2ED" }}>
          <p className="text-2xl font-bold font-display" style={{ color: "#006039" }}>{approvedCount}</p>
          <p className="text-xs" style={{ color: "#666" }}>Approved SOPs</p>
        </div>
        <div className="rounded-xl border border-border p-3 text-center" style={{ backgroundColor: "#FFF8E8" }}>
          <p className="text-2xl font-bold font-display" style={{ color: "#D4860A" }}>{draftCount}</p>
          <p className="text-xs" style={{ color: "#666" }}>In Draft</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "#999" }} />
          <Input
            placeholder="Search SOPs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* SOP list */}
      {filtered.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "#999" }}>No SOPs found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <Card key={s.id} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setViewItem(s)}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <BookOpen className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#006039" }} />
                      <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>{s.title}</p>
                      <Badge variant="outline" className="text-[9px] h-4" style={{
                        color: s.status === "approved" ? "#006039" : "#D4860A",
                        borderColor: s.status === "approved" ? "#006039" : "#D4860A",
                        backgroundColor: s.status === "approved" ? "#E8F2ED" : "#FFF8E8",
                      }}>
                        {s.status === "approved" ? "Approved" : "Draft"}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] h-4" style={{ color: "#666", borderColor: "#ddd" }}>
                        {s.department}
                      </Badge>
                    </div>
                    {s.description && (
                      <p className="text-xs mt-1 truncate" style={{ color: "#666" }}>{s.description}</p>
                    )}
                  </div>
                  {canManage && s.status === "draft" && !s.id?.startsWith("seed-") && (
                    <Button
                      size="sm"
                      className="h-6 text-[9px] px-2 text-white flex-shrink-0"
                      style={{ backgroundColor: "#006039" }}
                      onClick={(e) => { e.stopPropagation(); handleApprove(s.id); }}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />Approve
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewItem} onOpenChange={(o) => { if (!o) setViewItem(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewItem && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{viewItem.title}</DialogTitle>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="text-[9px] h-4" style={{
                    color: viewItem.status === "approved" ? "#006039" : "#D4860A",
                    borderColor: viewItem.status === "approved" ? "#006039" : "#D4860A",
                    backgroundColor: viewItem.status === "approved" ? "#E8F2ED" : "#FFF8E8",
                  }}>
                    {viewItem.status === "approved" ? "Approved" : "Draft"}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] h-4">{viewItem.department}</Badge>
                </div>
              </DialogHeader>
              {viewItem.description && (
                <p className="text-sm" style={{ color: "#666" }}>{viewItem.description}</p>
              )}
              {viewItem.content && typeof viewItem.content === "object" ? (
                <div className="space-y-4 mt-2">
                  {SOP_SECTIONS.map((section) => {
                    const text = viewItem.content[section];
                    if (!text) return null;
                    return (
                      <div key={section}>
                        <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#006039" }}>{section}</p>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: "#444" }}>{text}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3 mt-2">
                  {SOP_SECTIONS.map((section) => (
                    <div key={section} className="rounded-lg p-3" style={{ backgroundColor: "#F7F7F7" }}>
                      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#006039" }}>{section}</p>
                      <p className="text-xs" style={{ color: "#999" }}>Content not yet added for this section.</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">New SOP</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Title *</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Department</Label>
                <Select value={form.department} onValueChange={(v) => setForm((f) => ({ ...f, department: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.filter((d) => d !== "All").map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-1" placeholder="One-line summary of this SOP" />
            </div>
            {SOP_SECTIONS.map((section) => (
              <div key={section}>
                <Label className="text-xs">{section}</Label>
                <Textarea
                  value={form.sections[section]}
                  onChange={(e) => setForm((f) => ({ ...f, sections: { ...f.sections, [section]: e.target.value } }))}
                  className="mt-1"
                  rows={3}
                  placeholder={`Describe the ${section.toLowerCase()}...`}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={saving} style={{ backgroundColor: "#006039" }} className="text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save as Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
