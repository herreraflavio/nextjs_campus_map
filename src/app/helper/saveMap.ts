import {
  finalizedLayerRef,
  labelsLayerRef,
  eventsLayerRef,
  eventsStore,
} from "@/app/components/map/arcgisRefs";

/**
 * POST the map (drawings, labels, events, settings) to /api/maps/[id]
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
    poster_url?: string | null;
    locationTag?: string | null;
    location?: string | null;
    location_at?: string | null;
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

interface PolygonDrawing {
  attributes: Record<string, any>;
  geometry: {
    type: "polygon";
    rings: number[][][];
    spatialReference: SpatialReference;
  };
  symbol: {
    type: "simple-fill";
    color: number[];
    outline: {
      color: number[];
      width: number;
    };
  };
}

interface PolylineDrawing {
  attributes: Record<string, any>;
  geometry: {
    type: "polyline";
    paths: number[][][];
    spatialReference: SpatialReference;
  };
  symbol: {
    type: "simple-line";
    color: number[];
    width: number;
  };
}

interface PointDrawing {
  attributes: Record<string, any>;
  geometry: {
    type: "point";
    x: number;
    y: number;
    spatialReference: SpatialReference;
  };
  symbol: {
    type: "simple-marker";
    color: number[];
    size: number;
    outline: {
      color: number[];
      width: number;
    };
  };
}

type DrawingExport = PolygonDrawing | PolylineDrawing | PointDrawing;

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

// WebMercator (3857) -> WGS84 (4326)
function webMercatorToGeographic(
  x: number,
  y: number,
): { lon: number; lat: number } {
  // If coordinates already look like lon/lat, return as-is.
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) {
    return { lon: x, lat: y };
  }

  const R = 6378137;
  const lat = (y / R) * (180 / Math.PI);
  const lon = (x / R) * (180 / Math.PI);

  const latDeg =
    (180 / Math.PI) *
    (2 * Math.atan(Math.exp(lat * (Math.PI / 180))) - Math.PI / 2);

  return { lon, lat: latDeg };
}

function normalizeSpatialReference(sr: any): SpatialReference {
  const wkid =
    typeof sr?.wkid === "number"
      ? sr.wkid
      : typeof sr?.latestWkid === "number"
        ? sr.latestWkid
        : 3857;

  return {
    wkid,
    latestWkid: typeof sr?.latestWkid === "number" ? sr.latestWkid : wkid,
  };
}

function toRgbaArray(value: any, fallback: number[]): number[] {
  if (typeof value?.toRgba === "function") {
    return value.toRgba();
  }
  if (Array.isArray(value)) {
    return value;
  }
  return fallback;
}

function serializeDrawing(g: any, index: number): DrawingExport | null {
  const geomType = g?.geometry?.type;
  if (
    geomType !== "polygon" &&
    geomType !== "polyline" &&
    geomType !== "point"
  ) {
    console.warn(`Skipping unsupported drawing at index ${index}:`, g);
    return null;
  }

  const attrs: Record<string, any> = {
    id: g.attributes?.id,
    name: g.attributes?.name,
    description: g.attributes?.description,
  };

  if (g.attributes?.showAtZoom != null) {
    attrs.showAtZoom = g.attributes.showAtZoom;
  }
  if (g.attributes?.hideAtZoom != null) {
    attrs.hideAtZoom = g.attributes.hideAtZoom;
  }
  if (g.attributes?.order != null) {
    attrs.order = g.attributes.order;
  }
  if (Array.isArray(g.attributes?.color)) {
    attrs.color = g.attributes.color;
  }
  if (typeof g.attributes?.width === "number") {
    attrs.width = g.attributes.width;
  }
  if (typeof g.attributes?.size === "number") {
    attrs.size = g.attributes.size;
  }

  const sr = normalizeSpatialReference(
    g.geometry?.spatialReference?.toJSON?.() ?? g.geometry?.spatialReference,
  );

  const sym = g.symbol ?? {};
  const color = toRgbaArray(
    sym.color,
    geomType === "polygon" ? [154, 254, 247, 0.37] : [255, 0, 0, 1],
  );

  if (geomType === "polygon") {
    if (!Array.isArray(g.geometry?.rings)) {
      console.warn(`Skipping polygon with missing rings at index ${index}:`, g);
      return null;
    }

    const outlineColor = toRgbaArray(sym.outline?.color, [255, 0, 0, 1]);
    const outlineWidth =
      typeof sym.outline?.width === "number" ? sym.outline.width : 1;

    console.log(`Polygon ${index}: "${attrs.name}" (id: ${attrs.id})`);

    return {
      attributes: attrs,
      geometry: {
        type: "polygon",
        rings: g.geometry.rings,
        spatialReference: sr,
      },
      symbol: {
        type: "simple-fill",
        color,
        outline: {
          color: outlineColor,
          width: outlineWidth,
        },
      },
    };
  }

  if (geomType === "polyline") {
    if (!Array.isArray(g.geometry?.paths)) {
      console.warn(
        `Skipping polyline with missing paths at index ${index}:`,
        g,
      );
      return null;
    }

    const width =
      typeof sym.width === "number"
        ? sym.width
        : typeof g.attributes?.width === "number"
          ? g.attributes.width
          : 3;

    console.log(`Polyline ${index}: "${attrs.name}" (id: ${attrs.id})`);

    return {
      attributes: attrs,
      geometry: {
        type: "polyline",
        paths: g.geometry.paths,
        spatialReference: sr,
      },
      symbol: {
        type: "simple-line",
        color,
        width,
      },
    };
  }

  if (typeof g.geometry?.x !== "number" || typeof g.geometry?.y !== "number") {
    console.warn(`Skipping point with missing x/y at index ${index}:`, g);
    return null;
  }

  const outlineColor = toRgbaArray(sym.outline?.color, [255, 0, 0, 1]);
  const outlineWidth =
    typeof sym.outline?.width === "number" ? sym.outline.width : 1;

  const size =
    typeof sym.size === "number"
      ? sym.size
      : typeof g.attributes?.size === "number"
        ? g.attributes.size
        : 10;

  console.log(`Point ${index}: "${attrs.name}" (id: ${attrs.id})`);

  return {
    attributes: attrs,
    geometry: {
      type: "point",
      x: g.geometry.x,
      y: g.geometry.y,
      spatialReference: sr,
    },
    symbol: {
      type: "simple-marker",
      color,
      size,
      outline: {
        color: outlineColor,
        width: outlineWidth,
      },
    },
  };
}

// Serialize drawings, labels, and events
// Note: we filter layer events to fromUser==true; store events are kept as-is unless FILTER_STORE_EVENTS is true.
function generateExport(): {
  polygons: DrawingExport[];
  labels: any[];
  events: EventPoint[];
} {
  console.log("========== STARTING EXPORT GENERATION ==========");

  const polyLayer = finalizedLayerRef.current as any;
  const labelLayer = labelsLayerRef.current as any;

  console.log("eventsLayerRef.current:", eventsLayerRef.current);
  console.log("eventsLayerRef.current type:", typeof eventsLayerRef.current);
  console.log(
    "eventsLayerRef.current keys:",
    eventsLayerRef.current ? Object.keys(eventsLayerRef.current) : "null",
  );

  if (eventsLayerRef.current && typeof eventsLayerRef.current === "object") {
    console.log(
      "eventsLayerRef.current.graphics:",
      eventsLayerRef.current.graphics,
    );
    if (eventsLayerRef.current.graphics) {
      console.log(
        "eventsLayerRef.current.graphics.items:",
        eventsLayerRef.current.graphics.items,
      );
      console.log(
        "eventsLayerRef.current.graphics.items length:",
        eventsLayerRef.current.graphics?.items?.length || 0,
      );
    }
  }

  console.log("eventsStore.items:", eventsStore.items);
  console.log("eventsStore.items length:", eventsStore.items?.length || 0);

  // ── Events ──────────────────────────────────────────────────────────────────
  const events: EventPoint[] = [];
  const processedIds = new Set<string>();

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
      `Processing ${layerUserItems.length} user events from graphics layer (out of ${rawItems.length})...`,
    );

    layerUserItems.forEach((graphic: any) => {
      const a = graphic.attributes || {};

      if (a.id && !processedIds.has(a.id)) {
        processedIds.add(a.id);

        let finalX = graphic.geometry?.x;
        let finalY = graphic.geometry?.y;

        if (typeof finalX === "number" && typeof finalY === "number") {
          const { lon, lat } = webMercatorToGeographic(finalX, finalY);
          finalX = lon;
          finalY = lat;
        }

        const eventObj: EventPoint = {
          attributes: {
            id: a.id,
            event_name: a.event_name,
            description: a.description ?? null,
            date: a.date ?? null,
            startAt: a.startAt ?? null,
            endAt: a.endAt ?? null,
            locationTag: a.locationTag ?? null,
            location: a.location ?? null,
            location_at: a.location_at ?? null,
            poster_url: a.poster_url ?? null,
            names: a.names ?? null,
            original: a.original ?? null,
            fromUser: true,
          },
          geometry: {
            type: "point",
            x: finalX,
            y: finalY,
            spatialReference: {
              wkid: 4326,
              latestWkid: 4326,
            },
          },
        };

        events.push(eventObj);
        console.log(
          `Added user event from layer: "${a.event_name}" (id: ${a.id})`,
        );
      }
    });
  } else {
    console.log("No events found in graphics layer (eventsLayerRef.current)");
  }

  if (eventsStore?.items && Array.isArray(eventsStore.items)) {
    console.log(
      `Processing ${eventsStore.items.length} events from eventsStore...`,
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

        let finalX = ev.geometry?.x;
        let finalY = ev.geometry?.y;

        if (typeof finalX === "number" && typeof finalY === "number") {
          const { lon, lat } = webMercatorToGeographic(finalX, finalY);
          finalX = lon;
          finalY = lat;
        }

        const eventObj: EventPoint = {
          attributes: {
            id: ev.id,
            event_name: ev.event_name,
            description: ev.description ?? null,
            date: ev.date ?? null,
            startAt: ev.startAt ?? null,
            endAt: ev.endAt ?? null,
            locationTag: ev.locationTag ?? null,
            location: ev.location ?? null,
            location_at: ev.location_at ?? null,
            names: ev.names ?? null,
            original: ev.original ?? null,
            fromUser: normalizedFromUser,
          },
          geometry: {
            type: "point",
            x: finalX,
            y: finalY,
            spatialReference: {
              wkid: 4326,
              latestWkid: 4326,
            },
          },
        };

        events.push(eventObj);
        console.log(
          `Added event from store: "${ev.event_name}" (id: ${ev.id})`,
        );
      }
    });
  } else {
    console.log("No events found in eventsStore");
  }

  console.log(`TOTAL EVENTS COLLECTED: ${events.length}`);
  events.forEach((e, i) => {
    console.log(
      `Final Event ${i}: "${e.attributes.event_name}" (id: ${e.attributes.id}, fromUser: ${e.attributes.fromUser})`,
    );
  });

  // ── Drawings (polygons + polylines + points) ───────────────────────────────
  console.log("Processing drawings...");
  const polygons: DrawingExport[] = (
    (polyLayer?.graphics?.items || []) as any[]
  )
    .map((g: any, index: number) => serializeDrawing(g, index))
    .filter((d): d is DrawingExport => d !== null);

  console.log(`Total drawings: ${polygons.length}`);

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
        spatialReference: normalizeSpatialReference(
          l.geometry.spatialReference?.toJSON?.() ??
            l.geometry.spatialReference,
        ),
      };

      console.log(
        `Label ${index}: "${sym.text}" (parentId: ${attrs.parentId})`,
      );

      return { attributes: attrs, geometry: geom };
    },
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
    mapTile: string | null;
    baseMap: string | null;
    apiSources: string[];
  },
): void {
  console.log("========== STARTING SAVE TO SERVER ==========");
  console.log("Map ID:", mapId);
  console.log("User Email:", userEmail);
  console.log("Settings:", settings);

  const { polygons, labels, events } = generateExport();

  console.log("========== FINAL DATA BEFORE API CALL ==========");
  console.log("Drawings count:", polygons.length);
  console.log("Labels count:", labels.length);
  console.log("Events count:", events.length);

  console.log("Drawings detail:");
  polygons.forEach((drawing, index) => {
    console.log(`Drawing ${index}:`, drawing);
  });

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
    console.warn("⚠️ Nothing to save (no drawings, labels, or events).");
    return;
  }

  const payload = {
    userEmail,
    polygons,
    labels,
    events,
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
// import {
//   finalizedLayerRef,
//   labelsLayerRef,
//   eventsLayerRef,
//   eventsStore,
// } from "@/app/components/map/arcgisRefs";

// /**
//  * POST the map (drawings, labels, events, settings) to /api/maps/[id]
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
//     poster_url?: string | null;
//     locationTag?: string | null;
//     location?: string | null;
//     location_at?: string | null;
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

// interface PolygonDrawing {
//   attributes: Record<string, any>;
//   geometry: {
//     type: "polygon";
//     rings: number[][][];
//     spatialReference: SpatialReference;
//   };
//   symbol: {
//     type: "simple-fill";
//     color: number[];
//     outline: {
//       color: number[];
//       width: number;
//     };
//   };
// }

// interface PolylineDrawing {
//   attributes: Record<string, any>;
//   geometry: {
//     type: "polyline";
//     paths: number[][][];
//     spatialReference: SpatialReference;
//   };
//   symbol: {
//     type: "simple-line";
//     color: number[];
//     width: number;
//   };
// }

// type DrawingExport = PolygonDrawing | PolylineDrawing;

// // ---------- config toggles ----------
// /**
//  * By requirement: only filter LAYER events to fromUser==true.
//  * If you also want to restrict STORE events, set this to true.
//  */
// const FILTER_STORE_EVENTS = false;

