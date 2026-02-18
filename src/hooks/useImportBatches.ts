import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface ImportBatch {
  id: string;
  user_id: string;
  filename: string | null;
  row_count: number | null;
  created_at: string | null;
  status: string | null;
  account_id: string | null;
}

export const useImportBatches = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["import-batches", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("import_batches")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ImportBatch[];
    },
    enabled: !!user?.id,
  });
};

export const useCreateImportBatch = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<ImportBatch, Error, { filename?: string; row_count?: number }>({
    mutationFn: async (batch: { filename?: string; row_count?: number }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("import_batches")
        .insert({
          user_id: user.id,
          filename: batch.filename || null,
          row_count: batch.row_count || 0,
          status: "completed",
        })
        .select()
        .single();

      if (error) throw error;
      return data as ImportBatch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
    },
  });
};

export const useDeleteImportBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchId: string) => {
      // Unlink receipts from transactions in this batch
      const { data: batchTxIds } = await supabase
        .from("transactions")
        .select("id")
        .eq("import_batch_id", batchId);

      if (batchTxIds?.length) {
        await supabase
          .from("receipts")
          .update({ transaction_id: null })
          .in("transaction_id", batchTxIds.map((t) => t.id));
      }

      // Delete transactions first (they reference import_batches via FK)
      const { error: txError } = await supabase
        .from("transactions")
        .delete()
        .eq("import_batch_id", batchId);

      if (txError) throw txError;

      // Then delete the batch (now safe, no FK references)
      const { error } = await supabase
        .from("import_batches")
        .delete()
        .eq("id", batchId);

      if (error) throw error;
      return batchId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["unmatched-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["vat-summary"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Import batch deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete batch");
    },
  });
};

export const useBulkDeleteImportBatches = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchIds: string[]) => {
      // Unlink receipts from transactions in these batches
      const { data: batchTxIds } = await supabase
        .from("transactions")
        .select("id")
        .in("import_batch_id", batchIds);

      if (batchTxIds?.length) {
        await supabase
          .from("receipts")
          .update({ transaction_id: null })
          .in("transaction_id", batchTxIds.map((t) => t.id));
      }

      // Delete transactions first (they reference import_batches via FK)
      const { error: txError } = await supabase
        .from("transactions")
        .delete()
        .in("import_batch_id", batchIds);

      if (txError) throw txError;

      // Then delete the batches (now safe, no FK references)
      const { error } = await supabase
        .from("import_batches")
        .delete()
        .in("id", batchIds);

      if (error) throw error;
      return batchIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["unmatched-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["vat-summary"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(`Deleted ${count} import batch${count !== 1 ? "es" : ""}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete batches");
    },
  });
};
