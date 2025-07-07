// // src/components/arcgismap.tsx
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
// import { useMapId } from "@/app/context/MapContext";

// import { getPolygonCentroid } from "./map/centroid";
// import { rebuildBuckets, labelBuckets } from "./map/bucketManager";

// export default function ArcGISMap() {
//   const mapDiv = useRef<HTMLDivElement>(null);
//   const mapId = useMapId();

//   console.log("mapId:", mapId);

//   useEffect(() => {
//     // We wait until the ArcGIS AMD loader is available
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
//           // ——— Basic map & view ———
//           // const map = new Map({ basemap: "streets-navigation-vector" });
//           const map = new Map({ basemap: "satellite" });

//           const view = new MapView({
//             container: mapDiv.current,
//             map,
//             center: [-120.422045, 37.365169],
//             zoom: 16,
//           });

//           // ——— Layers ———
//           const editingLayer = new GraphicsLayer({ id: "editing" });
//           const finalizedLayer = new GraphicsLayer({ id: "finalized" });
//           const labelsLayer = new GraphicsLayer({ id: "labels" });

//           // background image (optional)
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

//           // ——— LOAD polygons.json → add to 'finalized' & 'labels' layers ———
//           // fetch("/data/polygons.json")
//           fetch(`/api/maps/${mapId}`)
//             .then((res) => res.json())
//             .then((data: { polygons: any[]; labels: any[] }) => {
//               data.polygons.forEach((p) => {
//                 // 1) Add the polygon itself to finalizedLayer
//                 const polyGraphic = new Graphic({
//                   geometry: p.geometry,
//                   symbol: p.symbol,
//                   attributes: p.attributes,
//                   popupTemplate: {
//                     title: p.attributes.name,
//                     content: p.attributes.description,
//                   },
//                 });
//                 finalizedLayer.add(polyGraphic);
//               });
//               // 2) Recreate labels from saved data
//               data.labels.forEach((l: any) => {
//                 const labelGraphic = new Graphic({
//                   geometry: {
//                     type: "point",
//                     x: l.geometry.x,
//                     y: l.geometry.y,
//                     spatialReference: view.spatialReference,
//                   },
//                   symbol: {
//                     type: "text",
//                     text: l.attributes.text,
//                     color: l.attributes.color,
//                     haloColor: l.attributes.haloColor,
//                     haloSize: l.attributes.haloSize,
//                     font: {
//                       size: l.attributes.fontSize,
//                       family: "sans-serif",
//                       weight: "bold",
//                     },
//                   },
//                   attributes: {
//                     parentId: l.attributes.parentId,
//                     showAtZoom: l.attributes.showAtZoom,
//                     hideAtZoom: l.attributes.hideAtZoom,
//                   },
//                 });
//                 labelsLayer.add(labelGraphic);
//               });

//               // Once all labels exist, rebuild buckets so `labelBuckets` populates.
//               rebuildBuckets(labelsLayer);
//               finalizedLayerRef.events.dispatchEvent(new Event("change"));
//             })
//             .catch((err) => console.error("Error loading polygons.json:", err));

//           // ——— Watch for zoom and control label visibility via labelBuckets ———
//           view.watch("zoom", (z: number) => {
//             labelBuckets.forEach((b) => {
//               const show = z >= b.minZoom && z <= b.maxZoom;
//               b.labels.forEach((lbl) => {
//                 lbl.visible = show;
//               });
//             });
//           });

//           // Ensure buckets re‐compute if labels layer changes
//           rebuildBuckets(labelsLayer);
//           labelsLayer.graphics.on("change", () => rebuildBuckets(labelsLayer));

//           // ——— Reposition labels when polygons are edited in finalizedLayer ———
//           finalizedLayer.graphics.on("change", () => {
//             const polys = finalizedLayer.graphics.items;
//             const labels = labelsLayer.graphics.items;
//             labels.forEach((label: any) => {
//               const pid = label.attributes.parentId;
//               const poly = polys.find((p: any) => p.attributes.id === pid);
//               if (!poly) return;
//               // recalc centroid of that polygon’s first ring
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

