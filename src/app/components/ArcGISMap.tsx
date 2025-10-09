// "use client";

// import { useEffect, useRef } from "react";
// import {
//   editingLayerRef,
//   MapViewRef,
//   finalizedLayerRef,
//   GraphicRef,
//   setFinalizedLayer,
//   setLabelsLayer,
//   eventsLayerRef,
//   eventsStore,
//   type CampusEvent,
// } from "./map/arcgisRefs";
// import "./ArcGISMap.css";
// import EventCalendarOverlay from "./map/MapControls/EventCalendarOverlay";
// import DynamicEventLoader from "./map/MapControls/DynamicEventLoader";
// import TurnByTurnOverlay from "./map/MapControls/TurnByTurnOverlay";

// import { useMapId } from "@/app/context/MapContext";
// import { rebuildBuckets, labelBuckets } from "./map/bucketManager";
// import { toGraphic as toEventGraphic } from "./map/MapControls/eventsLayer";

// /* ─────────────────────────────────────────
//  * Types from API payload
//  * ───────────────────────────────────── */
// interface SpatialReference {
//   wkid: number;
//   latestWkid: number;
// }
// interface PolygonDTO {
//   attributes: Record<string, any>;
//   geometry: {
//     type: string;
//     rings: number[][][];
//     spatialReference: SpatialReference;
//   };
//   symbol: {
//     type: string;
//     color: number[]; // [r,g,b,a]
//     outline: { color: number[]; width: number };
//   };
// }
// interface LabelDTO {
//   attributes: {
//     parentId: string;
//     showAtZoom: number | null;
//     hideAtZoom: number | null;
//     fontSize: number;
//     color: number[];
//     haloColor: number[];
//     haloSize: number;
//     text: string;
//   };
//   geometry: {
//     type: string;
//     x: number;
//     y: number;
//     spatialReference: SpatialReference;
//   };
// }
// interface EventPointDTO {
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
//     iconSize?: number;
//     iconUrl?: string;
//   };
//   geometry: {
//     type: "point";
//     x: number;
//     y: number;
//     spatialReference: SpatialReference;
//   };
// }
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
// interface ExportBody {
//   userEmail: string;
//   polygons: PolygonDTO[];
//   labels: LabelDTO[];
//   events?: EventPointDTO[];
//   /** NEW: endpoints to fetch dynamic events */
//   eventSources?: string[];

//   settings: {
//     zoom: number;
//     center: [x: number, y: number];
//     constraints: {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     } | null;
//     featureLayers: FeatureLayerConfig[] | null;
//   };
// }

// /* ─────────────────────────────────────────
//  * Component
//  * ───────────────────────────────────── */
// export default function ArcGISMap(mapData: ExportBody) {
//   const mapDiv = useRef<HTMLDivElement>(null);
//   const mapId = useMapId();

//   useEffect(() => {
//     const intv = setInterval(() => {
//       if (!(window as any).require) return;
//       clearInterval(intv);

//       (window as any).require(
//         [
//           "esri/config",
//           "esri/Map",
//           "esri/views/MapView",
//           "esri/Graphic",
//           "esri/layers/GraphicsLayer",
//           "esri/layers/MediaLayer",
//           "esri/layers/support/ImageElement",
//           "esri/layers/support/ExtentAndRotationGeoreference",
//           "esri/geometry/Extent",
//           "esri/geometry/Point",
//           "esri/geometry/Polygon",
//           "esri/geometry/support/webMercatorUtils",
//           "esri/geometry/geometryEngine",
//           "esri/layers/FeatureLayer",
//           // ⬇️ NEW: use WebTileLayer to consume your CloudFront tiles (XYZ)
//           "esri/layers/WebTileLayer",
//         ],
//         (
//           esriConfig: any,
//           EsriMap: any,
//           MapView: any,
//           Graphic: any,
//           GraphicsLayer: any,
//           MediaLayer: any,
//           ImageElement: any,
//           ExtentAndRotationGeoreference: any,
//           Extent: any,
//           Point: typeof __esri.Point,
//           Polygon: typeof __esri.Polygon,
//           webMercatorUtils: any,
//           geometryEngine: any,
//           FeatureLayer: any,
//           WebTileLayer: any
//         ) => {
//           /* ─────────── Helpers ─────────── */
//           const isLonLat = (x: number, y: number) =>
//             Math.abs(x) <= 180 && Math.abs(y) <= 90;

