import { TIER1_ROLES, isTier1OrSuper } from "@/lib/roles";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/roles";
import { Play, Save, Check } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { escalationHoursError } from "@/lib/reminder-validation";

type Rule = Database["public"]["Tables"]["reminder_rules"]["Row"];
type Level = Database["public"]["Tables"]["escalation_levels"]["Row"];
type Event = { id: string; description: string; project_name: string | null; subject_ref: string; subject_date: string; raised_at: string; level: number; delivery: string; recipient_names: string; notified_role: string; recipient_ids: string[]; acknowledgements: Record<string, string> };
const READ_ROLES = ["super_admin", ...TIER1_ROLES, "head_of_projects", "planning_head"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const displayDate = (date: string) => new Date(date).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" });

function RuleRow({ initial, editable, refresh }: { initial: Rule; editable: boolean; refresh: () => void }) {
  const [rule, setRule] = useState(initial);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("update_reminder_rule", { p_key: rule.key, p_due: rule.due_time_ist, p_days: rule.working_days, p_mode: rule.delivery_mode, p_active: rule.active, p_effective_from: rule.effective_from });
    setBusy(false);
    if (error) { console.error(error); toast.error(error.message); } else { toast.success("Reminder rule saved"); refresh(); }
  };
  return <div className="space-y-3 border-b border-border py-4">
    <h3 className="text-sm font-semibold">{rule.description}</h3>
    <div className="grid grid-cols-2 gap-3">
      <Label className="space-y-2">Due time (IST)<Input aria-label={`${rule.key} due time`} type="time" value={rule.due_time_ist.slice(0, 5)} disabled={!editable} onChange={e => setRule({ ...rule, due_time_ist: e.target.value })} /></Label>
      <Label className="space-y-2">Delivery mode<Select value={rule.delivery_mode} disabled={!editable} onValueChange={delivery_mode => setRule({ ...rule, delivery_mode })}><SelectTrigger aria-label={`${rule.key} delivery mode`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="shadow">Shadow</SelectItem><SelectItem value="live">Live</SelectItem></SelectContent></Select></Label>
    </div>
    <Label className="block space-y-2">Effective from<Input aria-label={`${rule.key} effective from`} type="date" value={rule.effective_from} disabled={!editable} onChange={e => setRule({ ...rule, effective_from: e.target.value })} /></Label>
    <fieldset className="flex flex-wrap gap-x-4 gap-y-2"><legend className="mb-2 text-xs text-muted-foreground">Working days</legend>{DAYS.map((day, i) => <label key={day} className="flex items-center gap-1 text-xs"><input type="checkbox" disabled={!editable} checked={rule.working_days.includes(i + 1)} onChange={e => setRule({ ...rule, working_days: e.target.checked ? [...rule.working_days, i + 1].sort() : rule.working_days.filter(d => d !== i + 1) })} />{day}</label>)}</fieldset>
    <div className="flex items-center justify-between"><Label className="flex items-center gap-2"><Switch checked={rule.active} disabled={!editable} onCheckedChange={active => setRule({ ...rule, active })} aria-label={`${rule.key} active`} />Active</Label>{editable && <Button size="sm" disabled={busy || !rule.working_days.length || !rule.effective_from} onClick={save}><Save className="mr-2 h-4 w-4" />Save rule</Button>}</div>
  </div>;
}

function LevelRow({ initial, editable, refresh }: { initial: Level; editable: boolean; refresh: () => void }) {
  const [hours, setHours] = useState(initial.after_hours);
  const [role, setRole] = useState(initial.notify_role);
  const [busy, setBusy] = useState(false);
  const hoursError = escalationHoursError(initial.rule_key, hours);
  return <div className="grid grid-cols-1 gap-2 border-b border-border py-3 sm:grid-cols-[5rem_6rem_1fr_auto] sm:items-center">
    <span className="text-sm">Level {initial.level}</span>
    <Label className="space-y-1 text-xs">After hours<Input aria-label={`${initial.rule_key} level ${initial.level} hours`} type="number" min={0} value={hours} disabled={!editable} aria-invalid={!!hoursError} onChange={e => setHours(Number(e.target.value))} />{hoursError && <span className="block text-destructive" role="alert">{hoursError}</span>}</Label>
    <Select value={role} disabled={!editable} onValueChange={setRole}><SelectTrigger aria-label={`${initial.rule_key} level ${initial.level} role`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="owner">Owner</SelectItem>{Object.entries(ROLE_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>
    {editable && <Button size="sm" variant="outline" disabled={busy || hours < 0 || !!hoursError} onClick={async () => { setBusy(true); const { error } = await supabase.rpc("update_escalation_level", { p_key: initial.rule_key, p_level: initial.level, p_hours: hours, p_role: role }); setBusy(false); if (error) { console.error(error); toast.error(error.message); } else { toast.success("Escalation saved"); refresh(); } }}><Save className="mr-2 h-4 w-4" />Save level</Button>}
  </div>;
}

export function OpenReminders({ settings = false }: { settings?: boolean }) {
  const { role, userId } = useUserRole();
  const flags = useFeatureFlags();
  const client = useQueryClient();
  const allowed = role !== null && READ_ROLES.includes(role);
  const query = useQuery({ queryKey: ["open-reminders", userId], enabled: !!userId && (settings || flags.isEnabled("reminders")), queryFn: async () => { const { data, error } = await supabase.rpc("list_open_reminders"); if (error) throw error; return data as unknown as Event[]; } });
  if ((!allowed && settings) || (!settings && !flags.isEnabled("reminders"))) return null;
  return <section className="min-w-0 space-y-3"><h2 className="font-display text-lg font-bold">Open reminders</h2>
    {query.isLoading ? <p className="text-sm">Loading reminders…</p> : query.isError ? <p className="text-sm text-destructive">Could not load reminders.</p> : !query.data?.length ? <p className="text-sm text-muted-foreground">No open reminders.</p> : <div className="divide-y divide-border border-y border-border">{query.data.map(event => <div key={event.id} className="space-y-2 py-3 text-sm">
      <p className="break-words font-semibold">{event.description}</p><p className="break-words">{event.recipient_names} · {ROLE_LABELS[event.notified_role] ?? event.notified_role}</p>
      <p className="break-words text-muted-foreground">{event.project_name ?? "No project"} · {displayDate(event.subject_date)}</p><p className="text-xs text-muted-foreground">Since {displayDate(event.raised_at)} · Level {event.level} · {event.delivery === "shadow" ? "Shadow" : "Live"}</p>
      {userId && event.recipient_ids.includes(userId) && <Button size="sm" variant="outline" disabled={!!event.acknowledgements[userId]} onClick={async () => { const { error } = await supabase.rpc("acknowledge_reminder", { p_id: event.id }); if (error) toast.error(error.message); else await client.invalidateQueries({ queryKey: ["open-reminders"] }); }}><Check className="mr-2 h-4 w-4" />{event.acknowledgements[userId] ? "Acknowledged" : "Acknowledge"}</Button>}
    </div>)}</div>}
  </section>;
}

export function RemindersPanel() {
  const { role } = useUserRole();
  const client = useQueryClient();
  const flags = useFeatureFlags();
  const [dry, setDry] = useState<Record<string, unknown>[] | null>(null);
  const [asof, setAsof] = useState("");
  const [busy, setBusy] = useState(false);
  const admin = isTier1OrSuper(role);
  const editable = admin;
  const query = useQuery({ queryKey: ["reminder-settings"], enabled: admin, queryFn: async () => { const [rules, levels] = await Promise.all([supabase.from("reminder_rules").select("*").order("key"), supabase.from("escalation_levels").select("*").order("level")]); if (rules.error) throw rules.error; if (levels.error) throw levels.error; return { rules: rules.data, levels: levels.data }; } });
  const refresh = () => { void client.invalidateQueries({ queryKey: ["reminder-settings"] }); };
  if (!admin) return null;
  return <section className="min-w-0 space-y-5" aria-label="Reminders settings"><h2 className="font-display text-lg font-bold">Reminders</h2>
    <p className="text-sm text-muted-foreground">Reminders {flags.isEnabled("reminders") ? "On" : "Off"}</p>
    {query.isError && <p className="text-sm text-destructive">Could not load reminder settings.</p>}
    {query.data?.rules.map(rule => <div key={rule.key} className="min-w-0"><RuleRow key={rule.updated_at} initial={rule} editable={editable} refresh={refresh} /><h3 className="mt-4 text-sm font-semibold">Escalation levels</h3>{query.data.levels.filter(level => level.rule_key === rule.key).map(level => <LevelRow key={`${level.level}-${level.updated_at}`} initial={level} editable={editable} refresh={refresh} />)}</div>)}
    <Label className="block space-y-2">As of (optional date and time IST)<Input aria-label="As of (optional date and time IST)" type="datetime-local" value={asof} onChange={e => setAsof(e.target.value)} /></Label>
    <Button disabled={busy} onClick={async () => { setBusy(true); const { data, error } = await supabase.rpc("run_reminders", { p_dry: true, p_asof: admin && asof ? `${asof}:00+05:30` : undefined }); setBusy(false); if (error) { console.error(error); toast.error("Could not preview reminders. Please try again."); } else setDry(data as Record<string, unknown>[]); }}><Play className="mr-2 h-4 w-4" />Preview (saves nothing)</Button>
    {dry !== null && <div className="space-y-2" aria-live="polite"><h3 className="font-semibold">Preview result</h3>{!dry.length ? <p className="text-sm text-muted-foreground">No new reminders would be raised.</p> : dry.map((row, i) => <div key={i} className="border-b border-border py-2 text-sm"><p className="break-all">{String(row.rule_key)} · {String(row.subject_ref)}</p><p>Level {String(row.level)} · {String(row.notified_role)} · {String(row.delivery)}</p></div>)}</div>}
    <OpenReminders settings />
  </section>;
}