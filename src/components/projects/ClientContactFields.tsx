import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function ClientContactFields({ phone, email, onPhone, onEmail }: { phone: string; email: string; onPhone: (value: string) => void; onEmail: (value: string) => void }) {
  return <fieldset className="min-w-0 space-y-3"><legend className="mb-3 font-display font-semibold">Client contact</legend>
    <div className="space-y-1.5"><Label htmlFor="client-phone">Client phone *</Label><Input id="client-phone" type="tel" autoComplete="off" required value={phone} onChange={e => onPhone(e.target.value)} placeholder="+91XXXXXXXXXX" /></div>
    <div className="space-y-1.5"><Label htmlFor="client-email">Client email *</Label><Input id="client-email" type="email" autoComplete="off" required value={email} onChange={e => onEmail(e.target.value)} /></div>
    <p className="text-xs text-muted-foreground">Visible to directors only after saving.</p>
  </fieldset>;
}