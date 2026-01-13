/* ───────────── Types ───────────── */
export interface SpatialReference {
  wkid: number;
  latestWkid: number;
}

export interface Polygon {
  attributes: Record<string, any>;
  geometry: {
    type: string;
    rings: number[][][];
    spatialReference: SpatialReference;
  };
  symbol: {
    type: string;
    color: number[]; // [r,g,b,a] or [r,g,b,a?] depending on ArcGIS object
    outline: { color: number[]; width: number };
  };
}

export interface Label {
  attributes: {
    parentId: string;
    showAtZoom: number | null;
    hideAtZoom: number | null;
    fontSize: number;
    color: number[]; // [r,g,b,a]
    haloColor: number[]; // [r,g,b,a]
    haloSize: number;
    text: string;
  };
  geometry: {
    type: string;
    x: number;
    y: number;
    spatialReference: SpatialReference;
  };
}

export interface FieldInfo {
  fieldName: string;
  label: string;
  visible: boolean;
  format?: { digitSeparator?: boolean; places?: number };
}

export interface FeatureLayerConfig {
  url: string;
  index: number;
  outFields: string[];
  popupEnabled: boolean;
  popupTemplate?: {
    title: string;
    content: Array<{ type: string; fieldInfos?: FieldInfo[] }>;
  };
}

/** Settings shape used by settingsRef (kept in 4326 object form for convenience) */
export interface ExportBodySettingsForRef {
  zoom: number;
  center: { spatialReference: SpatialReference; x: number; y: number };
  constraints: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  } | null;
  featureLayers: FeatureLayerConfig[] | null;
  mapTile: string | null;
  baseMap: string | null;
  apiSources: string[];
}

/** Settings shape expected by the POST /api/maps/[id] (center as [x,y]) */
export interface SaveSettings {
  zoom: number;
  center: [number, number]; // [x,y] in Web Mercator or 4326 (server just stores)
  constraints: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  } | null;
  featureLayers: FeatureLayerConfig[] | null;
}

/** For completeness if you need it elsewhere */
export interface ExportBody {
  userEmail: string;
  polygons: Polygon[];
  labels: Label[];
  settings: ExportBodySettingsForRef;
}

/* ───────────── Places registry ───────────── */
export type Place = {
  placeId: string;
  label: string;
  geometry: { wkid: number; x: number; y: number }; // EPSG:4326
  aliases?: string[];
};

export const placesRegistry: Place[] = [
  {
    placeId: "ballroom",
    label: "UC Merced Ballroom Conference Center",
    geometry: { wkid: 4326, x: -120.4271702086338, y: 37.362759538767769 },
    aliases: ["conference center", "ballroom"],
  },
  {
    placeId: "cob1-105",
    label: "COB1 105",
    geometry: { wkid: 4326, x: -120.42344423309218, y: 37.367006016916903 },
    aliases: ["cob 1 105", "classroom office building 1 room 105"],
  },
  {
    placeId: "cob2-170",
    label: "COB2 170",
    geometry: { wkid: 4326, x: -120.4236, y: 37.3635 },
    aliases: ["cob 2 170"],
  },
  {
    placeId: "library-lantern",
    label: "Library Lantern",
    geometry: { wkid: 4326, x: -120.4241, y: 37.3651 },
    aliases: ["lantern"],
  },
  {
    placeId: "se1",
    label: "Science & Engineering 1 (SE1)",
    geometry: { wkid: 4326, x: -120.4248, y: 37.3639 },
    aliases: ["se1"],
  },
  {
    placeId: "granite",
    label: "Granite Pass",
    geometry: { wkid: 4326, x: -120.4228, y: 37.3665 },
    aliases: [],
  },
  {
    placeId: "glacier",
    label: "Glacier Point",
    geometry: { wkid: 4326, x: -120.4224, y: 37.3669 },
    aliases: [],
  },
  {
    placeId: "rec-field",
    label: "Recreation Field",
    geometry: { wkid: 3857, x: -13405694.019024547, y: 4489223.854452545 },
    aliases: ["rec field"],
  },
];

/* ───────────── Events store ───────────── */
export type CampusEvent = {
  id: string;
  event_name: string;
  description?: string;
  date?: string; // "YYYY-MM-DD"
  startAt?: string; // "HH:mm"
  endAt?: string; // "HH:mm"
  location_at?: string;
  location?: string;
  locationTag?: string; // placeId
  fullLocationTag?: string; // full location tag
  names?: string[];
  original?: any;
  geometry: { x: number; y: number; wkid: number }; // typically 4326
  fromUser: boolean;
  iconSize: number;
  iconUrl: string;
  poster_url?: string;
};

