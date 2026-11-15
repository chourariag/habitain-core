import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, KeyRound, Loader2, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

type Run = { id: string; run_at: string; status: string; trigger: string; row_counts: unknown; error: string | null };
type Token = { id: string; label: string; created_at: string; last_used_at: string | null; expires_at: string; revoked_at: string | null };
type Sizes = { database_bytes: number | null; buckets: { id: string; files: number; bytes: number }[] };
const date = (value: string) => new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' });

export function ExportsPanel() {
  const { isEnabled } = useFeatureFlags();
  const enabled = isEnabled('exports');
  const [runs, setRuns] = useState<Run[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [sizes, setSizes] = useState<Sizes | null>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState('');
  const [expiryDays, setExpiryDays] = useState(180);
  const [shownToken, setShownToken] = useState<string | null>(null);
  const load = async () => {
    const [{ data, error }, admin] = await Promise.all([
      supabase.from('export_log').select('id,run_at,status,trigger,row_counts,error').order('run_at', { ascending: false }).limit(7),
      supabase.functions.invoke('export-admin', { body: { action: 'status' } }),
    ]);
    if (error || admin.error) { toast.error('Export history could not be loaded'); return; }
    setRuns(data ?? []); setTokens(admin.data.tokens ?? []); setSizes(admin.data.sizes ?? null);
  };
  useEffect(() => { if (enabled) void load(); }, [enabled]);
  if (!enabled) return null;
  const action = async (fn: string, body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error || data?.error) throw new Error(data?.error ?? 'Request failed');
      if (data?.token) { setShownToken(data.token); setLabel(''); }
      else toast.success(fn === 'export-nightly' ? 'Export completed' : 'Token revoked');
      await load();
    } catch { toast.error('Export request failed; refresh the run history for its status'); }
    finally { setBusy(false); }
  };
  return <section className="min-w-0 space-y-4 border-t border-border pt-6" aria-label="Exports">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display text-lg font-bold">Exports</h2>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="icon" aria-label="Refresh exports" title="Refresh exports" onClick={() => void load()} disabled={busy}><RefreshCw className="h-4 w-4" /></Button>
        <Button onClick={() => void action('export-nightly', { trigger: 'manual' })} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Export Now</Button>
      </div>
    </div>
    <ul className="divide-y divide-border">
      {runs.map(run => <li key={run.id} className="min-w-0 space-y-2 py-3 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><span>{date(run.run_at)} · {run.trigger}</span><strong>{run.status}</strong></div>
        <dl className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-2">{Object.entries((run.row_counts ?? {}) as Record<string, number>).map(([name, count]) => <div key={name} className="flex min-w-0 justify-between gap-3"><dt className="break-all text-muted-foreground">{name}</dt><dd className="shrink-0">{count}</dd></div>)}</dl>
        {run.error && <p className="break-words text-destructive">{run.error}</p>}
      </li>)}
      {!runs.length && <li className="py-3 text-sm text-muted-foreground">No export runs</li>}
    </ul>
    <h3 className="font-semibold">Storage</h3>
    <p className="text-sm">Database: {sizes?.database_bytes == null ? 'not visible' : `${(sizes.database_bytes / 1e9).toFixed(6)} GB`}</p>
    <ul className="divide-y divide-border text-sm">{sizes?.buckets.map(bucket => <li key={bucket.id} className="flex min-w-0 flex-wrap justify-between gap-2 py-2"><span className="break-all">{bucket.id}</span><span>{bucket.files} files · {(bucket.bytes / 1e9).toFixed(6)} GB</span></li>)}</ul>
    <h3 className="font-semibold">Dashboard tokens</h3>
    <div className="flex flex-wrap items-end gap-2"><Input aria-label="Token label" placeholder="Token label" value={label} maxLength={100} onChange={event => setLabel(event.target.value)} className="min-w-0 flex-1" /><label className="text-xs text-muted-foreground">Expires in days<Input aria-label="Token expiry days" type="number" min={1} max={365} value={expiryDays} onChange={event => setExpiryDays(Number(event.target.value))} className="mt-1 w-24" /></label><Button disabled={busy || !label.trim() || !Number.isInteger(expiryDays) || expiryDays < 1 || expiryDays > 365} onClick={() => void action('export-admin', { action: 'create', label, expires_in_days: expiryDays })}><KeyRound className="mr-2 h-4 w-4" />Create token</Button></div>
    {shownToken && <div className="min-w-0 space-y-2 border border-border p-3"><div className="flex justify-between gap-2"><strong className="text-sm">Token · shown once</strong><Button variant="ghost" size="icon" aria-label="Dismiss token" onClick={() => setShownToken(null)}><X className="h-4 w-4" /></Button></div><Input aria-label="New dashboard token" readOnly value={shownToken} /><Button variant="outline" onClick={() => void navigator.clipboard.writeText(shownToken).then(() => toast.success('Token copied')).catch(() => toast.error('Copy unavailable'))}>Copy token</Button></div>}
    <ul aria-label="Dashboard token list" className="divide-y divide-border">{tokens.map(token => <li key={token.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0 space-y-1"><p className="break-all text-sm font-medium">{token.label}</p><p className="text-xs text-muted-foreground">Created {date(token.created_at)}</p><p className="text-xs text-muted-foreground">Last used {token.last_used_at ? date(token.last_used_at) : 'Never'}</p><p className="text-xs text-muted-foreground">Expires {date(token.expires_at)}</p>{token.revoked_at && <p className="text-xs text-muted-foreground">Revoked {date(token.revoked_at)}</p>}</div>{!token.revoked_at && <Button variant="outline" disabled={busy} onClick={() => void action('export-admin', { action: 'revoke', id: token.id })}>Revoke</Button>}</li>)}</ul>
  </section>;
}