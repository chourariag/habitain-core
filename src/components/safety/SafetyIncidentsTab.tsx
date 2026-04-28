import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, ShieldAlert, Camera, X } from "lucide-react";
import { format, startOfMonth, startOfYear, differenceInCalendarDays } from "date-fns";
import { toast } from "sonner";
import { insertNotifications } from "@/lib/notifications";

const TYPES: Record<string, string> = {
  near_miss: "Near-Miss",
  first_aid: "First Aid",
  medical_treatment: "Medical Treatment",
  dangerous_occurrence: "Dangerous Occurrence",
  property_damage: "Property Damage",
};
const SEVERITIES = ["minor", "moderate", "serious", "critical"] as const;
const SEV_COLOR: Record<string, string> = { minor: "#006039", moderate: "#D4860A", serious: "#F40009", critical: "#F40009" };

const MANAGE_ROLES = ["super_admin", "managing_director", "head_operations", "production_head", "site_installation_mgr", "hr_executive"];
const URGENT_NOTIFY_ROLES = ["super_admin", "managing_director", "finance_director", "sales_director", "architecture_director"];
const STANDARD_NOTIFY_ROLES = ["head_operations", "production_head", "site_installation_mgr", "hr_executive"]; // Azad+Suraj equivalents

export function SafetyIncidentsTab() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const canManage = MANAGE_ROLES.includes(role ?? "");

  const [rows, setRows] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: r }, { data: p }] = await Promise.all([
      (supabase as any).from("safety_incidents").select("*").order("incident_at", { ascending: false }).limit(500),
      supabase.from("profiles").select("auth_user_id, display_name, role").eq("is_active", true).order("display_name"),
    ]);
    setRows((r as any[]) ?? []);
    setProfiles(p ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const profileName = (id: string) => profiles.find((p) => p.auth_user_id === id)?.display_name ?? "—";

  const monthRows = rows.filter((x) => new Date(x.incident_at) >= startOfMonth(new Date()));
  const ytdRows = rows.filter((x) => new Date(x.incident_at) >= startOfYear(new Date()));
  const openActions = rows.filter((x) => x.status !== "closed").length;
  const lastIncident = rows[0];
  const daysSince = lastIncident ? differenceInCalendarDays(new Date(), new Date(lastIncident.incident_at)) : null;

  const byType = useMemo(() => {
    const acc: Record<string, number> = {};
    monthRows.forEach((r) => { acc[r.incident_type] = (acc[r.incident_type] ?? 0) + 1; });
    return acc;
  }, [monthRows]);

  const handleSubmit = async (payload: any) => {
    if (!user) return;
    const { data, error } = await (supabase as any).from("safety_incidents").insert({
      incident_at: payload.incident_at,
      location: payload.location,
      location_detail: payload.location_detail || null,
      persons_involved: payload.persons_involved,
      reported_by: user.id,
      incident_type: payload.incident_type,
      severity: payload.severity,
      description: payload.description,
      immediate_action: payload.immediate_action,
      work_stopped: payload.work_stopped,
      photo_urls: payload.photo_urls,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }

    // Notifications
    const isUrgent = payload.severity === "serious" || payload.severity === "critical";
    const targetRoles = isUrgent ? [...STANDARD_NOTIFY_ROLES, ...URGENT_NOTIFY_ROLES] : STANDARD_NOTIFY_ROLES;
    const { data: recipients } = await supabase
      .from("profiles").select("auth_user_id").in("role", targetRoles as any).eq("is_active", true);
    if (recipients?.length) {
      await insertNotifications(recipients.map((p: any) => ({
        recipient_id: p.auth_user_id,
        title: isUrgent ? `🚨 ${payload.severity.toUpperCase()} safety incident` : `Safety incident: ${TYPES[payload.incident_type]}`,
        body: `${payload.location} · ${payload.description.slice(0, 120)}`,
        category: "safety_incident",
        related_table: "safety_incidents",
        related_id: data?.id,
        navigate_to: "/admin?tab=safety",
      })));
    }
    toast.success(isUrgent ? "Reported — directors notified urgently" : "Reported — Azad & Suraj notified");
    setFormOpen(false);
    load();
  };

  const editRow = rows.find((r) => r.id === editId);

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border p-4 bg-card" style={{ borderLeft: "3px solid #006039" }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Days Since Last Incident</p>
          <p className="text-3xl font-bold font-display" style={{ color: daysSince === null || daysSince > 30 ? "#006039" : daysSince > 7 ? "#D4860A" : "#F40009" }}>
            {daysSince ?? "—"}
          </p>
          {lastIncident && <p className="text-[10px] text-muted-foreground mt-1">Last: {format(new Date(lastIncident.incident_at), "dd/MM/yyyy")}</p>}
        </div>
        <div className="rounded-lg border border-border p-4 bg-card" style={{ borderLeft: "3px solid #D4860A" }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">This Month</p>
          <p className="text-2xl font-bold font-display">{monthRows.length}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {Object.entries(byType).map(([k, v]) => `${TYPES[k] ?? k}: ${v}`).join(" · ") || "No incidents"}
          </p>
        </div>
        <div className="rounded-lg border border-border p-4 bg-card" style={{ borderLeft: "3px solid #006039" }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Year to Date</p>
          <p className="text-2xl font-bold font-display">{ytdRows.length}</p>
        </div>
        <div className="rounded-lg border border-border p-4 bg-card" style={{ borderLeft: `3px solid ${openActions ? "#F40009" : "#006039"}` }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Open Corrective Actions</p>
          <p className="text-2xl font-bold font-display" style={{ color: openActions ? "#F40009" : "#006039" }}>{openActions}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><ShieldAlert className="h-4 w-4" /> Safety Log</h3>
        <Button size="sm" onClick={() => setFormOpen(true)} style={{ backgroundColor: "#006039" }}>
          <Plus className="h-4 w-4 mr-1" /> New Safety Entry
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No safety entries yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id} className="cursor-pointer hover:border-foreground/20" onClick={() => setEditId(r.id)}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" style={{ color: SEV_COLOR[r.severity], borderColor: SEV_COLOR[r.severity] }}>
                    {r.severity.toUpperCase()}
                  </Badge>
                  <Badge variant="outline">{TYPES[r.incident_type]}</Badge>
                  <Badge variant="outline" style={{ color: r.status === "closed" ? "#006039" : "#D4860A", borderColor: r.status === "closed" ? "#006039" : "#D4860A" }}>
                    {r.status.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">{format(new Date(r.incident_at), "dd/MM/yyyy hh:mm a")}</span>
                </div>
                <p className="text-sm font-medium" style={{ color: "#1A1A1A" }}>{r.location}{r.location_detail ? ` · ${r.location_detail}` : ""}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                <p className="text-[10px] text-muted-foreground">
                  Reported by {profileName(r.reported_by)} · Persons: {(r.persons_involved ?? []).map(profileName).join(", ") || "—"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewIncidentDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        profiles={profiles}
        onSubmit={handleSubmit}
      />

      {editRow && (
        <IncidentDetailDialog
          row={editRow}
          profiles={profiles}
          canManage={canManage}
          onClose={() => { setEditId(null); load(); }}
        />
      )}
    </div>
  );
}

/* ─── New incident dialog ─── */
function NewIncidentDialog({ open, onOpenChange, profiles, onSubmit }: any) {
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [location, setLocation] = useState("");
  const [locDetail, setLocDetail] = useState("");
  const [persons, setPersons] = useState<string[]>([]);
  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("");
  const [desc, setDesc] = useState("");
  const [action, setAction] = useState("");
  const [stopped, setStopped] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setLocation(""); setLocDetail(""); setPersons([]); setType(""); setSeverity("");
    setDesc(""); setAction(""); setStopped(false); setPhotos([]);
  };

  const submit = async () => {
    if (!location || !type || !severity || persons.length === 0 || desc.length < 50 || !action) {
      toast.error("Fill all required fields (description ≥ 50 chars)"); return;
    }
    setBusy(true);
    // Upload photos
    const urls: string[] = [];
    for (const f of photos.slice(0, 4)) {
      const path = `safety/${Date.now()}-${f.name.replace(/\s+/g, "_")}`;
      const { error } = await supabase.storage.from("safety-photos").upload(path, f);
      if (error) { toast.error(`Photo upload failed: ${error.message}`); setBusy(false); return; }
      const { data: u } = supabase.storage.from("safety-photos").getPublicUrl(path);
      urls.push(u.publicUrl);
    }
    await onSubmit({
      incident_at: new Date(date).toISOString(),
      location, location_detail: locDetail,
      persons_involved: persons,
      incident_type: type, severity,
      description: desc, immediate_action: action,
      work_stopped: stopped,
      photo_urls: urls,
    });
    reset();
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Safety Entry</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Date & Time *</label>
              <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Location *</label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Factory Bay">Factory Bay</SelectItem>
                  <SelectItem value="Site">Site</SelectItem>
                  <SelectItem value="Office">Office</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Location detail (bay no., site name…)</label>
            <Input value={locDetail} onChange={(e) => setLocDetail(e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Person(s) involved *</label>
            <Select onValueChange={(v) => { if (v && !persons.includes(v)) setPersons([...persons, v]); }}>
              <SelectTrigger><SelectValue placeholder="Add person…" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {profiles.filter((p: any) => !persons.includes(p.auth_user_id)).map((p: any) => (
                  <SelectItem key={p.auth_user_id} value={p.auth_user_id}>{p.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1 mt-2">
              {persons.map((id) => {
                const name = profiles.find((p: any) => p.auth_user_id === id)?.display_name;
                return (
                  <Badge key={id} variant="outline" className="text-xs gap-1">
                    {name}
                    <button onClick={() => setPersons(persons.filter((x) => x !== id))} className="ml-1"><X className="h-3 w-3" /></button>
                  </Badge>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Incident Type *</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Severity *</label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Description * (min 50 chars · {desc.length})</label>
            <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What happened in detail…" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Immediate Action Taken *</label>
            <Textarea rows={2} value={action} onChange={(e) => setAction(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={stopped} onChange={(e) => setStopped(e.target.checked)} />
            Was work stopped?
          </label>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Supporting Photos (up to 4) · {photos.length} added</label>
            <div className="flex gap-2 flex-wrap mt-1">
              {photos.map((f, i) => (
                <div key={i} className="relative">
                  <img src={URL.createObjectURL(f)} className="h-16 w-16 object-cover rounded" />
                  <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 text-[10px]">×</button>
                </div>
              ))}
              {photos.length < 4 && (
                <label className="h-16 w-16 rounded border-2 border-dashed border-border flex items-center justify-center cursor-pointer">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                    const f = Array.from(e.target.files ?? []).slice(0, 4 - photos.length);
                    setPhotos([...photos, ...f]);
                  }} />
                </label>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} style={{ backgroundColor: "#006039" }}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Detail / corrective action ─── */
function IncidentDetailDialog({ row, profiles, canManage, onClose }: any) {
  const [rootCause, setRootCause] = useState(row.root_cause ?? "");
  const [corrective, setCorrective] = useState(row.corrective_action ?? "");
  const [preventive, setPreventive] = useState(row.preventive_measure ?? "");
  const [status, setStatus] = useState(row.status);
  const [busy, setBusy] = useState(false);

  const profileName = (id: string) => profiles.find((p: any) => p.auth_user_id === id)?.display_name ?? "—";

  const save = async () => {
    setBusy(true);
    const patch: any = { status };
    if (rootCause && rootCause !== row.root_cause) { patch.root_cause = rootCause; patch.root_cause_at = new Date().toISOString(); }
    if (corrective && corrective !== row.corrective_action) { patch.corrective_action = corrective; patch.corrective_action_at = new Date().toISOString(); }
    if (preventive && preventive !== row.preventive_measure) { patch.preventive_measure = preventive; patch.preventive_measure_at = new Date().toISOString(); }
    if (status === "closed" && row.status !== "closed") {
      const { data: { user } } = await supabase.auth.getUser();
      patch.closed_at = new Date().toISOString();
      patch.closed_by = user?.id;
    }
    const { error } = await (supabase as any).from("safety_incidents").update(patch).eq("id", row.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Updated");
    onClose();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Safety Incident Detail</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">When:</span> {format(new Date(row.incident_at), "dd/MM/yyyy hh:mm a")}</div>
            <div><span className="text-muted-foreground">Severity:</span> <span style={{ color: SEV_COLOR[row.severity] }}>{row.severity}</span></div>
            <div><span className="text-muted-foreground">Type:</span> {TYPES[row.incident_type]}</div>
            <div><span className="text-muted-foreground">Location:</span> {row.location}{row.location_detail ? ` · ${row.location_detail}` : ""}</div>
            <div className="col-span-2"><span className="text-muted-foreground">Persons:</span> {(row.persons_involved ?? []).map(profileName).join(", ")}</div>
            <div className="col-span-2"><span className="text-muted-foreground">Reported by:</span> {profileName(row.reported_by)}</div>
          </div>
          <div><p className="text-xs font-medium text-muted-foreground">Description</p><p>{row.description}</p></div>
          <div><p className="text-xs font-medium text-muted-foreground">Immediate Action</p><p>{row.immediate_action}</p></div>
          {row.photo_urls?.length > 0 && (
            <div className="flex gap-2 flex-wrap">{row.photo_urls.map((u: string, i: number) => (
              <a key={i} href={u} target="_blank" rel="noopener noreferrer"><img src={u} className="h-20 w-20 object-cover rounded border" /></a>
            ))}</div>
          )}

          <hr />
          <p className="text-xs font-semibold">Corrective Action Tracking</p>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Root Cause (within 24h)</label>
            <Textarea rows={2} value={rootCause} onChange={(e) => setRootCause(e.target.value)} disabled={!canManage} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Corrective Action (within 48h)</label>
            <Textarea rows={2} value={corrective} onChange={(e) => setCorrective(e.target.value)} disabled={!canManage} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Preventive Measure (within 72h)</label>
            <Textarea rows={2} value={preventive} onChange={(e) => setPreventive(e.target.value)} disabled={!canManage} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={status} onValueChange={setStatus} disabled={!canManage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="action_pending">Action Pending</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {canManage && (
            <Button onClick={save} disabled={busy} style={{ backgroundColor: "#006039" }}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
