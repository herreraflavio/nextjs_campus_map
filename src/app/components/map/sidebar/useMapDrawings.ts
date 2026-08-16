//src/app/components/map/sidebar/useMapDrawings.ts
"use client";

import { useEffect, useState } from "react";

import {
  finalizedLayerRef,
  MapViewRef,
} from "../arcgisRefs";
import type { DrawingGraphic } from "./DrawingSidebar";

function snapshotFinalizedDrawings(): DrawingGraphic[] {
  const graphics = finalizedLayerRef.current?.graphics;

  const items: DrawingGraphic[] =
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

export function useFinalizedDrawings(): DrawingGraphic[] {
  const [drawings, setDrawings] = useState<DrawingGraphic[]>([]);

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

export function goToDrawing(graphic: DrawingGraphic): void {
  const view = MapViewRef.current as __esri.MapView | null;
  const geometry = graphic?.geometry as __esri.Geometry | undefined;

  if (!view || !geometry) return;

  const target =
    (geometry as any).extent?.center ??
    geometry;

  void view
    .goTo({ target, zoom: 18 })
    .then(() => {
      view.popup.open({
        features: [graphic as any],
        location: target as any,
      });
    })
    .catch((error) => {
      console.error("Failed to navigate to drawing:", error);
    });
}