// // Robust truthiness normalizer for fromUser flags coming from attributes or store
// const isTrue = (v: unknown): boolean => {
//   if (v === true || v === 1) return true;
//   if (typeof v === "string") {
//     const s = v.trim().toLowerCase();
//     return s === "true" || s === "1" || s === "yes";
//   }
//   return false;
// };

// // WebMercator (3857) -> WGS84 (4326)
// function webMercatorToGeographic(
//   x: number,
//   y: number,
// ): { lon: number; lat: number } {
//   // If coordinates already look like lon/lat, return as-is.
//   if (Math.abs(x) <= 180 && Math.abs(y) <= 90) {
//     return { lon: x, lat: y };
//   }

//   const R = 6378137;
//   const lat = (y / R) * (180 / Math.PI);
//   const lon = (x / R) * (180 / Math.PI);

//   const latDeg =
//     (180 / Math.PI) *
//     (2 * Math.atan(Math.exp(lat * (Math.PI / 180))) - Math.PI / 2);

//   return { lon, lat: latDeg };
// }

// function normalizeSpatialReference(sr: any): SpatialReference {
//   const wkid =
//     typeof sr?.wkid === "number"
//       ? sr.wkid
//       : typeof sr?.latestWkid === "number"
//         ? sr.latestWkid
//         : 3857;

