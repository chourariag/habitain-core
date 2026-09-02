import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, UserX, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import {
  createOffboardingRecord,
  resolveOffboardingImpactItem,
  advanceOffboarding,
} from "@/lib/admin-api";
import { format } from "date-fns";

type Profile = {
  id: string;
  auth_user_id: string;
  display_name: string | null;
  email: string | null;
  role: AppRole;
  is_active: boolean | null;
};

type OffboardingRecord = {
  id: string;
  profile_id: string;
  status: string;
  last_working_day: string;
  reason: string;
  exit_reason_category: string | null;
  exit_interview_notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  profiles: Profile;
};


type ImpactItem = {
  id: string;
  offboarding_record_id: string;
  item_type: string;
  entity_table: string;
  entity_id: string;
  field_name: string;
  old_value: string;
  new_value: string | null;
  resolution_status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  notes: string | null;
};

type ClearanceItem = {
  id: string;
  offboarding_record_id: string;
  checklist_item: string;
  status: string;
  completed_by: string | null;
  completed_at: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  reassignment_pending: "Reassignment Pending",
  clearance_pending: "Clearance Pending",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, { fg: string; bg: string; border: string }> = {
  reassignment_pending: { fg: "#92400E", bg: "#FEF3C7", border: "#FCD34D" },
  clearance_pending: { fg: "#1E40AF", bg: "#DBEAFE", border: "#93C5FD" },
  completed: { fg: "#166534", bg: "#DCFCE7", border: "#86EFAC" },
  cancelled: { fg: "#991B1B", bg: "#FEE2E2", border: "#FCA5A5" },
};

function useProfiles() {
  return useQuery({
    queryKey: ["offboarding-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, auth_user_id, display_name, email, role, is_active")
        .eq("is_active", true)
        .order("display_name");
      if (error) throw error;
      return (data as Profile[]) || [];
    },
  });
}

function useOffboardingRecords() {
  return useQuery({
    queryKey: ["offboarding-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offboarding_records")
        .select("*, profiles!inner(id, auth_user_id, display_name, email, role, is_active)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as OffboardingRecord[]) || [];
    },
  });
}

function useImpactItems(recordId?: string) {
  return useQuery({
    queryKey: ["offboarding-impact-items", recordId],
    queryFn: async () => {
      if (!recordId) return [];
      const { data, error } = await supabase
        .from("offboarding_impact_items")
        .select("*")
        .eq("offboarding_record_id", recordId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as ImpactItem[]) || [];
    },
    enabled: !!recordId,
  });
}

function useClearanceItems(recordId?: string) {
  return useQuery({
    queryKey: ["offboarding-clearance-items", recordId],
    queryFn: async () => {
      if (!recordId) return [];
      const { data, error } = await supabase
        .from("offboarding_clearance_items")
        .select("*")
        .eq("offboarding_record_id", recordId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as ClearanceItem[]) || [];
    },
    enabled: !!recordId,
  });
}

