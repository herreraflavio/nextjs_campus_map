import type { MapColorSettings } from "@/app/types/mapColors";
export { isMapColorSettings as isMapSidebarSettings, normalizeMapColors as normalizeMapSidebar } from "@/app/types/mapColors";

export type MapSidebarSettings = MapColorSettings;

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
