import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";

export type AccountCredential = { email: string; password: string };
export function AccountCredentials({ credentials, onClose }: { credentials: AccountCredential[]; onClose: () => void }) {
  return <Dialog open={credentials.length > 0} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[85dvh] overflow-auto">
      <DialogHeader><DialogTitle>New temporary passwords</DialogTitle></DialogHeader>
      {credentials.map(row => <div key={row.email} className="space-y-2 border-b border-border pb-3">
        <p className="text-sm break-all">{row.email}</p>
        <p className="font-mono text-sm break-all">{row.password}</p>
        <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(row.password)}><Copy className="h-4 w-4 mr-2" />Copy</Button>
      </div>)}
      <div className="flex flex-wrap gap-2">
        {<Button variant="outline" onClick={() => {
          const csv = [["Email", "Temporary password"], ...credentials.map(c => [c.email, c.password])].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
          const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
          const link = document.createElement("a"); link.href = url; link.download = "hstack-new-account-credentials.csv"; link.click(); URL.revokeObjectURL(url);
        }}><Download className="h-4 w-4 mr-2" />Download CSV</Button>}
        <Button onClick={onClose}>Done</Button>
      </div>
    </DialogContent>
  </Dialog>;
}