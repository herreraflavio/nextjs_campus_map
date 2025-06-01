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
// import { getPolygonCentroid } from "./map/centroid";
// import { rebuildBuckets, labelBuckets } from "./map/bucketManager";

// export default function ArcGISMap() {
//   const mapDiv = useRef<HTMLDivElement>(null);

//   useEffect(() => {
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
//           const map = new Map({ basemap: "streets-navigation-vector" });
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

//           // background image
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

//           // Watch for zoom and control visibility
//           view.watch("zoom", (z: number) => {
//             labelBuckets.forEach((b) => {
//               const show = z >= b.minZoom && z <= b.maxZoom;
//               b.labels.forEach((lbl) => (lbl.visible = show));
//             });
//           });

//           // Run rebuild on init and collection changes
//           rebuildBuckets(labelsLayer);
//           labelsLayer.graphics.on("change", () => rebuildBuckets(labelsLayer));

//           // ——— reposition on polygon edits ———
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

//           // ——— store refs for Sidebar & Sketch tool ———
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
import { getPolygonCentroid } from "./map/centroid";
import { rebuildBuckets, labelBuckets } from "./map/bucketManager";

export default function ArcGISMap() {
  const mapDiv = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // We wait until the ArcGIS AMD loader is available
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
          // ——— Basic map & view ———
          const map = new Map({ basemap: "streets-navigation-vector" });
          const view = new MapView({
            container: mapDiv.current,
            map,
            center: [-120.422045, 37.365169],
            zoom: 16,
          });

          // ——— Layers ———
          const editingLayer = new GraphicsLayer({ id: "editing" });
          const finalizedLayer = new GraphicsLayer({ id: "finalized" });
          const labelsLayer = new GraphicsLayer({ id: "labels" });

          // background image (optional)
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

          // ——— LOAD polygons.json → add to 'finalized' & 'labels' layers ———
          fetch("/data/polygons.json")
            .then((res) => res.json())
            .then((data: { polygons: any[] }) => {
              data.polygons.forEach((p) => {
                // 1) Add the polygon itself to finalizedLayer
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

                // 2) Compute centroid of the first ring & add a text label
                //    (we assume at least one ring exists).
                const [cx, cy] = getPolygonCentroid(p.geometry.rings[0]);

                // Build label attributes, including showAtZoom/hideAtZoom if provided:
                const labelAttrs: any = {
                  id: `label-${p.attributes.id}`,
                  parentId: p.attributes.id,
                  name: p.attributes.name,
                };
                if (p.attributes.showAtZoom != null) {
                  labelAttrs.showAtZoom = p.attributes.showAtZoom;
                }
                if (p.attributes.hideAtZoom != null) {
                  labelAttrs.hideAtZoom = p.attributes.hideAtZoom;
                }

                const labelGraphic = new Graphic({
                  geometry: {
                    type: "point",
                    x: cx,
                    y: cy,
                    spatialReference: view.spatialReference,
                  },
                  symbol: {
                    type: "text",
                    text: p.attributes.name,
                    color: "black",
                    haloColor: "white",
                    haloSize: "2px",
                    font: {
                      size: 12,
                      family: "sans-serif",
                      weight: "bold",
                    },
                  },
                  attributes: labelAttrs,
                });
                labelsLayer.add(labelGraphic);
              });

              // Once all labels exist, rebuild buckets so `labelBuckets` populates.
              rebuildBuckets(labelsLayer);
              finalizedLayerRef.events.dispatchEvent(new Event("change"));
            })
            .catch((err) => console.error("Error loading polygons.json:", err));

          // ——— Watch for zoom and control label visibility via labelBuckets ———
          view.watch("zoom", (z: number) => {
            labelBuckets.forEach((b) => {
              const show = z >= b.minZoom && z <= b.maxZoom;
              b.labels.forEach((lbl) => {
                lbl.visible = show;
              });
            });
          });

          // Ensure buckets re‐compute if labels layer changes
          rebuildBuckets(labelsLayer);
          labelsLayer.graphics.on("change", () => rebuildBuckets(labelsLayer));

          // ——— Reposition labels when polygons are edited in finalizedLayer ———
          finalizedLayer.graphics.on("change", () => {
            const polys = finalizedLayer.graphics.items;
            const labels = labelsLayer.graphics.items;
            labels.forEach((label: any) => {
              const pid = label.attributes.parentId;
              const poly = polys.find((p: any) => p.attributes.id === pid);
              if (!poly) return;
              // recalc centroid of that polygon’s first ring
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

          // ——— Store layer refs for Sidebar & Sketch tool ———
          editingLayerRef.current = editingLayer;
          setFinalizedLayer(finalizedLayer);
          setLabelsLayer(labelsLayer);
          GraphicRef.current = Graphic;
          MapViewRef.current = view;
        }
      );
    }, 100);

    return () => clearInterval(intv);
  }, []);

  return <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />;
}