//   return {
//     wkid,
//     latestWkid: typeof sr?.latestWkid === "number" ? sr.latestWkid : wkid,
//   };
// }

// function toRgbaArray(value: any, fallback: number[]): number[] {
//   if (typeof value?.toRgba === "function") {
//     return value.toRgba();
//   }
//   if (Array.isArray(value)) {
//     return value;
//   }
//   return fallback;
// }

// function serializeDrawing(g: any, index: number): DrawingExport | null {
//   const geomType = g?.geometry?.type;
//   if (geomType !== "polygon" && geomType !== "polyline") {
//     console.warn(`Skipping unsupported drawing at index ${index}:`, g);
//     return null;
//   }

//   const attrs: Record<string, any> = {
//     id: g.attributes?.id,
//     name: g.attributes?.name,
//     description: g.attributes?.description,
//   };

//   if (g.attributes?.showAtZoom != null)
//     attrs.showAtZoom = g.attributes.showAtZoom;
//   if (g.attributes?.hideAtZoom != null)
//     attrs.hideAtZoom = g.attributes.hideAtZoom;
//   if (g.attributes?.order != null) attrs.order = g.attributes.order;
//   if (Array.isArray(g.attributes?.color)) attrs.color = g.attributes.color;
//   if (typeof g.attributes?.width === "number") attrs.width = g.attributes.width;

