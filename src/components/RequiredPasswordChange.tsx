import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeAccountPassword } from "@/lib/change-password";
import { LockKeyhole, LogOut, Loader2 } from "lucide-react";

export function RequiredPasswordChange({ onSuccess, signOut, recovery = false }: { onSuccess: () => Promise<void>; signOut: () => Promise<void>; recovery?: boolean }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return <main className="min-h-dvh bg-background flex items-center justify-center p-4">
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-3"><LockKeyhole className="h-8 w-8 text-primary" /><h1 className="font-display text-2xl font-bold">Set a new password</h1></div>
      <form className="space-y-4" onSubmit={async e => {
        e.preventDefault(); setError("");
        if (password !== confirm) { setError("Passwords do not match"); return; }
        setSaving(true);
        try { await changeAccountPassword(password, recovery ? undefined : current, recovery); setCurrent(""); setPassword(""); setConfirm(""); await onSuccess(); }
        catch (err) { setError(err instanceof Error ? err.message : "Unable to change password"); }
        finally { setSaving(false); }
      }}>
        {!recovery && <div className="space-y-2"><Label htmlFor="required-current">Current password</Label><Input id="required-current" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required /></div>}
        <div className="space-y-2"><Label htmlFor="required-new">New password</Label><Input id="required-new" type="password" autoComplete="new-password" minLength={10} value={password} onChange={e => setPassword(e.target.value)} required /></div>
        <div className="space-y-2"><Label htmlFor="required-confirm">Confirm new password</Label><Input id="required-confirm" type="password" autoComplete="new-password" minLength={10} value={confirm} onChange={e => setConfirm(e.target.value)} required /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full min-h-11" disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Set new password</Button>
      </form>
      <Button variant="ghost" className="w-full" onClick={() => void signOut()}><LogOut className="h-4 w-4 mr-2" />Sign out</Button>
    </div>
  </main>;
}