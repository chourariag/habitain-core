import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { PROJECT_CREATOR_ACCESS_CHANGED } from "@/hooks/useCanCreateProject";
import { isTier1OrSuper, ROLE_LABELS } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Search, ShieldCheck, UserMinus } from "lucide-react";
import { toast } from "sonner";

type Person = { user_id: string; name: string | null; roles: string[] | null; is_active?: boolean; built_in?: boolean };
type Creator = Person & { note: string | null; granted_by_name: string | null; granted_at: string; revoked_at: string | null; profile_active: boolean };
type CreatorList = { built_in_label: string; built_in: Person[]; grants: Creator[]; candidates: Person[] };
const roleNames = (person: Person) => (person.roles ?? []).map(role => ROLE_LABELS[role] ?? role.replace(/_/g, " ")).join(" · ") || "No assigned role";
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-GB").format(new Date(value));

export function ProjectCreatorsTab() {
  const { role, userId } = useUserRole();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["project-creators", userId], enabled: isTier1OrSuper(role),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_project_creators");
      if (error) throw error;
      return data as unknown as CreatorList;
    },
  });
  if (!isTier1OrSuper(role)) return null;
  const change = async (person: Person, grant: boolean) => {
    setBusy(person.user_id);
    try {
      const { error } = grant
        ? await supabase.rpc("grant_project_creator", { p_user_id: person.user_id, p_note: note.trim() || undefined })
        : await supabase.rpc("revoke_project_creator", { p_user_id: person.user_id });
      if (error) throw error;
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["super-admin-audit"] });
      window.dispatchEvent(new Event(PROJECT_CREATOR_ACCESS_CHANGED));
      toast.success(grant ? "Project creation access added" : "Project creation access removed");
      if (grant) { setAdding(false); setSearch(""); setNote(""); }
    } catch (error) { toast.error(error instanceof Error ? error.message : (error as { message?: string })?.message || "Could not update project creation access"); }
    finally { setBusy(null); }
  };
  const candidates = (data?.candidates ?? []).filter(person => `${person.name ?? ""} ${roleNames(person)}`.toLowerCase().includes(search.toLowerCase().trim()));
  return <div className="min-w-0 space-y-6">
    <section className="space-y-3 border-b border-border pb-4">
      <h2 className="flex items-center gap-2 font-display text-base font-semibold"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" />Always allowed (Super Admin, MD, Directors)</h2>
      <div className="divide-y divide-border">{data?.built_in.map(person => <div key={person.user_id} className="py-2 text-sm"><p className="break-words font-medium">{person.name || "Unnamed person"}</p><p className="break-words text-xs text-muted-foreground">{roleNames(person)}{person.is_active === false ? " · Account inactive" : ""}</p></div>)}</div>
    </section>
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-base font-semibold">Granted people</h2><Button onClick={() => setAdding(true)} disabled={isLoading || !!error} className="min-h-11 gap-2"><Plus className="h-4 w-4" />Add person</Button></div>
      {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading project creators" />}
      {error && <p role="alert" className="break-words text-sm text-destructive">Could not load project creators. <Button variant="link" onClick={() => void refetch()}>Retry</Button></p>}
      {!isLoading && !error && !data?.grants.length && <p className="text-sm text-muted-foreground">No additional people granted.</p>}
      <div className="divide-y divide-border">{data?.grants.map(person => <div key={person.user_id} className="flex flex-wrap items-start justify-between gap-3 py-3">
        <div className="min-w-0 flex-1 basis-[180px]"><p className="break-words text-sm font-medium">{person.name || "Unnamed person"}</p><p className="break-words text-xs text-muted-foreground">{roleNames(person)}</p><p className="break-words text-xs text-muted-foreground">Granted by {person.granted_by_name || "Unknown"} · {dateLabel(person.granted_at)}</p>{person.note && <p className="break-words text-sm">{person.note}</p>}{!person.profile_active && <p className="text-xs text-warning">Account inactive</p>}{!person.is_active && <p className="text-xs text-muted-foreground">Removed{person.revoked_at ? ` · ${dateLabel(person.revoked_at)}` : ""}</p>}</div>
        {person.is_active && <Button variant="outline" size="sm" className="min-h-11 gap-2" disabled={busy !== null} onClick={() => void change(person, false)} aria-label={`Remove ${person.name || "person"}`}><UserMinus className="h-4 w-4" />Remove</Button>}
      </div>)}</div>
    </section>
    <Dialog open={adding} onOpenChange={open => { if (busy) return; setAdding(open); if (!open) { setSearch(""); setNote(""); } }}>
      <DialogContent className="flex max-h-[85vh] flex-col p-0 sm:max-w-lg">
        <DialogHeader className="px-4 pt-4"><DialogTitle>Add person</DialogTitle></DialogHeader>
        <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto px-4 pb-4">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Search active people by name or role" placeholder="Search name or role" value={search} onChange={event => setSearch(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="creator-note">Note (optional)</Label><Input id="creator-note" value={note} onChange={event => setNote(event.target.value)} /></div>
          <div className="divide-y divide-border">{candidates.map(person => <div key={person.user_id} className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{person.name || "Unnamed person"}</p><p className="break-words text-xs text-muted-foreground">{roleNames(person)}</p></div><Button className="min-h-11 shrink-0" disabled={busy !== null} onClick={() => void change(person, true)} aria-label={`Add ${person.name || "person"}`}>{busy === person.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}</Button></div>)}</div>
          {!candidates.length && <p className="text-sm text-muted-foreground">No matching active people.</p>}
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}