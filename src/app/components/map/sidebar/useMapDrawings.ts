//src/app/components/map/sidebar/useMapDrawings.ts
"use client";

import { useEffect, useState } from "react";

import {
  finalizedLayerRef,
  eventsLayerRef,
  MapViewRef,
} from "../arcgisRefs";
import type { MapSidebarGraphic } from "./MapSidebar";

function snapshotFinalizedDrawings(): MapSidebarGraphic[] {
  const graphics = finalizedLayerRef.current?.graphics;

  const items: MapSidebarGraphic[] =
    typeof graphics?.toArray === "function"
      ? graphics.toArray()
      : Array.isArray(graphics?.items)
        ? graphics.items
        : [];

  return [...items].sort(
    (a, b) =>
      (a.attributes?.order ?? 0) -
      (b.attributes?.order ?? 0),
  );
}

export function useMapEvents(): MapSidebarGraphic[] {
  const [events, setEvents] = useState<MapSidebarGraphic[]>([]);
  useEffect(() => {
    const sync = () => {
      const items = eventsLayerRef.current?.graphics?.toArray?.() ?? [];
      setEvents(previous => previous.length === items.length && previous.every((graphic, i) => graphic === items[i])
        ? previous : [...items]);
    };
    eventsLayerRef.events.addEventListener("change", sync);
    sync();
    return () => eventsLayerRef.events.removeEventListener("change", sync);
  }, []);
  return events;
}

export function useFinalizedDrawings(): MapSidebarGraphic[] {
  const [drawings, setDrawings] = useState<MapSidebarGraphic[]>([]);

  useEffect(() => {
    const sync = () => {
      setDrawings(snapshotFinalizedDrawings());
    };

    finalizedLayerRef.events.addEventListener("change", sync);
    sync();

    return () => {
      finalizedLayerRef.events.removeEventListener("change", sync);
    };
  }, []);

  return drawings;
}

export async function goToDrawing(
  graphic: MapSidebarGraphic,
  options: { dock?: boolean; isCurrent?: () => boolean; targetGeometry?: __esri.Geometry } = {},
): Promise<void> {
  const view = MapViewRef.current as __esri.MapView | null;
  const geometry = graphic?.geometry as __esri.Geometry | undefined;

  if (!view || !geometry) return;

  const location = popupLocationForGeometry(geometry);
  const targetGeometry = options.targetGeometry ?? geometry;
  const target = (targetGeometry as any).extent?.center ?? targetGeometry;

  try {
    await view.goTo({ target, zoom: 18 });
    if (MapViewRef.current !== view || (options.isCurrent && !options.isCurrent())) return;
    openDrawingPopup(view, graphic, location, options);
  } catch (error: any) {
    if (error?.name !== "AbortError") console.error("Failed to navigate to drawing:", error);
  }
}

function popupLocationForGeometry(geometry: __esri.Geometry): __esri.Geometry {
  const g = geometry as any;
  return g.type === "point"
    ? geometry
    : g.extent?.center ?? g.centroid ?? geometry;
}

function openDrawingPopup(
  view: __esri.MapView,
  graphic: MapSidebarGraphic,
  location: __esri.Geometry,
  options: { dock?: boolean; isCurrent?: () => boolean },
): void {
  const viewAny = view as any;
  const popupOptions = {
    features: [graphic as any],
    location: location as any,
    collapsed: false,
  };

  viewAny.popupEnabled = true;
  viewAny.popup?.close?.();

  const open = () => {
    if (MapViewRef.current !== view || (options.isCurrent && !options.isCurrent())) return;
    if (options.dock && viewAny.popup) {
      viewAny.popup.dockEnabled = true;
      viewAny.popup.dockOptions = { position: "top-right", breakpoint: false };
    }
    if (typeof viewAny.openPopup === "function") {
      void viewAny.openPopup(popupOptions).then(() => {
        if (MapViewRef.current !== view || (options.isCurrent && !options.isCurrent())) {
          if (viewAny.popup?.selectedFeature === graphic) viewAny.closePopup?.();
          return;
        }
        if (options.dock && viewAny.popup) {
          viewAny.popup.dockEnabled = true;
          viewAny.popup.dockOptions = { position: "top-right", breakpoint: false };
        }
      }).catch((error: unknown) => console.error("Failed to open drawing popup:", error));
      return;
    }

    viewAny.popup?.open?.(popupOptions);
  };

  window.requestAnimationFrame(() => {
    open();

    window.setTimeout(() => {
      if (viewAny.popup?.visible !== true) {
        open();
      }
    }, 120);
  });
}
