import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { IRISH_TOWNS, formatTownDisplay, type IrishTown } from "@/lib/irishTowns";
import { cn } from "@/lib/utils";
import { useGooglePlaces } from "@/hooks/useGooglePlaces";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onTownSelect?: (town: IrishTown) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

interface GooglePrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
}

/** Strip "County " / "Co. " prefix from Google's administrative_area_level_1 */
function normalizeCounty(raw: string): string {
  return raw.replace(/^(County|Co\.?)\s+/i, "");
}

/** Look up distanceFromDublin from static list; 0 if not found */
function lookupDistance(townName: string, county: string): number {
  const match = IRISH_TOWNS.find(
    (t) => t.name.toLowerCase() === townName.toLowerCase() && t.county.toLowerCase() === county.toLowerCase(),
  );
  return match?.distanceFromDublin ?? 0;
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

  // --- Google Places state ---
  const {
    isLoaded: googleReady,
    loadError,
    getAutocompleteService,
    getSessionToken,
    resetSessionToken,
    getPlacesService,
  } = useGooglePlaces();
  const useGoogle = googleReady && !loadError;

  const [predictions, setPredictions] = useState<GooglePrediction[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attrDivRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Static fallback state ---
  const [searchTerm, setSearchTerm] = useState("");

  // Extract the last segment of the input for static matching
  function getSearchSegment(text: string): string {
    const parts = text.split(/[,\s]+/).filter(Boolean);
    return (parts[parts.length - 1] || "").toLowerCase();
  }

  // Update search term when value changes (for static fallback)
  useEffect(() => {
    if (!useGoogle) {
      setSearchTerm(getSearchSegment(value));
    }
  }, [value, useGoogle]);

  // Static filtered towns (fallback mode only)
  const filteredTowns =
    !useGoogle && searchTerm.length >= 2
      ? IRISH_TOWNS.filter(
          (town) => town.name.toLowerCase().includes(searchTerm) || town.county.toLowerCase().includes(searchTerm),
        ).slice(0, 15)
      : [];

  // ---- Google autocomplete fetch ----
  const fetchPredictions = useCallback(
    (input: string) => {
      const service = getAutocompleteService();
      if (!service || input.length < 3) {
        setPredictions([]);
        return;
      }

      service.getPlacePredictions(
        {
          input,
          componentRestrictions: { country: "ie" },
          types: ["address"],
          sessionToken: getSessionToken(),
        },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            setPredictions(
              results.map((r) => ({
                placeId: r.place_id,
                mainText: r.structured_formatting.main_text,
                secondaryText: r.structured_formatting.secondary_text ?? "",
                description: r.description,
              })),
            );
          } else {
            setPredictions([]);
          }
        },
      );
    },
    [getAutocompleteService, getSessionToken],
  );

  // ---- Google place selection ----
  const handleGoogleSelect = useCallback(
    (prediction: GooglePrediction) => {
      onChange(prediction.description);
      setOpen(false);

      if (!onTownSelect) {
        resetSessionToken();
        return;
      }

      // Fetch full details to extract county
      const div = attrDivRef.current ?? document.createElement("div");
      attrDivRef.current = div;
      const service = getPlacesService(div);
      if (!service) {
        resetSessionToken();
        return;
      }

      service.getDetails(
        {
          placeId: prediction.placeId,
          fields: ["address_components"],
          sessionToken: getSessionToken(),
        },
        (place, detailStatus) => {
          resetSessionToken(); // end billing session

          if (detailStatus !== google.maps.places.PlacesServiceStatus.OK || !place?.address_components) {
            return;
          }

          let county = "";
          let townName = "";

          for (const comp of place.address_components) {
            if (comp.types.includes("administrative_area_level_1")) {
              county = normalizeCounty(comp.long_name);
            }
            if (!townName && (comp.types.includes("locality") || comp.types.includes("postal_town"))) {
              townName = comp.long_name;
            }
          }

          if (county) {
            onTownSelect({
              name: townName || prediction.mainText,
              county,
              distanceFromDublin: lookupDistance(townName || prediction.mainText, county),
            });
          }
        },
      );

      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [onChange, onTownSelect, getPlacesService, getSessionToken, resetSessionToken],
  );

  // ---- Static fallback selection ----
  function handleStaticSelect(town: IrishTown) {
    const formatted = formatTownDisplay(town);
    onChange(formatted);
    onTownSelect?.(town);
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  // Open/close popover when Google predictions change
  useEffect(() => {
    if (useGoogle) {
      setOpen(predictions.length > 0);
    }
  }, [predictions, useGoogle]);

  // ---- Input change handler ----
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    onChange(newValue);

    if (useGoogle) {
      // Debounce Google requests (300ms)
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (newValue.length >= 3) {
        debounceRef.current = setTimeout(() => fetchPredictions(newValue), 300);
      } else {
        setPredictions([]);
      }
    } else {
      // Static fallback
      const segment = getSearchSegment(newValue);
      if (segment.length >= 2) {
        setOpen(true);
      } else {
        setOpen(false);
      }
    }
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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
              if (useGoogle) {
                if (predictions.length > 0) setOpen(true);
              } else {
                const segment = getSearchSegment(value);
                if (segment.length >= 2 && filteredTowns.length > 0) {
                  setOpen(true);
                }
              }
            }}
            placeholder={placeholder}
            className={cn(className)}
            disabled={disabled}
            autoComplete="off"
          />
        </div>
      </PopoverTrigger>
      {open && (
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)]"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {useGoogle
                  ? predictions.map((pred) => (
                      <CommandItem
                        key={pred.placeId}
                        value={pred.placeId}
                        onSelect={() => handleGoogleSelect(pred)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{pred.mainText}</span>
                        <span className="ml-auto text-sm text-muted-foreground truncate">{pred.secondaryText}</span>
                      </CommandItem>
                    ))
                  : filteredTowns.map((town) => (
                      <CommandItem
                        key={`${town.name}-${town.county}`}
                        value={`${town.name}-${town.county}`}
                        onSelect={() => handleStaticSelect(town)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span>{town.name}</span>
                        <span className="ml-auto text-sm text-muted-foreground">Co. {town.county}</span>
                      </CommandItem>
                    ))}
              </CommandGroup>
            </CommandList>
            {useGoogle && (
              <div className="px-3 py-1.5 text-[10px] text-muted-foreground text-right border-t">Powered by Google</div>
            )}
          </Command>
        </PopoverContent>
      )}
    </Popover>
  );
}