//   const sr = normalizeSpatialReference(
//     g.geometry?.spatialReference?.toJSON?.() ?? g.geometry?.spatialReference,
//   );

//   const sym = g.symbol ?? {};
//   const color = toRgbaArray(
//     sym.color,
//     geomType === "polygon" ? [154, 254, 247, 0.37] : [255, 0, 0, 1],
//   );

//   if (geomType === "polygon") {
//     if (!Array.isArray(g.geometry?.rings)) {
//       console.warn(`Skipping polygon with missing rings at index ${index}:`, g);
//       return null;
//     }

//     const outlineColor = toRgbaArray(sym.outline?.color, [255, 0, 0, 1]);
//     const outlineWidth =
//       typeof sym.outline?.width === "number" ? sym.outline.width : 1;

//     console.log(`Polygon ${index}: "${attrs.name}" (id: ${attrs.id})`);

//     return {
//       attributes: attrs,
//       geometry: {
//         type: "polygon",
//         rings: g.geometry.rings,
//         spatialReference: sr,
//       },
//       symbol: {
//         type: "simple-fill",
//         color,
//         outline: {
//           color: outlineColor,
//           width: outlineWidth,
//         },
//       },
//     };
//   }

//   if (!Array.isArray(g.geometry?.paths)) {
//     console.warn(`Skipping polyline with missing paths at index ${index}:`, g);
//     return null;
//   }

