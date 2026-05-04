import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, UserMinus, Check, X, Eye, ShieldCheck, Search } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/components/AuthProvider";
import { ROLE_LABELS, ROLE_TIERS, type AppRole } from "@/lib/roles";
import {
  raiseApprovalRequest, listApprovalRequests, setApprovalDecision, type ApprovalRequest,
} from "@/lib/approval-requests";
import { createUserWithPassword, reassignAndDeactivate } from "@/lib/admin-api";
import { logAudit } from "@/lib/super-admin";

const RAISER_ROLES = [
  "managing_director","super_admin","finance_director","sales_director",
  "architecture_director","head_operations","hr_executive","planning_head",
];
const MD_ROLES = ["managing_director","super_admin"];
const PROJECT_APPROVER_ROLES = ["managing_director","super_admin","sales_director","principal_architect"];
const TEMP_PASSWORD = "HStack@2026";

type Profile = {
  id: string; auth_user_id: string;
  display_name: string | null; email: string | null;
  role: AppRole; is_active: boolean | null;
  created_at: string;
};

export default function UserManagement() {
  const { role } = useUserRole();
  const { user } = useAuth();
  const isRaiser = !!role && RAISER_ROLES.includes(role);
  const isApprover = !!role && MD_ROLES.includes(role);
  const isProjectApprover = !!role && PROJECT_APPROVER_ROLES.includes(role);

  const [tab, setTab] = useState("users");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all"|"active"|"inactive"|"pending">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [deactOpen, setDeactOpen] = useState<Profile | null>(null);
  const [reviewing, setReviewing] = useState<ApprovalRequest | null>(null);
  const [tempPwShown, setTempPwShown] = useState<{ name: string; password: string } | null>(null);

  const { data: profiles, refetch: refetchProfiles } = useQuery({
    queryKey: ["um-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      return (data as unknown as Profile[]) || [];
    },
  });

  const { data: requests, refetch: refetchReqs } = useQuery({
    queryKey: ["um-requests"],
    queryFn: () => listApprovalRequests(),
  });

  const userRequests = (requests || []);
  const pendingCount = userRequests.filter(r => r.status === "pending").length;

  const filteredUsers = useMemo(() => {
    const list = (profiles || []).filter(p => {
      if (statusFilter === "active" && p.is_active === false) return false;
      if (statusFilter === "inactive" && p.is_active !== false) return false;
      if (search) {
        const q = search.toLowerCase();
        return (p.display_name || "").toLowerCase().includes(q)
          || (p.email || "").toLowerCase().includes(q)
          || (ROLE_LABELS[p.role] || "").toLowerCase().includes(q);
      }
      return true;
    });
    return list;
  }, [profiles, statusFilter, search]);

  if (!isRaiser && !isApprover && !isProjectApprover) {
    return <div className="p-8 text-sm text-muted-foreground">You don&apos;t have access to User Management.</div>;
  }

  async function handleApprove(req: ApprovalRequest) {
    try {
      if (req.request_type === "add_user") {
        const p = req.payload as Record<string, string>;
        await createUserWithPassword({
          email: p.email,
          role: p.role as AppRole,
          password: TEMP_PASSWORD,
          display_name: p.full_name,
          phone: p.phone,
          reporting_manager_id: p.reporting_to,
        });
        await setApprovalDecision(req.id, "approved", undefined, `Created with temp password ${TEMP_PASSWORD}`);
        await logAudit({
          section: "User Management", action: "approve_add_user",
          entity: p.email, summary: `Approved add user — ${p.full_name} as ${p.role}`,
        });
        setTempPwShown({ name: p.full_name || p.email, password: TEMP_PASSWORD });
      } else if (req.request_type === "deactivate_user") {
        const p = req.payload as Record<string, string>;
        await reassignAndDeactivate(p.user_id, p.reassign_to);
        await setApprovalDecision(req.id, "approved");
        await logAudit({
          section: "User Management", action: "approve_deactivate_user",
          entity: p.user_email, summary: `Approved deactivation — ${p.user_name} (${p.reason})`,
        });
        toast.success("User deactivated");
      } else if (req.request_type === "create_project") {
        const p = req.payload as Record<string, unknown>;
        // Strip non-column fields used only for downstream creation
        const { module_count: _mc, panel_count: _pc, ...projectFields } = p as any;
        const { data: created, error } = await supabase.from("projects").insert({
          ...projectFields,
          status: "Active",
          created_by: req.requested_by,
          updated_by: req.requested_by,
        } as never).select("id,name").single();
        if (error) throw error;
        await setApprovalDecision(req.id, "approved");
        await logAudit({ section: "Projects", action: "approve_create_project", entity: String(p.name), summary: `Approved project creation by ${req.requested_by_name}` });

        // Notify MD with awareness + raiser confirmation
        try {
          const { insertNotifications } = await import("@/lib/notifications");
          const { data: mds } = await supabase
            .from("profiles").select("auth_user_id").eq("role", "managing_director" as any).eq("is_active", true);
          const approverName = (await supabase.from("profiles").select("display_name").eq("auth_user_id", user?.id || "").maybeSingle()).data?.display_name || "approver";
          const notifyList: { recipient_id: string; title: string; body: string; category: string; related_table?: string; related_id?: string; navigate_to?: string }[] = [];
          (mds || []).forEach((m: any) => {
            if (m.auth_user_id !== user?.id) {
              notifyList.push({
                recipient_id: m.auth_user_id,
                title: `Project approved — ${p.name}`,
                body: `Approved by ${approverName}.`,
                category: "info",
                related_table: "projects",
                related_id: (created as any)?.id,
                navigate_to: `/projects/${(created as any)?.id}`,
              });
            }
          });
          notifyList.push({
            recipient_id: req.requested_by,
            title: `Project approved — ${p.name}`,
            body: `Your project request has been approved by ${approverName}.`,
            category: "info",
            related_table: "projects",
            related_id: (created as any)?.id,
            navigate_to: `/projects/${(created as any)?.id}`,
          });
          if (notifyList.length) await insertNotifications(notifyList);
        } catch (e) { console.warn("notify on approve failed", e); }

        toast.success("Project created");
      } else if (req.request_type === "archive_project") {
        const p = req.payload as Record<string, string>;
        const { error } = await supabase.from("projects").update({
          status: "Archived",
          is_archived: true,
          archived_at: new Date().toISOString(),
          archive_reason: p.reason,
        } as never).eq("id", p.project_id);
        if (error) throw error;
        await setApprovalDecision(req.id, "approved");
        await logAudit({ section: "Projects", action: "approve_archive_project", entity: p.project_name, summary: `Archived — ${p.reason}` });
        toast.success("Project archived");
      }
      setReviewing(null);
      refetchProfiles(); refetchReqs();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleReject(req: ApprovalRequest, reason: string) {
    try {
      await setApprovalDecision(req.id, "rejected", reason);
      await logAudit({
        section: "User Management", action: `reject_${req.request_type}`,
        entity: (req.payload as Record<string,string>).email || (req.payload as Record<string,string>).user_email || req.id,
        summary: `Rejected: ${reason}`,
      });
      // Notify the raiser with the rejection reason
      try {
        const { insertNotifications } = await import("@/lib/notifications");
        const p = req.payload as Record<string, unknown>;
        const subject = req.request_type === "create_project" ? `Project request rejected — ${p.name}` : "Request rejected";
        await insertNotifications({
          recipient_id: req.requested_by,
          title: subject,
          body: `Reason: ${reason}. You can edit and resubmit.`,
          category: "info",
          related_table: "approval_requests",
          related_id: req.id,
          navigate_to: "/users",
        });
      } catch (e) { console.warn("notify on reject failed", e); }
      toast.success("Request rejected");
      setReviewing(null);
      refetchReqs();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Add and deactivate users — every change requires MD approval.
          </p>
        </div>
        {isRaiser && (
          <Button onClick={() => setAddOpen(true)} className="gap-1.5">
            <UserPlus className="h-4 w-4" /> Add User Request
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="users">All Users</TabsTrigger>
          <TabsTrigger value="requests" className="gap-1.5">
            Requests
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-md font-bold" style={{ background: "#FEF3C7", color: "#92400E" }}>
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, email, role…" className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={v=>setStatusFilter(v as never)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(p => {
                  const inactive = p.is_active === false;
                  return (
                    <TableRow key={p.id} className={inactive ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{p.display_name || "—"}</TableCell>
                      <TableCell className="text-xs">{p.email}</TableCell>
                      <TableCell className="text-xs">{ROLE_LABELS[p.role]}</TableCell>
                      <TableCell>
                        <Badge variant={inactive ? "secondary" : "default"}>
                          {inactive ? "Inactive" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{new Date(p.created_at).toLocaleDateString("en-GB")}</TableCell>
                      <TableCell className="text-right">
                        {isRaiser && !inactive && p.auth_user_id !== user?.id && (
                          <Button size="sm" variant="ghost" onClick={()=>setDeactOpen(p)} className="gap-1.5 text-destructive">
                            <UserMinus className="h-3.5 w-3.5" /> Deactivate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          <div className="bg-card rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userRequests.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">No requests yet.</TableCell></TableRow>
                )}
                {userRequests.map(r => {
                  const p = r.payload as Record<string, string>;
                  let summary = "";
                  let typeLabel = "";
                  switch (r.request_type) {
                    case "add_user":
                      typeLabel = "Add User";
                      summary = `${p.full_name} as ${ROLE_LABELS[p.role as AppRole] || p.role}`;
                      break;
                    case "deactivate_user":
                      typeLabel = "Deactivate";
                      summary = `${p.user_name || p.user_email} — ${p.reason}`;
                      break;
                    case "create_project":
                      typeLabel = "Create Project";
                      summary = `${p.name}${p.client_name ? ` — ${p.client_name}` : ""}`;
                      break;
                    case "archive_project":
                      typeLabel = "Archive Project";
                      summary = `${p.project_name} — ${p.reason}`;
                      break;
                  }
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{typeLabel}</Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[320px]">{summary}</TableCell>
                      <TableCell className="text-xs">{r.requested_by_name}</TableCell>
                      <TableCell>
                        {r.status === "pending" && <Badge style={{ background: "#FEF3C7", color: "#92400E" }}>Pending MD</Badge>}
                        {r.status === "approved" && <Badge style={{ background: "#DCFCE7", color: "#166534" }}>Approved</Badge>}
                        {r.status === "rejected" && <Badge variant="destructive">Rejected</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{new Date(r.requested_at).toLocaleDateString("en-GB")}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={()=>setReviewing(r)} className="gap-1.5">
                          <Eye className="h-3.5 w-3.5" /> {isApprover && r.status === "pending" ? "Review" : "View"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <AddUserRequestDialog
        open={addOpen} onOpenChange={setAddOpen}
        activeUsers={(profiles || []).filter(p => p.is_active !== false)}
        onSubmitted={() => { refetchReqs(); setTab("requests"); }}
      />

      {deactOpen && (
        <DeactivateRequestDialog
          target={deactOpen}
          onOpenChange={(o) => !o && setDeactOpen(null)}
          activeUsers={(profiles || []).filter(p => p.is_active !== false && p.auth_user_id !== deactOpen.auth_user_id)}
          onSubmitted={() => { setDeactOpen(null); refetchReqs(); setTab("requests"); }}
        />
      )}

      <ReviewDialog
        request={reviewing}
        canDecide={isApprover && reviewing?.status === "pending"}
        onClose={() => setReviewing(null)}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      <Dialog open={!!tempPwShown} onOpenChange={(o)=>!o && setTempPwShown(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> User Created
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Account for <strong>{tempPwShown?.name}</strong> has been created.</p>
            <div className="rounded-md border p-3" style={{ background: "#F7F7F7" }}>
              <div className="text-xs text-muted-foreground">Temporary password</div>
              <div className="font-mono text-lg font-bold mt-1">{tempPwShown?.password}</div>
            </div>
            <p className="text-xs text-muted-foreground">Share this password with the new employee. They should change it on first login.</p>
          </div>
          <DialogFooter><Button onClick={()=>setTempPwShown(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────── Add User Request Dialog ─────────── */
function AddUserRequestDialog({ open, onOpenChange, activeUsers, onSubmitted }:{
  open: boolean; onOpenChange:(o:boolean)=>void;
  activeUsers: Profile[]; onSubmitted: ()=>void;
}) {
  const [full_name, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AppRole | "">("");
  const [department, setDepartment] = useState("");
  const [reporting_to, setReportingTo] = useState("");
  const [start_date, setStartDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setFullName(""); setEmail(""); setPhone(""); setRole(""); setDepartment("");
    setReportingTo(""); setStartDate(""); setReason("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!full_name || !email || !role || !department || !reporting_to || !start_date || !reason) {
      toast.error("Fill all required fields");
      return;
    }
    setSubmitting(true);
    try {
      await raiseApprovalRequest("add_user", {
        full_name, email, phone, role, department,
        reporting_to, start_date, reason,
      });
      await logAudit({ section: "User Management", action: "raise_add_user", entity: email, summary: `${full_name} as ${role}` });
      toast.success("Request sent to MD for approval");
      reset(); onOpenChange(false); onSubmitted();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add User Request</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Full Name *</Label><Input value={full_name} onChange={e=>setFullName(e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Email *</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91…" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role *</Label>
              <Select value={role} onValueChange={v=>setRole(v as AppRole)}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {Object.entries(ROLE_TIERS).map(([tier, roles]) => (
                    <SelectGroup key={tier}>
                      <SelectLabel className="text-[10px]">{tier}</SelectLabel>
                      {roles.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Department *</Label><Input value={department} onChange={e=>setDepartment(e.target.value)} required /></div>
          </div>
          <div>
            <Label>Reporting To *</Label>
            <Select value={reporting_to} onValueChange={setReportingTo}>
              <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
              <SelectContent className="max-h-64">
                {activeUsers.map(u => (
                  <SelectItem key={u.auth_user_id} value={u.auth_user_id}>
                    {u.display_name || u.email} — {ROLE_LABELS[u.role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Start Date *</Label><Input type="date" value={start_date} onChange={e=>setStartDate(e.target.value)} required /></div>
          <div>
            <Label>Reason for addition *</Label>
            <Textarea value={reason} onChange={e=>setReason(e.target.value)} required
              placeholder="e.g. New hire replacing Rakesh as Factory Floor Supervisor" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Sending…" : "Send for MD Approval"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────── Deactivate Request Dialog ─────────── */
const DEACT_REASONS = ["Resigned","Terminated","Contract ended","Role made redundant","Other"];

function DeactivateRequestDialog({ target, onOpenChange, activeUsers, onSubmitted }:{
  target: Profile; onOpenChange:(o:boolean)=>void;
  activeUsers: Profile[]; onSubmitted: ()=>void;
}) {
  const [last_working_date, setLwd] = useState("");
  const [reason, setReason] = useState("");
  const [reason_other, setReasonOther] = useState("");
  const [reassign_to, setReassign] = useState("");
  const [handover_done, setHandover] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!last_working_date || !reason || !reassign_to) {
      toast.error("Fill all required fields");
      return;
    }
    setSubmitting(true);
    try {
      const finalReason = reason === "Other" ? reason_other : reason;
      await raiseApprovalRequest("deactivate_user", {
        user_id: target.auth_user_id,
        user_name: target.display_name,
        user_email: target.email,
        last_working_date,
        reason: finalReason,
        reassign_to,
        handover_done,
      });
      await logAudit({ section: "User Management", action: "raise_deactivate_user",
        entity: target.email || target.id, summary: `${target.display_name} — ${finalReason}` });
      toast.success("Request sent to MD for approval");
      onSubmitted();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSubmitting(false); }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Request Deactivation — {target.display_name || target.email}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Last Working Date *</Label><Input type="date" value={last_working_date} onChange={e=>setLwd(e.target.value)} required /></div>
          <div>
            <Label>Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
              <SelectContent>
                {DEACT_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            {reason === "Other" && (
              <Textarea className="mt-2" placeholder="Specify reason" value={reason_other} onChange={e=>setReasonOther(e.target.value)} />
            )}
          </div>
          <div>
            <Label>Reassign open tasks to *</Label>
            <Select value={reassign_to} onValueChange={setReassign}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent className="max-h-64">
                {activeUsers.map(u => (
                  <SelectItem key={u.auth_user_id} value={u.auth_user_id}>
                    {u.display_name || u.email} — {ROLE_LABELS[u.role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={handover_done} onChange={e=>setHandover(e.target.checked)} />
            Handover completed
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={submitting}>{submitting ? "Sending…" : "Send for MD Approval"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────── Review Dialog ─────────── */
function ReviewDialog({ request, canDecide, onClose, onApprove, onReject }:{
  request: ApprovalRequest | null; canDecide: boolean;
  onClose: ()=>void;
  onApprove: (r: ApprovalRequest)=>void;
  onReject: (r: ApprovalRequest, reason: string)=>void;
}) {
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  if (!request) return null;
  const p = request.payload as Record<string, string | boolean>;

  return (
    <Dialog open onOpenChange={(o)=>!o && (onClose(), setShowReject(false), setRejectReason(""))}>
      <DialogContent>
        <DialogHeader><DialogTitle>
          {request.request_type === "add_user" ? "Add User Request" : "Deactivation Request"}
        </DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm">
          {Object.entries(p).map(([k, v]) => (
            <div key={k} className="grid grid-cols-3 gap-2 py-1 border-b last:border-0">
              <div className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</div>
              <div className="col-span-2 break-words">{String(v ?? "—")}</div>
            </div>
          ))}
          <div className="grid grid-cols-3 gap-2 py-1 text-xs text-muted-foreground">
            <div>Requested by</div>
            <div className="col-span-2">{request.requested_by_name} · {new Date(request.requested_at).toLocaleString("en-GB")}</div>
          </div>
          {request.status !== "pending" && (
            <div className="rounded-md p-2 mt-2" style={{ background: "#F7F7F7" }}>
              <div className="text-xs">
                <strong>{request.status === "approved" ? "Approved" : "Rejected"}</strong> by {request.approved_by_name} on{" "}
                {request.approved_at && new Date(request.approved_at).toLocaleString("en-GB")}
              </div>
              {request.rejected_reason && <div className="text-xs mt-1">Reason: {request.rejected_reason}</div>}
              {request.audit_notes && <div className="text-xs mt-1">Notes: {request.audit_notes}</div>}
            </div>
          )}
          {showReject && (
            <Textarea autoFocus className="mt-2" placeholder="Reason for rejection (required)"
              value={rejectReason} onChange={e=>setRejectReason(e.target.value)} />
          )}
        </div>
        <DialogFooter>
          {canDecide && !showReject && (
            <>
              <Button variant="outline" onClick={()=>setShowReject(true)} className="gap-1.5"><X className="h-4 w-4" /> Reject</Button>
              <Button onClick={()=>onApprove(request)} className="gap-1.5" style={{ background: "#006039" }}><Check className="h-4 w-4" /> Approve</Button>
            </>
          )}
          {canDecide && showReject && (
            <>
              <Button variant="outline" onClick={()=>{ setShowReject(false); setRejectReason(""); }}>Cancel</Button>
              <Button variant="destructive" disabled={!rejectReason.trim()} onClick={()=>onReject(request, rejectReason)}>Confirm Reject</Button>
            </>
          )}
          {!canDecide && <Button onClick={onClose}>Close</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