//           const toViewSR = (geom: __esri.Geometry | any): __esri.Geometry => {
//             const wkid = geom?.spatialReference?.wkid;
//             if (wkid === 3857 || wkid === 102100) return geom;
//             if (wkid === 4326)
//               return webMercatorUtils.geographicToWebMercator(geom);
//             if (
//               geom?.x !== undefined &&
//               geom?.y !== undefined &&
//               isLonLat(geom.x, geom.y)
//             ) {
//               return webMercatorUtils.geographicToWebMercator(
//                 new Point({
//                   x: geom.x,
//                   y: geom.y,
//                   spatialReference: { wkid: 4326 },
//                 })
//               );
//             }
//             return geom;
//           };

//           const computeLabelPoint = (poly: __esri.Polygon): __esri.Point => {
//             try {
//               const p = geometryEngine.labelPoints(poly);
//               if (p)
//                 return new Point({
//                   x: p.x,
//                   y: p.y,
//                   spatialReference: { wkid: 3857 },
//                 });
//             } catch {}
//             const c1 = (poly as any).centroid;
//             if (c1)
//               return new Point({
//                 x: c1.x,
//                 y: c1.y,
//                 spatialReference: { wkid: 3857 },
//               });
//             if (poly.extent?.center)
//               return new Point({
//                 x: poly.extent.center.x,
//                 y: poly.extent.center.y,
//                 spatialReference: { wkid: 3857 },
//               });
//             // bbox fallback
//             const ring = poly.rings?.[0] ?? [];
//             let minX = Infinity,
//               maxX = -Infinity,
//               minY = Infinity,
//               maxY = -Infinity;
//             for (const [x, y] of ring) {
//               if (x < minX) minX = x;
//               if (x > maxX) maxX = x;
//               if (y < minY) minY = y;
//               if (y > maxY) maxY = y;
//             }
//             return new Point({
//               x: (minX + maxX) / 2,
//               y: (minY + maxY) / 2,
//               spatialReference: { wkid: 3857 },
//             });
//           };

//           const createTextSymbol = (attrs: any) => ({
//             type: "text",
//             text: attrs.text,
//             color: attrs.color ?? [0, 0, 0, 1],
//             haloColor: attrs.haloColor ?? [255, 255, 255, 1],
//             haloSize: attrs.haloSize ?? 2,
//             font: {
//               size: attrs.fontSize ?? 12,
//               family: "sans-serif",
//               weight: "bold",
//             },
//           });
//           esriConfig.apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY as string;

//           /* ─────────── Map & View ─────────── */
//           // const map = new EsriMap({ basemap: "light-gray/labels" });
//           const map = new EsriMap({
//             basemap: "arcgis/light-gray", // ✅ not "light-gray"
//           });

//           const [cx, cy] = mapData.settings.center;
//           const centerPoint =
//             Math.abs(cx) <= 180 && Math.abs(cy) <= 90
//               ? webMercatorUtils.geographicToWebMercator(
//                   new Point({ x: cx, y: cy, spatialReference: { wkid: 4326 } })
//                 )
//               : new Point({ x: cx, y: cy, spatialReference: { wkid: 3857 } });

//           const view = new MapView({
//             container: mapDiv.current,
//             map,
//             spatialReference: { wkid: 3857 },
//             center: centerPoint,
//             zoom: mapData.settings.zoom,
//             constraints: mapData.settings.constraints
//               ? {
//                   geometry: new Extent({
//                     xmin: mapData.settings.constraints.xmin,
//                     ymin: mapData.settings.constraints.ymin,
//                     xmax: mapData.settings.constraints.xmax,
//                     ymax: mapData.settings.constraints.ymax,
//                     spatialReference: { wkid: 3857 },
//                   }),
//                 }
//               : undefined,
//           });

//           /* ─────────── Layers ─────────── */
//           const editingLayer = new GraphicsLayer({ id: "editing" });
//           const finalizedLayer = new GraphicsLayer({ id: "finalized" });
//           const labelsLayer = new GraphicsLayer({ id: "labels" });
//           const eventsLayer = new GraphicsLayer({
//             id: "events-layer",
//             title: "Campus Events",
//             listMode: "show",
//           });

//           // ➕ Your CloudFront XYZ tiles as a WebTileLayer
//           const campusTiles = new WebTileLayer({
//             urlTemplate:
//               "https://tiles.flavioherrera.com/v6/{level}/{col}/{row}.png",
//             id: "campus-xyz",
//             opacity: 1,
//           });

