import { useState, useEffect, useRef, useCallback } from "react";

const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY ?? "";

// Singleton state — shared across all component instances
let loadPromise: Promise<void> | null = null;
let loadedFlag = false;
let loadErrorFlag: string | null = null;

function ensureLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    // Already loaded (e.g. script tag in HTML)
    if (window.google?.maps?.places) {
      loadedFlag = true;
      resolve();
      return;
    }

    const callbackName = "__googleMapsCallback_" + Date.now();
    (window as unknown as Record<string, () => void>)[callbackName] = () => {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      loadedFlag = true;
      resolve();
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      loadErrorFlag = "Failed to load Google Maps";
      reject(new Error(loadErrorFlag));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function useGooglePlaces() {
  const [isLoaded, setIsLoaded] = useState(loadedFlag);
  const [loadError, setLoadError] = useState<string | null>(loadErrorFlag);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  useEffect(() => {
    if (!API_KEY) {
      setLoadError("No API key");
      return;
    }
    if (loadedFlag) {
      setIsLoaded(true);
      return;
    }
    ensureLoaded()
      .then(() => setIsLoaded(true))
      .catch((err) => setLoadError((err as Error).message));
  }, []);

  const getSessionToken = useCallback((): google.maps.places.AutocompleteSessionToken => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }
    return sessionTokenRef.current;
  }, []);

  const resetSessionToken = useCallback(() => {
    sessionTokenRef.current = null;
  }, []);

  const getAutocompleteService = useCallback((): google.maps.places.AutocompleteService | null => {
    if (!isLoaded) return null;
    if (!autocompleteServiceRef.current) {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
    }
    return autocompleteServiceRef.current;
  }, [isLoaded]);

  const getPlacesService = useCallback(
    (attrDiv: HTMLDivElement): google.maps.places.PlacesService | null => {
      if (!isLoaded) return null;
      if (!placesServiceRef.current) {
        placesServiceRef.current = new google.maps.places.PlacesService(attrDiv);
      }
      return placesServiceRef.current;
    },
    [isLoaded],
  );

  return {
    isLoaded,
    loadError,
    getAutocompleteService,
    getSessionToken,
    resetSessionToken,
    getPlacesService,
  };
}
