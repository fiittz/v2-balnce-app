import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BankHeaderProps {
  selectionMode: boolean;
  selectedCount: number;
  onEnterSelection: () => void;
  onDeleteClick: () => void;
  onClearSelection: () => void;
}

export function BankHeader({
  selectionMode,
  selectedCount,
  onEnterSelection,
  onDeleteClick,
  onClearSelection,
}: BankHeaderProps) {
  return (
    <header className="bg-background px-4 sm:px-6 py-4 border-b border-border sticky top-16 z-10">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground">Manage your bank transactions</p>
        </div>

        <div className="flex items-center gap-2">
          {!selectionMode ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onEnterSelection}
              className="rounded-xl"
            >
              Select
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedCount} selected
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={onDeleteClick}
                disabled={selectedCount === 0}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9 w-9 rounded-xl"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClearSelection}
                className="h-9 w-9 rounded-xl"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
