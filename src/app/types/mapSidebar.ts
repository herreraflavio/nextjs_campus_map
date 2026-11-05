import { isHexColor } from "@/app/types/mapTopBar";

export type MapSidebarSettings = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
};

export const DEFAULT_MAP_SIDEBAR: MapSidebarSettings = {
  backgroundColor: "#ffffff",
  borderColor: "#d1d5db",
  textColor: "#000000",
};

export const MAP_SIDEBAR_LOADED = "map-sidebar-loaded";
export type MapSidebarLoadedEvent = {
  mapId: string;
  settings: MapSidebarSettings | null;
};

export function isMapSidebarSettings(value: unknown): value is MapSidebarSettings {
  if (!value || typeof value !== "object") return false;
  const sidebar = value as Record<string, unknown>;
  return isHexColor(sidebar.backgroundColor) && isHexColor(sidebar.borderColor) &&
    isHexColor(sidebar.textColor);
}

export function normalizeMapSidebar(value: unknown): MapSidebarSettings | null {
  // Missing overrides retain the existing sidebar palette, including its accents.
  if (!isMapSidebarSettings(value)) return null;
  return {
    backgroundColor: value.backgroundColor.toLowerCase(),
    borderColor: value.borderColor.toLowerCase(),
    textColor: value.textColor.toLowerCase(),
  };
}
