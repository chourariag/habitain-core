import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, X } from "lucide-react";
import { format } from "date-fns";

interface JournalEntry {
  id: string;
  note: string;
  photo_url: string | null;
  entry_date: string;
  shared_by: string | null;
}

interface Props {
  entries: JournalEntry[];
}

export function ConstructionJournal({ entries }: Props) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!entries.length) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Construction Journal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="flex gap-3 p-3 rounded-lg border">
              {entry.photo_url && (
                <button
                  onClick={() => setLightboxUrl(entry.photo_url)}
                  className="h-14 w-14 rounded overflow-hidden border border-border shrink-0 hover:ring-2 hover:ring-primary"
                >
                  <img src={entry.photo_url} alt="Site" className="h-full w-full object-cover" />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-heading font-semibold text-muted-foreground">
                  {format(new Date(entry.entry_date), "dd/MM/yyyy")}
                </p>
                <p className="text-sm font-body text-foreground mt-0.5">{entry.note}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {lightboxUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2" onClick={() => setLightboxUrl(null)}>
            <X className="h-5 w-5" />
          </button>
          <img src={lightboxUrl} alt="Site photo" className="max-h-[85vh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
