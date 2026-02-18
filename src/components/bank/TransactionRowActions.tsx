import { Tag, Scissors, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface TransactionRowActionsProps {
  transactionId: string;
  onCategorize: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function TransactionRowActions({ transactionId, onCategorize, onDelete }: TransactionRowActionsProps) {
  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCategorize(transactionId);
        }}
        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Categorize"
      >
        <Tag className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          toast.info("Split transaction coming soon");
        }}
        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Split"
      >
        <Scissors className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(transactionId);
        }}
        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        title="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
