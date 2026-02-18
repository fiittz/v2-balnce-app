import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, X, Upload, Tag, Link2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useActiveJobs, useCancelJob } from "@/hooks/useProcessingJobs";

const JOB_TYPE_LABELS: Record<string, { label: string; icon: typeof Upload; route: string }> = {
  receipt_ocr: { label: "receipts", icon: Upload, route: "/receipts" },
  categorization: { label: "transactions", icon: Tag, route: "/bank" },
  matching: { label: "receipts", icon: Link2, route: "/bank" },
};

export default function JobProgressIndicator() {
  const navigate = useNavigate();
  const { data: activeJobs } = useActiveJobs();
  const cancelJob = useCancelJob();
  const [dismissedJobs, setDismissedJobs] = useState<Set<string>>(new Set());
  const [completedTimers, setCompletedTimers] = useState<Map<string, NodeJS.Timeout>>(new Map());

  // Auto-dismiss completed jobs after 5 seconds
  useEffect(() => {
    if (!activeJobs) return;

    activeJobs.forEach((job) => {
      if (job.status === "completed" && !completedTimers.has(job.id)) {
        const timer = setTimeout(() => {
          setDismissedJobs((prev) => new Set([...prev, job.id]));
          setCompletedTimers((prev) => {
            const next = new Map(prev);
            next.delete(job.id);
            return next;
          });
        }, 5000);

        setCompletedTimers((prev) => new Map([...prev, [job.id, timer]]));
      }
    });

    return () => {
      completedTimers.forEach((timer) => clearTimeout(timer));
    };
  }, [activeJobs, completedTimers]);

  const visibleJobs = activeJobs?.filter((j) => !dismissedJobs.has(j.id)) || [];

  if (visibleJobs.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs">
      {visibleJobs.map((job) => {
        const config = JOB_TYPE_LABELS[job.job_type] || {
          label: "items",
          icon: Loader2,
          route: "/",
        };
        const Icon = config.icon;
        const progress = job.total_items > 0 ? Math.round((job.processed_items / job.total_items) * 100) : 0;
        const isComplete = job.status === "completed";
        const isFailed = job.status === "failed";

        return (
          <div
            key={job.id}
            onClick={() => navigate(config.route)}
            className={`bg-card border rounded-xl p-3 shadow-lg cursor-pointer hover:shadow-xl transition-shadow animate-in slide-in-from-right-4 fade-in duration-200 ${
              isComplete ? "border-green-200" : isFailed ? "border-red-200" : "border-border"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isComplete ? "bg-green-100" : isFailed ? "bg-red-100" : "bg-primary/10"
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : isFailed ? (
                  <X className="w-4 h-4 text-red-600" />
                ) : (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {isComplete
                    ? `Done — ${job.processed_items} ${config.label}`
                    : isFailed
                      ? `Failed — ${job.error_message || "Unknown error"}`
                      : `Processing ${job.processed_items}/${job.total_items} ${config.label}...`}
                </p>
                {!isComplete && !isFailed && <Progress value={progress} className="h-1.5 mt-1.5" />}
              </div>

              {!isComplete && !isFailed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelJob.mutate(job.id);
                  }}
                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {(isComplete || isFailed) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDismissedJobs((prev) => new Set([...prev, job.id]));
                  }}
                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
