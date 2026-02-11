import { cn } from "@/lib/utils";

export type FilterType = "all" | "income" | "expense" | "uncategorized";

interface TransactionFiltersProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  counts: {
    all: number;
    income: number;
    expense: number;
    uncategorized: number;
  };
}

export function TransactionFilters({
  activeFilter,
  onFilterChange,
  counts,
}: TransactionFiltersProps) {
  const filters: { value: FilterType; label: string; count: number }[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "income", label: "Income", count: counts.income },
    { value: "expense", label: "Expenses", count: counts.expense },
    { value: "uncategorized", label: "To Review", count: counts.uncategorized },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onFilterChange(filter.value)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
            activeFilter === filter.value
              ? "bg-foreground text-background"
              : "bg-secondary text-muted-foreground hover:bg-secondary/80"
          )}
        >
          {filter.label}
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
            activeFilter === filter.value
              ? "bg-background/20 text-background"
              : "bg-background text-muted-foreground"
          )}>
            {filter.count}
          </span>
        </button>
      ))}
    </div>
  );
}
