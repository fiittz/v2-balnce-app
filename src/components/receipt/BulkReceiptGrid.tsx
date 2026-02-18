import { useState, useMemo } from "react";
import { CheckCircle2, XCircle, Loader2, Search, Trash2, FileImage, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReceiptImageViewer } from "@/components/receipt/ReceiptImageViewer";
import { supabase } from "@/integrations/supabase/client";
import type { BulkReceiptFile } from "@/hooks/useBulkReceiptUpload";

interface BulkReceiptGridProps {
  files: BulkReceiptFile[];
  onRemove: (fileId: string) => void;
  onManualMatch: (fileId: string, transactionId: string) => void;
  phase: string;
}

interface TransactionCandidate {
  id: string;
  amount: number;
  description: string;
  transaction_date: string;
}

function StatusBadge({ status }: { status: BulkReceiptFile["status"] }) {
  switch (status) {
    case "matched":
      return (
        <Badge className="bg-green-500/15 text-green-700 border-green-200 gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Matched
        </Badge>
      );
    case "not_matched":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="w-3 h-3" />
          Not Matched
        </Badge>
      );
    case "processing":
    case "matching":
      return (
        <Badge className="bg-blue-500/15 text-blue-700 border-blue-200 gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          {status === "processing" ? "Processing" : "Matching"}
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="w-3 h-3" />
          Error
        </Badge>
      );
    case "queued":
      return (
        <Badge variant="secondary" className="gap-1">
          Queued
        </Badge>
      );
    case "done":
      return <Badge className="bg-blue-500/15 text-blue-700 border-blue-200 gap-1">OCR Done</Badge>;
    default:
      return null;
  }
}

function ManualMatchDialog({
  open,
  onOpenChange,
  file,
  userId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: BulkReceiptFile | null;
  userId: string;
  onSelect: (transactionId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<TransactionCandidate[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);

    try {
      let query = supabase
        .from("transactions")
        .select("id, amount, description, transaction_date")
        .eq("user_id", userId)
        .is("receipt_url", null)
        .order("transaction_date", { ascending: false })
        .limit(20);

      // Search by description or amount
      const asNumber = parseFloat(search);
      if (!isNaN(asNumber)) {
        // Search by amount (negative for expenses)
        query = query.or(`amount.eq.${asNumber},amount.eq.${-asNumber}`);
      } else {
        query = query.ilike("description", `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setResults(data || []);
    } catch (err) {
      console.error("Search error:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Transaction</DialogTitle>
        </DialogHeader>

        {file?.receiptData && (
          <div className="text-sm text-muted-foreground mb-2">
            Receipt: {file.receiptData.supplier_name || "Unknown vendor"} - {file.receiptData.total_amount?.toFixed(2)}{" "}
            EUR
            {file.receiptData.date ? ` on ${file.receiptData.date}` : ""}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="Search by description or amount..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={loading} size="sm">
            <Search className="w-4 h-4" />
          </Button>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-2 mt-2">
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}

          {!loading && results.length === 0 && search && (
            <p className="text-sm text-muted-foreground text-center py-4">No unlinked transactions found</p>
          )}

          {results.map((tx) => (
            <button
              key={tx.id}
              className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
              onClick={() => {
                onSelect(tx.id);
                onOpenChange(false);
                setSearch("");
                setResults([]);
              }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-sm">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">{tx.transaction_date}</p>
                </div>
                <span className="font-mono text-sm font-medium">{Math.abs(tx.amount).toFixed(2)} EUR</span>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BulkReceiptGrid({ files, onRemove, onManualMatch, phase }: BulkReceiptGridProps) {
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<BulkReceiptFile | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [viewerFile, setViewerFile] = useState<BulkReceiptFile | null>(null);

  // Create stable object URLs for files without imageUrl (pre-upload)
  const localUrls = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of files) {
      if (!f.imageUrl && f.file.type.startsWith("image/")) {
        map.set(f.id, URL.createObjectURL(f.file));
      }
    }
    return map;
  }, [files]);

  const getViewableUrl = (f: BulkReceiptFile): string | null => {
    if (f.file.type === "application/pdf") return null;
    return f.imageUrl || localUrls.get(f.id) || null;
  };

  // Grab user id from first file's receipt or from supabase
  const openManualMatch = async (file: BulkReceiptFile) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
    setSelectedFile(file);
    setMatchDialogOpen(true);
  };

  if (files.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {files.map((f) => (
          <div key={f.id} className="border rounded-xl p-3 space-y-2 bg-card">
            {/* Thumbnail + filename */}
            <div className="flex items-center gap-3">
              {(() => {
                const viewUrl = getViewableUrl(f);
                const thumbContent = viewUrl ? (
                  <img src={viewUrl} alt="" className="w-full h-full object-cover" />
                ) : f.file.type === "application/pdf" ? (
                  <FileText className="w-6 h-6 text-red-500" />
                ) : (
                  <FileImage className="w-6 h-6 text-muted-foreground" />
                );

                return viewUrl ? (
                  <button
                    type="button"
                    onClick={() => setViewerFile(f)}
                    className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary transition-shadow"
                  >
                    {thumbContent}
                  </button>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {thumbContent}
                  </div>
                );
              })()}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.file.name}</p>
                {f.receiptData?.supplier_name && (
                  <p className="text-xs text-muted-foreground truncate">{f.receiptData.supplier_name}</p>
                )}
              </div>
              {phase === "idle" && (
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => onRemove(f.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Extracted data */}
            {f.receiptData && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <span className="font-mono font-medium text-foreground">
                    {f.receiptData.total_amount?.toFixed(2)} EUR
                  </span>
                </div>
                {f.receiptData.date && (
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{f.receiptData.date}</span>
                  </div>
                )}
              </div>
            )}

            {/* Error message */}
            {f.error && <p className="text-xs text-destructive">{f.error}</p>}

            {/* Status + action */}
            <div className="flex items-center justify-between">
              <StatusBadge status={f.status} />
              {f.status === "not_matched" && (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openManualMatch(f)}>
                  <Search className="w-3 h-3 mr-1" />
                  Assign
                </Button>
              )}
              {f.matchResult && f.status === "matched" && (
                <span className="text-xs text-green-600 font-medium">
                  {(f.matchResult.score * 100).toFixed(0)}% match
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <ManualMatchDialog
        open={matchDialogOpen}
        onOpenChange={setMatchDialogOpen}
        file={selectedFile}
        userId={userId}
        onSelect={(txId) => {
          if (selectedFile) {
            onManualMatch(selectedFile.id, txId);
          }
        }}
      />

      {viewerFile &&
        (() => {
          const url = getViewableUrl(viewerFile);
          return url ? (
            <ReceiptImageViewer
              open={true}
              onOpenChange={(open) => {
                if (!open) setViewerFile(null);
              }}
              imageUrl={url}
              title={viewerFile.receiptData?.supplier_name || viewerFile.file.name}
            />
          ) : null;
        })()}
    </>
  );
}
