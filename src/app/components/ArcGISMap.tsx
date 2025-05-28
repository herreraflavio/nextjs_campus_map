// "use client";
// import { useEffect, useRef } from "react";
// import {
//   editingLayerRef,
//   MapViewRef,
//   finalizedLayerRef,
//   GraphicRef,
// } from "./map/arcgisRefs";

// import { setFinalizedLayer, setLabelsLayer } from "./map/arcgisRefs";

// import { getPolygonCentroid } from "./map/centroid";

// import Point from "@arcgis/core/geometry/Point";

// export default function ArcGISMap() {
//   const mapDiv = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     const intv = setInterval(() => {
//       if ((window as any).require) {
//         clearInterval(intv);

//         (window as any).require(
//           [
//             "esri/Map",
//             "esri/views/MapView",
//             "esri/Graphic",
//             "esri/layers/GraphicsLayer",
//             "esri/layers/MediaLayer",
//             "esri/layers/support/ImageElement",
//             "esri/layers/support/ExtentAndRotationGeoreference",
//             "esri/geometry/Extent",
//             "esri/geometry/Point",
//           ],
//           (
//             Map: any,
//             MapView: any,
//             Graphic: any,
//             GraphicsLayer: any,
//             MediaLayer: any,
//             ImageElement: any,
//             ExtentAndRotationGeoreference: any,
//             Extent: any,
//             Point: any
//           ) => {
//             const map = new Map({ basemap: "streets-navigation-vector" });
//             const view = new MapView({
//               container: mapDiv.current,
//               map,
//               center: [-120.422045, 37.365169],
//               zoom: 16,
//             });

//             // 1) Create an editing layer (for Sketch)
//             const editingLayer = new GraphicsLayer({ id: "editing" });
//             // 2) Create a finalized layer (static graphics)
//             const finalizedLayer = new GraphicsLayer({ id: "finalized" });
//             const labelsLayer = new GraphicsLayer({ id: "labels" });

//             const imgLowRes = new ImageElement({
//               image: "https://campusmap.flavioherrera.com/testing/map4.png",
//               georeference: new ExtentAndRotationGeoreference({
//                 extent: new Extent({
//                   xmin: -13406409.47,
//                   ymin: 4488936.09,
//                   xmax: -13404924.08,
//                   ymax: 4490876.39,
//                   spatialReference: { wkid: 102100 },
//                 }),
//                 rotation: 90,
//               }),
//             });

//             // 4. Add it to a MediaLayer
//             const mediaLayer = new MediaLayer({
//               source: [imgLowRes],
//             });

//             map.addMany([
//               mediaLayer,
//               finalizedLayer,
//               editingLayer,
//               labelsLayer,
//             ]);

//             // somewhere after map.addMany([...]) and before you store refs:

//             // 1) a place to keep your buckets
//             const labelBuckets: Array<{
//               minZoom: number;
//               maxZoom: number;
//               labels: __esri.Graphic[];
//             }> = [];

//             // 2) when ever a new label is added to labelsLayer (e.g. on "change")
//             //    repopulate your buckets from scratch:
//             function rebuildBuckets() {
//               labelBuckets.length = 0;
//               labelsLayer.graphics.items.forEach((lbl: any) => {
//                 const minZ = lbl.attributes.showAtZoom ?? 0;
//                 const maxZ = lbl.attributes.hideAtZoom ?? Infinity;
//                 // find an existing bucket
//                 let b = labelBuckets.find(
//                   (bkt) => bkt.minZoom === minZ && bkt.maxZoom === maxZ
//                 );
//                 if (!b) {
//                   b = { minZoom: minZ, maxZoom: maxZ, labels: [] };
//                   labelBuckets.push(b);
//                 }
//                 b.labels.push(lbl);
//               });
//             }

//             // 3) every time your finalized layer changes, rebuild
//             finalizedLayerRef.events.addEventListener("change", rebuildBuckets);

//             // 4) now watch the view zoom
//             view.watch("zoom", (newZoom: number) => {
//               labelBuckets.forEach((bucket) => {
//                 const shouldShow =
//                   newZoom >= bucket.minZoom && newZoom <= bucket.maxZoom;
//                 bucket.labels.forEach((lbl) => {
//                   lbl.visible = shouldShow;
//                 });
//               });
//             });

//             // 5) kick it off once
//             rebuildBuckets();

