import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { buildSplit, splitMismatch, splitTotal, unitKey, type QuantityUnits, type SplitRow } from "@/lib/site-quantity-units";

const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 3 });

// Optional "Which unit?" split under a site BOQ quantity. Renders nothing when the line has no allocated units.
export function SiteQuantityUnits({ units, quantity, uom, readOnly, qtyChanged, onSave }: {
  units: QuantityUnits; quantity: number; uom: string; readOnly: boolean; qtyChanged: boolean;
  onSave: (split: SplitRow[]) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const savedKey = JSON.stringify(units.split);
  useEffect(() => {
    setInputs(Object.fromEntries(units.split.map(s => [unitKey(s), String(Number(s.qty))])));
    setError(null);
  }, [savedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (units.work_location !== "site" || units.allocated.length === 0) return null;
  const typed = units.allocated.reduce((n, a) => n + (Number(inputs[unitKey(a)]) || 0), 0);
  const warn = units.split.length > 0 && (qtyChanged || splitMismatch(units.split, quantity));
  const save = async () => {
    const res = buildSplit(units.allocated, inputs, quantity);
    if ("error" in res) { setError(res.error); return; }
    setBusy(true); setError(null);
    const ok = await onSave(res.split);
    setBusy(false);
    if (ok) setOpen(false);
  };

  return (
    <div className="min-w-0 space-y-2" data-testid="which-unit">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <Button type="button" size="sm" variant="ghost" className="h-11 px-2 text-xs" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <ChevronDown className="mr-1 h-3.5 w-3.5" /> : <ChevronRight className="mr-1 h-3.5 w-3.5" />}Which unit?
        </Button>
        {units.split.length === 0
          ? <span className="text-xs text-muted-foreground">Unit not stated</span>
          : <span className="text-xs text-muted-foreground break-words min-w-0">{units.split.map(s => `${s.unit_label}: ${fmt(Number(s.qty))}`).join(" · ")}</span>}
      </div>
      {warn && <p className="text-xs text-warning flex items-start gap-1"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /><span className="break-words">Unit split no longer matches the quantity</span></p>}
      {open && (
        <div className="rounded-md border border-border p-2 space-y-2 min-w-0">
          {units.allocated.map(a => (
            <div key={unitKey(a)} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_8rem] gap-1 sm:gap-2 sm:items-center min-w-0">
              <label className="text-sm break-words min-w-0" htmlFor={`unit-${units.quantity_id}-${a.unit_label}`}>
                {a.unit_label} <span className="text-xs text-muted-foreground">(allocated {fmt(Number(a.qty))} {uom})</span>
              </label>
              <Input id={`unit-${units.quantity_id}-${a.unit_label}`} className="h-11" inputMode="decimal" type="number" min={0} disabled={readOnly || busy}
                value={inputs[unitKey(a)] ?? ""} onChange={e => setInputs(s => ({ ...s, [unitKey(a)]: e.target.value }))} />
            </div>
          ))}
          <p className={`text-xs ${typed > quantity ? "text-destructive" : "text-muted-foreground"}`}>Unassigned: {fmt(quantity - typed)} {uom}</p>
          {error && <p className="text-xs text-destructive break-words">{error}</p>}
          {!readOnly && (
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => setInputs({})}>Clear</Button>
              <Button type="button" className="h-11" disabled={busy} onClick={save}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save units</Button>
            </div>
          )}
          {units.split.length > 0 && <p className="text-[11px] text-muted-foreground">Saved: {fmt(splitTotal(units.split))} of {fmt(quantity)} {uom}</p>}
        </div>
      )}
    </div>
  );
}