//           // ——— Store layer refs for Sidebar & Sketch tool ———
//           editingLayerRef.current = editingLayer;
//           setFinalizedLayer(finalizedLayer);
//           setLabelsLayer(labelsLayer);
//           GraphicRef.current = Graphic;
//           MapViewRef.current = view;
//         }
//       );
//     }, 100);

//     return () => clearInterval(intv);
//   }, []);

//   return <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />;
// }

// src/components/arcgismap.tsx

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
import { useMapId } from "@/app/context/MapContext";

import { getPolygonCentroid } from "./map/centroid";
import { rebuildBuckets, labelBuckets } from "./map/bucketManager";

export default function ArcGISMap() {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapId = useMapId();

  useEffect(() => {
    // Wait until the ArcGIS AMD loader is available
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
        ],
        (
          Map: any,
          MapView: any,
          Graphic: any,
          GraphicsLayer: any,
          MediaLayer: any,
          ImageElement: any,
          ExtentAndRotationGeoreference: any,
          Extent: any,
          Point: typeof __esri.Point
        ) => {
          /* ─────────── Map & View ─────────── */
          const map = new Map({ basemap: "satellite" });

          const view = new MapView({
            container: mapDiv.current,
            map,
            center: [-120.422045, 37.368169],
            zoom: 15,
          });

          /* ─────────── Layers ─────────── */
          const editingLayer = new GraphicsLayer({ id: "editing" });
          const finalizedLayer = new GraphicsLayer({ id: "finalized" });
          const labelsLayer = new GraphicsLayer({ id: "labels" });

          // (optional) background image
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

          /* ─────────── Helper: Set label visibility ─────────── */
          const applyLabelVisibility = (zoom: number) => {
            labelBuckets.forEach((bucket) => {
              const show = zoom >= bucket.minZoom && zoom <= bucket.maxZoom;
              bucket.labels.forEach((lbl) => (lbl.visible = show));
            });
          };

          /* ─────────── Load polygons & labels ─────────── */
          fetch(`/api/maps/${mapId}`)
            .then((res) => res.json())
            .then((data: { polygons: any[]; labels: any[] }) => {
              // 1) polygons
              data.polygons.forEach((p) => {
                const polyGraphic = new Graphic({
                  geometry: p.geometry,
                  symbol: p.symbol,
                  attributes: p.attributes,
                  popupTemplate: {
                    title: p.attributes.name,
                    content: p.attributes.description,
                  },
                });
                finalizedLayer.add(polyGraphic);
              });

              // 2) labels
              data.labels.forEach((l: any) => {
                const labelGraphic = new Graphic({
                  geometry: {
                    type: "point",
                    x: l.geometry.x,
                    y: l.geometry.y,
                    spatialReference: view.spatialReference,
                  },
                  symbol: {
                    type: "text",
                    text: l.attributes.text,
                    color: l.attributes.color,
                    haloColor: l.attributes.haloColor,
                    haloSize: l.attributes.haloSize,
                    font: {
                      size: l.attributes.fontSize,
                      family: "sans-serif",
                      weight: "bold",
                    },
                  },
                  attributes: {
                    parentId: l.attributes.parentId,
                    showAtZoom: l.attributes.showAtZoom,
                    hideAtZoom: l.attributes.hideAtZoom,
                  },
                });
                labelsLayer.add(labelGraphic);
              });

              // Build buckets and immediately sync visibility
              rebuildBuckets(labelsLayer);

              // Wait until the first render so view.zoom is correct
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

          /* ─────────── Reposition labels when polygons move ─────────── */
          finalizedLayer.graphics.on("change", () => {
            const polys = finalizedLayer.graphics.items;
            const labels = labelsLayer.graphics.items;

            labels.forEach((label: any) => {
              const pid = label.attributes.parentId;
              const poly = polys.find((p: any) => p.attributes.id === pid);
              if (!poly) return;

              const [cx, cy] = getPolygonCentroid(poly.geometry.rings[0]);
              (window as any).require(
                ["esri/geometry/Point"],
                (Point: typeof __esri.Point) => {
                  label.geometry = new Point({
                    x: cx,
                    y: cy,
                    spatialReference: poly.geometry.spatialReference,
                  });
                }
              );
            });
          });

          /* ─────────── Expose refs for other components ─────────── */
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
