import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCategories } from "@/hooks/useCategories";
import { AddCategoryDialog } from "./AddCategoryDialog";

const MAX_BADGES = 8;

interface ChartOfAccountsWidgetProps {
  accountType?: string;
}

export function ChartOfAccountsWidget({ accountType }: ChartOfAccountsWidgetProps) {
  const navigate = useNavigate();
  const { data: categories = [], isLoading } = useCategories(undefined, accountType);
  const [dialogOpen, setDialogOpen] = useState(false);

  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");

  return (
    <>
      <div className="bg-card rounded-2xl p-5 card-shadow flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Bookkeeping
            </p>
            <h2 className="text-base font-semibold">Chart of Accounts</h2>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 rounded-xl text-xs"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="w-3 h-3" />
            Add Category
          </Button>
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading categories...</p>
        ) : categories.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No categories yet. Add one to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Income */}
            {incomeCategories.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Income ({incomeCategories.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {incomeCategories.slice(0, MAX_BADGES).map((c) => (
                    <Badge
                      key={c.id}
                      variant="secondary"
                      className="bg-green-100 text-green-800 text-[11px]"
                    >
                      {c.name}
                    </Badge>
                  ))}
                  {incomeCategories.length > MAX_BADGES && (
                    <Badge variant="outline" className="text-[11px]">
                      +{incomeCategories.length - MAX_BADGES} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Expense */}
            {expenseCategories.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Expenses ({expenseCategories.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {expenseCategories.slice(0, MAX_BADGES).map((c) => (
                    <Badge
                      key={c.id}
                      variant="secondary"
                      className="bg-red-100 text-red-800 text-[11px]"
                    >
                      {c.name}
                    </Badge>
                  ))}
                  {expenseCategories.length > MAX_BADGES && (
                    <Badge variant="outline" className="text-[11px]">
                      +{expenseCategories.length - MAX_BADGES} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <Button
          size="sm"
          variant="outline"
          className="mt-1 w-fit rounded-xl text-xs"
          onClick={() => navigate("/chart-of-accounts")}
        >
          View All
        </Button>
      </div>

      <AddCategoryDialog open={dialogOpen} onOpenChange={setDialogOpen} defaultAccountType={accountType} />
    </>
  );
}
