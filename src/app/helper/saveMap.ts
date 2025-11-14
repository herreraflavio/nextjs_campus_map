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
// saveMap.ts

import {
  finalizedLayerRef,
  labelsLayerRef,
  eventsLayerRef, // ⬅️ we read from this layer
  eventsStore, // ⬅️ and we merge in anything in the store
} from "@/app/components/map/arcgisRefs";

/**
 * POST the map (polygons, labels, events, settings) to /api/maps/[id]
 */
interface FieldInfo {
  fieldName: string;
  label: string;
  visible: boolean;
  format?: {
    digitSeparator?: boolean;
    places?: number;
  };
}

interface FeatureLayerConfig {
  url: string;
  index: number;
  outFields: string[];
  popupEnabled: boolean;
  popupTemplate?: {
    title: string;
    content: Array<{
      type: string;
      fieldInfos?: FieldInfo[];
    }>;
  };
}

interface SpatialReference {
  wkid: number;
  latestWkid: number;
}

interface EventPoint {
  attributes: {
    id: string;
    event_name: string;
    description?: string | null;
    date?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    locationTag?: string | null;
    names?: string[] | null;
    original?: any | null;
    fromUser: boolean;
  };
  geometry: {
    type: "point";
    x: number;
    y: number;
    spatialReference: SpatialReference;
  };
}

// ---------- config toggles ----------
/**
 * By requirement: only filter LAYER events to fromUser==true.
 * If you also want to restrict STORE events, set this to true.
 */
const FILTER_STORE_EVENTS = false;

// Robust truthiness normalizer for fromUser flags coming from attributes or store
const isTrue = (v: unknown): boolean => {
  if (v === true || v === 1) return true;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  return false;
};