//   const width =
//     typeof sym.width === "number"
//       ? sym.width
//       : typeof g.attributes?.width === "number"
//         ? g.attributes.width
//         : 3;

//   console.log(`Polyline ${index}: "${attrs.name}" (id: ${attrs.id})`);

//   return {
//     attributes: attrs,
//     geometry: {
//       type: "polyline",
//       paths: g.geometry.paths,
//       spatialReference: sr,
//     },
//     symbol: {
//       type: "simple-line",
//       color,
//       width,
//     },
//   };
// }

// // Serialize drawings, labels, and events
// // Note: we filter layer events to fromUser==true; store events are kept as-is unless FILTER_STORE_EVENTS is true.
// function generateExport(): {
//   polygons: DrawingExport[];
//   labels: any[];
//   events: EventPoint[];
// } {
//   console.log("========== STARTING EXPORT GENERATION ==========");

//   const polyLayer = finalizedLayerRef.current as any;
//   const labelLayer = labelsLayerRef.current as any;

//   console.log("eventsLayerRef.current:", eventsLayerRef.current);
//   console.log("eventsLayerRef.current type:", typeof eventsLayerRef.current);
//   console.log(
//     "eventsLayerRef.current keys:",
//     eventsLayerRef.current ? Object.keys(eventsLayerRef.current) : "null",
//   );

//   if (eventsLayerRef.current && typeof eventsLayerRef.current === "object") {
//     console.log(
//       "eventsLayerRef.current.graphics:",
//       eventsLayerRef.current.graphics,
//     );
//     if (eventsLayerRef.current.graphics) {
//       console.log(
//         "eventsLayerRef.current.graphics.items:",
//         eventsLayerRef.current.graphics.items,
//       );
//       console.log(
//         "eventsLayerRef.current.graphics.items length:",
//         eventsLayerRef.current.graphics?.items?.length || 0,
//       );
//     }
//   }

//   console.log("eventsStore.items:", eventsStore.items);
//   console.log("eventsStore.items length:", eventsStore.items?.length || 0);

//   // ── Events ──────────────────────────────────────────────────────────────────
//   const events: EventPoint[] = [];
//   const processedIds = new Set<string>();

//   const eventsLayer = eventsLayerRef.current as any;
//   if (eventsLayer?.graphics?.items) {
//     const rawItems = eventsLayer.graphics.items as any[];

//     const layerUserItems = rawItems.filter((graphic: any, index: number) => {
//       const a = graphic?.attributes ?? {};
//       const keep = isTrue(a.fromUser);
//       console.log(`Layer event ${index} pre-filter:`, {
//         id: a.id,
//         event_name: a.event_name,
//         fromUserRaw: a.fromUser,
//         fromUserNormalized: keep,
//         kept: keep,
//       });
//       return keep;
//     });

//     console.log(
//       `Processing ${layerUserItems.length} user events from graphics layer (out of ${rawItems.length})...`,
//     );

//     layerUserItems.forEach((graphic: any) => {
//       const a = graphic.attributes || {};

//       if (a.id && !processedIds.has(a.id)) {
//         processedIds.add(a.id);

//         let finalX = graphic.geometry?.x;
//         let finalY = graphic.geometry?.y;

//         if (typeof finalX === "number" && typeof finalY === "number") {
//           const { lon, lat } = webMercatorToGeographic(finalX, finalY);
//           finalX = lon;
//           finalY = lat;
//         }

//         const eventObj: EventPoint = {
//           attributes: {
//             id: a.id,
//             event_name: a.event_name,
//             description: a.description ?? null,
//             date: a.date ?? null,
//             startAt: a.startAt ?? null,
//             endAt: a.endAt ?? null,
//             locationTag: a.locationTag ?? null,
//             location: a.location ?? null,
//             location_at: a.location_at ?? null,
//             poster_url: a.poster_url ?? null,
//             names: a.names ?? null,
//             original: a.original ?? null,
//             fromUser: true,
//           },
//           geometry: {
//             type: "point",
//             x: finalX,
//             y: finalY,
//             spatialReference: {
//               wkid: 4326,
//               latestWkid: 4326,
//             },
//           },
//         };

//         events.push(eventObj);
//         console.log(
//           `Added user event from layer: "${a.event_name}" (id: ${a.id})`,
//         );
//       }
//     });
//   } else {
//     console.log("No events found in graphics layer (eventsLayerRef.current)");
//   }