export const eventsStore = {
  items: [] as CampusEvent[],
  events: new EventTarget(),
};

export function addEventToStore(ev: CampusEvent) {
  eventsStore.items.push(ev);
  eventsStore.events.dispatchEvent(new CustomEvent("added", { detail: ev }));
}

/* ───────────── Layer refs ───────────── */
export const editingLayerRef = { current: null as any };
export const finalizedLayerRef = {
  current: null as any,
  events: new EventTarget(),
};
export const labelsLayerRef = { current: null as any };
export const eventsLayerRef = {
  current: null as any,
  events: new EventTarget(), // 👈 *** THIS LINE IS ADDED ***
};

/* ───────────── Settings & map refs ───────────── */
export function setFinalizedLayer(layer: any) {
  finalizedLayerRef.current = layer;
  finalizedLayerRef.events.dispatchEvent(new Event("change"));
}
export function setLabelsLayer(layer: any) {
  labelsLayerRef.current = layer;
}

/** Runtime settings shared container (center kept as 4326 object) */
export const settingsRef: { current: ExportBodySettingsForRef } = {
  current: {
    zoom: 15,
    center: {
      spatialReference: { wkid: 4326, latestWkid: 4326 },
      x: -120.422045,
      y: 37.368169,
    },
    constraints: null,
    featureLayers: [
      {
        url: "https://services6.arcgis.com/rX5atNlsxFq7LIpv/arcgis/rest/services/County_of_Merced_Jurisdictional_Zoning_Designations/FeatureServer",
        index: 5,
        outFields: ["*"],
        popupEnabled: true,
        popupTemplate: {
          title: "{ZONENAME}",
          content: [
            {
              type: "fields",
              fieldInfos: [
                { fieldName: "hall", label: "Hall Name", visible: true },
                {
                  fieldName: "beds",
                  label: "Number of Beds",
                  visible: true,
                  format: { digitSeparator: true, places: 0 },
                },
              ],
            },
          ],
        },
      },
    ],
    mapTile: null,
    baseMap: "arcgis/light-gray",
    apiSources: [],
  },
};

export const MapViewRef = { current: null as any };
export const GraphicRef = { current: null as any };
export const settingsEvents = new EventTarget();

/* ───────────── Z-order helpers ───────────── */

/** true only when a layer explicitly defines a numeric 'z' */
export function hasNumericZ(layer: any): boolean {
  return typeof (layer as any)?.z === "number" && isFinite((layer as any).z);
}

/**
 * Reorders ONLY layers with a numeric `z` (ascending = bottom→top).
 * All layers WITHOUT `z` keep their current relative order and remain on TOP.
 * This preserves Esri internal/temporary layers (e.g., Sketch handles).
 */
export function resortByZ(map: __esri.Map): void {
  if (!map?.layers) return;
  const flagKey = "__resortingByZ__";
  if ((map as any)[flagKey]) return;
  (map as any)[flagKey] = true;

  try {
    const items = map.layers.toArray(); // ✅ instead of `.items`
    const withZ = items
      .filter(hasNumericZ)
      .sort((a: any, b: any) => (a.z as number) - (b.z as number));
    const withoutZ = items.filter((l) => !hasNumericZ(l)); // keep existing order (top)

    const finalOrder = [...withZ, ...withoutZ];
    finalOrder.forEach((lyr, index) => map.reorder(lyr, index));
  } finally {
    (map as any)[flagKey] = false;
  }
}

/** Convenience: set layer.z then immediately apply the global resort */
export function setLayerZ(map: __esri.Map, layer: any, z: number): void {
  (layer as any).z = z;
  resortByZ(map);
}

/* ───────────── Export helpers (polygons, labels, events) ───────────── */

