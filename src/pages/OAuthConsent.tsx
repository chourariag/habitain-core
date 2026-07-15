import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Loader2 } from "lucide-react";

// Typed wrapper around the beta supabase.auth.oauth namespace.
type OAuthResult = {
  data: {
    client?: { name?: string; client_name?: string; redirect_uris?: string[] } | null;
    scope?: string;
    redirect_url?: string;
    redirect_to?: string;
  } | null;
  error: { message: string } | null;
};
const oauthApi = () => (supabase.auth as unknown as {
  oauth: {
    getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
    approveAuthorization: (id: string) => Promise<OAuthResult>;
    denyAuthorization: (id: string) => Promise<OAuthResult>;
  };
}).oauth;

function isSameOriginPath(next: string | null): next is string {
  if (!next) return false;
  try {
    const u = new URL(next, window.location.origin);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthResult["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id in the URL.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        // Preserve the FULL consent URL so the login flow returns here.
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      setSignedInEmail(sess.session.user.email ?? null);
      const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("The authorization server did not return a redirect URL.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "an application";
  const redirectUri = details?.client?.redirect_uris?.[0];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <Logo size="lg" />
        </div>
        <div className="bg-card border border-border rounded-lg shadow-card p-6 space-y-5">
          {error ? (
            <>
              <h1 className="text-lg font-bold">Could not load this authorization request</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
              <p className="text-xs text-muted-foreground">
                Ask the client app to restart the connection.
              </p>
            </>
          ) : !details ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading authorization details…
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-lg font-bold leading-snug">
                  Connect {clientName} to HStack
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  This lets {clientName} use HStack as you. It can only see and
                  do what your HStack account is already allowed to.
                </p>
              </div>
              <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-4">
                <div>
                  <span className="font-medium text-foreground">Signed in as: </span>
                  {signedInEmail ?? "unknown"}
                </div>
                {redirectUri && (
                  <div className="truncate">
                    <span className="font-medium text-foreground">Redirect: </span>
                    <span className="font-mono">{redirectUri}</span>
                  </div>
                )}
                <div>
                  This does not bypass HStack's role or row-level security
                  policies.
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => decide(false)}
                >
                  Cancel connection
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => decide(true)}
                >
                  {busy ? "Working…" : `Approve ${clientName}`}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Exported for tests / imports elsewhere
export { isSameOriginPath };