// Serialize polygons, labels, and events
// Note: we filter **layer events** to fromUser==true; store events are kept as-is unless FILTER_STORE_EVENTS is true.
function generateExport(): { polygons: any[]; labels: any[]; events: any[] } {
  console.log("========== STARTING EXPORT GENERATION ==========");

  const polyLayer = finalizedLayerRef.current as any;
  const labelLayer = labelsLayerRef.current as any;

  // Debug eventsLayerRef structure
  console.log("eventsLayerRef.current:", eventsLayerRef.current);
  console.log("eventsLayerRef.current type:", typeof eventsLayerRef.current);
  console.log(
    "eventsLayerRef.current keys:",
    eventsLayerRef.current ? Object.keys(eventsLayerRef.current) : "null"
  );

  if (eventsLayerRef.current && typeof eventsLayerRef.current === "object") {
    console.log(
      "eventsLayerRef.current.graphics:",
      eventsLayerRef.current.graphics
    );
    if (eventsLayerRef.current.graphics) {
      console.log(
        "eventsLayerRef.current.graphics.items:",
        eventsLayerRef.current.graphics.items
      );
      console.log(
        "eventsLayerRef.current.graphics.items length:",
        eventsLayerRef.current.graphics?.items?.length || 0
      );
    }
  }

  // Also check eventsStore
  console.log("eventsStore.items:", eventsStore.items);
  console.log("eventsStore.items length:", eventsStore.items?.length || 0);

  // ── Events (points): merge from both layer and store ─────────────────────────
  const events: any[] = [];
  const processedIds = new Set<string>();

  // --- LAYER: only keep fromUser === true ---
  const eventsLayer = eventsLayerRef.current as any;
  if (eventsLayer?.graphics?.items) {
    const rawItems = eventsLayer.graphics.items as any[];

    const layerUserItems = rawItems.filter((graphic: any, index: number) => {
      const a = graphic?.attributes ?? {};
      const keep = isTrue(a.fromUser);
      console.log(`Layer event ${index} pre-filter:`, {
        id: a.id,
        event_name: a.event_name,
        fromUserRaw: a.fromUser,
        fromUserNormalized: keep,
        kept: keep,
      });
      return keep;
    });

    console.log(
      `Processing ${layerUserItems.length} user events from graphics layer (out of ${rawItems.length})...`
    );

    layerUserItems.forEach((graphic: any, index: number) => {
      const a = graphic.attributes || {};

      if (a.id && !processedIds.has(a.id)) {
        processedIds.add(a.id);

        const eventObj: EventPoint = {
          attributes: {
            id: a.id,
            event_name: a.event_name,
            description: a.description ?? null,
            date: a.date ?? null,
            startAt: a.startAt ?? null,
            endAt: a.endAt ?? null,
            locationTag: a.locationTag ?? null,
            names: a.names ?? null,
            original: a.original ?? null,
            fromUser: true, // normalized + guaranteed by filter
          },
          geometry: {
            type: "point",
            x: graphic.geometry?.x,
            y: graphic.geometry?.y,
            spatialReference: graphic.geometry?.spatialReference?.toJSON?.() ??
              graphic.geometry?.spatialReference ?? {
                wkid: 4326,
                latestWkid: 4326,
              },
          },
        };

        events.push(eventObj);
        console.log(
          `Added user event from layer: "${a.event_name}" (id: ${a.id})`
        );
      }
    });
  } else {
    console.log("No events found in graphics layer (eventsLayerRef.current)");
  }

  // --- STORE: add items not already in the layer (optionally filter) ---
  if (eventsStore?.items && Array.isArray(eventsStore.items)) {
    console.log(
      `Processing ${eventsStore.items.length} events from eventsStore...`
    );

    eventsStore.items.forEach((ev: any, index: number) => {
      const normalizedFromUser = isTrue(ev.fromUser);
      const keep = FILTER_STORE_EVENTS ? normalizedFromUser : true;

      console.log(`Event ${index} from store:`, {
        id: ev.id,
        event_name: ev.event_name,
        fromUserRaw: ev.fromUser,
        fromUserNormalized: normalizedFromUser,
      });

      if (!keep) return;

      if (ev.id && !processedIds.has(ev.id)) {
        processedIds.add(ev.id);

        const eventObj: EventPoint = {
          attributes: {
            id: ev.id,
            event_name: ev.event_name,
            description: ev.description ?? null,
            date: ev.date ?? null,
            startAt: ev.startAt ?? null,
            endAt: ev.endAt ?? null,
            locationTag: ev.locationTag ?? null,
            names: ev.names ?? null,
            original: ev.original ?? null,
            fromUser: normalizedFromUser,
          },
          geometry: {
            type: "point",
            x: ev.geometry?.x,
            y: ev.geometry?.y,
            spatialReference: {
              wkid: ev.geometry?.wkid ?? 4326,
              latestWkid: ev.geometry?.wkid ?? 4326,
            },
          },
        };

        events.push(eventObj);
        console.log(
          `Added event from store: "${ev.event_name}" (id: ${ev.id})`
        );
      }
    });
  } else {
    console.log("No events found in eventsStore");
  }

  console.log(`TOTAL EVENTS COLLECTED: ${events.length}`);
  events.forEach((e, i) => {
    console.log(
      `Final Event ${i}: "${e.attributes.event_name}" (id: ${e.attributes.id}, fromUser: ${e.attributes.fromUser})`
    );
  });

  // ── Polygons ────────────────────────────────────────────────────────────────
  console.log("Processing polygons...");
  const polygons = (polyLayer?.graphics?.items || []).map(
    (g: any, index: number) => {
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
        spatialReference:
          g.geometry.spatialReference?.toJSON?.() ??
          g.geometry.spatialReference,
      };

      const sym = g.symbol;
      const color =
        typeof sym.color?.toRgba === "function"
          ? sym.color.toRgba()
          : sym.color;
      const outline = sym.outline;
      const outlineColor =
        typeof outline?.color?.toRgba === "function"
          ? outline.color.toRgba()
          : outline?.color;

      console.log(`Polygon ${index}: "${attrs.name}" (id: ${attrs.id})`);

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
    }
  );
  console.log(`Total polygons: ${polygons.length}`);

  // ── Labels ─────────────────────────────────────────────────────────────────
  console.log("Processing labels...");
  const labels = (labelLayer?.graphics?.items || []).map(
    (l: any, index: number) => {
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
        spatialReference:
          l.geometry.spatialReference?.toJSON?.() ??
          l.geometry.spatialReference,
      };

      console.log(
        `Label ${index}: "${sym.text}" (parentId: ${attrs.parentId})`
      );

      return { attributes: attrs, geometry: geom };
    }
  );
  console.log(`Total labels: ${labels.length}`);

  console.log("========== EXPORT GENERATION COMPLETE ==========");
  console.log("Summary:", {
    polygons: polygons.length,
    labels: labels.length,
    events: events.length,
  });

  return { polygons, labels, events };
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
  console.log("========== STARTING SAVE TO SERVER ==========");
  console.log("Map ID:", mapId);
  console.log("User Email:", userEmail);
  console.log("Settings:", settings);

  const { polygons, labels, events } = generateExport();

  console.log("========== FINAL DATA BEFORE API CALL ==========");
  console.log("Polygons count:", polygons.length);
  console.log("Labels count:", labels.length);
  console.log("Events count:", events.length);

  // Detailed events logging
  console.log("Events detail:");
  events.forEach((event, index) => {
    console.log(`Event ${index}:`, {
      id: event.attributes.id,
      event_name: event.attributes.event_name,
      date: event.attributes.date,
      fromUser: event.attributes.fromUser,
      location_at: event.attributes.locationTag,
      geometry: {
        x: event.geometry.x,
        y: event.geometry.y,
        spatialReference: event.geometry.spatialReference,
      },
    });
  });

  if (polygons.length === 0 && labels.length === 0 && events.length === 0) {
    console.warn("⚠️ Nothing to save (no polygons, labels, or events).");
    return;
  }

  const payload = {
    userEmail,
    polygons,
    labels,
    events, // already filtered for layer items
    settings,
  };

  console.log("API Payload:", JSON.stringify(payload, null, 2));

  fetch(`/api/maps/${mapId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      console.log(`API Response Status: ${res.status} ${res.statusText}`);
      if (!res.ok) {
        console.error(`Save failed (${res.status}):`, res.statusText);
        return res.json().then((body) => {
          console.error("Error body:", body);
          throw new Error(`Save failed: ${res.statusText}`);
        });
      }
      return res.json();
    })
    .then((updatedMap) => {
      console.log("✅ Map saved successfully:", updatedMap);
      console.log("========== SAVE COMPLETE ==========");
    })
    .catch((err) => {
      console.error("❌ Error saving map:", err);
      console.log("========== SAVE FAILED ==========");
    });
}

// saveMap.ts
// import {
//   finalizedLayerRef,
//   labelsLayerRef,
//   eventsLayerRef, // ⬅️ NEW
//   eventsStore, // ⬅️ Import eventsStore as well
// } from "@/app/components/map/arcgisRefs";

// /**
//  * POST the map (polygons, labels, events, settings) to /api/maps/[id]
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

// interface SpatialReference {
//   wkid: number;
//   latestWkid: number;
// }

// interface EventPoint {
//   attributes: {
//     id: string;
//     event_name: string;
//     description?: string | null;
//     date?: string | null;
//     startAt?: string | null;
//     endAt?: string | null;
//     locationTag?: string | null;
//     names?: string[] | null;
//     original?: any | null;
//     fromUser: boolean;
//   };
//   geometry: {
//     type: "point";
//     x: number;
//     y: number;
//     spatialReference: SpatialReference;
//   };
// }

// // Serialize polygons, labels, and events
// // Note: This function collects ALL events; filtering for user events happens in saveMapToServer
// function generateExport(): { polygons: any[]; labels: any[]; events: any[] } {
//   console.log("========== STARTING EXPORT GENERATION ==========");

//   const polyLayer = finalizedLayerRef.current as any;
//   const labelLayer = labelsLayerRef.current as any;

//   // Debug eventsLayerRef structure
//   console.log("eventsLayerRef.current:", eventsLayerRef.current);
//   console.log("eventsLayerRef.current type:", typeof eventsLayerRef.current);
//   console.log(
//     "eventsLayerRef.current keys:",
//     eventsLayerRef.current ? Object.keys(eventsLayerRef.current) : "null"
//   );

//   // Check if it's a graphics layer
//   if (eventsLayerRef.current && typeof eventsLayerRef.current === "object") {
//     console.log(
//       "eventsLayerRef.current.graphics:",
//       eventsLayerRef.current.graphics
//     );
//     if (eventsLayerRef.current.graphics) {
//       console.log(
//         "eventsLayerRef.current.graphics.items:",
//         eventsLayerRef.current.graphics.items
//       );
//       console.log(
//         "eventsLayerRef.current.graphics.items length:",
//         eventsLayerRef.current.graphics?.items?.length || 0
//       );
//     }
//   }

//   // Also check eventsStore
//   console.log("eventsStore.items:", eventsStore.items);
//   console.log("eventsStore.items length:", eventsStore.items?.length || 0);

//   // ── Events (points): merge from both layer and store ─────────────────────────
//   const events: any[] = [];
//   const processedIds = new Set<string>();

//   // First, try to get events from the graphics layer (if it exists)
//   const eventsLayer = eventsLayerRef.current as any;
//   if (eventsLayer?.graphics?.items) {
//     console.log(
//       `Processing ${eventsLayer.graphics.items.length} events from graphics layer...`
//     );

//     eventsLayer.graphics.items.forEach((graphic: any, index: number) => {
//       const a = graphic.attributes || {};
//       console.log(`Event ${index} from layer:`, {
//         id: a.id,
//         event_name: a.event_name,
//         fromUser: a.fromUser,
//       });

//       if (a.id && !processedIds.has(a.id)) {
//         processedIds.add(a.id);
//         const eventObj = {
//           attributes: {
//             id: a.id,
//             event_name: a.event_name,
//             description: a.description ?? null,
//             date: a.date ?? null,
//             startAt: a.startAt ?? null,
//             endAt: a.endAt ?? null,
//             locationTag: a.locationTag ?? null,
//             names: a.names ?? null,
//             original: a.original ?? null,
//             fromUser: a.fromUser ?? false,
//           },
//           geometry: {
//             type: "point" as const,
//             x: graphic.geometry?.x,
//             y: graphic.geometry?.y,
//             spatialReference: graphic.geometry?.spatialReference?.toJSON?.() ??
//               graphic.geometry?.spatialReference ?? {
//                 wkid: 4326,
//                 latestWkid: 4326,
//               },
//           },
//         };
//         events.push(eventObj);
//         console.log(`Added event from layer: "${a.event_name}" (id: ${a.id})`);
//       }
//     });
//   } else {
//     console.log("No events found in graphics layer (eventsLayerRef.current)");
//   }

//   // Then, add any events from the store that weren't already in the layer
//   if (eventsStore?.items && Array.isArray(eventsStore.items)) {
//     console.log(
//       `Processing ${eventsStore.items.length} events from eventsStore...`
//     );

//     eventsStore.items.forEach((ev: any, index: number) => {
//       console.log(`Event ${index} from store:`, {
//         id: ev.id,
//         event_name: ev.event_name,
//         fromUser: ev.fromUser,
//       });

//       if (ev.id && !processedIds.has(ev.id)) {
//         processedIds.add(ev.id);
//         const eventObj = {
//           attributes: {
//             id: ev.id,
//             event_name: ev.event_name,
//             description: ev.description ?? null,
//             date: ev.date ?? null,
//             startAt: ev.startAt ?? null,
//             endAt: ev.endAt ?? null,
//             locationTag: ev.locationTag ?? null,
//             names: ev.names ?? null,
//             original: ev.original ?? null,
//             fromUser: ev.fromUser ?? false,
//           },
//           geometry: {
//             type: "point" as const,
//             x: ev.geometry?.x,
//             y: ev.geometry?.y,
//             spatialReference: {
//               wkid: ev.geometry?.wkid ?? 4326,
//               latestWkid: ev.geometry?.wkid ?? 4326,
//             },
//           },
//         };
//         events.push(eventObj);
//         console.log(
//           `Added event from store: "${ev.event_name}" (id: ${ev.id})`
//         );
//       }
//     });
//   } else {
//     console.log("No events found in eventsStore");
//   }

//   console.log(`TOTAL EVENTS COLLECTED: ${events.length}`);
//   events.forEach((e, i) => {
//     console.log(
//       `Final Event ${i}: "${e.attributes.event_name}" (id: ${e.attributes.id}, fromUser: ${e.attributes.fromUser})`
//     );
//   });

//   // ── Polygons ──────────────────────────────────────────────────────────────────
//   console.log("Processing polygons...");
//   const polygons = (polyLayer?.graphics?.items || []).map(
//     (g: any, index: number) => {
//       const attrs: any = {
//         id: g.attributes.id,
//         name: g.attributes.name,
//         description: g.attributes.description,
//       };
//       if (g.attributes.showAtZoom != null)
//         attrs.showAtZoom = g.attributes.showAtZoom;
//       if (g.attributes.hideAtZoom != null)
//         attrs.hideAtZoom = g.attributes.hideAtZoom;

//       const geom = {
//         type: g.geometry.type,
//         rings: g.geometry.rings,
//         spatialReference:
//           g.geometry.spatialReference?.toJSON?.() ??
//           g.geometry.spatialReference,
//       };

//       const sym = g.symbol;
//       const color =
//         typeof sym.color?.toRgba === "function"
//           ? sym.color.toRgba()
//           : sym.color;
//       const outline = sym.outline;
//       const outlineColor =
//         typeof outline?.color?.toRgba === "function"
//           ? outline.color.toRgba()
//           : outline?.color;

//       console.log(`Polygon ${index}: "${attrs.name}" (id: ${attrs.id})`);

//       return {
//         attributes: attrs,
//         geometry: geom,
//         symbol: {
//           type: sym.type,
//           color,
//           outline: {
//             color: outlineColor,
//             width: outline?.width,
//           },
//         },
//       };
//     }
//   );
//   console.log(`Total polygons: ${polygons.length}`);

//   // ── Labels ─────────────────────────────────────────────────────────────────────
//   console.log("Processing labels...");
//   const labels = (labelLayer?.graphics?.items || []).map(
//     (l: any, index: number) => {
//       const sym = l.symbol as any;
//       const attrs: any = {
//         parentId: l.attributes.parentId,
//         showAtZoom: l.attributes.showAtZoom ?? null,
//         hideAtZoom: l.attributes.hideAtZoom ?? null,
//         fontSize: sym.font.size,
//         color: sym.color,
//         haloColor: sym.haloColor,
//         haloSize: sym.haloSize,
//         text: sym.text,
//       };

//       const geom = {
//         type: l.geometry.type,
//         x: l.geometry.x,
//         y: l.geometry.y,
//         spatialReference:
//           l.geometry.spatialReference?.toJSON?.() ??
//           l.geometry.spatialReference,
//       };

//       console.log(
//         `Label ${index}: "${sym.text}" (parentId: ${attrs.parentId})`
//       );

//       return { attributes: attrs, geometry: geom };
//     }
//   );
//   console.log(`Total labels: ${labels.length}`);

//   console.log("========== EXPORT GENERATION COMPLETE ==========");
//   console.log("Summary:", {
//     polygons: polygons.length,
//     labels: labels.length,
//     events: events.length,
//   });

//   return { polygons, labels, events };
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
//   console.log("========== STARTING SAVE TO SERVER ==========");
//   console.log("Map ID:", mapId);
//   console.log("User Email:", userEmail);
//   console.log("Settings:", settings);

//   const { polygons, labels, events } = generateExport();

//   console.log("========== FINAL DATA BEFORE API CALL ==========");
//   console.log("Polygons count:", polygons.length);
//   console.log("Labels count:", labels.length);
//   console.log("Events count:", events.length);

//   // Detailed events logging
//   console.log("Events detail:");
//   events.forEach((event, index) => {
//     console.log(`Event ${index}:`, {
//       id: event.attributes.id,
//       event_name: event.attributes.event_name,
//       date: event.attributes.date,
//       location: event.attributes.locationTag,
//       geometry: {
//         x: event.geometry.x,
//         y: event.geometry.y,
//         spatialReference: event.geometry.spatialReference,
//       },
//     });
//   });

//   if (polygons.length === 0 && labels.length === 0 && events.length === 0) {
//     console.warn("⚠️ Nothing to save (no polygons, labels, or events).");
//     return;
//   }

//   const payload = {
//     userEmail,
//     polygons,
//     labels,
//     events,
//     settings,
//   };

//   console.log("API Payload:", JSON.stringify(payload, null, 2));

//   fetch(`/api/maps/${mapId}`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(payload),
//   })
//     .then((res) => {
//       console.log(`API Response Status: ${res.status} ${res.statusText}`);
//       if (!res.ok) {
//         console.error(`Save failed (${res.status}):`, res.statusText);
//         return res.json().then((body) => {
//           console.error("Error body:", body);
//           throw new Error(`Save failed: ${res.statusText}`);
//         });
//       }
//       return res.json();
//     })
//     .then((updatedMap) => {
//       console.log("✅ Map saved successfully:", updatedMap);
//       console.log("========== SAVE COMPLETE ==========");
//     })
//     .catch((err) => {
//       console.error("❌ Error saving map:", err);
//       console.log("========== SAVE FAILED ==========");
//     });
// }
// saveMap.ts
// import {
//   finalizedLayerRef,
//   labelsLayerRef,
//   eventsLayerRef, // ⬅️ NEW
//   eventsStore, // ⬅️ Import eventsStore as well
// } from "@/app/components/map/arcgisRefs";

// /**
//  * POST the map (polygons, labels, events, settings) to /api/maps/[id]
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

// interface SpatialReference {
//   wkid: number;
//   latestWkid: number;
// }

// interface EventPoint {
//   attributes: {
//     id: string;
//     event_name: string;
//     description?: string | null;
//     date?: string | null;
//     startAt?: string | null;
//     endAt?: string | null;
//     locationTag?: string | null;
//     names?: string[] | null;
//     original?: any | null;
//     fromUser: boolean;
//   };
//   geometry: {
//     type: "point";
//     x: number;
//     y: number;
//     spatialReference: SpatialReference;
//   };
// }

// // Serialize polygons, labels, and events
// function generateExport(): { polygons: any[]; labels: any[]; events: any[] } {
//   console.log("========== STARTING EXPORT GENERATION ==========");

//   const polyLayer = finalizedLayerRef.current as any;
//   const labelLayer = labelsLayerRef.current as any;

//   // Debug eventsLayerRef structure
//   console.log("eventsLayerRef.current:", eventsLayerRef.current);
//   console.log("eventsLayerRef.current type:", typeof eventsLayerRef.current);
//   console.log(
//     "eventsLayerRef.current keys:",
//     eventsLayerRef.current ? Object.keys(eventsLayerRef.current) : "null"
//   );

//   // Check if it's a graphics layer
//   if (eventsLayerRef.current && typeof eventsLayerRef.current === "object") {
//     console.log(
//       "eventsLayerRef.current.graphics:",
//       eventsLayerRef.current.graphics
//     );
//     if (eventsLayerRef.current.graphics) {
//       console.log(
//         "eventsLayerRef.current.graphics.items:",
//         eventsLayerRef.current.graphics.items
//       );
//       console.log(
//         "eventsLayerRef.current.graphics.items length:",
//         eventsLayerRef.current.graphics?.items?.length || 0
//       );
//     }
//   }

//   // Also check eventsStore
//   console.log("eventsStore.items:", eventsStore.items);
//   console.log("eventsStore.items length:", eventsStore.items?.length || 0);

//   // ── Events (points): merge from both layer and store ─────────────────────────
//   const events: any[] = [];
//   const processedIds = new Set<string>();

//   // First, try to get events from the graphics layer (if it exists)
//   const eventsLayer = eventsLayerRef.current as any;
//   if (eventsLayer?.graphics?.items) {
//     console.log(
//       `Processing ${eventsLayer.graphics.items.length} events from graphics layer...`
//     );

//     eventsLayer.graphics.items.forEach((graphic: any, index: number) => {
//       const a = graphic.attributes || {};
//       console.log(`Event ${index} from layer:`, {
//         id: a.id,
//         event_name: a.event_name,
//         fromUser: a.fromUser,
//       });

//       if (a.id && !processedIds.has(a.id)) {
//         processedIds.add(a.id);
//         const eventObj = {
//           attributes: {
//             id: a.id,
//             event_name: a.event_name,
//             description: a.description ?? null,
//             date: a.date ?? null,
//             startAt: a.startAt ?? null,
//             endAt: a.endAt ?? null,
//             locationTag: a.locationTag ?? null,
//             names: a.names ?? null,
//             original: a.original ?? null,
//             fromUser: a.fromUser ?? false,
//           },
//           geometry: {
//             type: "point" as const,
//             x: graphic.geometry?.x,
//             y: graphic.geometry?.y,
//             spatialReference: graphic.geometry?.spatialReference?.toJSON?.() ??
//               graphic.geometry?.spatialReference ?? {
//                 wkid: 4326,
//                 latestWkid: 4326,
//               },
//           },
//         };
//         events.push(eventObj);
//         console.log(`Added event from layer: "${a.event_name}" (id: ${a.id})`);
//       }
//     });
//   } else {
//     console.log("No events found in graphics layer (eventsLayerRef.current)");
//   }

//   // Then, add any events from the store that weren't already in the layer
//   if (eventsStore?.items && Array.isArray(eventsStore.items)) {
//     console.log(
//       `Processing ${eventsStore.items.length} events from eventsStore...`
//     );

//     eventsStore.items.forEach((ev: any, index: number) => {
//       console.log(`Event ${index} from store:`, {
//         id: ev.id,
//         event_name: ev.event_name,
//         fromUser: ev.fromUser,
//       });

//       if (ev.id && !processedIds.has(ev.id)) {
//         processedIds.add(ev.id);
//         const eventObj = {
//           attributes: {
//             id: ev.id,
//             event_name: ev.event_name,
//             description: ev.description ?? null,
//             date: ev.date ?? null,
//             startAt: ev.startAt ?? null,
//             endAt: ev.endAt ?? null,
//             locationTag: ev.locationTag ?? null,
//             names: ev.names ?? null,
//             original: ev.original ?? null,
//             fromUser: ev.fromUser ?? false,
//           },
//           geometry: {
//             type: "point" as const,
//             x: ev.geometry?.x,
//             y: ev.geometry?.y,
//             spatialReference: {
//               wkid: ev.geometry?.wkid ?? 4326,
//               latestWkid: ev.geometry?.wkid ?? 4326,
//             },
//           },
//         };
//         events.push(eventObj);
//         console.log(
//           `Added event from store: "${ev.event_name}" (id: ${ev.id})`
//         );
//       }
//     });
//   } else {
//     console.log("No events found in eventsStore");
//   }

//   console.log(`TOTAL EVENTS COLLECTED: ${events.length}`);
//   events.forEach((e, i) => {
//     console.log(
//       `Final Event ${i}: "${e.attributes.event_name}" (id: ${e.attributes.id}, fromUser: ${e.attributes.fromUser})`
//     );
//   });

//   // ── Polygons ──────────────────────────────────────────────────────────────────
//   console.log("Processing polygons...");
//   const polygons = (polyLayer?.graphics?.items || []).map(
//     (g: any, index: number) => {
//       const attrs: any = {
//         id: g.attributes.id,
//         name: g.attributes.name,
//         description: g.attributes.description,
//       };
//       if (g.attributes.showAtZoom != null)
//         attrs.showAtZoom = g.attributes.showAtZoom;
//       if (g.attributes.hideAtZoom != null)
//         attrs.hideAtZoom = g.attributes.hideAtZoom;

//       const geom = {
//         type: g.geometry.type,
//         rings: g.geometry.rings,
//         spatialReference:
//           g.geometry.spatialReference?.toJSON?.() ??
//           g.geometry.spatialReference,
//       };

//       const sym = g.symbol;
//       const color =
//         typeof sym.color?.toRgba === "function"
//           ? sym.color.toRgba()
//           : sym.color;
//       const outline = sym.outline;
//       const outlineColor =
//         typeof outline?.color?.toRgba === "function"
//           ? outline.color.toRgba()
//           : outline?.color;

//       console.log(`Polygon ${index}: "${attrs.name}" (id: ${attrs.id})`);

//       return {
//         attributes: attrs,
//         geometry: geom,
//         symbol: {
//           type: sym.type,
//           color,
//           outline: {
//             color: outlineColor,
//             width: outline?.width,
//           },
//         },
//       };
//     }
//   );
//   console.log(`Total polygons: ${polygons.length}`);

//   // ── Labels ─────────────────────────────────────────────────────────────────────
//   console.log("Processing labels...");
//   const labels = (labelLayer?.graphics?.items || []).map(
//     (l: any, index: number) => {
//       const sym = l.symbol as any;
//       const attrs: any = {
//         parentId: l.attributes.parentId,
//         showAtZoom: l.attributes.showAtZoom ?? null,
//         hideAtZoom: l.attributes.hideAtZoom ?? null,
//         fontSize: sym.font.size,
//         color: sym.color,
//         haloColor: sym.haloColor,
//         haloSize: sym.haloSize,
//         text: sym.text,
//       };

//       const geom = {
//         type: l.geometry.type,
//         x: l.geometry.x,
//         y: l.geometry.y,
//         spatialReference:
//           l.geometry.spatialReference?.toJSON?.() ??
//           l.geometry.spatialReference,
//       };

//       console.log(
//         `Label ${index}: "${sym.text}" (parentId: ${attrs.parentId})`
//       );

//       return { attributes: attrs, geometry: geom };
//     }
//   );
//   console.log(`Total labels: ${labels.length}`);

//   console.log("========== EXPORT GENERATION COMPLETE ==========");
//   console.log("Summary:", {
//     polygons: polygons.length,
//     labels: labels.length,
//     events: events.length,
//   });

//   return { polygons, labels, events };
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
//   console.log("========== STARTING SAVE TO SERVER ==========");
//   console.log("Map ID:", mapId);
//   console.log("User Email:", userEmail);
//   console.log("Settings:", settings);

//   const { polygons, labels, events } = generateExport();

//   console.log("========== FINAL DATA BEFORE API CALL ==========");
//   console.log("Polygons count:", polygons.length);
//   console.log("Labels count:", labels.length);
//   console.log("Events count:", events.length);

//   // Detailed events logging
//   console.log("Events detail:");
//   events.forEach((event, index) => {
//     console.log(`Event ${index}:`, {
//       id: event.attributes.id,
//       event_name: event.attributes.event_name,
//       date: event.attributes.date,
//       location: event.attributes.locationTag,
//       geometry: {
//         x: event.geometry.x,
//         y: event.geometry.y,
//         spatialReference: event.geometry.spatialReference,
//       },
//     });
//   });

//   if (polygons.length === 0 && labels.length === 0 && events.length === 0) {
//     console.warn("⚠️ Nothing to save (no polygons, labels, or events).");
//     return;
//   }

//   const payload = {
//     userEmail,
//     polygons,
//     labels,
//     events,
//     settings,
//   };

//   console.log("API Payload:", JSON.stringify(payload, null, 2));

//   fetch(`/api/maps/${mapId}`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(payload),
//   })
//     .then((res) => {
//       console.log(`API Response Status: ${res.status} ${res.statusText}`);
//       if (!res.ok) {
//         console.error(`Save failed (${res.status}):`, res.statusText);
//         return res.json().then((body) => {
//           console.error("Error body:", body);
//           throw new Error(`Save failed: ${res.statusText}`);
//         });
//       }
//       return res.json();
//     })
//     .then((updatedMap) => {
//       console.log("✅ Map saved successfully:", updatedMap);
//       console.log("========== SAVE COMPLETE ==========");
//     })
//     .catch((err) => {
//       console.error("❌ Error saving map:", err);
//       console.log("========== SAVE FAILED ==========");
//     });
// }
// saveMap.ts
// import {
//   finalizedLayerRef,
//   labelsLayerRef,
//   eventsLayerRef, // ⬅️ NEW
// } from "@/app/components/map/arcgisRefs";

// /**
//  * POST the map (polygons, labels, events, settings) to /api/maps/[id]
//  */
// interface FieldInfo {
//   fieldName: string;
//   label: string;
//   visible: boolean;
//   format?: { digitSeparator?: boolean; places?: number };
// }
// interface FeatureLayerConfig {
//   url: string;
//   index: number;
//   outFields: string[];
//   popupEnabled: boolean;
//   popupTemplate?: {
//     title: string;
//     content: Array<{ type: string; fieldInfos?: FieldInfo[] }>;
//   };
// }

// interface SpatialReference {
//   wkid: number;
//   latestWkid: number;
// }

// interface EventPoint {
//   attributes: {
//     id: string;
//     event_name: string;
//     description?: string | null;
//     date?: string | null;
//     startAt?: string | null;
//     endAt?: string | null;
//     locationTag?: string | null;
//     names?: string[] | null;
//     original?: any | null;
//     fromUser: boolean;
//   };
//   geometry: {
//     type: "point";
//     x: number;
//     y: number;
//     spatialReference: SpatialReference;
//   };
// }

// // Serialize polygons, labels, and events
// function generateExport(): { polygons: any[]; labels: any[]; events: any[] } {
//   const polyLayer = finalizedLayerRef.current as any;
//   const labelLayer = labelsLayerRef.current as any;

//   console.log(eventsLayerRef.current);

//   // ── Events (points): filter out non-user events and serialize ───────────────
//   const eventSrc: EventPoint[] = Array.isArray(eventsLayerRef.current)
//     ? (eventsLayerRef.current as EventPoint[])
//     : [];

//   const events = eventSrc.map((g) => {
//     const a = g.attributes;
//     console.log(a.event_name);
//     return {
//       attributes: {
//         id: a.id,
//         event_name: a.event_name,
//         description: a.description ?? null,
//         date: a.date ?? null,
//         startAt: a.startAt ?? null,
//         endAt: a.endAt ?? null,
//         locationTag: a.locationTag ?? null,
//         names: a.names ?? null,
//         original: a.original ?? null,
//         fromUser: a.fromUser,
//         // omit fromUser in export on purpose; it was only for filtering
//       },
//       geometry: {
//         type: g.geometry.type, // "point"
//         x: g.geometry.x,
//         y: g.geometry.y,
//         spatialReference:
//           (g.geometry.spatialReference as any)?.toJSON?.() ??
//           g.geometry.spatialReference,
//       },
//     };
//   });

//   // ── Polygons ────────────────────────────────────────────────────────────────
//   const polygons = (polyLayer?.graphics?.items || []).map((g: any) => {
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
//       spatialReference:
//         g.geometry.spatialReference?.toJSON?.() ?? g.geometry.spatialReference,
//     };

//     const sym = g.symbol;
//     const color =
//       typeof sym.color?.toRgba === "function" ? sym.color.toRgba() : sym.color;
//     const outline = sym.outline;
//     const outlineColor =
//       typeof outline?.color?.toRgba === "function"
//         ? outline.color.toRgba()
//         : outline?.color;

//     return {
//       attributes: attrs,
//       geometry: geom,
//       symbol: {
//         type: sym.type,
//         color,
//         outline: {
//           color: outlineColor,
//           width: outline?.width,
//         },
//       },
//     };
//   });

//   // ── Labels ─────────────────────────────────────────────────────────────────
//   const labels = (labelLayer?.graphics?.items || []).map((l: any) => {
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
//       spatialReference:
//         l.geometry.spatialReference?.toJSON?.() ?? l.geometry.spatialReference,
//     };
//     return { attributes: attrs, geometry: geom };
//   });

//   return { polygons, labels, events };
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
//   const { polygons, labels, events } = generateExport();
//   console.log(events);

//   if (polygons.length === 0 && labels.length === 0 && events.length === 0) {
//     console.warn("Nothing to save (no polygons, labels, or events).");
//     return;
//   }

//   fetch(`/api/maps/${mapId}`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ userEmail, polygons, labels, events, settings }),
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
