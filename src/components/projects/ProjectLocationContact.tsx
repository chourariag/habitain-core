import { useState } from "react";
import { MapPin, Pencil, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SiteLocationFields } from "@/components/projects/SiteLocationFields";
import { ClientContactFields } from "@/components/projects/ClientContactFields";
import { canEditSiteLocation, hasSitePin, normaliseClientPhone, siteMapUrl, validClientEmail, validateSiteLocation, type SiteLocation } from "@/lib/project-location";
import { isTier1OrSuper } from "@/lib/roles";

type ProjectPin = { id: string; location: string | null; site_lat: number | null; site_lng: number | null; site_radius: number | null };
export function ProjectLocationContact({ project, role, contact, onSaved }: { project: ProjectPin; role: string | null; contact: { client_phone: string | null; client_email: string | null } | null; onSaved: () => void }) {
  const [editing, setEditing] = useState<"site" | "contact" | null>(null);
  const [site, setSite] = useState<SiteLocation>({ location: "", site_lat: "", site_lng: "", site_radius: "300" });
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const close = () => { setEditing(null); setPhone(""); setEmail(""); };
  const edit = (kind: "site" | "contact") => {
    setSite({ location: project.location ?? "", site_lat: project.site_lat == null ? "" : String(project.site_lat), site_lng: project.site_lng == null ? "" : String(project.site_lng), site_radius: String(project.site_radius ?? 300) });
    setPhone(contact?.client_phone ?? ""); setEmail(contact?.client_email ?? ""); setEditing(kind);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (editing === "site") { const error = validateSiteLocation(site); if (error) { toast.error(error); return; } }
    const normalised = normaliseClientPhone(phone);
    if (editing === "contact" && (!normalised || !validClientEmail(email))) { toast.error("Enter a valid Indian mobile number and client email"); return; }
    setSaving(true);
    try {
      const { error } = editing === "site"
        ? await supabase.rpc("set_project_site_location", { p_project_id: project.id, p_address: site.location.trim(), p_lat: Number(site.site_lat), p_lng: Number(site.site_lng), p_radius: Number(site.site_radius) })
        : await supabase.rpc("set_project_client_contact", { p_project_id: project.id, p_phone: normalised ?? "", p_email: email.trim() });
      if (error) throw error;
      toast.success(editing === "site" ? "Site location saved" : "Client contact saved"); close(); onSaved();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save changes"); }
    finally { setSaving(false); }
  };
  return <>
    <section className="min-w-0 space-y-3 border-y border-border py-4" aria-label="Site location">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-display text-lg font-semibold"><MapPin className="h-5 w-5 text-primary" />Site location</h2>{canEditSiteLocation(role) && <Button variant="outline" className="min-h-11 gap-2" onClick={() => edit("site")}><Pencil className="h-4 w-4" />Edit site location</Button>}</div>
      <p className="break-words text-sm">{project.location || "Site address not set"}</p>
      {hasSitePin(project.site_lat, project.site_lng) ? <a className="inline-flex min-h-11 items-center gap-2 break-words text-sm text-primary underline" href={siteMapUrl(project.site_lat, project.site_lng)} target="_blank" rel="noopener noreferrer">{project.site_lat}, {project.site_lng}<ExternalLink className="h-4 w-4 shrink-0" /></a> : <p className="text-sm text-warning">Site pin not set</p>}
      <p className="text-sm text-muted-foreground">Attendance radius: {project.site_radius ?? 300} m</p>
      {isTier1OrSuper(role) && <Button variant="outline" className="min-h-11 gap-2" onClick={() => edit("contact")}><Pencil className="h-4 w-4" />Edit client contact</Button>}
    </section>
    <Dialog open={editing !== null} onOpenChange={open => { if (!open) close(); }}><DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-lg"><form onSubmit={save} className="flex max-h-[85vh] min-w-0 flex-col"><DialogHeader className="px-4 pt-4"><DialogTitle>{editing === "site" ? "Edit site location" : "Edit client contact"}</DialogTitle></DialogHeader><div className="min-h-0 flex-1 overflow-y-auto p-4">{editing === "site" ? <SiteLocationFields value={site} onChange={setSite} /> : <ClientContactFields phone={phone} email={email} onPhone={setPhone} onEmail={setEmail} />}</div><div className="flex justify-end gap-2 border-t border-border bg-background p-4"><Button type="button" variant="outline" className="min-h-11" onClick={close} disabled={saving}>Cancel</Button><Button type="submit" className="min-h-11" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button></div></form></DialogContent></Dialog>
  </>;
}