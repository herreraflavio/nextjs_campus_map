"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useLocationSearchGraph } from "@/app/helper/searchLocation";
import type { DrawingExport } from "@/app/types/myTypes";
import { apiSourceId, eventKey } from "@/app/types/apiSources";
import { finalizedLayerRef, MapViewRef } from "./arcgisRefs";
import { setMapLocationFocus } from "./categories/categoryVisibility";
import { resolveMapLocation } from "./mapLocation";
import { goToDrawing, useMapEvents } from "./sidebar/useMapDrawings";
import { useApiSources } from "./apiSourceStore";

export default function MapLocationTarget({
  drawings, viewReady, drawingsReady, onDestinationChange,
}: {
  drawings: DrawingExport[];
  viewReady: boolean;
  drawingsReady: boolean;
  onDestinationChange: (id: string | null) => void;
}) {
  const params = useSearchParams();
  const query = params.get("location")?.trim() ?? "";
  const eventId = params.get("event");
  const sourceId = params.get("source");
  const events = useMapEvents();
  const { sources, statuses } = useApiSources();
  const event = eventId ? events.find(event => String(event.attributes?.id) === eventId &&
    (!sourceId || event.attributes?.sourceId === sourceId)) : null;
  // API records use location for the building mapping; location_at is display detail.
  const location = eventId ? (event?.attributes?.location ?? "") : query;
  const { loading, searchOptions, publicNodes } = useLocationSearchGraph(!!query || !!eventId);
  const target = useMemo(() => {
    if (!location || loading) return null;
    return resolveMapLocation(location, drawings, searchOptions, publicNodes);
  }, [location, loading, drawings, searchOptions, publicNodes]);

  useEffect(() => {
    onDestinationChange(target?.node?.id ?? null);
    if (!target && !event) return;
    setMapLocationFocus(target?.drawing?.attributes.id ?? `location:${target?.node?.id ?? "event"}`,
      target?.drawing?.attributes.categoryId, event ? eventKey(event.attributes ?? {}) : undefined);
    return () => setMapLocationFocus(null);
  }, [target, event, onDestinationChange]);

  useEffect(() => {
    const view = MapViewRef.current as __esri.MapView | null;
    if ((!target && !event) || loading || !viewReady || !drawingsReady || !view) return;
    let cancelled = false;
    const isCurrent = () => !cancelled && MapViewRef.current === view;
    const building = target?.drawing && finalizedLayerRef.current?.graphics.find(
      (graphic: __esri.Graphic) => graphic.attributes?.id === target.drawing?.attributes.id,
    );
    const selected = event || building;
    if (selected) {
      void goToDrawing(selected, { dock: true, isCurrent, targetGeometry: building?.geometry });
    } else if (target?.node) {
      void view.goTo({ target: [target.node.lon, target.node.lat], zoom: 18 }).catch(error => {
        if (isCurrent() && error?.name !== "AbortError") console.error("Failed to navigate to URL location:", error);
      });
    }
    return () => {
      cancelled = true;
      if (view.popup?.selectedFeature === selected) view.closePopup();
    };
  }, [target, event, loading, viewReady, drawingsReady]);

  const expectedSources = sourceId ? sources.filter(source => apiSourceId(source.url) === sourceId) : sources;
  const pending = expectedSources.some(source => !statuses.has(source.url) || statuses.get(source.url) === "loading");
  const failed = expectedSources.some(source => statuses.get(source.url) === "error");
  if (eventId && drawingsReady && !event && !pending) {
    return <div role="status" style={{ position: "absolute", top: 16, left: 60, right: 16, zIndex: 10,
      background: "white", padding: 12, borderRadius: 6 }}>
      {failed ? "Could not load the shared event's API source. Please try reloading." : "This shared event is no longer available."}
    </div>;
  }
  return null;
}
