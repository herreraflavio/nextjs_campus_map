// // exportMap.ts
// import {
//   finalizedLayerRef,
//   labelsLayerRef,
//   settingsRef,
// } from "@/app/components/map/arcgisRefs";

// // serialize your map as before
// // function generatePolygons() {
// function generateExport(): { polygons: any[]; labels: any[] } {
//   const polyLayer = finalizedLayerRef.current;
//   const labelLayer = labelsLayerRef.current;
//   // if (!polyLayer) return [];
//   const polygons = polyLayer.graphics.items.map((g: any) => {
//     const attrs: any = {
//       id: g.attributes.id,
//       name: g.attributes.name,
//       description: g.attributes.description,
//     };
//     if (g.attributes.showAtZoom != null)
//       attrs.showAtZoom = g.attributes.showAtZoom;
//     if (g.attributes.hideAtZoom != null)
//       attrs.hideAtZoom = g.attributes.hideAtZoom;

//     const geom = {
//       type: g.geometry.type,
//       rings: g.geometry.rings,
//       spatialReference: g.geometry.spatialReference.toJSON
//         ? g.geometry.spatialReference.toJSON()
//         : g.geometry.spatialReference,
//     };

//     const sym = g.symbol;
//     const color =
//       typeof sym.color.toRgba === "function" ? sym.color.toRgba() : sym.color;
//     const outline = sym.outline;
//     const outlineColor =
//       typeof outline.color.toRgba === "function"
//         ? outline.color.toRgba()
//         : outline.color;

//     return {
//       attributes: attrs,
//       geometry: geom,
//       symbol: {
//         type: sym.type,
//         color,
//         outline: {
//           color: outlineColor,
//           width: outline.width,
//         },
//       },
//     };
//   });

//   const labels = labelLayer.graphics.items.map((l: any) => {
//     const sym = l.symbol as any;
//     const attrs: any = {
//       parentId: l.attributes.parentId,
//       showAtZoom: l.attributes.showAtZoom ?? null,
//       hideAtZoom: l.attributes.hideAtZoom ?? null,
//       fontSize: sym.font.size,
//       color: sym.color,
//       haloColor: sym.haloColor,
//       haloSize: sym.haloSize,
//       text: sym.text,
//     };
//     const geom = {
//       type: l.geometry.type,
//       x: l.geometry.x,
//       y: l.geometry.y,
//       spatialReference: l.geometry.spatialReference.toJSON
//         ? l.geometry.spatialReference.toJSON()
//         : l.geometry.spatialReference,
//     };
//     return { attributes: attrs, geometry: geom };
//   });

//   return { polygons, labels };
// }

// /**
//  * Synchronously POSTs the current map’s polygons to your `/api/maps/[id]` endpoint.
//  * Non-blocking: fires off in the background.
//  */

// interface FieldInfo {
//   fieldName: string;
//   label: string;
//   visible: boolean;
//   format?: {
//     digitSeparator?: boolean;
//     places?: number;
//   };
// }

// interface FeatureLayerConfig {
//   url: string;
//   index: number;
//   outFields: string[];
//   popupEnabled: boolean;
//   popupTemplate?: {
//     title: string;
//     content: Array<{
//       type: string;
//       fieldInfos?: FieldInfo[];
//     }>;
//   };
// }

// export function saveMapToServer(
//   mapId: string,
//   userEmail: string,
//   settings: {
//     zoom: number;
//     center: [number, number];
//     constraints: null | {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     };
//     featureLayers: FeatureLayerConfig[] | null;
//   }
// ): void {
//   // const polygons = generatePolygons();
//   const { polygons, labels } = generateExport();
//   if (polygons.length === 0) {
//     console.warn("No polygons to save.");
//     return;
//   }

//   fetch(`/api/maps/${mapId}`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({
//       userEmail,
//       polygons,
//       labels,
//       settings,
//     }),
//   })
//     .then((res) => {
//       if (!res.ok) {
//         console.error(`Save failed (${res.status}):`, res.statusText);
//         return res.json().then((body) => console.error(body));
//       }
//       return res.json();
//     })
//     .then((updatedMap) => {
//       console.log("Map saved successfully:", updatedMap);
//     })
//     .catch((err) => console.error("Error saving map:", err));
// }

// exportMap.ts
import {
  finalizedLayerRef,
  labelsLayerRef,
  eventsLayerRef, // ⬅️ NEW
} from "@/app/components/map/arcgisRefs";

// Serialize polygons, labels, and events
function generateExport(): { polygons: any[]; labels: any[]; events: any[] } {
  const polyLayer = finalizedLayerRef.current;
  const labelLayer = labelsLayerRef.current;
  const eventLayer = eventsLayerRef.current;

  // ── Polygons ────────────────────────────────────────────────────────────────
  const polygons = (polyLayer?.graphics?.items || []).map((g: any) => {
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
      typeof sym.color?.toRgba === "function" ? sym.color.toRgba() : sym.color;
    const outline = sym.outline;
    const outlineColor =
      typeof outline?.color?.toRgba === "function"
        ? outline.color.toRgba()
        : outline?.color;

    return {
      attributes: attrs,
      geometry: geom,
      symbol: {
        type: sym.type,
        color,
        outline: {
          color: outlineColor,
          width: outline?.width,
        },
      },
    };
  });

  // ── Labels ─────────────────────────────────────────────────────────────────
  const labels = (labelLayer?.graphics?.items || []).map((l: any) => {
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

  // ── Events (points) ────────────────────────────────────────────────────────
  const events = (eventLayer?.graphics?.items || []).map((g: any) => {
    // Persist the CampusEvent-ish attributes you attached in addEventToStore
    const attrs: any = {
      id: g.attributes?.id,
      event_name: g.attributes?.event_name,
      description: g.attributes?.description ?? null,
      date: g.attributes?.date ?? null,
      startAt: g.attributes?.startAt ?? null,
      endAt: g.attributes?.endAt ?? null,
      locationTag: g.attributes?.locationTag ?? null,
      names: g.attributes?.names ?? null,
      original: g.attributes?.original ?? null,
    };

    const geom = {
      type: g.geometry.type, // "point"
      x: g.geometry.x,
      y: g.geometry.y,
      spatialReference: g.geometry.spatialReference.toJSON
        ? g.geometry.spatialReference.toJSON()
        : g.geometry.spatialReference,
    };

    // Symbol is optional; you can add it if you plan to style server-side
    return { attributes: attrs, geometry: geom };
  });

  return { polygons, labels, events };
}

/**
 * POST the map (polygons, labels, events, settings) to /api/maps/[id]
 */
interface FieldInfo {
  fieldName: string;
  label: string;
  visible: boolean;
  format?: { digitSeparator?: boolean; places?: number };
}
interface FeatureLayerConfig {
  url: string;
  index: number;
  outFields: string[];
  popupEnabled: boolean;
  popupTemplate?: {
    title: string;
    content: Array<{ type: string; fieldInfos?: FieldInfo[] }>;
  };
}

export function saveMapToServer(
  mapId: string,
  userEmail: string,
  settings: {
    zoom: number;
    center: [number, number];
    constraints: null | {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    };
    featureLayers: FeatureLayerConfig[] | null;
  }
): void {
  const { polygons, labels, events } = generateExport();

  if (polygons.length === 0 && labels.length === 0 && events.length === 0) {
    console.warn("Nothing to save (no polygons, labels, or events).");
    return;
  }

  fetch(`/api/maps/${mapId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userEmail, polygons, labels, events, settings }),
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
