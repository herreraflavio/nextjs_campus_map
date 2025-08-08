// "use client";

// import { useEffect, useRef } from "react";
// import {
//   editingLayerRef,
//   MapViewRef,
//   finalizedLayerRef,
//   GraphicRef,
//   setFinalizedLayer,
//   setLabelsLayer,
// } from "./map/arcgisRefs";
// import "./ArcGISMap.css";
// import { useMapId } from "@/app/context/MapContext";

// import { getPolygonCentroid } from "./map/centroid";
// import { rebuildBuckets, labelBuckets } from "./map/bucketManager";

// interface SpatialReference {
//   wkid: number;
//   latestWkid: number;
// }

// interface Polygon {
//   attributes: Record<string, any>;
//   geometry: {
//     type: string;
//     rings: number[][][];
//     spatialReference: SpatialReference;
//   };
//   symbol: {
//     type: string;
//     color: number[]; // [r,g,b,a]
//     outline: {
//       color: number[]; // [r,g,b,a]
//       width: number;
//     };
//   };
// }

// interface Label {
//   attributes: {
//     parentId: string;
//     showAtZoom: number | null;
//     hideAtZoom: number | null;
//     fontSize: number;
//     color: number[]; // [r,g,b,a]
//     haloColor: number[]; // [r,g,b,a]
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

// interface ExportBody {
//   userEmail: string;
//   polygons: Polygon[];
//   labels: Label[];
//   settings: {
//     zoom: number;
//     center: [x: number, y: number];
//     constraints: {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     } | null;
//   };
// }

// // helper to convert Web Mercator (EPSG:3857) → lon/lat in degrees (EPSG:4326)
// function mercatorToLonLat(x: number, y: number): [number, number] {
//   const R = 6378137; // Earth's radius in meters
//   const lon = (x / R) * (180 / Math.PI);
//   const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);
//   return [lon, lat];
// }

// export default function ArcGISMap(mapData: ExportBody) {
//   const mapDiv = useRef<HTMLDivElement>(null);
//   const mapId = useMapId();

//   console.log(mapData);

//   useEffect(() => {
//     // Wait until the ArcGIS AMD loader is available
//     const intv = setInterval(() => {
//       if (!(window as any).require) return;
//       clearInterval(intv);

//       (window as any).require(
//         [
//           "esri/Map",
//           "esri/views/MapView",
//           "esri/Graphic",
//           "esri/layers/GraphicsLayer",
//           "esri/layers/MediaLayer",
//           "esri/layers/support/ImageElement",
//           "esri/layers/support/ExtentAndRotationGeoreference",
//           "esri/geometry/Extent",
//           "esri/geometry/Point",
//         ],
//         (
//           Map: any,
//           MapView: any,
//           Graphic: any,
//           GraphicsLayer: any,
//           MediaLayer: any,
//           ImageElement: any,
//           ExtentAndRotationGeoreference: any,
//           Extent: any,
//           Point: typeof __esri.Point
//         ) => {
//           /* ─────────── Map & View ─────────── */
//           const map = new Map({ basemap: "satellite" });

//           console.log(mapData.settings.center);
//           let cords = mapData.settings.center;
//           console.log(cords[0], cords[1]);

//           let centerCoords = mercatorToLonLat(cords[0], cords[1]);
//           //let centerCoords = [cords[0], cords[1]];

//           console.log(centerCoords);
//           const view = new MapView({
//             container: mapDiv.current,
//             map,
//             center: centerCoords,
//             zoom: mapData.settings.zoom,
//             constraints: {
//               geometry: {
//                 type: "extent",
//                 xmin: mapData.settings.constraints?.xmin, // Adjust to fit UC Merced's bounding coordinates
//                 ymin: mapData.settings.constraints?.ymin,
//                 xmax: mapData.settings.constraints?.xmax,
//                 ymax: mapData.settings.constraints?.ymax,
//                 spatialReference: { wkid: 3857 },
//               },
//             },
//           });

//           /* ─────────── Layers ─────────── */
//           const editingLayer = new GraphicsLayer({ id: "editing" });
//           const finalizedLayer = new GraphicsLayer({ id: "finalized" });
//           const labelsLayer = new GraphicsLayer({ id: "labels" });

//           // (optional) background image
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

//           map.addMany([mediaLayer, finalizedLayer, editingLayer, labelsLayer]);

//           /* ─────────── Helper: Set label visibility ─────────── */
//           const applyLabelVisibility = (zoom: number) => {
//             labelBuckets.forEach((bucket) => {
//               const show = zoom >= bucket.minZoom && zoom <= bucket.maxZoom;
//               bucket.labels.forEach((lbl) => (lbl.visible = show));
//             });
//           };