//   if (eventsStore?.items && Array.isArray(eventsStore.items)) {
//     console.log(
//       `Processing ${eventsStore.items.length} events from eventsStore...`,
//     );

//     eventsStore.items.forEach((ev: any, index: number) => {
//       const normalizedFromUser = isTrue(ev.fromUser);
//       const keep = FILTER_STORE_EVENTS ? normalizedFromUser : true;

//       console.log(`Event ${index} from store:`, {
//         id: ev.id,
//         event_name: ev.event_name,
//         fromUserRaw: ev.fromUser,
//         fromUserNormalized: normalizedFromUser,
//       });

//       if (!keep) return;

//       if (ev.id && !processedIds.has(ev.id)) {
//         processedIds.add(ev.id);

//         let finalX = ev.geometry?.x;
//         let finalY = ev.geometry?.y;

//         if (typeof finalX === "number" && typeof finalY === "number") {
//           const { lon, lat } = webMercatorToGeographic(finalX, finalY);
//           finalX = lon;
//           finalY = lat;
//         }

//         const eventObj: EventPoint = {
//           attributes: {
//             id: ev.id,
//             event_name: ev.event_name,
//             description: ev.description ?? null,
//             date: ev.date ?? null,
//             startAt: ev.startAt ?? null,
//             endAt: ev.endAt ?? null,
//             locationTag: ev.locationTag ?? null,
//             location: ev.location ?? null,
//             location_at: ev.location_at ?? null,
//             names: ev.names ?? null,
//             original: ev.original ?? null,
//             fromUser: normalizedFromUser,
//           },
//           geometry: {
//             type: "point",
//             x: finalX,
//             y: finalY,
//             spatialReference: {
//               wkid: 4326,
//               latestWkid: 4326,
//             },
//           },
//         };

//         events.push(eventObj);
//         console.log(
//           `Added event from store: "${ev.event_name}" (id: ${ev.id})`,
//         );
//       }
//     });
//   } else {
//     console.log("No events found in eventsStore");
//   }

//   console.log(`TOTAL EVENTS COLLECTED: ${events.length}`);
//   events.forEach((e, i) => {
//     console.log(
//       `Final Event ${i}: "${e.attributes.event_name}" (id: ${e.attributes.id}, fromUser: ${e.attributes.fromUser})`,
//     );
//   });

//   // ── Drawings (polygons + polylines) ────────────────────────────────────────
//   console.log("Processing drawings...");
//   const polygons: DrawingExport[] = (
//     (polyLayer?.graphics?.items || []) as any[]
//   )
//     .map((g: any, index: number) => serializeDrawing(g, index))
//     .filter((d): d is DrawingExport => d !== null);

//   console.log(`Total drawings: ${polygons.length}`);

//   // ── Labels ─────────────────────────────────────────────────────────────────
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
//         spatialReference: normalizeSpatialReference(
//           l.geometry.spatialReference?.toJSON?.() ??
//             l.geometry.spatialReference,
//         ),
//       };

//       console.log(
//         `Label ${index}: "${sym.text}" (parentId: ${attrs.parentId})`,
//       );

//       return { attributes: attrs, geometry: geom };
//     },
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
//     mapTile: string | null;
//     baseMap: string | null;
//     apiSources: string[];
//   },
// ): void {
//   console.log("========== STARTING SAVE TO SERVER ==========");
//   console.log("Map ID:", mapId);
//   console.log("User Email:", userEmail);
//   console.log("Settings:", settings);

//   const { polygons, labels, events } = generateExport();

//   console.log("========== FINAL DATA BEFORE API CALL ==========");
//   console.log("Drawings count:", polygons.length);
//   console.log("Labels count:", labels.length);
//   console.log("Events count:", events.length);

//   console.log("Drawings detail:");
//   polygons.forEach((drawing, index) => {
//     console.log(`Drawing ${index}:`, drawing);
//   });

//   console.log("Events detail:");
//   events.forEach((event, index) => {
//     console.log(`Event ${index}:`, {
//       id: event.attributes.id,
//       event_name: event.attributes.event_name,
//       date: event.attributes.date,
//       fromUser: event.attributes.fromUser,
//       location_at: event.attributes.locationTag,
//       geometry: {
//         x: event.geometry.x,
//         y: event.geometry.y,
//         spatialReference: event.geometry.spatialReference,
//       },
//     });
//   });

