import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Download, FileText, FolderOpen, Lock } from "lucide-react";
import { format } from "date-fns";

interface PortalDocument {
  id: string;
  document_name: string;
  category: string;
  file_url: string;
  uploaded_at: string;
}

interface Props {
  documents: PortalDocument[];
  gfcRecords: any[];
  handover: any;
  scopeOfWork?: any;
}

const CATEGORIES = [
  { key: "Design", label: "Design Documents", icon: "📐" },
  { key: "Scope", label: "Scope of Work", icon: "📋" },
  { key: "Quality", label: "Quality", icon: "✅" },
  { key: "Handover", label: "Handover", icon: "🏠" },
];

export function ClientDocuments({ documents, gfcRecords, handover, scopeOfWork }: Props) {
  const fmtDate = (d: string | null) => d ? format(new Date(d), "dd/MM/yyyy") : "—";

  // Build auto-documents from GFC records etc.
  const autoDocuments: PortalDocument[] = [];

  // GFC Certificates
  for (const g of gfcRecords) {
    if (g.issued_at && g.pdf_url) {
      autoDocuments.push({
        id: `gfc-${g.id}`,
        document_name: `GFC Certificate — ${g.gfc_stage}`,
        category: "Design",
        file_url: g.pdf_url,
        uploaded_at: g.issued_at,
      });
    }
  }

  // Handover documents
  if (handover?.om_document_url) {
    autoDocuments.push({
      id: `handover-om-${handover.id}`,
      document_name: "O&M Manual",
      category: "Handover",
      file_url: handover.om_document_url,
      uploaded_at: handover.handover_date || handover.created_at,
    });
  }

  const allDocuments = [...autoDocuments, ...documents];

  const groupedDocs: Record<string, PortalDocument[]> = {};
  for (const cat of CATEGORIES) {
    groupedDocs[cat.key] = allDocuments.filter(d => d.category === cat.key);
  }

  const hasAny = allDocuments.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
          <FolderOpen className="h-4 w-4" /> Project Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAny ? (
          <div className="text-center py-6">
            <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-body text-muted-foreground">
              Documents will appear here as your project progresses.
            </p>
          </div>
        ) : (
          CATEGORIES.map((cat) => {
            const docs = groupedDocs[cat.key];
            if (docs.length === 0) return null;
            return (
              <div key={cat.key}>
                <p className="text-sm font-heading font-semibold text-foreground mb-2 flex items-center gap-2">
                  <span>{cat.icon}</span> {cat.label}
                </p>
                <div className="space-y-2">
                  {docs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-heading font-medium text-foreground truncate">
                            {doc.document_name}
                          </p>
                          <p className="text-[11px] font-body text-muted-foreground">
                            {fmtDate(doc.uploaded_at)}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-xs shrink-0 ml-2" asChild>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3 w-3 mr-1" /> Download
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
                <Separator className="mt-3" />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
