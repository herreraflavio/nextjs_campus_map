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
  console.log(ev);
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

// //arcgisRefs.ts
// import type {
//   DrawingExport,
//   EventPoint,
//   ExportBodySettingsForRef,
//   FeatureLayerConfig,
//   FieldInfo,
//   Label,
//   SaveSettings,
// } from "@/app/types/myTypes";
// import { cloneJsonValue } from "@/app/types/myTypes";

// export type {
//   SpatialReference,
//   HiddenSegmentRange,
//   VertexPause,
//   DirectionalSpriteFrames,
//   PolylineAnimation,
//   ExportBodySettingsForRef,
//   SaveSettings,
//   EventPoint,
//   MapSaveBody,
// } from "@/app/types/myTypes";

// /**
//  * Legacy name retained for backward compatibility.
//  * This now includes polygons, polylines, and points.
//  */
// export type Polygon = DrawingExport;
// export type { Label, FieldInfo, FeatureLayerConfig };

// export type CampusEvent = {
//   id: string;
//   event_name: string;
//   description?: string;
//   date?: string;
//   startAt?: string;
//   endAt?: string;
//   location_at?: string;
//   location?: string;
//   locationTag?: string;
//   fullLocationTag?: string;
//   names?: string[];
//   original?: any;
//   geometry: { x: number; y: number; wkid: number };
//   fromUser: boolean;
//   iconSize: number;
//   iconUrl: string;
//   poster_url?: string;
// };

// export const eventsStore = {
//   items: [] as CampusEvent[],
//   events: new EventTarget(),
// };

// export function addEventToStore(ev: CampusEvent) {
//   console.log(ev);
//   eventsStore.items.push(ev);
//   eventsStore.events.dispatchEvent(new CustomEvent("added", { detail: ev }));
// }

// export function updateEventInStore(updatedEv: CampusEvent) {
//   const index = eventsStore.items.findIndex((e) => e.id === updatedEv.id);
//   if (index > -1) {
//     eventsStore.items[index] = updatedEv;
//   } else {
//     eventsStore.items.push(updatedEv);
//   }

//   eventsStore.events.dispatchEvent(
//     new CustomEvent("updated", { detail: updatedEv }),
//   );

//   const layer = eventsLayerRef.current as any;
//   if (layer?.graphics) {
//     const graphic = layer.graphics.find(
//       (g: any) => g.attributes?.id === updatedEv.id,
//     );

//     if (graphic) {
//       Object.assign(graphic.attributes, {
//         event_name: updatedEv.event_name,
//         description: updatedEv.description,
//         date: updatedEv.date,
//         startAt: updatedEv.startAt,
//         endAt: updatedEv.endAt,
//         locationTag: updatedEv.locationTag,
//         fullLocationTag: updatedEv.fullLocationTag,
//         location: updatedEv.location,
//         location_at: updatedEv.location_at,
//         poster_url: updatedEv.poster_url,
//         names: updatedEv.names,
//       });

//       if (updatedEv.geometry && GraphicRef.current) {
//         const Graphic = GraphicRef.current as any;
//         graphic.geometry = new Graphic({
//           geometry: {
//             type: "point",
//             x: updatedEv.geometry.x,
//             y: updatedEv.geometry.y,
//             spatialReference: { wkid: updatedEv.geometry.wkid },
//           },
//         }).geometry;
//       }
//     }
//   }
// }

// export function deleteEventFromStore(id: string) {
//   eventsStore.items = eventsStore.items.filter((item) => item.id !== id);
//   eventsStore.events.dispatchEvent(
//     new CustomEvent("removed", { detail: { id } }),
//   );

//   const layer = eventsLayerRef.current as any;
//   if (layer?.graphics) {
//     const graphic = layer.graphics.find((g: any) => g.attributes?.id === id);
//     if (graphic) {
//       layer.remove(graphic);
//     }
//   }
// }

// export const editingLayerRef = { current: null as any };
// export const finalizedLayerRef = {
//   current: null as any,
//   events: new EventTarget(),
// };
// export const labelsLayerRef = { current: null as any };
// export const eventsLayerRef = {
//   current: null as any,
//   events: new EventTarget(),
// };

// export function setFinalizedLayer(layer: any) {
//   finalizedLayerRef.current = layer;
//   finalizedLayerRef.events.dispatchEvent(new Event("change"));
// }

// export function setLabelsLayer(layer: any) {
//   labelsLayerRef.current = layer;
// }

// export const settingsRef: { current: ExportBodySettingsForRef } = {
//   current: {
//     zoom: 15,
//     center: {
//       spatialReference: { wkid: 4326, latestWkid: 4326 },
//       x: -120.422045,
//       y: 37.368169,
//     },
//     constraints: null,
//     featureLayers: [
//       {
//         url: "https://services6.arcgis.com/rX5atNlsxFq7LIpv/arcgis/rest/services/County_of_Merced_Jurisdictional_Zoning_Designations/FeatureServer",
//         index: 5,
//         outFields: ["*"],
//         popupEnabled: true,
//         popupTemplate: {
//           title: "{ZONENAME}",
//           content: [
//             {
//               type: "fields",
//               fieldInfos: [
//                 { fieldName: "hall", label: "Hall Name", visible: true },
//                 {
//                   fieldName: "beds",
//                   label: "Number of Beds",
//                   visible: true,
//                   format: { digitSeparator: true, places: 0 },
//                 },
//               ],
//             },
//           ],
//         },
//       },
//     ],
//     mapTile: null,
//     baseMap: "arcgis/light-gray",
//     apiSources: [],
//   },
// };