//           // Optional background image
//           const imgLowRes = new ImageElement({
//             image: "https://campusmap.flavioherrera.com/testing/map4.png",
//             georeference: new ExtentAndRotationGeoreference({
//               extent: new Extent({
//                 xmin: -13406409.47,
//                 ymin: 4488936.09,
//                 xmax: -13404924.08,
//                 ymax: 4490876.39,
//                 spatialReference: { wkid: 102100 },
//               }),
//               rotation: 90,
//             }),
//           });
//           const mediaLayer = new MediaLayer({ source: [imgLowRes] });

//           // z-order
//           (mediaLayer as any).z = 10;
//           (campusTiles as any).z = 15; // under your drawings
//           (finalizedLayer as any).z = 30;
//           (editingLayer as any).z = 40;
//           (eventsLayer as any).z = 45;
//           (labelsLayer as any).z = 50;

//           const createFeatureLayers = () => {
//             const layers: any[] = [];
//             if (!mapData.settings.featureLayers?.length) return layers;
//             mapData.settings.featureLayers.forEach((config, index) => {
//               try {
//                 const fl = new FeatureLayer({
//                   url: config.url,
//                   index: config.index,
//                   outFields: config.outFields || ["*"],
//                   popupEnabled: config.popupEnabled !== false,
//                   popupTemplate: config.popupTemplate || undefined,
//                 });
//                 (fl as any).z = fl.index ?? 0;
//                 fl.id = `feature:${index}`;
//                 layers.push(fl);
//               } catch (e) {
//                 console.error("Error creating feature layer", index, e);
//               }
//             });
//             return layers;
//           };

//           const featureLayers = createFeatureLayers();
//           const allLayers = [
//             campusTiles, // ⬅️ add your WebTileLayer
//             ...featureLayers,
//             // mediaLayer,
//             finalizedLayer,
//             editingLayer,
//             eventsLayer,
//             labelsLayer,
//           ].filter(Boolean);
//           allLayers.sort((a: any, b: any) => (a.z ?? 0) - (b.z ?? 0));
//           map.addMany(allLayers);

//           /* ─────────── Labels visibility ─────────── */
//           const applyLabelVisibility = (zoom: number) => {
//             labelBuckets.forEach((bucket) => {
//               const show = zoom >= bucket.minZoom && zoom <= bucket.maxZoom;
//               bucket.labels.forEach((lbl) => (lbl.visible = show));
//             });
//           };

//           /* ─────────── Build labels from polygons ─────────── */
//           const rebuildAllLabelsFromPolygons = (
//             savedLabelMap: globalThis.Map<string, LabelDTO>
//           ) => {
//             labelsLayer.removeAll();

//             finalizedLayer.graphics.items.forEach((polyG: any) => {
//               if (polyG.geometry?.type !== "polygon") return;

//               const poly3857 = toViewSR(polyG.geometry) as __esri.Polygon;

//               const pt = computeLabelPoint(poly3857);
//               const saved = savedLabelMap.get(polyG.attributes?.id);
//               const attrs = {
//                 parentId: polyG.attributes?.id,
//                 text:
//                   saved?.attributes.text ?? polyG.attributes?.name ?? "Polygon",
//                 showAtZoom: saved?.attributes.showAtZoom ?? null,
//                 hideAtZoom: saved?.attributes.hideAtZoom ?? null,
//                 fontSize: saved?.attributes.fontSize ?? 12,
//                 color: saved?.attributes.color ?? [0, 0, 0, 1],
//                 haloColor: saved?.attributes.haloColor ?? [255, 255, 255, 1],
//                 haloSize: saved?.attributes.haloSize ?? 2,
//               };

//               const labelGraphic = new Graphic({
//                 geometry: pt,
//                 symbol: createTextSymbol(attrs),
//                 attributes: attrs,
//               });
//               labelsLayer.add(labelGraphic);
//             });

//             rebuildBuckets(labelsLayer);
//             applyLabelVisibility(view.zoom);
//           };

//           /* ─────────── Initial data load (includes events) ─────────── */
//           fetch(`/api/maps/${mapId}`)
//             .then((res) => res.json())
//             .then(
//               (data: {
//                 polygons: PolygonDTO[];
//                 labels: LabelDTO[];
//                 events?: EventPointDTO[];
//               }) => {
//                 // Polygons
//                 (data.polygons || []).forEach((p) => {
//                   const polyGeom = Polygon.fromJSON(p.geometry);
//                   const projectedGeom = toViewSR(polyGeom) as __esri.Polygon;

