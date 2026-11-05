import type { MapColorSettings } from "@/app/types/mapColors";
export { isMapColorSettings as isMapPopupSettings, normalizeMapColors as normalizeMapPopup } from "@/app/types/mapColors";

export type MapPopupSettings = MapColorSettings;

export const DEFAULT_MAP_POPUP: MapPopupSettings = {
  backgroundColor: "#ffffff",
  borderColor: "#d1d5db",
  textColor: "#323232",
};

export const MAP_POPUP_LOADED = "map-popup-loaded";
export type MapPopupLoadedEvent = {
  mapId: string;
  settings: MapPopupSettings | null;
};
