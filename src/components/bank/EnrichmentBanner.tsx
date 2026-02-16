import { Brain, CheckCircle2, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { EnrichmentProgress } from "@/services/postImportEnrichment";

interface EnrichmentBannerProps {
  progress: EnrichmentProgress | null;
}

export default function EnrichmentBanner({ progress }: EnrichmentBannerProps) {
  if (!progress || (progress.isComplete && progress.total === 0)) return null;

  const percentage = progress.total > 0
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3 text-sm">
      {progress.isComplete ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
      ) : (
        <Loader2 className="h-4 w-4 animate-spin text-purple-600 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="h-3.5 w-3.5 text-purple-600" />
          <span className="font-medium">
            {progress.isComplete ? "AI enrichment complete" : "Enriching unknown vendors..."}
          </span>
        </div>

        {!progress.isComplete && (
          <Progress value={percentage} className="h-1.5" />
        )}

        <p className="text-xs text-muted-foreground mt-1">
          {progress.isComplete
            ? `${progress.enriched} enriched, ${progress.skipped} skipped, ${progress.failed} failed`
            : `${progress.processed}/${progress.total} vendors processed`
          }
        </p>
      </div>
    </div>
  );
}