function InitiateOffboardingDialog({
  open,
  onClose,
  profiles,
}: {
  open: boolean;
  onClose: () => void;
  profiles: Profile[];
}) {
  const [profileId, setProfileId] = useState("");
  const [lastWorkingDay, setLastWorkingDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();

  const reset = () => {
    setProfileId("");
    setLastWorkingDay(format(new Date(), "yyyy-MM-dd"));
    setReason("");
    setCategory("");
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!profileId || !lastWorkingDay || !reason) {
      toast.error("Employee, last working day, and reason are required");
      return;
    }
    setSubmitting(true);
    try {
      await createOffboardingRecord({
        profile_id: profileId,
        last_working_day: lastWorkingDay,
        reason,
        exit_reason_category: category || null,
        exit_interview_notes: notes || null,
      });
      toast.success("Offboarding record created");
      qc.invalidateQueries({ queryKey: ["offboarding-records"] });
      reset();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to create offboarding record");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Initiate Offboarding</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Employee</Label>
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name || p.email || "—"} ({ROLE_LABELS[p.role] || p.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Last Working Day</Label>
            <Input type="date" value={lastWorkingDay} onChange={(e) => setLastWorkingDay(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Resignation accepted" />
          </div>
          <div className="space-y-1">
            <Label>Exit Reason Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resignation">Resignation</SelectItem>
                <SelectItem value="termination">Termination</SelectItem>
                <SelectItem value="retirement">Retirement</SelectItem>
                <SelectItem value="contract_end">Contract End</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Exit Interview Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !profileId || !lastWorkingDay || !reason} className="text-white gap-2" style={{ backgroundColor: "#006039" }}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Create Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImpactItemRow({
  item,
  profiles,
}: {
  item: ImpactItem;
  profiles: Profile[];
}) {
  const [reassignTo, setReassignTo] = useState<string>(item.new_value || "");
  const [resolution, setResolution] = useState<"resolved" | "leave_vacant">("resolved");
  const [notes, setNotes] = useState(item.notes || "");
  const qc = useQueryClient();

  const resolve = useMutation({
    mutationFn: async () => {
      await resolveOffboardingImpactItem({
        impact_item_id: item.id,
        resolution_status: resolution,
        reassign_to_profile_id: resolution === "resolved" ? reassignTo : undefined,
        notes,
      });
    },
    onSuccess: () => {
      toast.success("Impact item resolved");
      qc.invalidateQueries({ queryKey: ["offboarding-impact-items"] });
      qc.invalidateQueries({ queryKey: ["offboarding-records"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to resolve impact item"),
  });

  const isResolved = item.resolution_status === "resolved";

  return (
    <TableRow>
      <TableCell className="text-xs capitalize">{item.item_type.replace(/_/g, " ")}</TableCell>
      <TableCell className="text-xs">{item.entity_table}</TableCell>
      <TableCell className="text-xs">{item.field_name}</TableCell>
      <TableCell className="text-xs max-w-[160px] truncate" title={item.old_value}>{item.old_value}</TableCell>
      <TableCell>
        {isResolved ? (
          <span className="text-xs" style={{ color: "#666" }}>
            {item.new_value === "leave_vacant" ? "Left vacant" : profiles.find((p) => p.id === item.new_value)?.display_name || item.new_value || "—"}
          </span>
        ) : (
          <div className="space-y-2">
            <Select value={resolution} onValueChange={(v) => setResolution(v as any)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resolved">Reassign to profile</SelectItem>
                <SelectItem value="leave_vacant">Leave vacant</SelectItem>
              </SelectContent>
            </Select>
            {resolution === "resolved" && (
              <Select value={reassignTo} onValueChange={setReassignTo}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select replacement" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name || p.email || "—"} ({ROLE_LABELS[p.role] || p.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input className="h-8 text-xs" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        )}
      </TableCell>
      <TableCell>
        {isResolved ? (
          <Badge variant="outline" className="text-[10px] gap-1" style={{ color: "#166534", borderColor: "#86EFAC", background: "#DCFCE7" }}>
            <CheckCircle2 className="h-3 w-3" /> Resolved
          </Badge>
        ) : (
          <Button size="sm" className="h-7 text-white text-xs gap-1" style={{ backgroundColor: "#006039" }} onClick={() => resolve.mutate()} disabled={resolve.isPending || (resolution === "resolved" && !reassignTo)}>
            {resolve.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Resolve
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function OffboardingDetail({
  record,
  profiles,
  onClose,
}: {
  record: OffboardingRecord;
  profiles: Profile[];
  onClose: () => void;
}) {
  const { data: impactItems, isLoading: impactLoading } = useImpactItems(record.id);
  const { data: clearanceItems, isLoading: clearanceLoading } = useClearanceItems(record.id);
  const qc = useQueryClient();
  const { user } = useAuth();

  const toggleClearance = useMutation({
    mutationFn: async ({ item, checked }: { item: ClearanceItem; checked: boolean }) => {
      const { error } = await supabase
        .from("offboarding_clearance_items")
        .update({
          status: checked ? "completed" : "pending",
          completed_by: checked ? user?.id : null,
          completed_at: checked ? new Date().toISOString() : null,
        })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["offboarding-clearance-items"] }),
    onError: (e: any) => toast.error(e.message || "Failed to update clearance item"),
  });

  const advance = useMutation({
    mutationFn: async (newStatus: string) => {
      await advanceOffboarding(record.id, newStatus);
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["offboarding-records"] });
      qc.invalidateQueries({ queryKey: ["offboarding-impact-items"] });
      qc.invalidateQueries({ queryKey: ["offboarding-clearance-items"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to advance offboarding"),
  });

  const pendingImpact = (impactItems || []).filter((i) => i.resolution_status !== "resolved").length;
  const pendingClearance = (clearanceItems || []).filter((c) => c.status !== "completed").length;
  const canAdvanceToClearance = record.status === "reassignment_pending" && pendingImpact === 0;
  const canComplete = record.status === "clearance_pending" && pendingClearance === 0;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            Offboarding — {record.profiles.display_name || record.profiles.email || "—"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p style={{ color: "#666" }}>Role</p>
              <p className="font-medium">{ROLE_LABELS[record.profiles.role] || record.profiles.role}</p>
            </div>
            <div>
              <p style={{ color: "#666" }}>Last Working Day</p>
              <p className="font-medium">{format(new Date(record.last_working_day), "dd/MM/yyyy")}</p>
            </div>
            <div>
              <p style={{ color: "#666" }}>Status</p>
              <Badge variant="outline" className="text-[10px] capitalize" style={{
                color: STATUS_COLORS[record.status]?.fg || "#666",
                borderColor: STATUS_COLORS[record.status]?.border || "#E5E7EB",
                backgroundColor: STATUS_COLORS[record.status]?.bg || "transparent",
              }}>
                {STATUS_LABELS[record.status] || record.status}
              </Badge>
            </div>
            <div className="sm:col-span-3">
              <p style={{ color: "#666" }}>Reason</p>
              <p className="font-medium">{record.reason}</p>
            </div>
            {record.exit_reason_category && (
              <div>
                <p style={{ color: "#666" }}>Category</p>
                <p className="font-medium capitalize">{record.exit_reason_category.replace(/_/g, " ")}</p>
              </div>
            )}
            {record.exit_interview_notes && (
              <div className="sm:col-span-2">
                <p style={{ color: "#666" }}>Exit Interview Notes</p>
                <p className="font-medium">{record.exit_interview_notes}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-display font-semibold text-sm">Impact Reassignment</h4>
              {pendingImpact > 0 && (
                <Badge variant="outline" className="text-[10px] gap-1" style={{ color: "#92400E", borderColor: "#FCD34D", background: "#FEF3C7" }}>
                  <AlertTriangle className="h-3 w-3" /> {pendingImpact} pending
                </Badge>
              )}
            </div>
            {impactLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: "#F7F7F7" }}>
                      <TableHead className="text-xs" style={{ color: "#666" }}>Type</TableHead>
                      <TableHead className="text-xs" style={{ color: "#666" }}>Table</TableHead>
                      <TableHead className="text-xs" style={{ color: "#666" }}>Field</TableHead>
                      <TableHead className="text-xs" style={{ color: "#666" }}>Current Value</TableHead>
                      <TableHead className="text-xs" style={{ color: "#666" }}>Action</TableHead>
                      <TableHead className="text-xs" style={{ color: "#666" }}>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {impactItems && impactItems.length > 0 ? (
                      impactItems.map((item) => <ImpactItemRow key={item.id} item={item} profiles={profiles} />)
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-sm" style={{ color: "#999" }}>
                          No impact items found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="font-display font-semibold text-sm">Clearance Checklist</h4>
            {clearanceLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="rounded-lg border p-4 space-y-3 bg-card">
                {clearanceItems && clearanceItems.length > 0 ? (
                  clearanceItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <Checkbox
                        id={item.id}
                        checked={item.status === "completed"}
                        onCheckedChange={(checked) => toggleClearance.mutate({ item, checked: checked === true })}
                        disabled={record.status === "completed" || record.status === "cancelled"}
                      />
                      <div className="space-y-0.5">
                        <Label htmlFor={item.id} className="text-sm font-medium">{item.checklist_item}</Label>
                        {item.completed_at && (
                          <p className="text-[10px]" style={{ color: "#666" }}>
                            Completed {format(new Date(item.completed_at), "dd/MM/yyyy HH:mm")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm" style={{ color: "#999" }}>No clearance items.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {record.status === "reassignment_pending" && (
              <Button
                className="text-white gap-2"
                style={{ backgroundColor: "#006039" }}
                disabled={!canAdvanceToClearance || advance.isPending}
                onClick={() => advance.mutate("clearance_pending")}
              >
                {advance.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Move to Clearance
              </Button>
            )}
            {record.status === "clearance_pending" && (
              <Button
                className="text-white gap-2"
                style={{ backgroundColor: "#006039" }}
                disabled={!canComplete || advance.isPending}
                onClick={() => advance.mutate("completed")}
              >
                {advance.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Complete Offboarding
              </Button>
            )}
            {!["completed", "cancelled"].includes(record.status) && (
              <Button
                variant="outline"
                className="gap-2"
                style={{ color: "#991B1B", borderColor: "#FCA5A5" }}
                disabled={advance.isPending}
                onClick={() => advance.mutate("cancelled")}
              >
                <XCircle className="h-4 w-4" /> Cancel
              </Button>
            )}
            {!canAdvanceToClearance && record.status === "reassignment_pending" && (
              <p className="text-xs" style={{ color: "#92400E" }}>Resolve all impact items before moving to clearance.</p>
            )}
            {!canComplete && record.status === "clearance_pending" && (
              <p className="text-xs" style={{ color: "#92400E" }}>Complete all clearance items before finalizing.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OffboardingTab() {
  const [initOpen, setInitOpen] = useState(false);
  const [selected, setSelected] = useState<OffboardingRecord | null>(null);
  const { data: records, isLoading } = useOffboardingRecords();
  const { data: profiles, isLoading: profilesLoading } = useProfiles();

  if (isLoading || profilesLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "#666" }}>
          Initiate offboarding, reassign ownership, complete clearance, and deactivate the employee.
        </p>
        <Button className="text-white gap-2" style={{ backgroundColor: "#006039" }} onClick={() => setInitOpen(true)}>
          <UserX className="h-4 w-4" /> Initiate Offboarding
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto bg-card">
        <Table>
          <TableHeader>
            <TableRow style={{ backgroundColor: "#F7F7F7" }}>
              <TableHead className="text-xs uppercase tracking-wide" style={{ color: "#666" }}>Employee</TableHead>
              <TableHead className="text-xs uppercase tracking-wide" style={{ color: "#666" }}>Role</TableHead>
              <TableHead className="text-xs uppercase tracking-wide" style={{ color: "#666" }}>Last Working Day</TableHead>
              <TableHead className="text-xs uppercase tracking-wide" style={{ color: "#666" }}>Status</TableHead>
              <TableHead className="text-xs uppercase tracking-wide" style={{ color: "#666" }}>Created</TableHead>
              <TableHead className="text-xs uppercase tracking-wide" style={{ color: "#666" }}>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records && records.length > 0 ? (
              records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-sm">{r.profiles.display_name || r.profiles.email || "—"}</TableCell>
                  <TableCell className="text-xs">{ROLE_LABELS[r.profiles.role] || r.profiles.role}</TableCell>
                  <TableCell className="text-xs font-mono">{format(new Date(r.last_working_day), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize" style={{
                      color: STATUS_COLORS[r.status]?.fg || "#666",
                      borderColor: STATUS_COLORS[r.status]?.border || "#E5E7EB",
                      backgroundColor: STATUS_COLORS[r.status]?.bg || "transparent",
                    }}>
                      {STATUS_LABELS[r.status] || r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs" style={{ color: "#666" }}>{format(new Date(r.created_at), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelected(r)}>Open</Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-sm" style={{ color: "#999" }}>
                  No offboarding records yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {initOpen && profiles && (
        <InitiateOffboardingDialog open={initOpen} onClose={() => setInitOpen(false)} profiles={profiles} />
      )}
      {selected && profiles && (
        <OffboardingDetail record={selected} profiles={profiles} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
