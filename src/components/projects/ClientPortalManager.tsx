import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { Link2, RefreshCw, X, Globe, Copy } from "lucide-react";

interface Props {
  projectId: string;
  userRole: string | null;
}

const MANAGE_ROLES = [
  "super_admin", "managing_director", "finance_director",
  "sales_director", "site_installation_manager", "sales_executive",
];

export function ClientPortalManager({ projectId, userRole }: Props) {
  const [portalToken, setPortalToken] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const canManage = MANAGE_ROLES.includes(userRole ?? "");
  const canRevoke = ["super_admin", "managing_director", "finance_director", "sales_director"].includes(userRole ?? "");

  useEffect(() => {
    supabase
      .from("projects")
      .select("client_portal_token, client_portal_enabled, client_portal_expires_at, client_portal_status_message")
      .eq("id", projectId)
      .single()
      .then(({ data }) => {
        if (data) {
          setPortalToken(data.client_portal_token);
          setEnabled(data.client_portal_enabled ?? false);
          setExpiresAt(data.client_portal_expires_at);
          setStatusMsg(data.client_portal_status_message ?? "");
        }
      });
  }, [projectId]);

  if (!canManage) return null;

  const generateToken = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let i = 0; i < 32; i++) token += chars[Math.floor(Math.random() * chars.length)];
    return token;
  };

  const portalUrl = portalToken
    ? `${window.location.origin}/client/${portalToken}`
    : null;

  const handleGenerate = async () => {
    setLoading(true);
    const token = generateToken();
    const expires = addDays(new Date(), 30).toISOString();
    const { error } = await supabase
      .from("projects")
      .update({
        client_portal_token: token,
        client_portal_enabled: true,
        client_portal_expires_at: expires,
      } as any)
      .eq("id", projectId);

    if (error) {
      toast.error("Failed to generate portal link");
    } else {
      setPortalToken(token);
      setEnabled(true);
      setExpiresAt(expires);
      toast.success("Client portal link generated");
    }
    setLoading(false);
  };

  const handleRenew = async () => {
    setLoading(true);
    const expires = addDays(new Date(), 30).toISOString();
    const { error } = await supabase
      .from("projects")
      .update({ client_portal_expires_at: expires } as any)
      .eq("id", projectId);

    if (error) {
      toast.error("Failed to renew");
    } else {
      setExpiresAt(expires);
      toast.success("Portal link renewed for 30 days");
    }
    setLoading(false);
  };

  const handleRevoke = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("projects")
      .update({ client_portal_enabled: false } as any)
      .eq("id", projectId);

    if (error) {
      toast.error("Failed to revoke");
    } else {
      setEnabled(false);
      toast.success("Client portal access revoked");
    }
    setLoading(false);
  };

  const handleSaveStatus = async () => {
    const { error } = await supabase
      .from("projects")
      .update({ client_portal_status_message: statusMsg } as any)
      .eq("id", projectId);

    if (error) {
      toast.error("Failed to save status");
    } else {
      toast.success("Client status message updated");
    }
  };

  const copyLink = () => {
    if (portalUrl) {
      navigator.clipboard.writeText(portalUrl);
      toast.success("Link copied to clipboard");
    }
  };

  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-sm font-bold flex items-center gap-2">
            <Globe className="h-4 w-4" /> Client Portal
          </CardTitle>
          {enabled && !isExpired && (
            <Badge className="bg-primary text-primary-foreground text-xs">Active</Badge>
          )}
          {enabled && isExpired && (
            <Badge variant="outline" className="text-warning text-xs">Expired</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!portalToken ? (
          <Button size="sm" onClick={handleGenerate} disabled={loading}>
            <Link2 className="h-3.5 w-3.5 mr-1" /> Generate Magic Link
          </Button>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-body">
                {portalUrl}
              </code>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copyLink}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>

            {expiresAt && (
              <p className="text-xs font-body text-muted-foreground">
                Expires: {format(new Date(expiresAt), "dd/MM/yyyy")}
              </p>
            )}

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleRenew} disabled={loading}>
                <RefreshCw className="h-3 w-3 mr-1" /> Renew 30d
              </Button>
              {canRevoke && (
                <Button size="sm" variant="destructive" onClick={handleRevoke} disabled={loading}>
                  <X className="h-3 w-3 mr-1" /> Revoke
                </Button>
              )}
            </div>

            <Textarea
              placeholder="Status message shown to client, e.g. 'Your modules are in the finishing stage.'"
              value={statusMsg}
              onChange={(e) => setStatusMsg(e.target.value)}
              className="text-sm h-16"
            />
            <Button size="sm" variant="outline" onClick={handleSaveStatus}>
              Save Status Message
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
