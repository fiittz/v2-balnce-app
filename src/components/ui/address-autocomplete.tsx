import { useState, useRef, useEffect } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { IRISH_TOWNS, formatTownDisplay, type IrishTown } from "@/lib/irishTowns";
import { cn } from "@/lib/utils";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onTownSelect?: (town: IrishTown) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  onTownSelect,
  placeholder = "Start typing an address or town...",
  className,
  id,
  disabled,
}: AddressAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Extract the last segment of the input for matching
  // e.g. "12 Main St, Blanch" → "blanch"
  function getSearchSegment(text: string): string {
    const parts = text.split(/[,\s]+/).filter(Boolean);
    return (parts[parts.length - 1] || "").toLowerCase();
  }

  // Update search term when value changes (from typing)
  useEffect(() => {
    const segment = getSearchSegment(value);
    setSearchTerm(segment);
  }, [value]);

  // Filter towns based on last segment of typed text
  const filteredTowns = searchTerm.length >= 2
    ? IRISH_TOWNS.filter((town) => {
        const term = searchTerm;
        return (
          town.name.toLowerCase().includes(term) ||
          town.county.toLowerCase().includes(term)
        );
      }).slice(0, 15)
    : [];

  function handleSelect(town: IrishTown) {
    const formatted = formatTownDisplay(town);
    onChange(formatted);
    onTownSelect?.(town);
    setOpen(false);
    // Re-focus the input after selection
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    onChange(newValue);
    // Open dropdown when there's enough text
    const segment = getSearchSegment(newValue);
    if (segment.length >= 2) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            ref={inputRef}
            id={id}
            value={value}
            onChange={handleInputChange}
            onFocus={() => {
              const segment = getSearchSegment(value);
              if (segment.length >= 2 && filteredTowns.length > 0) {
                setOpen(true);
              }
            }}
            placeholder={placeholder}
            className={cn(className)}
            disabled={disabled}
            autoComplete="off"
          />
        </div>
      </PopoverTrigger>
      {filteredTowns.length > 0 && (
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)]"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              <CommandEmpty>No towns found.</CommandEmpty>
              <CommandGroup>
                {filteredTowns.map((town) => (
                  <CommandItem
                    key={`${town.name}-${town.county}`}
                    value={`${town.name}-${town.county}`}
                    onSelect={() => handleSelect(town)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{town.name}</span>
                    <span className="ml-auto text-sm text-muted-foreground">
                      Co. {town.county}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      )}
    </Popover>
  );
}