//           /* ─────────── Load polygons & labels ─────────── */
//           fetch(`/api/maps/${mapId}`)
//             .then((res) => res.json())
//             .then(
//               (data: { polygons: any[]; labels: any[]; settings: any[] }) => {
//                 // 1) polygons
//                 data.polygons.forEach((p) => {
//                   const polyGraphic = new Graphic({
//                     geometry: p.geometry,
//                     symbol: p.symbol,
//                     attributes: p.attributes,
//                     popupTemplate: {
//                       title: p.attributes.name,
//                       content: p.attributes.description,
//                     },
//                   });
//                   finalizedLayer.add(polyGraphic);
//                 });

//                 // 2) labels
//                 data.labels.forEach((l: any) => {
//                   const labelGraphic = new Graphic({
//                     geometry: {
//                       type: "point",
//                       x: l.geometry.x,
//                       y: l.geometry.y,
//                       spatialReference: view.spatialReference,
//                     },
//                     symbol: {
//                       type: "text",
//                       text: l.attributes.text,
//                       color: l.attributes.color,
//                       haloColor: l.attributes.haloColor,
//                       haloSize: l.attributes.haloSize,
//                       font: {
//                         size: l.attributes.fontSize,
//                         family: "sans-serif",
//                         weight: "bold",
//                       },
//                     },
//                     attributes: {
//                       parentId: l.attributes.parentId,
//                       showAtZoom: l.attributes.showAtZoom,
//                       hideAtZoom: l.attributes.hideAtZoom,
//                     },
//                   });
//                   labelsLayer.add(labelGraphic);
//                 });

//                 // Build buckets and immediately sync visibility
//                 rebuildBuckets(labelsLayer);

//                 // Wait until the first render so view.zoom is correct
//                 view.when(() => applyLabelVisibility(view.zoom));

//                 finalizedLayerRef.events.dispatchEvent(new Event("change"));
//               }
//             )
//             .catch((err) =>
//               console.error("Error loading polygons/labels:", err)
//             );

//           /* ─────────── Keep labels in sync while zooming ─────────── */
//           view.watch("zoom", (z: number) => applyLabelVisibility(z));

//           /* ─────────── Rebuild buckets & visibility on label edits ─────────── */
//           labelsLayer.graphics.on("change", () => {
//             rebuildBuckets(labelsLayer);
//             applyLabelVisibility(view.zoom);
//           });

//           /* ─────────── Reposition labels when polygons move ─────────── */
//           finalizedLayer.graphics.on("change", () => {
//             const polys = finalizedLayer.graphics.items;
//             const labels = labelsLayer.graphics.items;

//             labels.forEach((label: any) => {
//               const pid = label.attributes.parentId;
//               const poly = polys.find((p: any) => p.attributes.id === pid);
//               if (!poly) return;

//               const [cx, cy] = getPolygonCentroid(poly.geometry.rings[0]);
//               (window as any).require(
//                 ["esri/geometry/Point"],
//                 (Point: typeof __esri.Point) => {
//                   label.geometry = new Point({
//                     x: cx,
//                     y: cy,
//                     spatialReference: poly.geometry.spatialReference,
//                   });
//                 }
//               );
//             });
//           });

//           /* ─────────── Expose refs for other components ─────────── */
//           editingLayerRef.current = editingLayer;
//           setFinalizedLayer(finalizedLayer);
//           setLabelsLayer(labelsLayer);
//           GraphicRef.current = Graphic;
//           MapViewRef.current = view;
//         }
//       );
//     }, 100);

//     return () => clearInterval(intv);
//   }, [mapId]);

//   return <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />;
// }

"use client";

import { useEffect, useRef } from "react";
import {
  editingLayerRef,
  MapViewRef,
  finalizedLayerRef,
  GraphicRef,
  setFinalizedLayer,
  setLabelsLayer,
} from "./map/arcgisRefs";
import "./ArcGISMap.css";
import { useMapId } from "@/app/context/MapContext";
import { rebuildBuckets, labelBuckets } from "./map/bucketManager";

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
interface ExportBody {
  userEmail: string;
  polygons: PolygonDTO[];
  labels: LabelDTO[];
  settings: {
    zoom: number;
    center: [x: number, y: number];
    constraints: {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    } | null;
  };
}