//             // store refs
//             editingLayerRef.current = editingLayer;
//             setFinalizedLayer(finalizedLayer);
//             setLabelsLayer(labelsLayer);

//             finalizedLayerRef.events.addEventListener("change", () => {
//               const polys = finalizedLayer.graphics.items; // all polygons
//               const labels = labelsLayer.graphics.items; // all labels
//               labels.forEach((label: any) => {
//                 const pid = label.attributes.parentId;
//                 const poly = polys.find((p: any) => p.attributes.id === pid);
//                 if (!poly) return;
//                 // compute new centroid
//                 const [cx, cy] = getPolygonCentroid(poly.geometry.rings[0]);
//                 // reposition label (use real Point class)
//                 label.geometry = new Point({
//                   x: cx,
//                   y: cy,
//                   spatialReference: poly.geometry.spatialReference,
//                 });
//               });
//             });
//             GraphicRef.current = Graphic;
//             MapViewRef.current = view;
//           }
//         );
//       }
//     }, 100);

//     return () => clearInterval(intv);
//   }, []);

//   return <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />;
// }

// src/app/components/map/ArcGISMap.tsx

// src/app/components/map/ArcGISMap.tsx
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

          // background image
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

          // 2) on every zoom change, toggle each bucket’s visibility
          // view.watch("zoom", (z: number) => {
          //   labelBuckets.forEach((b) => {
          //     console.log("attemping to hide");
          //     console.log("z: " + z);
          //     console.log("b.minZoom: " + b.minZoom);
          //     console.log("b.maxZoom: " + b.maxZoom);
          //     const show = z >= b.minZoom && z <= b.maxZoom;
          //     b.labels.forEach((lbl) => (lbl.visible = show));
          //   });
          // });
          // Watch for zoom and control visibility
          view.watch("zoom", (z: number) => {
            labelBuckets.forEach((b) => {
              const show = z >= b.minZoom && z <= b.maxZoom;
              b.labels.forEach((lbl) => (lbl.visible = show));
            });
          });

          // Run rebuild on init and collection changes
          rebuildBuckets(labelsLayer);
          labelsLayer.graphics.on("change", () => rebuildBuckets(labelsLayer));

          // ——— reposition on polygon edits ———
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

          // ——— store refs for Sidebar & Sketch tool ———
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

//           // ——— Zoom-bucket state ———
//           type Bucket = {
//             minZoom: number;
//             maxZoom: number;
//             labels: __esri.Graphic[];
//           };
//           const labelBuckets: Bucket[] = [];

//           function rebuildBuckets() {
//             labelBuckets.length = 0;
//             labelsLayer.graphics.items.forEach((lbl: any) => {
//               const minZ = lbl.attributes.showAtZoom ?? 0;
//               const maxZ = lbl.attributes.hideAtZoom ?? Infinity;
//               let b = labelBuckets.find(
//                 (x) => x.minZoom === minZ && x.maxZoom === maxZ
//               );
//               if (!b) {
//                 b = { minZoom: minZ, maxZoom: maxZ, labels: [] };
//                 labelBuckets.push(b);
//               }
//               b.labels.push(lbl);
//             });
//           }

//           // 1) rebuild whenever labels layer changes
//           labelsLayer?.events.addEventListener("change", rebuildBuckets);

//           // 2) on every zoom change, toggle each bucket
//           view.watch("zoom", (z: number) => {
//             labelBuckets.forEach((b) => {
//               const show = z >= b.minZoom && z <= b.maxZoom;
//               b.labels.forEach((lbl) => (lbl.visible = show));
//             });
//           });

//           // 3) initial bucket build
//           rebuildBuckets();

//           // ——— reposition on polygon edits ———
//           finalizedLayer.events.addEventListener("change", () => {
//             const polys = finalizedLayer.graphics.items;
//             const labels = labelsLayer.graphics.items;
//             labels.forEach((label: any) => {
//               const pid = label.attributes.parentId;
//               const poly = polys.find((p: any) => p.attributes.id === pid);
//               if (!poly) return;
//               const [cx, cy] = getPolygonCentroid(poly.geometry.rings[0]);
//               // use AMD Point so no class-mismatch
//               label.geometry = new Point({
//                 x: cx,
//                 y: cy,
//                 spatialReference: poly.geometry.spatialReference,
//               });
//             });
//           });

//           // ——— store refs for other components ———
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
