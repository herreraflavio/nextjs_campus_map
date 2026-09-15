//arcgisRefs.ts
import type {
  DrawingExport,
  ExportBodySettingsForRef,
  FeatureLayerConfig,
  FieldInfo,
  Label,
} from "@/app/types/myTypes";

export type {
  SpatialReference,
  HiddenSegmentRange,
  VertexPause,
  DirectionalSpriteFrames,
  PolylineAnimation,
  ExportBodySettingsForRef,
  SaveSettings,
  EventPoint,
  MapSaveBody,
} from "@/app/types/myTypes";

/**
 * Legacy name retained for backward compatibility.
 * This now includes polygons, polylines, and points.
 */
export type Polygon = DrawingExport;
export type { Label, FieldInfo, FeatureLayerConfig };

export type CampusEvent = {
  id: string;
  event_name: string;
  description?: string;
  date?: string;
  startAt?: string;
  endAt?: string;
  location_at?: string;
  location?: string;
  locationTag?: string;
  fullLocationTag?: string;
  names?: string[];
  original?: any;
  geometry: { x: number; y: number; wkid: number };
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

export function updateEventInStore(updatedEv: CampusEvent) {
  const index = eventsStore.items.findIndex((e) => e.id === updatedEv.id);
  if (index > -1) {
    eventsStore.items[index] = updatedEv;
  } else {
    eventsStore.items.push(updatedEv);
  }

  eventsStore.events.dispatchEvent(
    new CustomEvent("updated", { detail: updatedEv }),
  );

  const layer = eventsLayerRef.current as any;
  if (layer?.graphics) {
    const graphic = layer.graphics.find(
      (g: any) => g.attributes?.id === updatedEv.id,
    );

    if (graphic) {
      Object.assign(graphic.attributes, {
        event_name: updatedEv.event_name,
        description: updatedEv.description,
        date: updatedEv.date,
        startAt: updatedEv.startAt,
        endAt: updatedEv.endAt,
        locationTag: updatedEv.locationTag,
        fullLocationTag: updatedEv.fullLocationTag,
        location: updatedEv.location,
        location_at: updatedEv.location_at,
        poster_url: updatedEv.poster_url,
        names: updatedEv.names,
      });

      if (updatedEv.geometry && GraphicRef.current) {
        const Graphic = GraphicRef.current as any;
        graphic.geometry = new Graphic({
          geometry: {
            type: "point",
            x: updatedEv.geometry.x,
            y: updatedEv.geometry.y,
            spatialReference: { wkid: updatedEv.geometry.wkid },
          },
        }).geometry;
      }
    }
  }
}

export function deleteEventFromStore(id: string) {
  eventsStore.items = eventsStore.items.filter((item) => item.id !== id);
  eventsStore.events.dispatchEvent(
    new CustomEvent("removed", { detail: { id } }),
  );

  const layer = eventsLayerRef.current as any;
  if (layer?.graphics) {
    const graphic = layer.graphics.find((g: any) => g.attributes?.id === id);
    if (graphic) {
      layer.remove(graphic);
    }
  }
}

export const editingLayerRef = { current: null as any };
export const finalizedLayerRef = {
  current: null as any,
  events: new EventTarget(),
};
export const labelsLayerRef = { current: null as any };
export const eventsLayerRef = {
  current: null as any,
  events: new EventTarget(),
};
export const spriteLayerRef = { current: null as any };

export function setFinalizedLayer(layer: any) {
  finalizedLayerRef.current = layer;
  finalizedLayerRef.events.dispatchEvent(new Event("change"));
}

export function setLabelsLayer(layer: any) {
  labelsLayerRef.current = layer;
}

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

export function hasNumericZ(layer: any): boolean {
  return typeof (layer as any)?.z === "number" && isFinite((layer as any).z);
}

export function resortByZ(map: __esri.Map): void {
  if (!map?.layers) return;

  const flagKey = "__resortingByZ__";
  if ((map as any)[flagKey]) return;
  (map as any)[flagKey] = true;

  try {
    const items = map.layers.toArray();
    const withZ = items
      .filter(hasNumericZ)
      .sort((a: any, b: any) => (a.z as number) - (b.z as number));
    const withoutZ = items.filter((l) => !hasNumericZ(l));

    const finalOrder = [...withZ, ...withoutZ];
    finalOrder.forEach((lyr, index) => map.reorder(lyr, index));
  } finally {
    (map as any)[flagKey] = false;
  }
}

export function setLayerZ(map: __esri.Map, layer: any, z: number): void {
  (layer as any).z = z;
  resortByZ(map);
}