export default function ArcGISMap(mapData: ExportBody) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapId = useMapId();

  useEffect(() => {
    const intv = setInterval(() => {
      if (!(window as any).require) return;
      clearInterval(intv);

      (window as any).require(
        [
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
        ],
        (
          EsriMap: any, // ⬅️ renamed (no clash with JS Map)
          MapView: any,
          Graphic: any,
          GraphicsLayer: any,
          MediaLayer: any,
          ImageElement: any,
          ExtentAndRotationGeoreference: any,
          Extent: any,
          Point: typeof __esri.Point,
          Polygon: typeof __esri.Polygon, // ⬅️ need real Polygon ctor
          webMercatorUtils: any,
          geometryEngine: any
        ) => {
          /* ─────────── Helpers ─────────── */
          const isLonLat = (x: number, y: number) =>
            Math.abs(x) <= 180 && Math.abs(y) <= 90;

          const toViewSR = (geom: __esri.Geometry | any): __esri.Geometry => {
            const wkid = geom?.spatialReference?.wkid;
            if (wkid === 3857 || wkid === 102100) return geom;
            if (wkid === 4326)
              return webMercatorUtils.geographicToWebMercator(geom);
            // If it's a point-ish object and looks like lon/lat, convert
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
            // bbox fallback
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

          /* ─────────── Map & View ─────────── */
          const map = new EsriMap({ basemap: "satellite" });

          // Normalize center to 3857
          const [cx, cy] = mapData.settings.center;
          const centerPoint = isLonLat(cx, cy)
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

          /* ─────────── Layers ─────────── */
          const editingLayer = new GraphicsLayer({ id: "editing" });
          const finalizedLayer = new GraphicsLayer({ id: "finalized" });
          const labelsLayer = new GraphicsLayer({ id: "labels" });

          // (optional) background image already in 102100/3857 family
          const imgLowRes = new ImageElement({
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
          });
          const mediaLayer = new MediaLayer({ source: [imgLowRes] });

          map.addMany([mediaLayer, finalizedLayer, editingLayer, labelsLayer]);

          /* ─────────── Label visibility buckets ─────────── */
          const applyLabelVisibility = (zoom: number) => {
            labelBuckets.forEach((bucket) => {
              const show = zoom >= bucket.minZoom && zoom <= bucket.maxZoom;
              bucket.labels.forEach((lbl) => (lbl.visible = show));
            });
          };

          /* ─────────── Build labels from polygons ─────────── */
          const rebuildAllLabelsFromPolygons = (
            savedLabelMap: globalThis.Map<string, LabelDTO>
          ) => {
            labelsLayer.removeAll();

            finalizedLayer.graphics.items.forEach((polyG: any) => {
              if (polyG.geometry?.type !== "polygon") return;

              // ensure polygon is real geometry & in view SR
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

          /* ─────────── Initial data load ─────────── */
          fetch(`/api/maps/${mapId}`)
            .then((res) => res.json())
            .then((data: { polygons: PolygonDTO[]; labels: LabelDTO[] }) => {
              // 1) Add polygons as real geometries (from JSON), project if needed
              data.polygons.forEach((p) => {
                const polyJSON = p.geometry; // DTO
                const polyGeom = Polygon.fromJSON(polyJSON); // ⬅️ real __esri.Polygon
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

              // 2) Keep only label ATTRS (position is recomputed)
              const savedLabelMap = new globalThis.Map<string, LabelDTO>(); // ⬅️ no clash
              (data.labels || []).forEach((l) => {
                if (l?.attributes?.parentId)
                  savedLabelMap.set(l.attributes.parentId, l);
              });

              // 3) Compute label positions from polygons in view SR
              rebuildAllLabelsFromPolygons(savedLabelMap);

              view.when(() => applyLabelVisibility(view.zoom));
              finalizedLayerRef.events.dispatchEvent(new Event("change"));
            })
            .catch((err) =>
              console.error("Error loading polygons/labels:", err)
            );

          /* ─────────── Keep labels in sync while zooming ─────────── */
          view.watch("zoom", (z: number) => applyLabelVisibility(z));

          /* ─────────── Rebuild buckets & visibility on label edits ─────────── */
          labelsLayer.graphics.on("change", () => {
            rebuildBuckets(labelsLayer);
            applyLabelVisibility(view.zoom);
          });

          /* ─────────── Recompute label positions when polygons change ─────────── */
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

          /* ─────────── Expose refs ─────────── */
          editingLayerRef.current = editingLayer;
          setFinalizedLayer(finalizedLayer);
          setLabelsLayer(labelsLayer);
          GraphicRef.current = Graphic;
          MapViewRef.current = view;
        }
      );
    }, 100);

    return () => clearInterval(intv);
  }, [mapId]);

  return <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />;
}
