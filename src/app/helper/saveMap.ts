// exportMap.ts
import {
  finalizedLayerRef,
  labelsLayerRef,
} from "@/app/components/map/arcgisRefs";

// serialize your map as before
// function generatePolygons() {
function generateExport(): { polygons: any[]; labels: any[] } {
  const polyLayer = finalizedLayerRef.current;
  const labelLayer = labelsLayerRef.current;
  // if (!polyLayer) return [];
  const polygons = polyLayer.graphics.items.map((g: any) => {
    const attrs: any = {
      id: g.attributes.id,
      name: g.attributes.name,
      description: g.attributes.description,
    };
    if (g.attributes.showAtZoom != null)
      attrs.showAtZoom = g.attributes.showAtZoom;
    if (g.attributes.hideAtZoom != null)
      attrs.hideAtZoom = g.attributes.hideAtZoom;

    const geom = {
      type: g.geometry.type,
      rings: g.geometry.rings,
      spatialReference: g.geometry.spatialReference.toJSON
        ? g.geometry.spatialReference.toJSON()
        : g.geometry.spatialReference,
    };

    const sym = g.symbol;
    const color =
      typeof sym.color.toRgba === "function" ? sym.color.toRgba() : sym.color;
    const outline = sym.outline;
    const outlineColor =
      typeof outline.color.toRgba === "function"
        ? outline.color.toRgba()
        : outline.color;

    return {
      attributes: attrs,
      geometry: geom,
      symbol: {
        type: sym.type,
        color,
        outline: {
          color: outlineColor,
          width: outline.width,
        },
      },
    };
  });

  const labels = labelLayer.graphics.items.map((l: any) => {
    const sym = l.symbol as any;
    const attrs: any = {
      parentId: l.attributes.parentId,
      showAtZoom: l.attributes.showAtZoom ?? null,
      hideAtZoom: l.attributes.hideAtZoom ?? null,
      fontSize: sym.font.size,
      color: sym.color,
      haloColor: sym.haloColor,
      haloSize: sym.haloSize,
      text: sym.text,
    };
    const geom = {
      type: l.geometry.type,
      x: l.geometry.x,
      y: l.geometry.y,
      spatialReference: l.geometry.spatialReference.toJSON
        ? l.geometry.spatialReference.toJSON()
        : l.geometry.spatialReference,
    };
    return { attributes: attrs, geometry: geom };
  });

  return { polygons, labels };
}

/**
 * Synchronously POSTs the current map’s polygons to your `/api/maps/[id]` endpoint.
 * Non-blocking: fires off in the background.
 */
export function saveMapToServer(mapId: string, userEmail: string): void {
  // const polygons = generatePolygons();
  const { polygons, labels } = generateExport();
  if (polygons.length === 0) {
    console.warn("No polygons to save.");
    return;
  }

  fetch(`/api/maps/${mapId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userEmail,
      polygons,
      labels,
    }),
  })
    .then((res) => {
      if (!res.ok) {
        console.error(`Save failed (${res.status}):`, res.statusText);
        return res.json().then((body) => console.error(body));
      }
      return res.json();
    })
    .then((updatedMap) => {
      console.log("Map saved successfully:", updatedMap);
    })
    .catch((err) => console.error("Error saving map:", err));
}