//                   const polyGraphic = new Graphic({
//                     geometry: projectedGeom,
//                     symbol: p.symbol,
//                     attributes: p.attributes,
//                     popupTemplate: {
//                       title: p.attributes.name,
//                       content: p.attributes.description,
//                     },
//                   });
//                   finalizedLayer.add(polyGraphic);
//                 });

//                 // Labels (attrs only; positions recomputed)
//                 const savedLabelMap = new globalThis.Map<string, LabelDTO>();
//                 (data.labels || []).forEach((l) => {
//                   if (l?.attributes?.parentId)
//                     savedLabelMap.set(l.attributes.parentId, l);
//                 });
//                 rebuildAllLabelsFromPolygons(savedLabelMap);

//                 // Persisted events → events layer
//                 (data.events || []).forEach((ev) => {
//                   try {
//                     const srcPt = new Point({
//                       x: ev.geometry.x,
//                       y: ev.geometry.y,
//                       spatialReference: {
//                         wkid: ev.geometry.spatialReference.wkid,
//                       },
//                     });
//                     const pt3857 = toViewSR(srcPt) as __esri.Point;

//                     const ce: CampusEvent = {
//                       id: ev.attributes.id || `evt-${Date.now()}`,
//                       event_name: ev.attributes.event_name || "Event",
//                       description: ev.attributes.description ?? undefined,
//                       date: ev.attributes.date ?? undefined,
//                       startAt: ev.attributes.startAt ?? undefined,
//                       endAt: ev.attributes.endAt ?? undefined,
//                       locationTag: ev.attributes.locationTag ?? undefined,
//                       names: ev.attributes.names ?? undefined,
//                       original: ev.attributes.original ?? undefined,
//                       geometry: { x: pt3857.x, y: pt3857.y, wkid: 3857 },
//                       fromUser: ev.attributes.fromUser,
//                       iconSize: ev.attributes.iconSize ?? 36,
//                       iconUrl: ev.attributes.iconUrl ?? "/icons/event-pin.png",
//                     };

//                     eventsLayer.add(toEventGraphic(Graphic, ce));
//                   } catch (e) {
//                     console.error("Failed to load event:", ev, e);
//                   }
//                 });

//                 view.when(() => applyLabelVisibility(view.zoom));
//                 finalizedLayerRef.events.dispatchEvent(new Event("change"));
//               }
//             )
//             .catch((err) =>
//               console.error("Error loading polygons/labels/events:", err)
//             );

//           /* ─────────── Refs for other modules ─────────── */
//           editingLayerRef.current = editingLayer;
//           setFinalizedLayer(finalizedLayer);
//           setLabelsLayer(labelsLayer);
//           GraphicRef.current = Graphic;
//           MapViewRef.current = view;
//           eventsLayerRef.current = eventsLayer;

//           // Pre-existing local events
//           for (const ev of eventsStore.items) {
//             eventsLayer.add(toEventGraphic(Graphic, ev));
//           }

//           // Labels visibility reactive
//           view.watch("zoom", (z: number) => applyLabelVisibility(z));

//           // Recompute label positions when polygons change
//           finalizedLayer.graphics.on("change", () => {
//             const savedLabelMap = new globalThis.Map<string, LabelDTO>();
//             labelsLayer.graphics.items.forEach((lbl: any) => {
//               const att = lbl.attributes;
//               if (att?.parentId) {
//                 savedLabelMap.set(att.parentId, {
//                   attributes: att,
//                   geometry: {
//                     type: "point",
//                     x: lbl.geometry.x,
//                     y: lbl.geometry.y,
//                     spatialReference: { wkid: 3857, latestWkid: 3857 },
//                   },
//                 } as any);
//               }
//             });
//             rebuildAllLabelsFromPolygons(savedLabelMap);
//           });
//         }
//       );
//     }, 100);

//     return () => clearInterval(intv);
//   }, [mapId]);

//   return (
//     <div style={{ position: "relative", width: "100%", height: "100%" }}>
//       <div
//         ref={mapDiv}
//         style={{
//           position: "absolute",
//           inset: 0,
//           width: "100%",
//           height: "100%",
//         }}
//       />
//       {/* hidden for now, unhide */}
//       {/* Fetch dynamic events for a generous rolling window; overlay will filter visibility */}
//       <DynamicEventLoader eventSources={mapData.eventSources ?? []} />
//       {/* Calendar/Date filter overlay (self-contained) */}
//       <EventCalendarOverlay />
//       <TurnByTurnOverlay />
//     </div>
//   );
// }

"use client";

