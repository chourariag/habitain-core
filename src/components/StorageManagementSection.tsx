import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  projectId: string;
  projectName: string;
  cleanupEligible: boolean;
  storageCleaned: boolean;
  storageCleanedAt: string | null;
  storageCleanedByRole?: string | null;
  onRefresh?: () => void;
}

export function StorageManagementSection({
  projectId, projectName, cleanupEligible, storageCleaned, storageCleanedAt, storageCleanedByRole, onRefresh,
}: Props) {
  const [allowed, setAllowed] = useState(false);
  const [step1, setStep1] = useState(false);
  const [step2, setStep2] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [working, setWorking] = useState(false);
  const [lastLog, setLastLog] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await (supabase as any)
        .from("profiles").select("role").eq("auth_user_id", user.id).maybeSingle();
      const role = prof?.role;
      setAllowed(["managing_director", "super_admin", "head_of_projects"].includes(role));
    })();
    (async () => {
      const { data } = await (supabase as any)
        .from("project_storage_cleanup_log")
        .select("*").eq("project_id", projectId)
        .order("performed_at", { ascending: false }).limit(1).maybeSingle();
      setLastLog(data);
    })();
  }, [projectId]);

  if (!allowed) return null;

  const nameMatches = confirmName.trim().toLowerCase() === projectName.trim().toLowerCase();

  const runCleanup = async () => {
    setWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke("project-storage-cleanup", {
        body: { project_id: projectId, confirm_name: confirmName },
      });
      if (error) throw error;
      toast.success(`Storage cleaned. ${data?.files_deleted_count ?? 0} files removed.`);
      setStep1(false); setStep2(false); setConfirmName("");
      onRefresh?.();
    } catch (e: any) {
      toast.error(e?.message || "Cleanup failed");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Trash2 className="h-4 w-4" /> Storage Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {storageCleaned ? (
          <div className="rounded-md bg-muted p-3">
            Storage cleaned on <strong>{storageCleanedAt ? format(new Date(storageCleanedAt), "dd/MM/yyyy") : "—"}</strong>
            {storageCleanedByRole ? <> by {storageCleanedByRole}</> : null}. Archive available on Zoho Drive.
            {lastLog && <div className="text-muted-foreground mt-1">{lastLog.files_deleted_count} files removed across {Object.keys(lastLog.buckets_processed || {}).length} buckets.</div>}
          </div>
        ) : !cleanupEligible ? (
          <div className="rounded-md bg-amber-50 text-amber-900 p-3 flex gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <span>Storage cleanup is not yet available. Waiting for archive to be uploaded to Zoho Drive by Karthik.</span>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground">
              Permanently delete source photos &amp; media (site diary, factory photos, QC, NCR, chat). Drawings, handover documents, the cloud report, and the ZIP file are preserved.
            </p>
            <Button variant="destructive" onClick={() => setStep1(true)}>
              <Trash2 className="h-4 w-4 mr-2" /> Clean Up Storage
            </Button>
          </>
        )}

        {/* Step 1 */}
        <Dialog open={step1} onOpenChange={(o) => !working && setStep1(o)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Confirm cleanup</DialogTitle>
              <DialogDescription>
                This will permanently delete all source photos and media files for <strong>{projectName}</strong> from HStack storage.
              </DialogDescription>
            </DialogHeader>
            <ul className="text-sm space-y-1">
              <li>✅ Archive has been uploaded to Zoho Drive</li>
              <li>✅ ZIP download link remains available</li>
              <li>✅ Cloud report remains accessible</li>
            </ul>
            <p className="text-sm font-medium">This cannot be undone. Are you sure?</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep1(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => { setStep1(false); setStep2(true); }}>Yes, I Understand</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Step 2 */}
        <Dialog open={step2} onOpenChange={(o) => !working && (setStep2(o), o || setConfirmName(""))}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Type the project name to confirm</DialogTitle>
              <DialogDescription>
                Type <strong>{projectName}</strong> below to enable deletion.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={projectName}
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep2(false)} disabled={working}>Cancel</Button>
              <Button variant="destructive" disabled={!nameMatches || working} onClick={runCleanup}>
                {working ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Delete Source Files
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