//   if (polygons.length === 0 && labels.length === 0 && events.length === 0) {
//     console.warn("⚠️ Nothing to save (no drawings, labels, or events).");
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
// import {
//   finalizedLayerRef,
//   labelsLayerRef,
//   eventsLayerRef, // ⬅️ we read from this layer
//   eventsStore, // ⬅️ and we merge in anything in the store
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
//     poster_url?: string | null;
//     locationTag?: string | null;
//     location?: string | null;
//     location_at?: string | null;
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

// // ---------- config toggles ----------
// /**
//  * By requirement: only filter LAYER events to fromUser==true.
//  * If you also want to restrict STORE events, set this to true.
//  */
// const FILTER_STORE_EVENTS = false;

// // Robust truthiness normalizer for fromUser flags coming from attributes or store
// const isTrue = (v: unknown): boolean => {
//   if (v === true || v === 1) return true;
//   if (typeof v === "string") {
//     const s = v.trim().toLowerCase();
//     return s === "true" || s === "1" || s === "yes";
//   }
//   return false;
// };

// // ── NEW HELPER: WebMercator (3857) -> WGS84 (4326) ───────────────────────────
// function webMercatorToGeographic(
//   x: number,
//   y: number,
// ): { lon: number; lat: number } {
//   // If coordinates look like they are already Lat/Lon (small numbers), return as is.
//   if (Math.abs(x) <= 180 && Math.abs(y) <= 90) {
//     return { lon: x, lat: y };
//   }

//   const R = 6378137; // Earth radius in meters
//   const lat = (y / R) * (180 / Math.PI);
//   const lon = (x / R) * (180 / Math.PI);

//   const latDeg =
//     (180 / Math.PI) *
//     (2 * Math.atan(Math.exp(lat * (Math.PI / 180))) - Math.PI / 2);

//   return { lon, lat: latDeg };
// }
// // ─────────────────────────────────────────────────────────────────────────────

// // Serialize polygons, labels, and events
// // Note: we filter **layer events** to fromUser==true; store events are kept as-is unless FILTER_STORE_EVENTS is true.
// function generateExport(): { polygons: any[]; labels: any[]; events: any[] } {
//   console.log("========== STARTING EXPORT GENERATION ==========");

//   const polyLayer = finalizedLayerRef.current as any;
//   const labelLayer = labelsLayerRef.current as any;

//   // Debug eventsLayerRef structure
//   console.log("eventsLayerRef.current:", eventsLayerRef.current);
//   console.log("eventsLayerRef.current type:", typeof eventsLayerRef.current);
//   console.log(
//     "eventsLayerRef.current keys:",
//     eventsLayerRef.current ? Object.keys(eventsLayerRef.current) : "null",
//   );

//   if (eventsLayerRef.current && typeof eventsLayerRef.current === "object") {
//     console.log(
//       "eventsLayerRef.current.graphics:",
//       eventsLayerRef.current.graphics,
//     );
//     if (eventsLayerRef.current.graphics) {
//       console.log(
//         "eventsLayerRef.current.graphics.items:",
//         eventsLayerRef.current.graphics.items,
//       );
//       console.log(
//         "eventsLayerRef.current.graphics.items length:",
//         eventsLayerRef.current.graphics?.items?.length || 0,
//       );
//     }
//   }

//   // Also check eventsStore
//   console.log("eventsStore.items:", eventsStore.items);
//   console.log("eventsStore.items length:", eventsStore.items?.length || 0);

//   // ── Events (points): merge from both layer and store ─────────────────────────
//   const events: any[] = [];
//   const processedIds = new Set<string>();

//   // --- LAYER: only keep fromUser === true ---
//   const eventsLayer = eventsLayerRef.current as any;
//   if (eventsLayer?.graphics?.items) {
//     const rawItems = eventsLayer.graphics.items as any[];

//     const layerUserItems = rawItems.filter((graphic: any, index: number) => {
//       const a = graphic?.attributes ?? {};
//       const keep = isTrue(a.fromUser);
//       console.log(`Layer event ${index} pre-filter:`, {
//         id: a.id,
//         event_name: a.event_name,
//         fromUserRaw: a.fromUser,
//         fromUserNormalized: keep,
//         kept: keep,
//       });
//       return keep;
//     });

//     console.log(
//       `Processing ${layerUserItems.length} user events from graphics layer (out of ${rawItems.length})...`,
//     );

//     layerUserItems.forEach((graphic: any, index: number) => {
//       const a = graphic.attributes || {};

//       if (a.id && !processedIds.has(a.id)) {
//         processedIds.add(a.id);

//         // Convert coords if they exist
//         let finalX = graphic.geometry?.x;
//         let finalY = graphic.geometry?.y;

