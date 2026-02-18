import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useCategories } from "@/hooks/useCategories";
import { Button } from "@/components/ui/button";
import { Tag } from "lucide-react";

interface BulkCategoryPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (categoryId: string) => void;
}

export default function BulkCategoryPicker({ open, onOpenChange, onSelect }: BulkCategoryPickerProps) {
  const { data: categories } = useCategories();

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2">
          <Tag className="w-4 h-4" />
          Categorize
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="center" side="top">
        <Command>
          <CommandInput placeholder="Search categories..." />
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>
            <CommandGroup>
              {categories?.map((cat) => (
                <CommandItem
                  key={cat.id}
                  value={cat.name}
                  onSelect={() => {
                    onSelect(cat.id);
                    onOpenChange(false);
                  }}
                >
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
