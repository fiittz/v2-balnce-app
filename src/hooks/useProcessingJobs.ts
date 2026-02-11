import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type ProcessingJob = Database["public"]["Tables"]["processing_jobs"]["Row"];
type ProcessingJobInsert = Database["public"]["Tables"]["processing_jobs"]["Insert"];

export function useActiveJobs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["processing-jobs", "active", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("processing_jobs")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ProcessingJob[];
    },
    enabled: !!user?.id,
    refetchInterval: 5000, // 5s polling fallback
  });

  // Realtime subscription for updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("processing-jobs-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "processing_jobs",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["processing-jobs"] });
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
          queryClient.invalidateQueries({ queryKey: ["unmatched-transactions"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return query;
}

export function useCreateJob() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobData: Omit<ProcessingJobInsert, "user_id">) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Insert job record
      const { data: job, error: insertError } = await supabase
        .from("processing_jobs")
        .insert({ ...jobData, user_id: user.id })
        .select()
        .single();

      if (insertError) throw insertError;

      // Invoke the edge function
      const { error: invokeError } = await supabase.functions.invoke(
        "process-job-worker",
        { body: { job_id: job.id } }
      );

      if (invokeError) {
        console.error("Failed to invoke worker:", invokeError);
        // Don't throw — the job is created, the worker can be retried
      }

      return job as ProcessingJob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processing-jobs"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create processing job");
    },
  });
}

export function useJobProgress(jobId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["processing-jobs", "progress", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const { data, error } = await supabase
        .from("processing_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (error) throw error;
      return data as ProcessingJob;
    },
    enabled: !!jobId,
    refetchInterval: 5000,
  });

  // Realtime subscription for this specific job
  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "processing_jobs",
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          queryClient.setQueryData(
            ["processing-jobs", "progress", jobId],
            payload.new
          );
          queryClient.invalidateQueries({ queryKey: ["processing-jobs", "active"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, queryClient]);

  return query;
}

export function useCancelJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from("processing_jobs")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", jobId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processing-jobs"] });
      toast.info("Job cancelled");
    },
  });
}