//         // If we have coordinates, convert them to Lat/Lon
//         if (typeof finalX === "number" && typeof finalY === "number") {
//           const { lon, lat } = webMercatorToGeographic(finalX, finalY);
//           finalX = lon;
//           finalY = lat;
//         }

//         const eventObj: EventPoint = {
//           attributes: {
//             id: a.id,
//             event_name: a.event_name,
//             description: a.description ?? null,
//             date: a.date ?? null,
//             startAt: a.startAt ?? null,
//             endAt: a.endAt ?? null,
//             locationTag: a.locationTag ?? null,
//             location: a.location ?? null,
//             location_at: a.location_at ?? null,
//             poster_url: a.poster_url ?? null,
//             names: a.names ?? null,
//             original: a.original ?? null,
//             fromUser: true, // normalized + guaranteed by filter
//           },
//           // we will need to convert wkid 3857 back to 4326 for x and y
//           geometry: {
//             type: "point",
//             x: finalX,
//             y: finalY,
//             // Force 4326 metadata now that we converted coords
//             spatialReference: {
//               wkid: 4326,
//               latestWkid: 4326,
//             },
//           },
//         };

//         events.push(eventObj);
//         console.log(
//           `Added user event from layer: "${a.event_name}" (id: ${a.id})`,
//         );
//       }
//     });
//   } else {
//     console.log("No events found in graphics layer (eventsLayerRef.current)");
//   }

//   // --- STORE: add items not already in the layer (optionally filter) ---
//   if (eventsStore?.items && Array.isArray(eventsStore.items)) {
//     console.log(
//       `Processing ${eventsStore.items.length} events from eventsStore...`,
//     );

//     eventsStore.items.forEach((ev: any, index: number) => {
//       const normalizedFromUser = isTrue(ev.fromUser);
//       const keep = FILTER_STORE_EVENTS ? normalizedFromUser : true;

//       console.log(`Event ${index} from store:`, {
//         id: ev.id,
//         event_name: ev.event_name,
//         fromUserRaw: ev.fromUser,
//         fromUserNormalized: normalizedFromUser,
//       });

//       if (!keep) return;

//       if (ev.id && !processedIds.has(ev.id)) {
//         processedIds.add(ev.id);

//         // Convert coords if they exist
//         let finalX = ev.geometry?.x;
//         let finalY = ev.geometry?.y;

//         // If we have coordinates, convert them to Lat/Lon
//         if (typeof finalX === "number" && typeof finalY === "number") {
//           const { lon, lat } = webMercatorToGeographic(finalX, finalY);
//           finalX = lon;
//           finalY = lat;
//         }

//         const eventObj: EventPoint = {
//           attributes: {
//             id: ev.id,
//             event_name: ev.event_name,
//             description: ev.description ?? null,
//             date: ev.date ?? null,
//             startAt: ev.startAt ?? null,
//             endAt: ev.endAt ?? null,
//             locationTag: ev.locationTag ?? null,
//             location: ev.location ?? null,
//             location_at: ev.location_at ?? null,
//             names: ev.names ?? null,
//             original: ev.original ?? null,
//             fromUser: normalizedFromUser,
//           },
//           geometry: {
//             type: "point",
//             x: finalX,
//             y: finalY,
//             // Force 4326 metadata
//             spatialReference: {
//               wkid: 4326,
//               latestWkid: 4326,
//             },
//           },
//         };

//         events.push(eventObj);
//         console.log(
//           `Added event from store: "${ev.event_name}" (id: ${ev.id})`,
//         );
//       }
//     });
//   } else {
//     console.log("No events found in eventsStore");
//   }

//   console.log(`TOTAL EVENTS COLLECTED: ${events.length}`);
//   events.forEach((e, i) => {
//     console.log(
//       `Final Event ${i}: "${e.attributes.event_name}" (id: ${e.attributes.id}, fromUser: ${e.attributes.fromUser})`,
//     );
//   });

//   // ── Polygons ────────────────────────────────────────────────────────────────
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
//     },
//   );
//   console.log(`Total polygons: ${polygons.length}`);

//   // ── Labels ─────────────────────────────────────────────────────────────────
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
//         `Label ${index}: "${sym.text}" (parentId: ${attrs.parentId})`,
//       );

//       return { attributes: attrs, geometry: geom };
//     },
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
//     mapTile: string | null;
//     baseMap: string | null;
//     apiSources: string[];
//   },
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
//       fromUser: event.attributes.fromUser,
//       location_at: event.attributes.locationTag,
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
//     events, // already filtered for layer items
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
