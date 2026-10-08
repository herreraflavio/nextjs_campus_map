export type MapTopBarSettings = {
  logoUrl: string | null;
  backgroundColor: string;
};

export const MAP_TOP_BAR_LOADED = "map-top-bar-loaded";
export type MapTopBarLoadedEvent = {
  mapId: string;
  settings: MapTopBarSettings;
};

export const DEFAULT_MAP_TOP_BAR: MapTopBarSettings = {
  logoUrl: null,
  backgroundColor: "#002856",
};

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
}

function isLogoUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function isMapTopBarSettings(value: unknown): value is MapTopBarSettings {
  if (!value || typeof value !== "object") return false;
  const bar = value as Record<string, unknown>;
  return (bar.logoUrl === null || isLogoUrl(bar.logoUrl)) &&
    isHexColor(bar.backgroundColor);
}

export function normalizeMapTopBar(value: unknown): MapTopBarSettings {
  if (!isMapTopBarSettings(value)) return { ...DEFAULT_MAP_TOP_BAR };
  return {
    // Older maps may contain enabled:false. The header is now always visible;
    // retain their saved logo/color while dropping the obsolete flag.
    logoUrl: value.logoUrl?.trim() || null,
    backgroundColor: value.backgroundColor.toLowerCase(),
  };
}