import { useEffect, useRef, useState } from "react";
import {
  editingLayerRef,
  MapViewRef,
  finalizedLayerRef,
  GraphicRef,
  setFinalizedLayer,
  setLabelsLayer,
  eventsLayerRef,
  eventsStore,
  type CampusEvent,
} from "./map/arcgisRefs";
import "./ArcGISMap.css";
import EventCalendarOverlay from "./map/MapControls/EventCalendarOverlay";
import DynamicEventLoader from "./map/MapControls/DynamicEventLoader";
import TurnByTurnOverlay from "./map/MapControls/TurnByTurnOverlay";

import { useMapId } from "@/app/context/MapContext";
import { rebuildBuckets, labelBuckets } from "./map/bucketManager";
import { toGraphic as toEventGraphic } from "./map/MapControls/eventsLayer";

/* ─────────────────────────────────────────
 * Types from API payload
 * ───────────────────────────────────── */
interface SpatialReference {
  wkid: number;
  latestWkid: number;
}
interface PolygonDTO {
  attributes: Record<string, any>;
  geometry: {
    type: string;
    rings: number[][][];
    spatialReference: SpatialReference;
  };
  symbol: {
    type: string;
    color: number[]; // [r,g,b,a]
    outline: { color: number[]; width: number };
  };
}
interface LabelDTO {
  attributes: {
    parentId: string;
    showAtZoom: number | null;
    hideAtZoom: number | null;
    fontSize: number;
    color: number[];
    haloColor: number[];
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
interface EventPointDTO {
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
    iconSize?: number;
    iconUrl?: string;
  };
  geometry: {
    type: "point";
    x: number;
    y: number;
    spatialReference: SpatialReference;
  };
}
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
interface ExportBody {
  userEmail: string;
  polygons: PolygonDTO[];
  labels: LabelDTO[];
  events?: EventPointDTO[];
  /** NEW: endpoints to fetch dynamic events */
  eventSources?: string[];

  settings: {
    zoom: number;
    center: [x: number, y: number];
    constraints: {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    } | null;
    featureLayers: FeatureLayerConfig[] | null;
  };
}

/* ─────────────────────────────────────────
 * Component
 * ───────────────────────────────────── */
export default function ArcGISMap(mapData: ExportBody) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapId = useMapId();

  /** Parent-owned overlay state */
  type ActiveOverlay = "calendar" | "turn" | null;
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>(null);