// export const MapViewRef = { current: null as any };
// export const GraphicRef = { current: null as any };
// export const settingsEvents = new EventTarget();

// export function hasNumericZ(layer: any): boolean {
//   return typeof (layer as any)?.z === "number" && isFinite((layer as any).z);
// }

// export function resortByZ(map: __esri.Map): void {
//   if (!map?.layers) return;

//   const flagKey = "__resortingByZ__";
//   if ((map as any)[flagKey]) return;
//   (map as any)[flagKey] = true;

//   try {
//     const items = map.layers.toArray();
//     const withZ = items
//       .filter(hasNumericZ)
//       .sort((a: any, b: any) => (a.z as number) - (b.z as number));
//     const withoutZ = items.filter((l) => !hasNumericZ(l));

//     const finalOrder = [...withZ, ...withoutZ];
//     finalOrder.forEach((lyr, index) => map.reorder(lyr, index));
//   } finally {
//     (map as any)[flagKey] = false;
//   }
// }

// export function setLayerZ(map: __esri.Map, layer: any, z: number): void {
//   (layer as any).z = z;
//   resortByZ(map);
// }

// export function generateExport(): {
//   polygons: DrawingExport[];
//   labels: Label[];
//   events: EventPoint[];
// } {
//   const drawLayer = finalizedLayerRef.current;
//   const labelLayer = labelsLayerRef.current;

//   const polygons: DrawingExport[] =
//     drawLayer?.graphics
//       ?.toArray()
//       ?.filter((g: any) =>
//         ["polygon", "polyline", "point"].includes(g.geometry?.type),
//       )
//       ?.map((g: any) => {
//         const attrs: Record<string, any> = {
//           id: g.attributes?.id,
//           name: g.attributes?.name,
//           description: g.attributes?.description,
//         };

//         if (g.attributes?.showAtZoom != null) {
//           attrs.showAtZoom = g.attributes.showAtZoom;
//         }
//         if (g.attributes?.hideAtZoom != null) {
//           attrs.hideAtZoom = g.attributes.hideAtZoom;
//         }
//         if (g.attributes?.order != null) {
//           attrs.order = g.attributes.order;
//         }
//         if (Array.isArray(g.attributes?.color)) {
//           attrs.color = g.attributes.color;
//         }
//         if (g.geometry?.type === "polyline" && g.attributes?.width != null) {
//           attrs.width = g.attributes.width;
//         }
//         if (
//           g.geometry?.type === "polyline" &&
//           g.attributes?.animation != null
//         ) {
//           attrs.animation = cloneJsonValue(g.attributes.animation);
//         }
//         if (g.geometry?.type === "point" && g.attributes?.size != null) {
//           attrs.size = g.attributes.size;
//         }

//         const sym = g.symbol;
//         const color =
//           typeof sym?.color?.toRgba === "function"
//             ? sym.color.toRgba()
//             : sym?.color;

//         if (g.geometry?.type === "polygon") {
//           const outline = sym?.outline;
//           const outlineColor =
//             typeof outline?.color?.toRgba === "function"
//               ? outline.color.toRgba()
//               : outline?.color;

//           return {
//             attributes: attrs,
//             geometry: {
//               type: g.geometry?.type,
//               rings: g.geometry?.rings,
//               spatialReference: g.geometry?.spatialReference?.toJSON
//                 ? g.geometry.spatialReference.toJSON()
//                 : g.geometry?.spatialReference,
//             },
//             symbol: {
//               type: sym?.type,
//               color,
//               outline: { color: outlineColor, width: outline?.width },
//             },
//           };
//         }

//         if (g.geometry?.type === "polyline") {
//           return {
//             attributes: attrs,
//             geometry: {
//               type: g.geometry?.type,
//               paths: g.geometry?.paths,
//               spatialReference: g.geometry?.spatialReference?.toJSON
//                 ? g.geometry.spatialReference.toJSON()
//                 : g.geometry?.spatialReference,
//             },
//             symbol: {
//               type: sym?.type,
//               color,
//               width:
//                 typeof sym?.width === "number"
//                   ? sym.width
//                   : typeof g.attributes?.width === "number"
//                     ? g.attributes.width
//                     : 3,
//             },
//           };
//         }

//         const outline = sym?.outline;
//         const outlineColor =
//           typeof outline?.color?.toRgba === "function"
//             ? outline.color.toRgba()
//             : outline?.color;

