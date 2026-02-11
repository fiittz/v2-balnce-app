import { useState } from "react";
import { Tag, Brain, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useCategories } from "@/hooks/useCategories";
import { useUpdateTransaction } from "@/hooks/useTransactions";

interface InlineCategoryPickerProps {
  transactionId: string;
  currentCategory: { name: string } | null | undefined;
  currentCategoryId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InlineCategoryPicker({
  transactionId,
  currentCategory,
  currentCategoryId,
  isOpen,
  onOpenChange,
}: InlineCategoryPickerProps) {
  const { data: categories } = useCategories();
  const updateTransaction = useUpdateTransaction();

  const handleSelect = (categoryId: string) => {
    updateTransaction.mutate({ id: transactionId, category_id: categoryId });
    onOpenChange(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenChange(!isOpen);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onOpenChange(true);
          }}
          className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 transition-colors ${
            currentCategory
              ? "bg-muted hover:bg-muted/80"
              : "bg-purple-100 text-purple-700 hover:bg-purple-200"
          }`}
        >
          {currentCategory ? (
            <>
              <Tag className="w-3 h-3" />
              {currentCategory.name}
            </>
          ) : (
            <>
              <Brain className="w-3 h-3" />
              Uncategorized
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start" onClick={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput placeholder="Search categories..." />
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>
            <CommandGroup>
              {categories?.map((cat) => (
                <CommandItem
                  key={cat.id}
                  value={cat.name}
                  onSelect={() => handleSelect(cat.id)}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      currentCategoryId === cat.id ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <span className="text-xs">{cat.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground capitalize">{cat.type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