  useEffect(() => {
    const intv = setInterval(() => {
      if (!(window as any).require) return;
      clearInterval(intv);

      (window as any).require(
        [
          "esri/config",
          "esri/Map",
          "esri/views/MapView",
          "esri/Graphic",
          "esri/layers/GraphicsLayer",
          "esri/layers/MediaLayer",
          "esri/layers/support/ImageElement",
          "esri/layers/support/ExtentAndRotationGeoreference",
          "esri/geometry/Extent",
          "esri/geometry/Point",
          "esri/geometry/Polygon",
          "esri/geometry/support/webMercatorUtils",
          "esri/geometry/geometryEngine",
          "esri/layers/FeatureLayer",
          "esri/layers/WebTileLayer",
        ],
        (
          esriConfig: any,
          EsriMap: any,
          MapView: any,
          Graphic: any,
          GraphicsLayer: any,
          MediaLayer: any,
          ImageElement: any,
          ExtentAndRotationGeoreference: any,
          Extent: any,
          Point: typeof __esri.Point,
          Polygon: typeof __esri.Polygon,
          webMercatorUtils: any,
          geometryEngine: any,
          FeatureLayer: any,
          WebTileLayer: any
        ) => {
          /* Helpers */
          const isLonLat = (x: number, y: number) =>
            Math.abs(x) <= 180 && Math.abs(y) <= 90;
          const toViewSR = (geom: __esri.Geometry | any): __esri.Geometry => {
            const wkid = geom?.spatialReference?.wkid;
            if (wkid === 3857 || wkid === 102100) return geom;
            if (wkid === 4326)
              return webMercatorUtils.geographicToWebMercator(geom);
            if (
              geom?.x !== undefined &&
              geom?.y !== undefined &&
              isLonLat(geom.x, geom.y)
            ) {
              return webMercatorUtils.geographicToWebMercator(
                new Point({
                  x: geom.x,
                  y: geom.y,
                  spatialReference: { wkid: 4326 },
                })
              );
            }
            return geom;
          };

          const computeLabelPoint = (poly: __esri.Polygon): __esri.Point => {
            try {
              const p = geometryEngine.labelPoints(poly);
              if (p)
                return new Point({
                  x: p.x,
                  y: p.y,
                  spatialReference: { wkid: 3857 },
                });
            } catch {}
            const c1 = (poly as any).centroid;
            if (c1)
              return new Point({
                x: c1.x,
                y: c1.y,
                spatialReference: { wkid: 3857 },
              });
            if (poly.extent?.center)
              return new Point({
                x: poly.extent.center.x,
                y: poly.extent.center.y,
                spatialReference: { wkid: 3857 },
              });
            const ring = poly.rings?.[0] ?? [];
            let minX = Infinity,
              maxX = -Infinity,
              minY = Infinity,
              maxY = -Infinity;
            for (const [x, y] of ring) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
            return new Point({
              x: (minX + maxX) / 2,
              y: (minY + maxY) / 2,
              spatialReference: { wkid: 3857 },
            });
          };

          const createTextSymbol = (attrs: any) => ({
            type: "text",
            text: attrs.text,
            color: attrs.color ?? [0, 0, 0, 1],
            haloColor: attrs.haloColor ?? [255, 255, 255, 1],
            haloSize: attrs.haloSize ?? 2,
            font: {
              size: attrs.fontSize ?? 12,
              family: "sans-serif",
              weight: "bold",
            },
          });
          esriConfig.apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY as string;

          /* Map & View */
          const map = new EsriMap({ basemap: "arcgis/light-gray" });
          const [cx, cy] = mapData.settings.center;
          const centerPoint =
            Math.abs(cx) <= 180 && Math.abs(cy) <= 90
              ? webMercatorUtils.geographicToWebMercator(
                  new Point({ x: cx, y: cy, spatialReference: { wkid: 4326 } })
                )
              : new Point({ x: cx, y: cy, spatialReference: { wkid: 3857 } });

          const view = new MapView({
            container: mapDiv.current,
            map,
            spatialReference: { wkid: 3857 },
            center: centerPoint,
            zoom: mapData.settings.zoom,
            constraints: mapData.settings.constraints
              ? {
                  geometry: new Extent({
                    xmin: mapData.settings.constraints.xmin,
                    ymin: mapData.settings.constraints.ymin,
                    xmax: mapData.settings.constraints.xmax,
                    ymax: mapData.settings.constraints.ymax,
                    spatialReference: { wkid: 3857 },
                  }),
                }
              : undefined,
          });

          view.ui.move("zoom", "bottom-right");

          /* Layers */
          const editingLayer = new GraphicsLayer({ id: "editing" });
          const finalizedLayer = new GraphicsLayer({ id: "finalized" });
          const labelsLayer = new GraphicsLayer({ id: "labels" });
          const eventsLayer = new GraphicsLayer({
            id: "events-layer",
            title: "Campus Events",
            listMode: "show",
          });

          const campusTiles = new WebTileLayer({
            urlTemplate:
              "https://tiles.flavioherrera.com/v6/{level}/{col}/{row}.png",
            id: "campus-xyz",
            opacity: 1,
          });

          const mediaLayer = new MediaLayer({
            source: [
              new ImageElement({
                image: "https://campusmap.flavioherrera.com/testing/map4.png",
                georeference: new ExtentAndRotationGeoreference({
                  extent: new Extent({
                    xmin: -13406409.47,
                    ymin: 4488936.09,
                    xmax: -13404924.08,
                    ymax: 4490876.39,
                    spatialReference: { wkid: 102100 },
                  }),
                  rotation: 90,
                }),
              }),
            ],
          });

          (mediaLayer as any).z = 10;
          (campusTiles as any).z = 15;
          (finalizedLayer as any).z = 30;
          (editingLayer as any).z = 40;
          (eventsLayer as any).z = 45;
          (labelsLayer as any).z = 50;

          const createFeatureLayers = () => {
            const layers: any[] = [];
            if (!mapData.settings.featureLayers?.length) return layers;
            mapData.settings.featureLayers.forEach((config, index) => {
              try {
                const fl = new FeatureLayer({
                  url: config.url,
                  index: config.index,
                  outFields: config.outFields || ["*"],
                  popupEnabled: config.popupEnabled !== false,
                  popupTemplate: config.popupTemplate || undefined,
                });
                (fl as any).z = fl.index ?? 0;
                fl.id = `feature:${index}`;
                layers.push(fl);
              } catch (e) {
                console.error("Error creating feature layer", index, e);
              }
            });
            return layers;
          };

          const featureLayers = createFeatureLayers();
          const allLayers = [
            campusTiles,
            ...featureLayers,
            // mediaLayer,
            finalizedLayer,
            editingLayer,
            eventsLayer,
            labelsLayer,
          ].filter(Boolean);
          allLayers.sort((a: any, b: any) => (a.z ?? 0) - (b.z ?? 0));
          map.addMany(allLayers);

          /* Labels visibility */
          const applyLabelVisibility = (zoom: number) => {
            labelBuckets.forEach((bucket) => {
              const show = zoom >= bucket.minZoom && zoom <= bucket.maxZoom;
              bucket.labels.forEach((lbl) => (lbl.visible = show));
            });
          };

          /* Build labels from polygons */
          const rebuildAllLabelsFromPolygons = (
            savedLabelMap: globalThis.Map<string, LabelDTO>
          ) => {
            labelsLayer.removeAll();
            finalizedLayer.graphics.items.forEach((polyG: any) => {
              if (polyG.geometry?.type !== "polygon") return;
              const poly3857 = toViewSR(polyG.geometry) as __esri.Polygon;
              const pt = computeLabelPoint(poly3857);
              const saved = savedLabelMap.get(polyG.attributes?.id);
              const attrs = {
                parentId: polyG.attributes?.id,
                text:
                  saved?.attributes.text ?? polyG.attributes?.name ?? "Polygon",
                showAtZoom: saved?.attributes.showAtZoom ?? null,
                hideAtZoom: saved?.attributes.hideAtZoom ?? null,
                fontSize: saved?.attributes.fontSize ?? 12,
                color: saved?.attributes.color ?? [0, 0, 0, 1],
                haloColor: saved?.attributes.haloColor ?? [255, 255, 255, 1],
                haloSize: saved?.attributes.haloSize ?? 2,
              };
              const labelGraphic = new Graphic({
                geometry: pt,
                symbol: createTextSymbol(attrs),
                attributes: attrs,
              });
              labelsLayer.add(labelGraphic);
            });
            rebuildBuckets(labelsLayer);
            applyLabelVisibility(view.zoom);
          };

          /* Initial data load (includes events) */
          fetch(`/api/maps/${mapId}`)
            .then((res) => res.json())
            .then(
              (data: {
                polygons: PolygonDTO[];
                labels: LabelDTO[];
                events?: EventPointDTO[];
              }) => {
                (data.polygons || []).forEach((p) => {
                  const polyGeom = Polygon.fromJSON(p.geometry);
                  const projectedGeom = toViewSR(polyGeom) as __esri.Polygon;
                  const polyGraphic = new Graphic({
                    geometry: projectedGeom,
                    symbol: p.symbol,
                    attributes: p.attributes,
                    popupTemplate: {
                      title: p.attributes.name,
                      content: p.attributes.description,
                    },
                  });
                  finalizedLayer.add(polyGraphic);
                });

                const savedLabelMap = new globalThis.Map<string, LabelDTO>();
                (data.labels || []).forEach((l) => {
                  if (l?.attributes?.parentId)
                    savedLabelMap.set(l.attributes.parentId, l);
                });
                rebuildAllLabelsFromPolygons(savedLabelMap);

                (data.events || []).forEach((ev) => {
                  try {
                    const srcPt = new Point({
                      x: ev.geometry.x,
                      y: ev.geometry.y,
                      spatialReference: {
                        wkid: ev.geometry.spatialReference.wkid,
                      },
                    });
                    const pt3857 = toViewSR(srcPt) as __esri.Point;
                    const ce: CampusEvent = {
                      id: ev.attributes.id || `evt-${Date.now()}`,
                      event_name: ev.attributes.event_name || "Event",
                      description: ev.attributes.description ?? undefined,
                      date: ev.attributes.date ?? undefined,
                      startAt: ev.attributes.startAt ?? undefined,
                      endAt: ev.attributes.endAt ?? undefined,
                      locationTag: ev.attributes.locationTag ?? undefined,
                      names: ev.attributes.names ?? undefined,
                      original: ev.attributes.original ?? undefined,
                      geometry: { x: pt3857.x, y: pt3857.y, wkid: 3857 },
                      fromUser: ev.attributes.fromUser,
                      iconSize: ev.attributes.iconSize ?? 36,
                      iconUrl: ev.attributes.iconUrl ?? "/icons/event-pin.png",
                    };
                    eventsLayer.add(toEventGraphic(Graphic, ce));
                  } catch (e) {
                    console.error("Failed to load event:", ev, e);
                  }
                });

                view.when(() => applyLabelVisibility(view.zoom));
                finalizedLayerRef.events.dispatchEvent(new Event("change"));
              }
            )
            .catch((err) =>
              console.error("Error loading polygons/labels/events:", err)
            );

          /* Refs */
          editingLayerRef.current = editingLayer;
          setFinalizedLayer(finalizedLayer);
          setLabelsLayer(labelsLayer);
          GraphicRef.current = Graphic;
          MapViewRef.current = view;
          eventsLayerRef.current = eventsLayer;

          for (const ev of eventsStore.items) {
            eventsLayer.add(toEventGraphic(Graphic, ev));
          }

          view.watch("zoom", (z: number) => applyLabelVisibility(z));

          finalizedLayer.graphics.on("change", () => {
            const savedLabelMap = new globalThis.Map<string, LabelDTO>();
            labelsLayer.graphics.items.forEach((lbl: any) => {
              const att = lbl.attributes;
              if (att?.parentId) {
                savedLabelMap.set(att.parentId, {
                  attributes: att,
                  geometry: {
                    type: "point",
                    x: lbl.geometry.x,
                    y: lbl.geometry.y,
                    spatialReference: { wkid: 3857, latestWkid: 3857 },
                  },
                } as any);
              }
            });
            rebuildAllLabelsFromPolygons(savedLabelMap);
          });
        }
      );
    }, 100);

    return () => clearInterval(intv);
  }, [mapId]);

