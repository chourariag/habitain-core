import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, Camera, X } from "lucide-react";
import { format } from "date-fns";

const CLIENT_MILESTONES = [
  "Production Start", "Foundation Confirmed", "Frame Erected", "Shell Complete",
  "Boarding Complete", "Flooring Done", "Delivery from Factory", "Site Erection",
  "Builder Finish", "Handover",
];

interface MilestonePhoto {
  id: string;
  milestone_name: string;
  photo_url: string;
  completed_at: string | null;
}

interface Props {
  photos: MilestonePhoto[];
  projectStartDate?: string | null;
}

export function MilestoneTimeline({ photos, projectStartDate }: Props) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const photosByMilestone: Record<string, MilestonePhoto[]> = {};
  for (const p of photos) {
    if (!photosByMilestone[p.milestone_name]) photosByMilestone[p.milestone_name] = [];
    photosByMilestone[p.milestone_name].push(p);
  }

  // Find the latest completed milestone
  let latestIdx = -1;
  CLIENT_MILESTONES.forEach((m, idx) => {
    if (photosByMilestone[m]?.length) latestIdx = idx;
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
            <Camera className="h-4 w-4" /> Build Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 overflow-x-auto pb-3 -mx-2 px-2 snap-x snap-mandatory">
            {CLIENT_MILESTONES.map((milestone, idx) => {
              const milestonePhotos = photosByMilestone[milestone] || [];
              const isComplete = milestonePhotos.length > 0;
              const isLatest = idx === latestIdx;
              const isFuture = idx > latestIdx;
              const completedDate = milestonePhotos[0]?.completed_at;

              return (
                <div
                  key={milestone}
                  className={`shrink-0 w-[160px] snap-start rounded-lg border-2 p-3 space-y-2 transition-colors ${
                    isLatest ? "border-primary bg-primary/5" :
                    isComplete ? "border-border bg-background" :
                    "border-dashed border-muted bg-muted/30"
                  }`}
                >
                  {/* Status icon */}
                  <div className="flex items-center gap-2">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isComplete ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {isComplete ? <Check className="h-3.5 w-3.5" /> : <Clock className="h-3 w-3" />}
                    </div>
                    {isLatest && <Badge className="text-[9px] bg-primary text-primary-foreground h-4 px-1.5">Latest</Badge>}
                  </div>

                  {/* Milestone name */}
                  <p className={`text-xs font-heading font-semibold leading-tight ${
                    isFuture ? "text-muted-foreground" : "text-foreground"
                  }`}>
                    {milestone}
                  </p>

                  {/* Date */}
                  {completedDate && (
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(completedDate), "dd MMM yyyy")}
                    </p>
                  )}

                  {/* Photo thumbnails */}
                  {milestonePhotos.length > 0 ? (
                    <div className="flex gap-1">
                      {milestonePhotos.slice(0, 3).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setLightboxUrl(p.photo_url)}
                          className="h-12 w-12 rounded overflow-hidden border border-border hover:ring-2 hover:ring-primary transition-shadow"
                        >
                          <img src={p.photo_url} alt={milestone} className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="h-12 flex items-center">
                      <span className="text-[10px] text-muted-foreground italic">
                        {isFuture ? "Upcoming" : "No photos yet"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Milestone photo"
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
