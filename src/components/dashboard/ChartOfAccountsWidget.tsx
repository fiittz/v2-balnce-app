import { useState } from "react";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCategories } from "@/hooks/useCategories";
import { AddCategoryDialog } from "./AddCategoryDialog";

interface ChartOfAccountsWidgetProps {
  accountType?: string;
}

export function ChartOfAccountsButton({ accountType }: ChartOfAccountsWidgetProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <BookOpen className="w-4 h-4 mr-2" />
        Chart of Accounts
      </Button>
      <ChartOfAccountsDialog open={open} onOpenChange={setOpen} accountType={accountType} />
    </>
  );
}

interface ChartOfAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountType?: string;
}

function ChartOfAccountsDialog({ open, onOpenChange, accountType }: ChartOfAccountsDialogProps) {
  const { data: categories = [], isLoading } = useCategories(undefined, accountType);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Chart of Accounts</DialogTitle>
              <Button size="sm" className="gap-1 rounded-xl text-xs" onClick={() => setAddDialogOpen(true)}>
                <Plus className="w-3 h-3" />
                Add Category
              </Button>
            </div>
          </DialogHeader>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4">Loading categories...</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No categories yet. Add one to get started.</p>
          ) : (
            <div className="space-y-5 mt-2">
              {/* Income */}
              {incomeCategories.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Income ({incomeCategories.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {incomeCategories.map((c) => (
                      <Badge key={c.id} variant="secondary" className="bg-green-100 text-green-800 text-xs py-1 px-2.5">
                        {c.name}
                        {c.account_code && <span className="ml-1 text-green-600 opacity-60">{c.account_code}</span>}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Expense */}
              {expenseCategories.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Expenses ({expenseCategories.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {expenseCategories.map((c) => (
                      <Badge key={c.id} variant="secondary" className="bg-red-100 text-red-800 text-xs py-1 px-2.5">
                        {c.name}
                        {c.account_code && <span className="ml-1 text-red-600 opacity-60">{c.account_code}</span>}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AddCategoryDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} defaultAccountType={accountType} />
    </>
  );
}