  /* Launcher click handlers (toggle behavior) */
  const toggleCalendar = () => {
    setActiveOverlay((cur) => (cur === "calendar" ? null : "calendar"));
  };
  const toggleTurn = () => {
    setActiveOverlay((cur) => (cur === "turn" ? null : "turn"));
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={mapDiv}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />

      {/* Rolling events fetcher (overlay handles visibility) */}
      <DynamicEventLoader eventSources={mapData.eventSources ?? []} />

      {/* ───────── Overlay Launchers (both always visible) ───────── */}
      <div style={dockWrap}>
        <button
          type="button"
          aria-label="Calendar filters"
          title="Calendar filters"
          aria-pressed={activeOverlay === "calendar"}
          onClick={toggleCalendar}
          style={{
            ...launcherBase,
            ...(activeOverlay === "calendar" ? launcherActive : null),
          }}
        >
          📅
        </button>
        <button
          type="button"
          aria-label="Turn-by-turn directions"
          title="Turn-by-turn directions"
          aria-pressed={activeOverlay === "turn"}
          onClick={toggleTurn}
          style={{
            ...launcherBase,
            marginTop: 11,
            ...(activeOverlay === "turn" ? launcherActive : null),
          }}
        >
          🧭
        </button>
      </div>

      {/* Calendar panel (offset so it doesn't cover the launchers) */}
      <EventCalendarOverlay
        expanded={activeOverlay === "calendar"}
        onClose={() => setActiveOverlay(null)}
      />

      {/* Turn-by-turn panel: show only when active.
          If your TurnByTurnOverlay draws its own absolute panel at top-right,
          the launchers will still sit above it (higher z-index). */}
      {activeOverlay === "turn" && (
        <div style={turnWrap}>
          <TurnByTurnOverlay />
          <div style={{ position: "absolute", top: 5, right: 5, zIndex: 9999 }}>
            <button
              onClick={() => setActiveOverlay(null)}
              style={closeTurnBtn}
              title="Close"
            >
              ⤫
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── Styles ───────── */
const dockWrap: React.CSSProperties = {
  position: "absolute",
  top: 5,
  left: 5,
  zIndex: 2000, // above panels so buttons are always clickable
  pointerEvents: "auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const launcherBase: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  border: "4px solid #000000ff",
  background: "white",
  boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
  cursor: "pointer",
  fontSize: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const launcherActive: React.CSSProperties = {
  borderColor: "#2775ff",
  boxShadow: "0 0 0 3px rgba(39,117,255,0.25), 0 8px 22px rgba(0,0,0,0.22)",
};

const turnWrap: React.CSSProperties = {
  position: "absolute",
  top: 5,
  left: 55, // leave space for the launcher column (44 + margins)
  zIndex: 1000,
  pointerEvents: "auto",
};

const closeTurnBtn: React.CSSProperties = {
  border: "none",
  background: "#fff",
  borderRadius: 8,
  cursor: "pointer",
  padding: "4px 8px",
  fontWeight: 700,
};
