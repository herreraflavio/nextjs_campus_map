import { buildSearchOptions, loadLocationGraph } from "@/app/helper/searchLocation";
import type { DrawingExport } from "@/app/types/myTypes";
import { finalizedLayerRef, MapViewRef } from "./arcgisRefs";
import { resolveMapLocation } from "./mapLocation";
import { revealDrawing, setEventVisibility } from "./categories/categoryVisibility";
import { goToDrawing } from "./sidebar/useMapDrawings";

export async function resolveEventLocation(location?: string) {
  if (!location?.trim()) return null;
  const drawings = (finalizedLayerRef.current?.graphics?.toArray?.() ?? []) as DrawingExport[];
  try {
    const graph = await loadLocationGraph();
    const nodes = graph.nodes.filter(node => !node.hidden);
    return resolveMapLocation(location, drawings, buildSearchOptions(nodes, graph.metaById), nodes);
  } catch {
    return resolveMapLocation(location, drawings, [], []);
  }
}

export async function goToEvent(graphic: any, options: { isCurrent?: () => boolean } = {}): Promise<void> {
  const view = MapViewRef.current;
  const target = await resolveEventLocation(graphic.attributes?.location);
  if (MapViewRef.current !== view || (options.isCurrent && !options.isCurrent())) return;
  if (target?.drawing) revealDrawing(target.drawing);
  setEventVisibility(graphic, true);
  await goToDrawing(graphic, { dock: true, ...options,
    targetGeometry: target?.drawing?.geometry as __esri.Geometry | undefined });
}

export function escapePopupText(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]!));
}