//         return {
//           attributes: attrs,
//           geometry: {
//             type: g.geometry?.type,
//             x: g.geometry?.x,
//             y: g.geometry?.y,
//             spatialReference: g.geometry?.spatialReference?.toJSON
//               ? g.geometry.spatialReference.toJSON()
//               : g.geometry?.spatialReference,
//           },
//           symbol: {
//             type: sym?.type,
//             color,
//             size:
//               typeof sym?.size === "number"
//                 ? sym.size
//                 : typeof g.attributes?.size === "number"
//                   ? g.attributes.size
//                   : 10,
//             outline: {
//               color: outlineColor,
//               width: typeof outline?.width === "number" ? outline.width : 1,
//             },
//           },
//         };
//       }) ?? [];

//   const labels: Label = undefined as unknown as Label;

//   const labelsOut: Label[] =
//     labelLayer?.graphics?.toArray()?.map((l: any) => {
//       const sym = l.symbol as any;
//       const attrs = {
//         parentId: l.attributes?.parentId,
//         showAtZoom: l.attributes?.showAtZoom ?? null,
//         hideAtZoom: l.attributes?.hideAtZoom ?? null,
//         fontSize: sym?.font?.size,
//         color: sym?.color,
//         haloColor: sym?.haloColor,
//         haloSize: sym?.haloSize,
//         text: sym?.text,
//       };

//       const geom = {
//         type: l.geometry?.type,
//         x: l.geometry?.x,
//         y: l.geometry?.y,
//         spatialReference: l.geometry?.spatialReference?.toJSON
//           ? l.geometry.spatialReference.toJSON()
//           : l.geometry?.spatialReference,
//       };

//       return { attributes: attrs, geometry: geom };
//     }) ?? [];

//   void labels;

//   const layerItems = eventsLayerRef.current?.graphics?.toArray() ?? [];
//   const eventsFromLayer: EventPoint[] = layerItems.map((g: any) => {
//     const a = g.attributes || {};
//     return {
//       attributes: {
//         id: a.id,
//         event_name: a.event_name,
//         description: a.description ?? null,
//         date: a.date ?? null,
//         startAt: a.startAt ?? null,
//         endAt: a.endAt ?? null,
//         poster_url: a.poster_url ?? null,
//         location_at: a.location_at ?? null,
//         location: a.location ?? null,
//         locationTag: a.locationTag ?? null,
//         fullLocationTag: a.fullLocationTag ?? null,
//         names: a.names ?? null,
//         original: a.original ?? null,
//         fromUser: a.fromUser ?? false,
//       },
//       geometry: {
//         type: "point",
//         x: g.geometry?.x,
//         y: g.geometry?.y,
//         spatialReference: g.geometry?.spatialReference?.toJSON
//           ? g.geometry.spatialReference.toJSON()
//           : g.geometry?.spatialReference,
//       },
//     };
//   });

//   const eventsFromStore: EventPoint[] = (eventsStore.items || []).map((ev) => ({
//     attributes: {
//       id: ev.id,
//       event_name: ev.event_name,
//       description: ev.description ?? null,
//       date: ev.date ?? null,
//       startAt: ev.startAt ?? null,
//       endAt: ev.endAt ?? null,
//       poster_url: ev.poster_url ?? null,
//       location_at: ev.location_at ?? null,
//       location: ev.location ?? null,
//       locationTag: ev.locationTag ?? null,
//       fullLocationTag: ev.fullLocationTag ?? null,
//       names: ev.names ?? null,
//       original: ev.original ?? null,
//       fromUser: ev.fromUser ?? false,
//     },
//     geometry: {
//       type: "point",
//       x: ev.geometry.x,
//       y: ev.geometry.y,
//       spatialReference: {
//         wkid: ev.geometry.wkid,
//         latestWkid: ev.geometry.wkid,
//       },
//     },
//   }));

//   const byId = new Map<string, EventPoint>();

//   for (const e of eventsFromLayer) {
//     if (e?.attributes?.id) byId.set(e.attributes.id, e);
//   }
//   for (const e of eventsFromStore) {
//     const id = e?.attributes?.id;
//     if (id && !byId.has(id)) byId.set(id, e);
//   }

//   const events = Array.from(byId.values());

//   return { polygons, labels: labelsOut, events };
// }

// export function saveMapToServer(
//   mapId: string,
//   userEmail: string,
//   settings: SaveSettings,
// ): void {
//   const { polygons, labels, events } = generateExport();

//   if (polygons.length === 0 && labels.length === 0 && events.length === 0) {
//     console.warn("Nothing to save (no drawings, labels, or events).");
//     return;
//   }

//   fetch(`/api/maps/${mapId}`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({
//       userEmail,
//       polygons,
//       labels,
//       events,
//       settings,
//     }),
//   })
//     .then(async (res) => {
//       if (!res.ok) {
//         console.error(`Save failed (${res.status}):`, res.statusText);
//         try {
//           const body = await res.json();
//           console.error(body);
//         } catch {}
//         return;
//       }
//       return res.json();
//     })
//     .then((updatedMap) => {
//       if (updatedMap) console.log("Map saved successfully:", updatedMap);
//     })
//     .catch((err) => console.error("Error saving map:", err));
// }
