import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KeyRound, RefreshCw, Copy, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const ADMIN_ROLES = ["super_admin", "managing_director"];
const VIEW_ROLES = [...ADMIN_ROLES, "finance_manager"];

type StatusResp = {
  configured: boolean;
  key: { id: string; key_prefix: string; created_at: string; last_used_at: string | null } | null;
};

export function TallyIngestionKeySection() {
  const { role } = useUserRole();
  const canView = role && VIEW_ROLES.includes(role);
  const canRotate = role && ADMIN_ROLES.includes(role);

  const [status, setStatus] = useState<StatusResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const endpointUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/tally-ingest`;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("tally-key-manage", {
      body: { action: "status" },
    });
    if (error) toast.error("Could not load key status");
    else setStatus(data as StatusResp);
    setLoading(false);
  };

  useEffect(() => { if (canView) load(); }, [canView]);

  const rotate = async () => {
    setRotating(true);
    const { data, error } = await supabase.functions.invoke("tally-key-manage", {
      body: { action: "rotate" },
    });
    setRotating(false);
    setConfirmOpen(false);
    if (error) { toast.error("Rotation failed"); return; }
    const key = (data as any)?.apiKey as string | undefined;
    if (!key) { toast.error("No key returned"); return; }
    setNewKey(key);
    setCopied(false);
    toast.success("New API key generated");
    load();
  };

  const copy = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    toast.success("Copied to clipboard");
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(endpointUrl);
    setUrlCopied(true);
    toast.success("Endpoint URL copied");
    setTimeout(() => setUrlCopied(false), 2000);
  };

  if (!canView) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ color: "#1A1A1A" }}>
          <KeyRound className="h-4 w-4" style={{ color: "#006039" }} />
          Tally Integration — Incoming API Key
        </CardTitle>
        <p className="text-xs mt-1" style={{ color: "#666" }}>
          Used by Tally to push data into HStack via <code>POST /functions/v1/tally-ingest</code>
          with header <code>X-API-Key</code>. The key value is only shown once at generation.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm">Status:</span>
          {loading ? (
            <Badge variant="outline">Checking…</Badge>
          ) : status?.configured ? (
            <>
              <Badge style={{ backgroundColor: "#006039", color: "#fff" }}>Configured</Badge>
              <code className="text-xs bg-muted px-2 py-1 rounded">{status.key?.key_prefix}</code>
              <span className="text-xs text-muted-foreground">
                Created {status.key ? new Date(status.key.created_at).toLocaleString("en-IN") : ""}
                {status.key?.last_used_at && ` · Last used ${new Date(status.key.last_used_at).toLocaleString("en-IN")}`}
              </span>
            </>
          ) : (
            <Badge style={{ backgroundColor: "#F40009", color: "#fff" }}>Not configured</Badge>
          )}
        </div>

        {canRotate && (
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={rotating}
            className="gap-2"
            style={{ backgroundColor: "#006039" }}
          >
            <RefreshCw className={`h-4 w-4 ${rotating ? "animate-spin" : ""}`} />
            {status?.configured ? "Rotate Key" : "Generate Key"}
          </Button>
        )}
      </CardContent>

      {/* Confirm rotate */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" style={{ color: "#D4860A" }} />
              {status?.configured ? "Rotate Tally API Key?" : "Generate Tally API Key?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {status?.configured
              ? "The current key will be revoked immediately. Any Tally client still using it will fail until you share the new key."
              : "A new API key will be generated. Share it with the Tally team securely — it is shown only once."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={rotate} disabled={rotating} style={{ backgroundColor: "#006039" }}>
              {status?.configured ? "Rotate" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal new key */}
      <Dialog open={!!newKey} onOpenChange={(o) => { if (!o) setNewKey(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Tally API Key</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Copy this now — it will not be shown again. Share it with the Tally team over a secure channel.
          </p>
          <div className="flex items-center gap-2 rounded border bg-muted/40 p-3">
            <code className="text-xs break-all flex-1">{newKey}</code>
            <Button size="sm" variant="outline" onClick={copy} className="gap-1 shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
