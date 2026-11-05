import { isHexColor } from "@/app/types/mapTopBar";

export type MapColorSettings = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
};

export function isMapColorSettings(value: unknown): value is MapColorSettings {
  if (!value || typeof value !== "object") return false;
  const colors = value as Record<string, unknown>;
  return isHexColor(colors.backgroundColor) && isHexColor(colors.borderColor) &&
    isHexColor(colors.textColor);
}

export function normalizeMapColors(value: unknown): MapColorSettings | null {
  // Missing overrides retain the original palette.
  if (!isMapColorSettings(value)) return null;
  return {
    backgroundColor: value.backgroundColor.toLowerCase(),
    borderColor: value.borderColor.toLowerCase(),
    textColor: value.textColor.toLowerCase(),
  };
}
