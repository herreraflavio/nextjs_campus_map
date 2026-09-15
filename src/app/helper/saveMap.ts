//src/app/helper/saveMap.ts
import {
  finalizedLayerRef,
  labelsLayerRef,
  eventsLayerRef,
  eventsStore,
} from "@/app/components/map/arcgisRefs";
import { getCategories } from "@/app/components/map/categories/categoryStore";
import type {
  DrawingExport,
  EventPoint,
  Label,
  MapCategory,
  MapSaveBody,
  SaveSettings,
  SpatialReference,
} from "@/app/types/myTypes";
import {
  cloneJsonValue,
  normalizePolylineAnimation,
} from "@/app/types/myTypes";

/**
 * POST the map (drawings, labels, events, settings) to /api/maps/[id]
 */

// ---------- config toggles ----------
/**
 * By requirement: only filter LAYER events to fromUser==true.
 * If you also want to restrict STORE events, set this to true.
 */
const FILTER_STORE_EVENTS = false;

const isTrue = (v: unknown): boolean => {
  if (v === true || v === 1) return true;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  return false;
};

function webMercatorToGeographic(
  x: number,
  y: number,
): { lon: number; lat: number } {
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
  if (typeof g.attributes?.categoryId === "string") {
    attrs.categoryId = g.attributes.categoryId;
  } else if (g.attributes?.categoryId === null) {
    attrs.categoryId = null;
  }
  if (
    typeof g.attributes?.iconUrl === "string" &&
    g.attributes.iconUrl.trim().length > 0
  ) {
    attrs.iconUrl = g.attributes.iconUrl.trim();
  } else if (g.attributes?.iconUrl === null) {
    attrs.iconUrl = null;
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
  if (geomType === "polyline" && g.attributes?.animation != null) {
    attrs.animation = cloneJsonValue(
      normalizePolylineAnimation(g.attributes.animation),
    );
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

export function generateExport(): {
  polygons: DrawingExport[];
  labels: Label[];
  events: EventPoint[];
  categories: MapCategory[];
} {
  const polyLayer = finalizedLayerRef.current as any;
  const labelLayer = labelsLayerRef.current as any;

  const events: EventPoint[] = [];
  const processedIds = new Set<string>();

  const eventsLayer = eventsLayerRef.current as any;
  if (eventsLayer?.graphics?.items) {
    const rawItems = eventsLayer.graphics.items as any[];

    const layerUserItems = rawItems.filter((graphic: any) => {
      const a = graphic?.attributes ?? {};
      const keep = isTrue(a.fromUser);
      return keep;
    });

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
      }
    });
  }

  if (eventsStore?.items && Array.isArray(eventsStore.items)) {
    eventsStore.items.forEach((ev: any) => {
      const normalizedFromUser = isTrue(ev.fromUser);
      const keep = FILTER_STORE_EVENTS ? normalizedFromUser : true;

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
      }
    });
  }

  const polygons: DrawingExport[] = (
    (polyLayer?.graphics?.items || []) as any[]
  )
    .map((g: any, index: number) => serializeDrawing(g, index))
    .filter((d): d is DrawingExport => d !== null);

  const labels: Label[] = (labelLayer?.graphics?.items || []).map(
    (l: any) => {
      const sym = l.symbol as any;
      const attrs = {
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

      return { attributes: attrs, geometry: geom };
    },
  );

  const categories = getCategories();

  return { polygons, labels, events, categories };
}

export function saveMapToServer(
  mapId: string,
  userEmail: string,
  settings: SaveSettings,
): void {
  const { polygons, labels, events, categories } = generateExport();

  if (
    polygons.length === 0 &&
    labels.length === 0 &&
    events.length === 0 &&
    categories.length === 0
  ) {
    console.warn("⚠️ Nothing to save (no drawings, labels, events, or categories).");
    return;
  }

  const payload: MapSaveBody = {
    userEmail,
    polygons,
    labels,
    events,
    categories,
    settings,
  };

  fetch(`/api/maps/${mapId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (!res.ok) {
        console.error(`Save failed (${res.status}):`, res.statusText);
        return res.json().then((body) => {
          console.error("Error body:", body);
          throw new Error(`Save failed: ${res.statusText}`);
        });
      }
      return res.json();
    })
    .catch((err) => {
      console.error("❌ Error saving map:", err);
    });
}