export function generateExport(): {
  polygons: any[];
  labels: any[];
  events: any[];
} {
  const polyLayer = finalizedLayerRef.current;
  const labelLayer = labelsLayerRef.current;

  // ───── Polygons ─────
  const polygons =
    polyLayer?.graphics
      ?.toArray() // ✅ instead of `.items`
      ?.map((g: any) => {
        const attrs: any = {
          id: g.attributes?.id,
          name: g.attributes?.name,
          description: g.attributes?.description,
        };
        if (g.attributes?.showAtZoom != null)
          attrs.showAtZoom = g.attributes.showAtZoom;
        if (g.attributes?.hideAtZoom != null)
          attrs.hideAtZoom = g.attributes.hideAtZoom;

        const geom = {
          type: g.geometry?.type,
          rings: g.geometry?.rings,
          spatialReference: g.geometry?.spatialReference?.toJSON
            ? g.geometry.spatialReference.toJSON()
            : g.geometry?.spatialReference,
        };

        const sym = g.symbol;
        const color =
          typeof sym?.color?.toRgba === "function"
            ? sym.color.toRgba()
            : sym?.color;
        const outline = sym?.outline;
        const outlineColor =
          typeof outline?.color?.toRgba === "function"
            ? outline.color.toRgba()
            : outline?.color;

        return {
          attributes: attrs,
          geometry: geom,
          symbol: {
            type: sym?.type,
            color,
            outline: { color: outlineColor, width: outline?.width },
          },
        };
      }) ?? [];

  // ───── Labels ─────
  const labels =
    labelLayer?.graphics
      ?.toArray() // ✅
      ?.map((l: any) => {
        const sym = l.symbol as any;
        const attrs: any = {
          parentId: l.attributes?.parentId,
          showAtZoom: l.attributes?.showAtZoom ?? null,
          hideAtZoom: l.attributes?.hideAtZoom ?? null,
          fontSize: sym?.font?.size,
          color: sym?.color,
          haloColor: sym?.haloColor,
          haloSize: sym?.haloSize,
          text: sym?.text,
        };
        const geom = {
          type: l.geometry?.type,
          x: l.geometry?.x,
          y: l.geometry?.y,
          spatialReference: l.geometry?.spatialReference?.toJSON
            ? l.geometry.spatialReference.toJSON()
            : l.geometry?.spatialReference,
        };
        return { attributes: attrs, geometry: geom };
      }) ?? [];

  // ───── Events (merge layer + store; de-dup by id) ─────
  const layerItems = eventsLayerRef.current?.graphics?.toArray() ?? []; // ✅
  const eventsFromLayer = layerItems.map((g: any) => {
    const a = g.attributes || {};
    return {
      attributes: {
        id: a.id,
        event_name: a.event_name,
        description: a.description ?? null,
        date: a.date ?? null,
        startAt: a.startAt ?? null,
        endAt: a.endAt ?? null,
        locationTag: a.locationTag ?? null,
        fullLocationTag: a.fullLocationTag ?? null,
        names: a.names ?? null,
        original: a.original ?? null,
      },
      geometry: {
        type: "point",
        x: g.geometry?.x,
        y: g.geometry?.y,
        spatialReference: g.geometry?.spatialReference?.toJSON
          ? g.geometry.spatialReference.toJSON()
          : g.geometry?.spatialReference,
      },
    };
  });

  const eventsFromStore = (eventsStore.items || []).map((ev) => ({
    attributes: {
      id: ev.id,
      event_name: ev.event_name,
      description: ev.description ?? null,
      date: ev.date ?? null,
      startAt: ev.startAt ?? null,
      endAt: ev.endAt ?? null,
      locationTag: ev.locationTag ?? null,
      fullLocationTag: ev.fullLocationTag ?? null,
      names: ev.names ?? null,
      original: ev.original ?? null,
    },
    geometry: {
      type: "point",
      x: ev.geometry.x,
      y: ev.geometry.y,
      spatialReference: { wkid: ev.geometry.wkid },
    },
  }));

  // De-dup by id (layer wins, then store fills in any missing)
  const byId = new Map<string, any>();
  for (const e of eventsFromLayer) {
    if (e?.attributes?.id) byId.set(e.attributes.id, e);
  }
  for (const e of eventsFromStore) {
    const id = e?.attributes?.id;
    if (id && !byId.has(id)) byId.set(id, e);
  }
  const events = Array.from(byId.values());

  return { polygons, labels, events };
}

/** POST polygons + labels + events + settings to your API */
export function saveMapToServer(
  mapId: string,
  userEmail: string,
  settings: SaveSettings
): void {
  const { polygons, labels, events } = generateExport();

  if (polygons.length === 0 && labels.length === 0 && events.length === 0) {
    console.warn("Nothing to save (no polygons, labels, or events).");
    return;
  }

  fetch(`/api/maps/${mapId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userEmail,
      polygons,
      labels,
      events,
      settings,
    }),
  })
    .then(async (res) => {
      if (!res.ok) {
        console.error(`Save failed (${res.status}):`, res.statusText);
        try {
          const body = await res.json();
          console.error(body);
        } catch {}
        return;
      }
      return res.json();
    })
    .then((updatedMap) => {
      if (updatedMap) console.log("Map saved successfully:", updatedMap);
    })
    .catch((err) => console.error("Error saving map:", err));
}
