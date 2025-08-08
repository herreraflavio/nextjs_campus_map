// "use client";
// import { useRef, useState } from "react";
// import {
//   editingLayerRef,
//   finalizedLayerRef,
//   labelsLayerRef,
//   MapViewRef,
//   GraphicRef,
//   settingsRef,
// } from "./map/arcgisRefs";
// import { useSession } from "next-auth/react";

// import { useMapId } from "@/app/context/MapContext";
// import { saveMapToServer } from "@/app/helper/saveMap";

// export default function ToggleSketchTool() {
//   const sketchRef = useRef<any>(null);
//   const [active, setActive] = useState(false);
//   const labelMap = useRef<Map<string, __esri.Graphic>>(new Map());
//   const smoothedCentroids = useRef<Map<string, { x: number; y: number }>>(
//     new Map()
//   );
//   const lastCentroidTime = useRef<Map<string, number>>(new Map());
//   const { data: session, status } = useSession();
//   const userEmail = session?.user?.email;
//   const mapId = useMapId();

//   /** random [r,g,b,a] with 0.4–0.8 alpha */
//   const makeRandomColor = (): number[] => {
//     const r = Math.floor(Math.random() * 256);
//     const g = Math.floor(Math.random() * 256);
//     const b = Math.floor(Math.random() * 256);
//     const a = 0.4 + Math.random() * 0.4;
//     return [r, g, b, parseFloat(a.toFixed(2))];
//   };

//   /** compute centroid of one ring */
//   // const getPolygonCentroid = (ring: number[][]): [number, number] => {
//   //   let signedArea = 0;
//   //   let cx = 0;
//   //   let cy = 0;
//   //   // ensure closed ring
//   //   if (
//   //     ring.length > 0 &&
//   //     (ring[0][0] !== ring[ring.length - 1][0] ||
//   //       ring[0][1] !== ring[ring.length - 1][1])
//   //   ) {
//   //     ring.push([...ring[0]]);
//   //   }
//   //   for (let i = 0; i < ring.length - 1; i++) {
//   //     const [x0, y0] = ring[i];
//   //     const [x1, y1] = ring[i + 1];
//   //     const cross = x0 * y1 - x1 * y0;
//   //     signedArea += cross;
//   //     cx += (x0 + x1) * cross;
//   //     cy += (y0 + y1) * cross;
//   //   }
//   //   signedArea = signedArea / 2;
//   //   cx = cx / (6 * signedArea);
//   //   cy = cy / (6 * signedArea);
//   //   return [cx, cy];
//   // };
//   /**
//    * Compute the centroid of a single, non-self-intersecting ring (no holes).
//    * Returns [cx, cy], or throws if area is zero.
//    */
//   // function getPolygonCentroid(ring: number[][]): [number, number] {
//   //   const n = ring.length;
//   //   if (n < 3) {
//   //     throw new Error("Need at least 3 points to form a polygon");
//   //   }

//   //   let twiceSignedArea = 0;
//   //   let Cx6A = 0;
//   //   let Cy6A = 0;

//   //   for (let i = 0; i < n; i++) {
//   //     const [x0, y0] = ring[i];
//   //     const [x1, y1] = ring[(i + 1) % n];
//   //     const cross = x0 * y1 - x1 * y0;
//   //     twiceSignedArea += cross;
//   //     Cx6A += (x0 + x1) * cross;
//   //     Cy6A += (y0 + y1) * cross;
//   //   }

//   //   const area = twiceSignedArea / 2;
//   //   if (area === 0) {
//   //     throw new Error("Polygon area is zero (degenerate)");
//   //   }

//   //   const cx = Cx6A / (6 * area);
//   //   const cy = Cy6A / (6 * area);
//   //   return [cx, cy];
//   // }

//   function getPolygonCentroid(ring: number[][]): [number, number] {
//     let minX = Infinity;
//     let maxX = -Infinity;
//     let minY = Infinity;
//     let maxY = -Infinity;

//     for (const [x, y] of ring) {
//       if (x < minX) minX = x;
//       if (x > maxX) maxX = x;
//       if (y < minY) minY = y;
//       if (y > maxY) maxY = y;
//     }

//     const cx = (minX + maxX) / 2;
//     const cy = (minY + maxY) / 2;

//     return [cx, cy];
//   }

//   /** create a text graphic at centroid of ring */
//   const createLabelGraphic = (
//     ring: number[][],
//     labelText: string,
//     parentId: string,
//     view: __esri.MapView,
//     Graphic: any
//   ): __esri.Graphic => {
//     const [cx, cy] = getPolygonCentroid(ring);
//     return new Graphic({
//       geometry: {
//         type: "point",
//         x: cx,
//         y: cy,
//         spatialReference: view.spatialReference,
//       },
//       symbol: {
//         type: "text",
//         text: labelText,
//         color: "black",
//         haloColor: "white",
//         haloSize: "2px",
//         font: {
//           size: 12,
//           family: "sans-serif",
//           weight: "bold",
//         },
//       },
//       attributes: {
//         id: `label-${parentId}`,
//         parentId,
//         name: labelText,
//       },
//     });
//   };

//   const toggleSketch = () => {
//     const view = MapViewRef.current as __esri.MapView;
//     const editLayer = editingLayerRef.current;
//     const finalLayer = finalizedLayerRef.current;
//     const Graphic = GraphicRef.current;
//     if (!view || !editLayer || !finalLayer || !Graphic) return;

//     // ─────── START EDIT MODE ───────

//     if (!active) {
//       const labelsLayer = labelsLayerRef.current;
//       const editLayer = editingLayerRef.current;
//       const Graphic = GraphicRef.current;

//       // 1) Move polygons back into editLayer (your existing code)
//       finalizedLayerRef.current!.graphics.items.forEach((g: any) => {
//         editLayer.add(
//           new Graphic({
//             geometry: g.geometry,
//             symbol: g.symbol,
//             attributes: { ...g.attributes },
//             popupTemplate: g.popupTemplate,
//           })
//         );
//       });
//       finalizedLayerRef.current!.removeAll();

//       // 2) **NEW**: Move labels back into editLayer & rebuild labelMap
//       labelsLayer.graphics.items.forEach((lbl: __esri.Graphic) => {
//         const clone = new Graphic({
//           geometry: lbl.geometry,
//           symbol: lbl.symbol,
//           attributes: { ...lbl.attributes },
//         });
//         editLayer.add(clone);
//         // store it under the parent polygon's id
//         labelMap.current.set(clone.attributes.parentId, clone);
//       });
//       // clear out the permanent labelsLayer so you'll re-export them on Stop
//       labelsLayer.removeAll();

//       // load Sketch + Point AMD modules
//       (window as any).require(
//         ["esri/widgets/Sketch", "esri/geometry/Point"],
//         (Sketch: any, Point: any) => {
//           const sketch = new Sketch({
//             view,
//             layer: editLayer,
//             availableCreateTools: ["polygon"],
//             creationMode: "update",
//             snappingOptions: {
//               enabled: true,
//               selfEnabled: true,
//               featureEnabled: true,
//               distance: 10,
//             },
//           });

//           // when a new polygon is finished
//           sketch.on("create", (evt: any) => {
//             if (evt.state !== "complete") return;
//             const g = evt.graphic;
//             // determine color
//             const rgba: number[] =
//               typeof g.symbol?.color?.toRgba === "function"
//                 ? g.symbol.color.toRgba()
//                 : Array.isArray(g.attributes?.color)
//                 ? g.attributes.color
//                 : makeRandomColor();
//             // assign id, name, description
//             // const id = crypto.randomUUID();
//             // alert(finalizedLayerRef.current!.graphics.items.length);
//             console.log(editingLayerRef.current.graphics.items);
//             const id =
//               "polygon" +
//               (editingLayerRef.current.graphics.items.length + 1) / 2;
//             console.log(id);
//             const name = g.attributes?.name ?? "New Polygon";
//             g.attributes = {
//               ...g.attributes,
//               id,
//               name,
//               description:
//                 g.attributes?.description ??
//                 `Drawn at ${new Date().toLocaleTimeString()}`,
//               color: rgba,
//             };
//             g.symbol = {
//               type: "simple-fill",
//               color: rgba,
//               outline: g.symbol?.outline ?? { color: [0, 0, 0, 1], width: 1 },
//             };
//             g.popupTemplate = {
//               title: "{name}",
//               content: `<p><b>Description:</b> {description}</p><p><i>Coordinates:</i><br/>${JSON.stringify(
//                 g.geometry.rings
//               )}</p>`,
//             };
//             // add a label
//             const label = createLabelGraphic(
//               g.geometry.rings[0],
//               name,
//               id,
//               view,
//               Graphic
//             );
//             editLayer.add(label);
//             labelMap.current.set(id, label);
//           });

//           // sketch.on("update", (evt: any) => {
//           //   if (evt.state === "complete") return;

//           //   const now = performance.now();

//           //   evt.graphics.forEach((g: any) => {
//           //     const id = g.attributes?.id;
//           //     const label = labelMap.current.get(id);
//           //     if (!label || g.geometry?.type !== "polygon") return;

//           //     const [cx, cy] = getPolygonCentroid(g.geometry.rings[0]);
//           //     const prev = smoothedCentroids.current.get(id) ?? {
//           //       x: cx,
//           //       y: cy,
//           //     };
//           //     const prevTime = lastCentroidTime.current.get(id) ?? now;

//           //     // Compute velocity (pixels/ms)
//           //     const dt = now - prevTime;
//           //     const dx = cx - prev.x;
//           //     const dy = cy - prev.y;
//           //     const distance = Math.sqrt(dx * dx + dy * dy);
//           //     const velocity = dt > 0 ? distance / dt : 0; // pixels/ms

//           //     lastCentroidTime.current.set(id, now);

//           //     // Convert velocity to alpha (higher speed = less smoothing)
//           //     // Tune these as needed
//           //     const minAlpha = 0.1; // max smoothing
//           //     const maxAlpha = 0.6; // less smoothing
//           //     const velocityThreshold = 0.5; // pixels/ms

//           //     const alpha = Math.min(
//           //       maxAlpha,
//           //       Math.max(minAlpha, velocity / velocityThreshold)
//           //     );

//           //     const newX = alpha * cx + (1 - alpha) * prev.x;
//           //     const newY = alpha * cy + (1 - alpha) * prev.y;

//           //     smoothedCentroids.current.set(id, { x: newX, y: newY });

//           //     label.geometry = new Point({
//           //       x: newX,
//           //       y: newY,
//           //       spatialReference: view.spatialReference,
//           //     });
//           //   });
//           // });
//           sketch.on("update", (evt: any) => {
//             if (evt.state === "complete") {
//               // Handle completion - check for duplicated polygons that need new IDs
//               const processedIds = new Set();

//               evt.graphics.forEach((g: any) => {
//                 if (g.geometry?.type !== "polygon") return;

//                 const existingId = g.attributes?.id;

//                 // Skip if we already processed this ID or if it doesn't have an ID yet
//                 if (!existingId || processedIds.has(existingId)) return;

//                 // Find all polygons with the same ID
//                 const duplicates = editLayer.graphics.items.filter(
//                   (graphic: any) =>
//                     graphic.attributes?.id === existingId &&
//                     graphic.geometry?.type === "polygon" &&
//                     graphic !== g // exclude the current graphic
//                 );

//                 // If we found duplicates, only process them (keep the original)
//                 duplicates.forEach((duplicate: any) => {
//                   // Generate new unique ID for the duplicate
//                   const newId =
//                     "polygon" + Date.now() + Math.floor(Math.random() * 1000);
//                   const originalName =
//                     duplicate.attributes?.name ?? "New Polygon";
//                   const copyName = originalName.includes("(Copy)")
//                     ? originalName
//                     : `${originalName} (Copy)`;

//                   // Update the duplicate's attributes
//                   duplicate.attributes = {
//                     ...duplicate.attributes,
//                     id: newId,
//                     name: copyName,
//                     description:
//                       duplicate.attributes?.description ??
//                       `Duplicated at ${new Date().toLocaleTimeString()}`,
//                   };

//                   // Update popup template to fix the content error
//                   duplicate.popupTemplate = {
//                     title: "{name}",
//                     content: `<p><b>Description:</b> {description}</p><p><i>ID:</i> {id}</p>`,
//                   };

//                   // Remove old label if it exists
//                   const oldLabel = labelMap.current.get(existingId);
//                   if (oldLabel) {
//                     // Don't remove the original label, just create a new one for duplicate
//                   }

//                   // Create a new label for the duplicate
//                   const newLabel = createLabelGraphic(
//                     duplicate.geometry.rings[0],
//                     copyName,
//                     newId,
//                     view,
//                     Graphic
//                   );
//                   editLayer.add(newLabel);
//                   labelMap.current.set(newId, newLabel);

//                   // Initialize smoothed centroid for the new polygon
//                   const [cx, cy] = getPolygonCentroid(
//                     duplicate.geometry.rings[0]
//                   );
//                   smoothedCentroids.current.set(newId, { x: cx, y: cy });
//                   lastCentroidTime.current.set(newId, performance.now());
//                 });

//                 processedIds.add(existingId);
//               });
//               return;
//             }

//             // Handle ongoing updates (your existing smoothing logic)
//             const now = performance.now();

//             evt.graphics.forEach((g: any) => {
//               const id = g.attributes?.id;
//               const label = labelMap.current.get(id);
//               if (!label || g.geometry?.type !== "polygon") return;

//               const [cx, cy] = getPolygonCentroid(g.geometry.rings[0]);
//               const prev = smoothedCentroids.current.get(id) ?? {
//                 x: cx,
//                 y: cy,
//               };
//               const prevTime = lastCentroidTime.current.get(id) ?? now;

//               // Compute velocity (pixels/ms)
//               const dt = now - prevTime;
//               const dx = cx - prev.x;
//               const dy = cy - prev.y;
//               const distance = Math.sqrt(dx * dx + dy * dy);
//               const velocity = dt > 0 ? distance / dt : 0; // pixels/ms

//               lastCentroidTime.current.set(id, now);

//               // Convert velocity to alpha (higher speed = less smoothing)
//               const minAlpha = 0.1; // max smoothing
//               const maxAlpha = 0.6; // less smoothing
//               const velocityThreshold = 0.5; // pixels/ms

//               const alpha = Math.min(
//                 maxAlpha,
//                 Math.max(minAlpha, velocity / velocityThreshold)
//               );

//               const newX = alpha * cx + (1 - alpha) * prev.x;
//               const newY = alpha * cy + (1 - alpha) * prev.y;

//               smoothedCentroids.current.set(id, { x: newX, y: newY });

//               // Ensure we have valid coordinates before creating Point
//               if (isFinite(newX) && isFinite(newY)) {
//                 label.geometry = new Point({
//                   x: newX,
//                   y: newY,
//                   spatialReference: view.spatialReference,
//                 });
//               }
//             });
//           });

//           view.ui.add(sketch, "top-right");
//           sketchRef.current = sketch;
//           setActive(true);
//         }
//       );

//       return;
//     }

//     // ─────── STOP EDIT MODE ───────
//     const labelsLayer = labelsLayerRef.current as __esri.GraphicsLayer;

//     editLayer.graphics.items.forEach((g: any, idx: any) => {
//       // text symbols → permanent labels layer
//       if (g.symbol?.type === "text") {
//         labelsLayer.add(g.clone());
//         return;
//       }

//       // otherwise polygon → final layer
//       const order = g.attributes.order ?? idx;
//       const fillColor: number[] =
//         typeof g.symbol?.color?.toRgba === "function"
//           ? g.symbol.color.toRgba()
//           : Array.isArray(g.attributes.color)
//           ? g.attributes.color
//           : makeRandomColor();
//       const name = g.attributes.name ?? `Polygon ${order + 1}`;

//       finalLayer.add(
//         new Graphic({
//           geometry: g.geometry,
//           symbol: {
//             type: "simple-fill",
//             color: fillColor,
//             outline: g.symbol?.outline ?? { color: [0, 0, 0, 1], width: 1 },
//           },
//           attributes: {
//             ...g.attributes,
//             order,
//             name,
//             color: fillColor,
//           },
//           popupTemplate: g.popupTemplate,
//         })
//       );
//     });

//     // clear edit layer and map state
//     editLayer.removeAll();
//     labelMap.current.clear();
//     finalizedLayerRef.events?.dispatchEvent(new Event("change"));
//     if (userEmail) {
//       const s = settingsRef.current;

//       saveMapToServer(mapId, userEmail, {
//         zoom: s.zoom,
//         center: [s.center.x, s.center.y] as [number, number],
//         constraints: s.constraints,
//       });
//       // saveMapToServer(mapId, userEmail, settingsRef.current);
//     }

//     if (sketchRef.current) {
//       sketchRef.current.cancel();
//       sketchRef.current.destroy();
//       view.ui.remove(sketchRef.current);
//       sketchRef.current = null;
//     }
//     setActive(false);
//   };

//   return (
//     <button
//       onClick={toggleSketch}
//       style={{
//         top: 10,
//         left: 10,
//         zIndex: 999,
//         padding: "8px 12px",
//         backgroundColor: active ? "#e63946" : "#2a9d8f",
//         color: "#fff",
//         border: "none",
//         borderRadius: 4,
//         cursor: "pointer",
//       }}
//     >
//       {active ? "Stop Drawing" : "Start Drawing"}
//     </button>
//   );
// }

// "use client";
// import { useRef, useState } from "react";
// import {
//   editingLayerRef,
//   finalizedLayerRef,
//   labelsLayerRef,
//   MapViewRef,
//   GraphicRef,
//   settingsRef,
// } from "./map/arcgisRefs";
// import { useSession } from "next-auth/react";
// import { useMapId } from "@/app/context/MapContext";
// import { saveMapToServer } from "@/app/helper/saveMap";

// export default function ToggleSketchTool() {
//   const sketchRef = useRef<any>(null);
//   const [active, setActive] = useState(false);

//   // parent polygon id -> label graphic (lives in edit layer during edit mode)
//   const labelMap = useRef<Map<string, __esri.Graphic>>(new Map());

//   // keep AMD modules handy outside the require() callback
//   const pointCtorRef = useRef<any>(null);
//   const geometryEngineRef = useRef<any>(null);

//   const { data: session } = useSession();
//   const userEmail = session?.user?.email;
//   const mapId = useMapId();

//   /** random [r,g,b,a] with 0.4–0.8 alpha */
//   const makeRandomColor = (): number[] => {
//     const r = Math.floor(Math.random() * 256);
//     const g = Math.floor(Math.random() * 256);
//     const b = Math.floor(Math.random() * 256);
//     const a = 0.4 + Math.random() * 0.4;
//     return [r, g, b, parseFloat(a.toFixed(2))];
//   };

//   /** last-resort bbox center */
//   function bboxCenter(
//     ring: number[][],
//     sr: __esri.SpatialReference,
//     Point: any
//   ) {
//     let minX = Infinity,
//       maxX = -Infinity;
//     let minY = Infinity,
//       maxY = -Infinity;
//     for (const [x, y] of ring) {
//       if (x < minX) minX = x;
//       if (x > maxX) maxX = x;
//       if (y < minY) minY = y;
//       if (y > maxY) maxY = y;
//     }
//     return new Point({
//       x: (minX + maxX) / 2,
//       y: (minY + maxY) / 2,
//       spatialReference: sr,
//     });
//   }

//   /** best interior label point: labelPoints -> centroid -> extent center -> bbox */
//   function labelPointForPolygon(
//     polygon: __esri.Polygon,
//     view: __esri.MapView,
//     Point: any,
//     geometryEngine: any
//   ): __esri.Point {
//     try {
//       if (geometryEngine) {
//         const pts = geometryEngine.labelPoints(polygon);
//         if (Array.isArray(pts) && pts.length) {
//           return new Point({
//             x: pts[0].x,
//             y: pts[0].y,
//             spatialReference: view.spatialReference,
//           });
//         }
//         // fallback to centroid from geometryEngine if available
//         if (geometryEngine.centroid) {
//           const c = geometryEngine.centroid(polygon);
//           if (c)
//             return new Point({
//               x: c.x,
//               y: c.y,
//               spatialReference: view.spatialReference,
//             });
//         }
//       }
//     } catch {}
//     // polygon.centroid (API provides), else extent.center, else bbox center
//     const c1 = (polygon as any).centroid;
//     if (c1)
//       return new Point({
//         x: c1.x,
//         y: c1.y,
//         spatialReference: view.spatialReference,
//       });
//     if (polygon.extent?.center)
//       return new Point({
//         x: polygon.extent.center.x,
//         y: polygon.extent.center.y,
//         spatialReference: view.spatialReference,
//       });
//     return bboxCenter(polygon.rings[0], view.spatialReference, Point);
//   }

//   /** create a text graphic at label point */
//   const createLabelGraphic = (
//     polygon: __esri.Polygon,
//     labelText: string,
//     parentId: string,
//     view: __esri.MapView,
//     Graphic: any,
//     Point: any,
//     geometryEngine: any
//   ): __esri.Graphic => {
//     const pt = labelPointForPolygon(polygon, view, Point, geometryEngine);
//     return new Graphic({
//       geometry: pt,
//       symbol: {
//         type: "text",
//         text: labelText,
//         color: "black",
//         haloColor: "white",
//         haloSize: "2px",
//         font: { size: 12, family: "sans-serif", weight: "bold" },
//       },
//       attributes: {
//         id: `label-${parentId}`,
//         parentId,
//         name: labelText,
//       },
//     });
//   };

//   /** Ensure duplicate polygons get unique IDs + their own labels */
//   function ensureUniqueIdsInEditLayer(
//     editLayer: __esri.GraphicsLayer,
//     view: __esri.MapView,
//     Graphic: any
//   ) {
//     const Point = pointCtorRef.current;
//     const geometryEngine = geometryEngineRef.current;

//     // group polygons by id
//     const polys = editLayer.graphics
//       .toArray()
//       .filter((g: any) => g.geometry?.type === "polygon");
//     const byId = new Map<string, __esri.Graphic[]>();
//     for (const g of polys) {
//       const pid = g.attributes?.id;
//       if (!pid) continue;
//       const arr = byId.get(pid) || [];
//       arr.push(g);
//       byId.set(pid, arr);
//     }

//     // for any id with >1 polygons, assign fresh ids to the extras and create fresh labels
//     byId.forEach((arr, existingId) => {
//       if (arr.length <= 1) return;
//       // keep the first as-is
//       for (let i = 1; i < arr.length; i++) {
//         const duplicate = arr[i];
//         const newId = "polygon" + Date.now() + Math.floor(Math.random() * 1000);
//         const baseName = duplicate.attributes?.name ?? "Polygon";
//         const copyName = baseName.includes("(Copy)")
//           ? baseName
//           : `${baseName} (Copy)`;

//         duplicate.attributes = {
//           ...duplicate.attributes,
//           id: newId,
//           name: copyName,
//           description:
//             duplicate.attributes?.description ??
//             `Duplicated at ${new Date().toLocaleTimeString()}`,
//         };

//         // also update popup template title/content if needed
//         duplicate.popupTemplate = {
//           title: "{name}",
//           content: `<p><b>Description:</b> {description}</p><p><i>ID:</i> {id}</p>`,
//         };

//         // create a new label for the duplicate
//         const newLabel = createLabelGraphic(
//           duplicate.geometry as __esri.Polygon,
//           copyName,
//           newId,
//           view,
//           Graphic,
//           Point,
//           geometryEngine
//         );
//         editLayer.add(newLabel);
//         labelMap.current.set(newId, newLabel);
//       }
//     });
//   }

//   const toggleSketch = () => {
//     const view = MapViewRef.current as __esri.MapView;
//     const editLayer = editingLayerRef.current!;
//     const finalLayer = finalizedLayerRef.current!;
//     const Graphic = GraphicRef.current!;
//     if (!view || !editLayer || !finalLayer || !Graphic) return;

//     // ─────── START EDIT MODE ───────
//     if (!active) {
//       const labelsLayer = labelsLayerRef.current!;
//       labelMap.current.clear();

//       // move finalized polygons back to edit
//       finalLayer.graphics.toArray().forEach((g: any) => {
//         editLayer.add(
//           new Graphic({
//             geometry: g.geometry,
//             symbol: g.symbol,
//             attributes: { ...g.attributes },
//             popupTemplate: g.popupTemplate,
//           })
//         );
//       });
//       finalLayer.removeAll();

//       // move permanent labels back to edit & rebuild labelMap
//       labelsLayer.graphics.toArray().forEach((lbl: __esri.Graphic) => {
//         const clone = new Graphic({
//           geometry: lbl.geometry,
//           symbol: lbl.symbol,
//           attributes: { ...lbl.attributes },
//         });
//         editLayer.add(clone);
//         if (clone.attributes?.parentId) {
//           labelMap.current.set(clone.attributes.parentId, clone);
//         }
//       });
//       labelsLayer.removeAll();

//       // load Sketch + Point + geometryEngine
//       (window as any).require(
//         [
//           "esri/widgets/Sketch",
//           "esri/geometry/Point",
//           "esri/geometry/geometryEngine",
//         ],
//         (Sketch: any, Point: any, geometryEngine: any) => {
//           pointCtorRef.current = Point;
//           geometryEngineRef.current = geometryEngine;

//           const sketch = new Sketch({
//             view,
//             layer: editLayer,
//             availableCreateTools: ["polygon"],
//             creationMode: "update",
//             snappingOptions: {
//               enabled: true,
//               selfEnabled: true,
//               featureEnabled: true,
//               distance: 10,
//             },
//           });

//           // on new polygon complete: assign id/symbol/template and add label
//           sketch.on("create", (evt: any) => {
//             if (evt.state !== "complete") return;
//             const g = evt.graphic;

//             const rgba: number[] =
//               typeof g.symbol?.color?.toRgba === "function"
//                 ? g.symbol.color.toRgba()
//                 : Array.isArray(g.attributes?.color)
//                 ? g.attributes.color
//                 : makeRandomColor();

//             const id =
//               "polygon" + Date.now() + Math.floor(Math.random() * 1000);
//             const name = g.attributes?.name ?? "New Polygon";

//             g.attributes = {
//               ...g.attributes,
//               id,
//               name,
//               description:
//                 g.attributes?.description ??
//                 `Drawn at ${new Date().toLocaleTimeString()}`,
//               color: rgba,
//             };
//             g.symbol = {
//               type: "simple-fill",
//               color: rgba,
//               outline: g.symbol?.outline ?? { color: [0, 0, 0, 1], width: 1 },
//             };
//             g.popupTemplate = {
//               title: "{name}",
//               content: `<p><b>Description:</b> {description}</p><p><i>ID:</i> {id}</p>`,
//             };

//             const label = createLabelGraphic(
//               g.geometry as __esri.Polygon,
//               name,
//               id,
//               view,
//               Graphic,
//               Point,
//               geometryEngine
//             );
//             editLayer.add(label);
//             labelMap.current.set(id, label);
//           });

//           // while updating polygons, keep labels pinned to best label point (no smoothing)
//           sketch.on("update", (evt: any) => {
//             if (evt.state === "complete") {
//               // handle duplicates robustly across the whole edit layer
//               ensureUniqueIdsInEditLayer(editLayer, view, Graphic);
//               return;
//             }

//             if (evt.state === "active") {
//               evt.graphics.forEach((g: any) => {
//                 if (g.geometry?.type !== "polygon") return;
//                 const id = g.attributes?.id;
//                 const lbl = labelMap.current.get(id);
//                 if (!lbl) return;

//                 const pt = labelPointForPolygon(
//                   g.geometry as __esri.Polygon,
//                   view,
//                   Point,
//                   geometryEngine
//                 );
//                 lbl.geometry = pt;
//               });
//             }
//           });

//           view.ui.add(sketch, "top-right");
//           sketchRef.current = sketch;
//           setActive(true);
//         }
//       );

//       return;
//     }

//     // ─────── STOP EDIT MODE ───────
//     // one more duplicate sweep before finalizing, just in case
//     ensureUniqueIdsInEditLayer(
//       editLayer,
//       MapViewRef.current as __esri.MapView,
//       Graphic
//     );

//     const labelsLayer = labelsLayerRef.current!;

//     // finalize: polygons -> final layer, labels -> labels layer
//     editLayer.graphics.toArray().forEach((g: any, idx: number) => {
//       // text symbols → permanent labels layer
//       if (g.symbol?.type === "text") {
//         labelsLayer.add(g.clone());
//         return;
//       }

//       // polygons → final layer
//       if (g.geometry?.type === "polygon") {
//         const order = g.attributes.order ?? idx;
//         const fillColor: number[] =
//           typeof g.symbol?.color?.toRgba === "function"
//             ? g.symbol.color.toRgba()
//             : Array.isArray(g.attributes.color)
//             ? g.attributes.color
//             : makeRandomColor();
//         const name = g.attributes.name ?? `Polygon ${order + 1}`;

//         finalizedLayerRef.current!.add(
//           new Graphic({
//             geometry: g.geometry,
//             symbol: {
//               type: "simple-fill",
//               color: fillColor,
//               outline: g.symbol?.outline ?? { color: [0, 0, 0, 1], width: 1 },
//             },
//             attributes: {
//               ...g.attributes,
//               order,
//               name,
//               color: fillColor,
//             },
//             popupTemplate: g.popupTemplate,
//           })
//         );
//       }
//     });

//     // clean up
//     editingLayerRef.current!.removeAll();
//     labelMap.current.clear();
//     finalizedLayerRef.current!.events?.dispatchEvent(new Event("change"));

//     if (userEmail) {
//       const s = settingsRef.current!;
//       saveMapToServer(mapId, userEmail, {
//         zoom: s.zoom,
//         center: [s.center.x, s.center.y] as [number, number],
//         constraints: s.constraints,
//       });
//     }

//     if (sketchRef.current) {
//       sketchRef.current.cancel();
//       sketchRef.current.destroy();
//       (MapViewRef.current as __esri.MapView).ui.remove(sketchRef.current);
//       sketchRef.current = null;
//     }

//     setActive(false);
//   };

//   return (
//     <button
//       onClick={toggleSketch}
//       style={{
//         position: "relative",

//         zIndex: 999,
//         padding: "8px 12px",
//         backgroundColor: active ? "#e63946" : "#2a9d8f",
//         color: "#fff",
//         border: "none",
//         borderRadius: 4,
//         cursor: "pointer",
//       }}
//     >
//       {active ? "Stop Drawing" : "Start Drawing"}
//     </button>
//   );
// }
// "use client";
// import { useRef, useState } from "react";
// import {
//   editingLayerRef,
//   finalizedLayerRef,
//   labelsLayerRef,
//   MapViewRef,
//   GraphicRef,
//   settingsRef,
// } from "./map/arcgisRefs";
// import { useSession } from "next-auth/react";
// import { useMapId } from "@/app/context/MapContext";
// import { saveMapToServer } from "@/app/helper/saveMap";

// export default function ToggleSketchTool() {
//   const sketchRef = useRef<any>(null);
//   const [active, setActive] = useState(false);

//   // parent polygon id -> label graphic (lives in edit layer while editing)
//   const labelMap = useRef<Map<string, __esri.Graphic>>(new Map());

//   // keep AMD modules handy
//   const pointCtorRef = useRef<any>(null);
//   const geometryEngineRef = useRef<any>(null);

//   const { data: session } = useSession();
//   const userEmail = session?.user?.email;
//   const mapId = useMapId();

//   /** random [r,g,b,a] with 0.4–0.8 alpha */
//   const makeRandomColor = (): number[] => {
//     const r = Math.floor(Math.random() * 256);
//     const g = Math.floor(Math.random() * 256);
//     const b = Math.floor(Math.random() * 256);
//     const a = 0.4 + Math.random() * 0.4;
//     return [r, g, b, parseFloat(a.toFixed(2))];
//   };

//   /** last-resort bbox center */
//   function bboxCenter(
//     ring: number[][],
//     sr: __esri.SpatialReference,
//     Point: any
//   ) {
//     let minX = Infinity,
//       maxX = -Infinity,
//       minY = Infinity,
//       maxY = -Infinity;
//     for (const [x, y] of ring) {
//       if (x < minX) minX = x;
//       if (x > maxX) maxX = x;
//       if (y < minY) minY = y;
//       if (y > maxY) maxY = y;
//     }
//     return new Point({
//       x: (minX + maxX) / 2,
//       y: (minY + maxY) / 2,
//       spatialReference: sr,
//     });
//   }

//   /** best interior label point */
//   function labelPointForPolygon(
//     polygon: __esri.Polygon,
//     view: __esri.MapView,
//     Point: any,
//     geometryEngine: any
//   ): __esri.Point {
//     try {
//       if (geometryEngine) {
//         const p = geometryEngine.labelPoints(polygon);
//         if (p)
//           return new Point({
//             x: p.x,
//             y: p.y,
//             spatialReference: view.spatialReference,
//           });
//         const c = geometryEngine.centroid?.(polygon);
//         if (c)
//           return new Point({
//             x: c.x,
//             y: c.y,
//             spatialReference: view.spatialReference,
//           });
//       }
//     } catch {}
//     const c1 = (polygon as any).centroid;
//     if (c1)
//       return new Point({
//         x: c1.x,
//         y: c1.y,
//         spatialReference: view.spatialReference,
//       });
//     if (polygon.extent?.center)
//       return new Point({
//         x: polygon.extent.center.x,
//         y: polygon.extent.center.y,
//         spatialReference: view.spatialReference,
//       });
//     return bboxCenter(
//       polygon.rings[0],
//       view.spatialReference,
//       pointCtorRef.current
//     );
//   }

//   /** create a text graphic at label point */
//   const createLabelGraphic = (
//     polygon: __esri.Polygon,
//     labelText: string,
//     parentId: string,
//     view: __esri.MapView,
//     Graphic: any,
//     Point: any,
//     geometryEngine: any
//   ): __esri.Graphic => {
//     const pt = labelPointForPolygon(polygon, view, Point, geometryEngine);
//     return new Graphic({
//       geometry: pt,
//       symbol: {
//         type: "text",
//         text: labelText,
//         color: "black",
//         haloColor: "white",
//         haloSize: "2px",
//         font: { size: 12, family: "sans-serif", weight: "bold" },
//       },
//       attributes: { id: `label-${parentId}`, parentId, name: labelText },
//     });
//   };

//   /** Ensure duplicate polygons get unique IDs + their own labels */
//   function ensureUniqueIdsInEditLayer(
//     editLayer: __esri.GraphicsLayer,
//     view: __esri.MapView,
//     Graphic: any
//   ) {
//     const Point = pointCtorRef.current;
//     const geometryEngine = geometryEngineRef.current;

//     const polys = editLayer.graphics
//       .toArray()
//       .filter((g: any) => g.geometry?.type === "polygon");
//     const byId = new Map<string, __esri.Graphic[]>();
//     for (const g of polys) {
//       const pid = g.attributes?.id;
//       if (!pid) continue;
//       const arr = byId.get(pid) || [];
//       arr.push(g);
//       byId.set(pid, arr);
//     }

//     byId.forEach((arr) => {
//       if (arr.length <= 1) return;
//       for (let i = 1; i < arr.length; i++) {
//         const duplicate = arr[i];
//         const newId = "polygon" + Date.now() + Math.floor(Math.random() * 1000);
//         const baseName = duplicate.attributes?.name ?? "Polygon";
//         const copyName = baseName.includes("(Copy)")
//           ? baseName
//           : `${baseName} (Copy)`;

//         duplicate.attributes = {
//           ...duplicate.attributes,
//           id: newId,
//           name: copyName,
//           description:
//             duplicate.attributes?.description ??
//             `Duplicated at ${new Date().toLocaleTimeString()}`,
//         };
//         duplicate.popupTemplate = {
//           title: "{name}",
//           content: `<p><b>Description:</b> {description}</p><p><i>ID:</i> {id}</p>`,
//         };

//         const newLabel = createLabelGraphic(
//           duplicate.geometry as __esri.Polygon,
//           copyName,
//           newId,
//           view,
//           Graphic,
//           Point,
//           geometryEngine
//         );
//         editLayer.add(newLabel);
//         labelMap.current.set(newId, newLabel);
//       }
//     });
//   }

//   /** Notify sidebar that finalized polygons changed */
//   function pushSidebarUpdate() {
//     const finalLayer = finalizedLayerRef.current!;
//     const items = finalLayer.graphics.toArray().map((g: any, idx: number) => ({
//       id: g.attributes?.id,
//       name: g.attributes?.name ?? `Polygon ${idx + 1}`,
//       order: g.attributes?.order ?? idx,
//       color: g.attributes?.color,
//     }));

//     // Custom ref event target (your existing pattern)
//     const target =
//       (finalLayer as any).events ??
//       ((finalLayer as any).events = new EventTarget());
//     target.dispatchEvent(new CustomEvent("change", { detail: { items } }));

//     // Also broadcast a DOM event (easy to listen from your sidebar)
//     window.dispatchEvent(
//       new CustomEvent("polygons-finalized", { detail: { items } })
//     );
//   }

//   const toggleSketch = () => {
//     const view = MapViewRef.current as __esri.MapView;
//     const editLayer = editingLayerRef.current!;
//     const finalLayer = finalizedLayerRef.current!;
//     const Graphic = GraphicRef.current!;
//     if (!view || !editLayer || !finalLayer || !Graphic) return;

//     // ─────── START EDIT MODE ───────
//     if (!active) {
//       const labelsLayer = labelsLayerRef.current!;
//       labelMap.current.clear();

//       // move finalized polygons back to edit
//       finalLayer.graphics.toArray().forEach((g: any) => {
//         editLayer.add(
//           new Graphic({
//             geometry: g.geometry,
//             symbol: g.symbol,
//             attributes: { ...g.attributes },
//             popupTemplate: g.popupTemplate,
//           })
//         );
//       });
//       finalLayer.removeAll();

//       // move permanent labels back to edit & rebuild labelMap
//       labelsLayer.graphics.toArray().forEach((lbl: __esri.Graphic) => {
//         const clone = new Graphic({
//           geometry: lbl.geometry,
//           symbol: lbl.symbol,
//           attributes: { ...lbl.attributes },
//         });
//         editLayer.add(clone);
//         if (clone.attributes?.parentId) {
//           labelMap.current.set(clone.attributes.parentId, clone);
//         }
//       });
//       labelsLayer.removeAll();

//       // load Sketch + Point + geometryEngine
//       (window as any).require(
//         [
//           "esri/widgets/Sketch",
//           "esri/geometry/Point",
//           "esri/geometry/geometryEngine",
//         ],
//         (Sketch: any, Point: any, geometryEngine: any) => {
//           pointCtorRef.current = Point;
//           geometryEngineRef.current = geometryEngine;

//           const sketch = new Sketch({
//             view,
//             layer: editLayer,
//             availableCreateTools: ["polygon"],
//             creationMode: "update",
//             snappingOptions: {
//               enabled: true,
//               selfEnabled: true,
//               featureEnabled: true,
//               distance: 10,
//             },
//           });

//           // on new polygon complete
//           sketch.on("create", (evt: any) => {
//             if (evt.state !== "complete") return;
//             const g = evt.graphic;

//             const rgba: number[] =
//               typeof g.symbol?.color?.toRgba === "function"
//                 ? g.symbol.color.toRgba()
//                 : Array.isArray(g.attributes?.color)
//                 ? g.attributes.color
//                 : makeRandomColor();

//             const id =
//               "polygon" + Date.now() + Math.floor(Math.random() * 1000);
//             const name = g.attributes?.name ?? "New Polygon";

//             g.attributes = {
//               ...g.attributes,
//               id,
//               name,
//               description:
//                 g.attributes?.description ??
//                 `Drawn at ${new Date().toLocaleTimeString()}`,
//               color: rgba,
//             };
//             g.symbol = {
//               type: "simple-fill",
//               color: rgba,
//               outline: g.symbol?.outline ?? { color: [0, 0, 0, 1], width: 1 },
//             };
//             g.popupTemplate = {
//               title: "{name}",
//               content: `<p><b>Description:</b> {description}</p><p><i>ID:</i> {id}</p>`,
//             };

//             const label = createLabelGraphic(
//               g.geometry as __esri.Polygon,
//               name,
//               id,
//               view,
//               Graphic,
//               Point,
//               geometryEngine
//             );
//             editLayer.add(label);
//             labelMap.current.set(id, label);
//           });

//           // keep labels pinned while editing
//           sketch.on("update", (evt: any) => {
//             if (evt.state === "complete") {
//               ensureUniqueIdsInEditLayer(editLayer, view, Graphic);
//               return;
//             }
//             if (evt.state === "active") {
//               evt.graphics.forEach((g: any) => {
//                 if (g.geometry?.type !== "polygon") return;
//                 const id = g.attributes?.id;
//                 const lbl = labelMap.current.get(id);
//                 if (!lbl) return;
//                 lbl.geometry = labelPointForPolygon(
//                   g.geometry as __esri.Polygon,
//                   view,
//                   pointCtorRef.current,
//                   geometryEngineRef.current
//                 );
//               });
//             }
//           });

//           view.ui.add(sketch, "top-right");
//           sketchRef.current = sketch;
//           setActive(true);
//         }
//       );
//       return;
//     }

//     // ─────── STOP EDIT MODE ───────
//     ensureUniqueIdsInEditLayer(
//       editLayer,
//       MapViewRef.current as __esri.MapView,
//       Graphic
//     );
//     const labelsLayer = labelsLayerRef.current!;

//     // finalize: polygons -> final layer, labels -> labels layer
//     editLayer.graphics.toArray().forEach((g: any, idx: number) => {
//       if (g.symbol?.type === "text") {
//         labelsLayer.add(g.clone());
//         return;
//       }
//       if (g.geometry?.type === "polygon") {
//         const order = g.attributes.order ?? idx;
//         const fillColor: number[] =
//           typeof g.symbol?.color?.toRgba === "function"
//             ? g.symbol.color.toRgba()
//             : Array.isArray(g.attributes.color)
//             ? g.attributes.color
//             : makeRandomColor();
//         const name = g.attributes.name ?? `Polygon ${order + 1}`;

//         finalizedLayerRef.current!.add(
//           new Graphic({
//             geometry: g.geometry,
//             symbol: {
//               type: "simple-fill",
//               color: fillColor,
//               outline: g.symbol?.outline ?? { color: [0, 0, 0, 1], width: 1 },
//             },
//             attributes: { ...g.attributes, order, name, color: fillColor },
//             popupTemplate: g.popupTemplate,
//           })
//         );
//       }
//     });

//     // clean up edit state
//     editingLayerRef.current!.removeAll();
//     labelMap.current.clear();

//     // 🔔 trigger sidebar refresh (both mechanisms)
//     pushSidebarUpdate();

//     if (userEmail) {
//       const s = settingsRef.current!;
//       saveMapToServer(mapId, userEmail, {
//         zoom: s.zoom,
//         center: [s.center.x, s.center.y] as [number, number],
//         constraints: s.constraints,
//       });
//     }

//     if (sketchRef.current) {
//       sketchRef.current.cancel();
//       sketchRef.current.destroy();
//       (MapViewRef.current as __esri.MapView).ui.remove(sketchRef.current);
//       sketchRef.current = null;
//     }

//     setActive(false);
//   };

//   return (
//     <button
//       onClick={toggleSketch}
//       style={{
//         position: "relative",
//         zIndex: 999,
//         padding: "8px 12px",
//         backgroundColor: active ? "#e63946" : "#2a9d8f",
//         color: "#fff",
//         border: "none",
//         borderRadius: 4,
//         cursor: "pointer",
//       }}
//     >
//       {active ? "Stop Drawing" : "Start Drawing"}
//     </button>
//   );
// }
"use client";
import { useRef, useState } from "react";
import {
  editingLayerRef,
  finalizedLayerRef,
  labelsLayerRef,
  MapViewRef,
  GraphicRef,
  settingsRef,
} from "./map/arcgisRefs";
import { useSession } from "next-auth/react";
import { useMapId } from "@/app/context/MapContext";
import { saveMapToServer } from "@/app/helper/saveMap";

export default function ToggleSketchTool() {
  const sketchRef = useRef<any>(null);
  const [active, setActive] = useState(false);

  // parent polygon id -> label graphic (lives in edit layer during edit mode)
  const labelMap = useRef<Map<string, __esri.Graphic>>(new Map());

  // AMD modules
  const pointCtorRef = useRef<any>(null);
  const geometryEngineRef = useRef<any>(null);

  const { data: session } = useSession();
  const userEmail = session?.user?.email;
  const mapId = useMapId();

  /** ensure we can emit "change" like before */
  function emitFinalizedChange() {
    const finalLayer = finalizedLayerRef.current as any;
    if (!finalLayer) return;
    if (!finalLayer.events) finalLayer.events = new EventTarget();
    finalLayer.events.dispatchEvent(new Event("change"));
  }

  /** random [r,g,b,a] with 0.4–0.8 alpha */
  const makeRandomColor = (): number[] => {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    const a = 0.4 + Math.random() * 0.4;
    return [r, g, b, parseFloat(a.toFixed(2))];
  };

  /** last-resort bbox center */
  function bboxCenter(
    ring: number[][],
    sr: __esri.SpatialReference,
    Point: any
  ) {
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
      spatialReference: sr,
    });
  }

  /** best interior label point */
  function labelPointForPolygon(
    polygon: __esri.Polygon,
    view: __esri.MapView,
    Point: any,
    geometryEngine: any
  ): __esri.Point {
    try {
      if (geometryEngine) {
        const p = geometryEngine.labelPoints(polygon);
        if (p)
          return new Point({
            x: p.x,
            y: p.y,
            spatialReference: view.spatialReference,
          });
        const c = geometryEngine.centroid?.(polygon);
        if (c)
          return new Point({
            x: c.x,
            y: c.y,
            spatialReference: view.spatialReference,
          });
      }
    } catch {}
    const c1 = (polygon as any).centroid;
    if (c1)
      return new Point({
        x: c1.x,
        y: c1.y,
        spatialReference: view.spatialReference,
      });
    if (polygon.extent?.center)
      return new Point({
        x: polygon.extent.center.x,
        y: polygon.extent.center.y,
        spatialReference: view.spatialReference,
      });
    return bboxCenter(
      polygon.rings[0],
      view.spatialReference,
      pointCtorRef.current
    );
  }

  /** create a text graphic at label point */
  const createLabelGraphic = (
    polygon: __esri.Polygon,
    labelText: string,
    parentId: string,
    view: __esri.MapView,
    Graphic: any,
    Point: any,
    geometryEngine: any
  ): __esri.Graphic => {
    const pt = labelPointForPolygon(polygon, view, Point, geometryEngine);
    return new Graphic({
      geometry: pt,
      symbol: {
        type: "text",
        text: labelText,
        color: "black",
        haloColor: "white",
        haloSize: "2px",
        font: { size: 12, family: "sans-serif", weight: "bold" },
      },
      attributes: { id: `label-${parentId}`, parentId, name: labelText },
    });
  };

  /** Ensure duplicate polygons get unique IDs + their own labels */
  function ensureUniqueIdsInEditLayer(
    editLayer: __esri.GraphicsLayer,
    view: __esri.MapView,
    Graphic: any
  ) {
    const Point = pointCtorRef.current;
    const geometryEngine = geometryEngineRef.current;

    const polys = editLayer.graphics
      .toArray()
      .filter((g: any) => g.geometry?.type === "polygon");
    const byId = new Map<string, __esri.Graphic[]>();
    for (const g of polys) {
      const pid = g.attributes?.id;
      if (!pid) continue;
      const arr = byId.get(pid) || [];
      arr.push(g);
      byId.set(pid, arr);
    }

    byId.forEach((arr) => {
      if (arr.length <= 1) return;
      for (let i = 1; i < arr.length; i++) {
        const duplicate = arr[i];
        const newId = "polygon" + Date.now() + Math.floor(Math.random() * 1000);
        const baseName = duplicate.attributes?.name ?? "Polygon";
        const copyName = baseName.includes("(Copy)")
          ? baseName
          : `${baseName} (Copy)`;

        duplicate.attributes = {
          ...duplicate.attributes,
          id: newId,
          name: copyName,
          description:
            duplicate.attributes?.description ??
            `Duplicated at ${new Date().toLocaleTimeString()}`,
        };
        duplicate.popupTemplate = {
          title: "{name}",
          content: `<p><b>Description:</b> {description}</p><p><i>ID:</i> {id}</p>`,
        };

        const newLabel = createLabelGraphic(
          duplicate.geometry as __esri.Polygon,
          copyName,
          newId,
          view,
          Graphic,
          Point,
          geometryEngine
        );
        editLayer.add(newLabel);
        labelMap.current.set(newId, newLabel);
      }
    });
  }

  const toggleSketch = () => {
    const view = MapViewRef.current as __esri.MapView;
    const editLayer = editingLayerRef.current!;
    const finalLayer = finalizedLayerRef.current!;
    const Graphic = GraphicRef.current!;
    if (!view || !editLayer || !finalLayer || !Graphic) return;

    // ─────── START EDIT MODE ───────
    if (!active) {
      const labelsLayer = labelsLayerRef.current!;
      labelMap.current.clear();

      // move finalized polygons back to edit
      finalLayer.graphics.toArray().forEach((g: any) => {
        editLayer.add(
          new Graphic({
            geometry: g.geometry,
            symbol: g.symbol,
            attributes: { ...g.attributes },
            popupTemplate: g.popupTemplate,
          })
        );
      });
      finalLayer.removeAll();

      // move permanent labels back to edit & rebuild labelMap
      labelsLayer.graphics.toArray().forEach((lbl: __esri.Graphic) => {
        const clone = new Graphic({
          geometry: lbl.geometry,
          symbol: lbl.symbol,
          attributes: { ...lbl.attributes },
        });
        editLayer.add(clone);
        if (clone.attributes?.parentId) {
          labelMap.current.set(clone.attributes.parentId, clone);
        }
      });
      labelsLayer.removeAll();

      // load Sketch + Point + geometryEngine
      (window as any).require(
        [
          "esri/widgets/Sketch",
          "esri/geometry/Point",
          "esri/geometry/geometryEngine",
        ],
        (Sketch: any, Point: any, geometryEngine: any) => {
          pointCtorRef.current = Point;
          geometryEngineRef.current = geometryEngine;

          const sketch = new Sketch({
            view,
            layer: editLayer,
            availableCreateTools: ["polygon"],
            creationMode: "update",
            snappingOptions: {
              enabled: true,
              selfEnabled: true,
              featureEnabled: true,
              distance: 10,
            },
          });

          // on new polygon complete
          sketch.on("create", (evt: any) => {
            if (evt.state !== "complete") return;
            const g = evt.graphic;

            const rgba: number[] =
              typeof g.symbol?.color?.toRgba === "function"
                ? g.symbol.color.toRgba()
                : Array.isArray(g.attributes?.color)
                ? g.attributes.color
                : makeRandomColor();

            const id =
              "polygon" + Date.now() + Math.floor(Math.random() * 1000);
            const name = g.attributes?.name ?? "New Polygon";

            g.attributes = {
              ...g.attributes,
              id,
              name,
              description:
                g.attributes?.description ??
                `Drawn at ${new Date().toLocaleTimeString()}`,
              color: rgba,
            };
            g.symbol = {
              type: "simple-fill",
              color: rgba,
              outline: g.symbol?.outline ?? { color: [0, 0, 0, 1], width: 1 },
            };
            g.popupTemplate = {
              title: "{name}",
              content: `<p><b>Description:</b> {description}</p><p><i>ID:</i> {id}</p>`,
            };

            const label = createLabelGraphic(
              g.geometry as __esri.Polygon,
              name,
              id,
              view,
              Graphic,
              Point,
              geometryEngine
            );
            editLayer.add(label);
            labelMap.current.set(id, label);
          });

          // keep labels pinned while editing
          sketch.on("update", (evt: any) => {
            if (evt.state === "complete") {
              ensureUniqueIdsInEditLayer(editLayer, view, Graphic);
              return;
            }
            if (evt.state === "active") {
              evt.graphics.forEach((g: any) => {
                if (g.geometry?.type !== "polygon") return;
                const id = g.attributes?.id;
                const lbl = labelMap.current.get(id);
                if (!lbl) return;
                lbl.geometry = labelPointForPolygon(
                  g.geometry as __esri.Polygon,
                  view,
                  pointCtorRef.current,
                  geometryEngineRef.current
                );
              });
            }
          });

          view.ui.add(sketch, "top-right");
          sketchRef.current = sketch;
          setActive(true);
        }
      );
      return;
    }

    // ─────── STOP EDIT MODE ───────
    ensureUniqueIdsInEditLayer(
      editLayer,
      MapViewRef.current as __esri.MapView,
      Graphic
    );
    const labelsLayer = labelsLayerRef.current!;

    // polygons -> final layer, labels -> labels layer
    editLayer.graphics.toArray().forEach((g: any, idx: number) => {
      if (g.symbol?.type === "text") {
        labelsLayer.add(g.clone());
        return;
      }
      if (g.geometry?.type === "polygon") {
        const order = g.attributes.order ?? idx;
        const fillColor: number[] =
          typeof g.symbol?.color?.toRgba === "function"
            ? g.symbol.color.toRgba()
            : Array.isArray(g.attributes.color)
            ? g.attributes.color
            : makeRandomColor();
        const name = g.attributes.name ?? `Polygon ${order + 1}`;

        finalizedLayerRef.current!.add(
          new Graphic({
            geometry: g.geometry,
            symbol: {
              type: "simple-fill",
              color: fillColor,
              outline: g.symbol?.outline ?? { color: [0, 0, 0, 1], width: 1 },
            },
            attributes: { ...g.attributes, order, name, color: fillColor },
            popupTemplate: g.popupTemplate,
          })
        );
      }
    });

    // clean up edit state
    editingLayerRef.current!.removeAll();
    labelMap.current.clear();

    // 🔔 same event the sidebar already listens for
    // emitFinalizedChange();
    //     // clear edit layer and map state
    //     editLayer.removeAll();
    //     labelMap.current.clear();
    finalizedLayerRef.events?.dispatchEvent(new Event("change"));

    if (userEmail) {
      const s = settingsRef.current!;
      saveMapToServer(mapId, userEmail, {
        zoom: s.zoom,
        center: [s.center.x, s.center.y] as [number, number],
        constraints: s.constraints,
      });
    }

    if (sketchRef.current) {
      sketchRef.current.cancel();
      sketchRef.current.destroy();
      (MapViewRef.current as __esri.MapView).ui.remove(sketchRef.current);
      sketchRef.current = null;
    }

    setActive(false);
  };

  return (
    <button
      onClick={toggleSketch}
      style={{
        position: "relative",
        zIndex: 999,
        padding: "8px 12px",
        backgroundColor: active ? "#e63946" : "#2a9d8f",
        color: "#fff",
        border: "none",
        borderRadius: 4,
        cursor: "pointer",
      }}
    >
      {active ? "Stop Drawing" : "Start Drawing"}
    </button>
  );
}

// "use client";
// import { useRef, useState } from "react";
// import {
//   editingLayerRef,
//   finalizedLayerRef,
//   labelsLayerRef,
//   MapViewRef,
//   GraphicRef,
//   settingsRef,
// } from "./map/arcgisRefs";
// import { useSession } from "next-auth/react";
// import { useMapId } from "@/app/context/MapContext";
// import { saveMapToServer } from "@/app/helper/saveMap";

// export default function ToggleSketchTool() {
//   const sketchRef = useRef<any>(null);
//   const [active, setActive] = useState(false);
//   const labelMap = useRef<Map<string, __esri.Graphic>>(new Map());
//   const { data: session } = useSession();
//   const userEmail = session?.user?.email;
//   const mapId = useMapId();

//   /** random [r,g,b,a] with 0.4–0.8 alpha */
//   const makeRandomColor = (): number[] => {
//     const r = Math.floor(Math.random() * 256);
//     const g = Math.floor(Math.random() * 256);
//     const b = Math.floor(Math.random() * 256);
//     const a = 0.4 + Math.random() * 0.4;
//     return [r, g, b, parseFloat(a.toFixed(2))];
//   };

//   /** bounding-box centroid (used only for live sketch) */
//   function getPolygonCentroid(ring: number[][]): [number, number] {
//     let minX = Infinity,
//       maxX = -Infinity;
//     let minY = Infinity,
//       maxY = -Infinity;
//     for (const [x, y] of ring) {
//       if (x < minX) minX = x;
//       if (x > maxX) maxX = x;
//       if (y < minY) minY = y;
//       if (y > maxY) maxY = y;
//     }
//     return [(minX + maxX) / 2, (minY + maxY) / 2];
//   }

//   /** create a text graphic at the box-centroid (live) */
//   const createLabelGraphic = (
//     ring: number[][],
//     labelText: string,
//     parentId: string,
//     view: __esri.MapView,
//     Graphic: any
//   ): __esri.Graphic => {
//     const [cx, cy] = getPolygonCentroid(ring);
//     return new Graphic({
//       geometry: {
//         type: "point",
//         x: cx,
//         y: cy,
//         spatialReference: view.spatialReference,
//       },
//       symbol: {
//         type: "text",
//         text: labelText,
//         color: "black",
//         haloColor: "white",
//         haloSize: "2px",
//         font: { size: 12, family: "sans-serif", weight: "bold" },
//       },
//       attributes: { id: parentId, name: labelText },
//     });
//   };

//   const toggleSketch = () => {
//     const view = MapViewRef.current as __esri.MapView;
//     const editLayer = editingLayerRef.current!;
//     const finalLayer = finalizedLayerRef.current!;
//     const Graphic = GraphicRef.current!;
//     if (!view || !editLayer || !finalLayer || !Graphic) return;

//     // ─────── START EDIT MODE ───────
//     if (!active) {
//       const labelsLayer = labelsLayerRef.current!;
//       labelMap.current.clear();

//       // Move any finalized polygons + labels back into edit
//       finalLayer.graphics.items.forEach((g: any) => {
//         // polygon
//         const editG = new Graphic({
//           geometry: g.geometry,
//           symbol: g.symbol,
//           attributes: { ...g.attributes },
//           popupTemplate: g.popupTemplate,
//         });
//         editLayer.add(editG);

//         // live label
//         if (g.geometry?.type === "polygon") {
//           const label = createLabelGraphic(
//             g.geometry.rings[0],
//             g.attributes.name,
//             g.attributes.id,
//             view,
//             Graphic
//           );
//           editLayer.add(label);
//           labelMap.current.set(g.attributes.id, label);
//         }
//       });
//       finalLayer.removeAll();
//       labelsLayer.removeAll();

//       // Load the Sketch widget
//       (window as any).require(
//         ["esri/widgets/Sketch", "esri/geometry/Point"],
//         (Sketch: any, Point: any) => {
//           const sketch = new Sketch({
//             view,
//             layer: editLayer,
//             availableCreateTools: ["polygon"],
//             creationMode: "update",
//             snappingOptions: {
//               enabled: true,
//               selfEnabled: true,
//               featureEnabled: true,
//               distance: 10,
//             },
//           });

//           // on create: style + live label
//           sketch.on("create", (evt: any) => {
//             if (evt.state !== "complete") return;
//             const g = evt.graphic;
//             const rgba: number[] =
//               typeof g.symbol?.color?.toRgba === "function"
//                 ? g.symbol.color.toRgba()
//                 : Array.isArray(g.attributes?.color)
//                 ? g.attributes.color
//                 : makeRandomColor();
//             const id = "polygon" + Date.now();
//             const name = g.attributes?.name ?? "New Polygon";
//             g.attributes = { ...g.attributes, id, name, color: rgba };
//             g.symbol = {
//               type: "simple-fill",
//               color: rgba,
//               outline: g.symbol?.outline ?? { color: [0, 0, 0, 1], width: 1 },
//             };
//             g.popupTemplate = {
//               title: "{name}",
//               content: `<p><b>Description:</b> {description}</p>`,
//             };

//             // add the live label
//             const label = createLabelGraphic(
//               g.geometry.rings[0],
//               name,
//               id,
//               view,
//               Graphic
//             );
//             editLayer.add(label);
//             labelMap.current.set(id, label);
//           });

//           // on update: move the live label
//           sketch.on("update", (evt: any) => {
//             if (evt.state === "active") {
//               evt.graphics.forEach((g: any) => {
//                 const lbl = labelMap.current.get(g.attributes.id);
//                 if (!lbl) return;
//                 const [cx, cy] = getPolygonCentroid(g.geometry.rings[0]);
//                 lbl.geometry = new Point({
//                   x: cx,
//                   y: cy,
//                   spatialReference: view.spatialReference,
//                 });
//               });
//             }
//           });

//           view.ui.add(sketch, "top-right");
//           sketchRef.current = sketch;
//           setActive(true);
//         }
//       );
//       return;
//     }

//     // ─────── STOP EDIT MODE ───────
//     const labelsLayer = labelsLayerRef.current!;

//     editLayer.graphics.items.forEach((g: any) => {
//       if (g.geometry?.type !== "polygon") return;

//       // 1) finalize the polygon
//       finalLayer.add(
//         new Graphic({
//           geometry: g.geometry,
//           symbol: {
//             type: "simple-fill",
//             color:
//               typeof g.symbol?.color?.toRgba === "function"
//                 ? g.symbol.color.toRgba()
//                 : Array.isArray(g.attributes.color)
//                 ? g.attributes.color
//                 : makeRandomColor(),
//             outline: g.symbol?.outline ?? { color: [0, 0, 0, 1], width: 1 },
//           },
//           attributes: { ...g.attributes },
//           popupTemplate: g.popupTemplate,
//         })
//       );

//       // 2) grab the *same* live label if we have it...
//       const liveLabel = labelMap.current.get(g.attributes.id);
//       if (liveLabel) {
//         labelsLayer.add(liveLabel.clone());
//       } else {
//         // ...otherwise this is a clone/duplicate: give it a fresh ID + label
//         const newId = "polygon" + Date.now() + Math.floor(Math.random() * 1000);
//         g.attributes.id = newId;
//         const name = g.attributes.name ?? "Polygon";
//         labelsLayer.add(
//           createLabelGraphic(g.geometry.rings[0], name, newId, view, Graphic)
//         );
//       }
//     });

//     // clean up
//     editLayer.removeAll();
//     labelMap.current.clear();
//     finalizedLayerRef.events?.dispatchEvent(new Event("change"));

//     if (userEmail) {
//       const s = settingsRef.current!;
//       saveMapToServer(mapId, userEmail, {
//         zoom: s.zoom,
//         center: [s.center.x, s.center.y],
//         constraints: s.constraints,
//       });
//     }

//     if (sketchRef.current) {
//       sketchRef.current.cancel();
//       sketchRef.current.destroy();
//       view.ui.remove(sketchRef.current);
//       sketchRef.current = null;
//     }
//     setActive(false);
//   };

//   return (
//     <button
//       onClick={toggleSketch}
//       style={{
//         position: "absolute",
//         top: 10,
//         left: 10,
//         zIndex: 999,
//         padding: "8px 12px",
//         backgroundColor: active ? "#e63946" : "#2a9d8f",
//         color: "#fff",
//         border: "none",
//         borderRadius: 4,
//         cursor: "pointer",
//       }}
//     >
//       {active ? "Stop Drawing" : "Start Drawing"}
//     </button>
//   );
// }

// "use client";
// import { useRef, useState } from "react";
// import {
//   editingLayerRef,
//   finalizedLayerRef,
//   labelsLayerRef,
//   MapViewRef,
//   GraphicRef,
//   settingsRef,
// } from "./map/arcgisRefs";
// import { useSession } from "next-auth/react";

// import { useMapId } from "@/app/context/MapContext";
// import { saveMapToServer } from "@/app/helper/saveMap";

// export default function ToggleSketchTool() {
//   const sketchRef = useRef<any>(null);
//   const [active, setActive] = useState(false);
//   const labelMap = useRef<Map<string, __esri.Graphic>>(new Map());
//   const smoothedCentroids = useRef<Map<string, { x: number; y: number }>>(
//     new Map()
//   );
//   const lastCentroidTime = useRef<Map<string, number>>(new Map());
//   const { data: session, status } = useSession();
//   const userEmail = session?.user?.email;
//   const mapId = useMapId();
//   const updateAnimationRef = useRef<number | null>(null);
//   const activeUpdateGraphics = useRef<Set<string>>(new Set());

//   /** random [r,g,b,a] with 0.4–0.8 alpha */
//   const makeRandomColor = (): number[] => {
//     const r = Math.floor(Math.random() * 256);
//     const g = Math.floor(Math.random() * 256);
//     const b = Math.floor(Math.random() * 256);
//     const a = 0.4 + Math.random() * 0.4;
//     return [r, g, b, parseFloat(a.toFixed(2))];
//   };

//   /**
//    * Helper function to get bounding box
//    */
//   const getBoundingBox = (
//     ring: number[][]
//   ): {
//     minX: number;
//     maxX: number;
//     minY: number;
//     maxY: number;
//   } => {
//     let minX = Infinity,
//       maxX = -Infinity;
//     let minY = Infinity,
//       maxY = -Infinity;

//     for (const [x, y] of ring) {
//       minX = Math.min(minX, x);
//       maxX = Math.max(maxX, x);
//       minY = Math.min(minY, y);
//       maxY = Math.max(maxY, y);
//     }

//     return { minX, maxX, minY, maxY };
//   };

//   /**
//    * Fast centroid calculation using bounding box center
//    */
//   const getPolygonCentroid = (ring: number[][]): [number, number] => {
//     const n = ring.length;
//     if (n < 3) {
//       throw new Error("Need at least 3 points to form a polygon");
//     }

//     // Always use bounding box center for speed
//     const bbox = getBoundingBox(ring);
//     return [(bbox.minX + bbox.maxX) / 2, (bbox.minY + bbox.maxY) / 2];
//   };

//   /** create a text graphic at centroid of ring */
//   const createLabelGraphic = (
//     ring: number[][],
//     labelText: string,
//     parentId: string,
//     view: __esri.MapView,
//     Graphic: any
//   ): __esri.Graphic => {
//     const [cx, cy] = getPolygonCentroid(ring);
//     return new Graphic({
//       geometry: {
//         type: "point",
//         x: cx,
//         y: cy,
//         spatialReference: view.spatialReference,
//       },
//       symbol: {
//         type: "text",
//         text: labelText,
//         color: "black",
//         haloColor: "white",
//         haloSize: "2px",
//         font: {
//           size: 12,
//           family: "sans-serif",
//           weight: "bold",
//         },
//       },
//       attributes: {
//         id: `label-${parentId}`,
//         parentId,
//         name: labelText,
//       },
//     });
//   };

//   const toggleSketch = () => {
//     const view = MapViewRef.current as __esri.MapView;
//     const editLayer = editingLayerRef.current;
//     const finalLayer = finalizedLayerRef.current;
//     const Graphic = GraphicRef.current;
//     if (!view || !editLayer || !finalLayer || !Graphic) return;

//     // ─────── START EDIT MODE ───────

//     if (!active) {
//       const labelsLayer = labelsLayerRef.current;
//       const editLayer = editingLayerRef.current;
//       const Graphic = GraphicRef.current;

//       // 1) Move polygons back into editLayer (your existing code)
//       finalizedLayerRef.current!.graphics.items.forEach((g: any) => {
//         editLayer.add(
//           new Graphic({
//             geometry: g.geometry,
//             symbol: g.symbol,
//             attributes: { ...g.attributes },
//             popupTemplate: g.popupTemplate,
//           })
//         );
//       });
//       finalizedLayerRef.current!.removeAll();

//       // 2) Move labels back into editLayer & rebuild labelMap
//       labelsLayer.graphics.items.forEach((lbl: __esri.Graphic) => {
//         const clone = new Graphic({
//           geometry: lbl.geometry,
//           symbol: lbl.symbol,
//           attributes: { ...lbl.attributes },
//         });
//         editLayer.add(clone);
//         // store it under the parent polygon's id
//         labelMap.current.set(clone.attributes.parentId, clone);

//         // Initialize smoothed centroid for existing labels
//         if (lbl.geometry && lbl.geometry.type === "point") {
//           smoothedCentroids.current.set(clone.attributes.parentId, {
//             x: (lbl.geometry as __esri.Point).x,
//             y: (lbl.geometry as __esri.Point).y,
//           });
//         }
//       });
//       // clear out the permanent labelsLayer so you'll re-export them on Stop
//       labelsLayer.removeAll();

//       // 3) Initialize smoothed centroids for existing polygons
//       editLayer.graphics.items.forEach((g: any) => {
//         if (g.geometry?.type === "polygon" && g.attributes?.id) {
//           const [cx, cy] = getPolygonCentroid(g.geometry.rings[0]);
//           if (!smoothedCentroids.current.has(g.attributes.id)) {
//             smoothedCentroids.current.set(g.attributes.id, { x: cx, y: cy });
//           }
//         }
//       });

//       // load Sketch + Point AMD modules
//       (window as any).require(
//         ["esri/widgets/Sketch", "esri/geometry/Point"],
//         (Sketch: any, Point: any) => {
//           const sketch = new Sketch({
//             view,
//             layer: editLayer,
//             availableCreateTools: ["polygon"],
//             creationMode: "update",
//             snappingOptions: {
//               enabled: true,
//               selfEnabled: true,
//               featureEnabled: true,
//               distance: 10,
//             },
//           });

//           // when a new polygon is finished
//           sketch.on("create", (evt: any) => {
//             if (evt.state !== "complete") return;
//             const g = evt.graphic;
//             // determine color
//             const rgba: number[] =
//               typeof g.symbol?.color?.toRgba === "function"
//                 ? g.symbol.color.toRgba()
//                 : Array.isArray(g.attributes?.color)
//                 ? g.attributes.color
//                 : makeRandomColor();
//             // assign id, name, description
//             console.log(editingLayerRef.current.graphics.items);
//             const id =
//               "polygon" +
//               (editingLayerRef.current.graphics.items.length + 1) / 2;
//             console.log(id);
//             const name = g.attributes?.name ?? "New Polygon";
//             g.attributes = {
//               ...g.attributes,
//               id,
//               name,
//               description:
//                 g.attributes?.description ??
//                 `Drawn at ${new Date().toLocaleTimeString()}`,
//               color: rgba,
//             };
//             g.symbol = {
//               type: "simple-fill",
//               color: rgba,
//               outline: g.symbol?.outline ?? { color: [0, 0, 0, 1], width: 1 },
//             };
//             g.popupTemplate = {
//               title: "{name}",
//               content: `<p><b>Description:</b> {description}</p><p><i>Coordinates:</i><br/>${JSON.stringify(
//                 g.geometry.rings
//               )}</p>`,
//             };
//             // add a label
//             const label = createLabelGraphic(
//               g.geometry.rings[0],
//               name,
//               id,
//               view,
//               Graphic
//             );
//             editLayer.add(label);
//             labelMap.current.set(id, label);

//             // Initialize smoothed centroid for the new polygon
//             const [cx, cy] = getPolygonCentroid(g.geometry.rings[0]);
//             smoothedCentroids.current.set(id, { x: cx, y: cy });
//           });

//           // Continuous update function for smooth label tracking
//           const updateLabels = () => {
//             const editLayer = editingLayerRef.current;
//             if (!editLayer) return;

//             const now = performance.now();

//             activeUpdateGraphics.current.forEach((polygonId) => {
//               const polygon = editLayer.graphics.find(
//                 (g: any) =>
//                   g.attributes?.id === polygonId &&
//                   g.geometry?.type === "polygon"
//               );

//               if (!polygon) {
//                 activeUpdateGraphics.current.delete(polygonId);
//                 return;
//               }

//               const label = labelMap.current.get(polygonId);
//               if (!label) return;

//               // Get centroid with improved calculation
//               const [cx, cy] = getPolygonCentroid(polygon.geometry.rings[0]);

//               // Get previous centroid for stability
//               const prev = smoothedCentroids.current.get(polygonId) ?? {
//                 x: cx,
//                 y: cy,
//               };

//               // Skip update if centroid hasn't moved much (reduces jitter)
//               const movementThreshold = 0.5; // pixels
//               const distance = Math.sqrt(
//                 Math.pow(cx - prev.x, 2) + Math.pow(cy - prev.y, 2)
//               );

//               if (distance < movementThreshold) {
//                 return; // Skip this update
//               }

//               const prevTime = lastCentroidTime.current.get(polygonId) ?? now;

//               // Compute velocity (pixels/ms)
//               const dt = now - prevTime;
//               const velocity = dt > 0 ? distance / dt : 0;

//               lastCentroidTime.current.set(polygonId, now);

//               // Use consistent smooth behavior regardless of polygon size
//               // Higher smoothing = more stable labels
//               const minAlpha = 0.05; // Maximum smoothing
//               const maxAlpha = 0.15; // Still pretty smooth
//               const velocityThreshold = 0.5;

//               const alpha = Math.min(
//                 maxAlpha,
//                 Math.max(minAlpha, velocity / velocityThreshold)
//               );

//               const newX = alpha * cx + (1 - alpha) * prev.x;
//               const newY = alpha * cy + (1 - alpha) * prev.y;

//               smoothedCentroids.current.set(polygonId, { x: newX, y: newY });

//               // Ensure we have valid coordinates before creating Point
//               if (isFinite(newX) && isFinite(newY)) {
//                 label.geometry = new Point({
//                   x: newX,
//                   y: newY,
//                   spatialReference: view.spatialReference,
//                 });
//               }
//             });

//             // Continue animation if there are active graphics
//             if (activeUpdateGraphics.current.size > 0) {
//               updateAnimationRef.current = requestAnimationFrame(updateLabels);
//             }
//           };

//           sketch.on("update", (evt: any) => {
//             if (evt.state === "complete") {
//               // Stop the animation loop
//               activeUpdateGraphics.current.clear();
//               if (updateAnimationRef.current) {
//                 cancelAnimationFrame(updateAnimationRef.current);
//                 updateAnimationRef.current = null;
//               }

//               // Handle completion - check for duplicated polygons that need new IDs
//               const processedIds = new Set();

//               evt.graphics.forEach((g: any) => {
//                 if (g.geometry?.type !== "polygon") return;

//                 const existingId = g.attributes?.id;

//                 // Skip if we already processed this ID or if it doesn't have an ID yet
//                 if (!existingId || processedIds.has(existingId)) return;

//                 // Find all polygons with the same ID
//                 const duplicates = editLayer.graphics.items.filter(
//                   (graphic: any) =>
//                     graphic.attributes?.id === existingId &&
//                     graphic.geometry?.type === "polygon" &&
//                     graphic !== g // exclude the current graphic
//                 );

//                 // If we found duplicates, only process them (keep the original)
//                 duplicates.forEach((duplicate: any) => {
//                   // Generate new unique ID for the duplicate
//                   const newId =
//                     "polygon" + Date.now() + Math.floor(Math.random() * 1000);
//                   const originalName =
//                     duplicate.attributes?.name ?? "New Polygon";
//                   const copyName = originalName.includes("(Copy)")
//                     ? originalName
//                     : `${originalName} (Copy)`;

//                   // Update the duplicate's attributes
//                   duplicate.attributes = {
//                     ...duplicate.attributes,
//                     id: newId,
//                     name: copyName,
//                     description:
//                       duplicate.attributes?.description ??
//                       `Duplicated at ${new Date().toLocaleTimeString()}`,
//                   };

//                   // Update popup template to fix the content error
//                   duplicate.popupTemplate = {
//                     title: "{name}",
//                     content: `<p><b>Description:</b> {description}</p><p><i>ID:</i> {id}</p>`,
//                   };

//                   // Create a new label for the duplicate
//                   const newLabel = createLabelGraphic(
//                     duplicate.geometry.rings[0],
//                     copyName,
//                     newId,
//                     view,
//                     Graphic
//                   );
//                   editLayer.add(newLabel);
//                   labelMap.current.set(newId, newLabel);

//                   // Initialize smoothed centroid for the new polygon
//                   const [cx, cy] = getPolygonCentroid(
//                     duplicate.geometry.rings[0]
//                   );
//                   smoothedCentroids.current.set(newId, { x: cx, y: cy });
//                   lastCentroidTime.current.set(newId, performance.now());
//                 });

//                 processedIds.add(existingId);
//               });
//               return;
//             }

//             // Handle ongoing updates with improved small polygon support
//             const now = performance.now();

//             evt.graphics.forEach((g: any) => {
//               // Skip if this is a text graphic (label)
//               if (g.symbol?.type === "text") return;

//               const id = g.attributes?.id;
//               if (!id || g.geometry?.type !== "polygon") return;

//               const label = labelMap.current.get(id);
//               if (!label) return;

//               // Get centroid with improved calculation
//               const [cx, cy] = getPolygonCentroid(g.geometry.rings[0]);

//               // Get previous centroid for stability
//               const prev = smoothedCentroids.current.get(id) ?? {
//                 x: cx,
//                 y: cy,
//               };

//               // Skip update if centroid hasn't moved much (reduces jitter)
//               const movementThreshold = 0.5; // pixels
//               const distance = Math.sqrt(
//                 Math.pow(cx - prev.x, 2) + Math.pow(cy - prev.y, 2)
//               );

//               if (distance < movementThreshold) {
//                 return; // Skip this update
//               }

//               const prevTime = lastCentroidTime.current.get(id) ?? now;

//               // Compute velocity (pixels/ms)
//               const dt = now - prevTime;
//               const dx = cx - prev.x;
//               const dy = cy - prev.y;
//               const velocity = dt > 0 ? distance / dt : 0;

//               lastCentroidTime.current.set(id, now);

//               // Use consistent smooth behavior regardless of polygon size
//               // Higher smoothing = more stable labels
//               const minAlpha = 0.05; // Maximum smoothing
//               const maxAlpha = 0.15; // Still pretty smooth
//               const velocityThreshold = 0.5;

//               const alpha = Math.min(
//                 maxAlpha,
//                 Math.max(minAlpha, velocity / velocityThreshold)
//               );

//               const newX = alpha * cx + (1 - alpha) * prev.x;
//               const newY = alpha * cy + (1 - alpha) * prev.y;

//               smoothedCentroids.current.set(id, { x: newX, y: newY });

//               // Ensure we have valid coordinates before creating Point
//               if (isFinite(newX) && isFinite(newY)) {
//                 label.geometry = new Point({
//                   x: newX,
//                   y: newY,
//                   spatialReference: view.spatialReference,
//                 });
//               }
//             });
//           });

//           view.ui.add(sketch, "top-right");
//           sketchRef.current = sketch;
//           setActive(true);
//         }
//       );

//       return;
//     }

//     // ─────── STOP EDIT MODE ───────
//     const labelsLayer = labelsLayerRef.current as __esri.GraphicsLayer;

//     editLayer.graphics.items.forEach((g: any, idx: any) => {
//       // text symbols → permanent labels layer
//       if (g.symbol?.type === "text") {
//         labelsLayer.add(g.clone());
//         return;
//       }

//       // otherwise polygon → final layer
//       const order = g.attributes.order ?? idx;
//       const fillColor: number[] =
//         typeof g.symbol?.color?.toRgba === "function"
//           ? g.symbol.color.toRgba()
//           : Array.isArray(g.attributes.color)
//           ? g.attributes.color
//           : makeRandomColor();
//       const name = g.attributes.name ?? `Polygon ${order + 1}`;

//       finalLayer.add(
//         new Graphic({
//           geometry: g.geometry,
//           symbol: {
//             type: "simple-fill",
//             color: fillColor,
//             outline: g.symbol?.outline ?? { color: [0, 0, 0, 1], width: 1 },
//           },
//           attributes: {
//             ...g.attributes,
//             order,
//             name,
//             color: fillColor,
//           },
//           popupTemplate: g.popupTemplate,
//         })
//       );
//     });

//     // clear edit layer and map state
//     editLayer.removeAll();
//     labelMap.current.clear();
//     smoothedCentroids.current.clear();
//     lastCentroidTime.current.clear();
//     activeUpdateGraphics.current.clear();

//     // Cancel any ongoing animation
//     if (updateAnimationRef.current) {
//       cancelAnimationFrame(updateAnimationRef.current);
//       updateAnimationRef.current = null;
//     }

//     finalizedLayerRef.events?.dispatchEvent(new Event("change"));
//     if (userEmail) {
//       const s = settingsRef.current;

//       saveMapToServer(mapId, userEmail, {
//         zoom: s.zoom,
//         center: [s.center.x, s.center.y] as [number, number],
//         constraints: s.constraints,
//       });
//     }

//     if (sketchRef.current) {
//       sketchRef.current.cancel();
//       sketchRef.current.destroy();
//       view.ui.remove(sketchRef.current);
//       sketchRef.current = null;
//     }
//     setActive(false);
//   };

//   return (
//     <button
//       onClick={toggleSketch}
//       style={{
//         top: 10,
//         left: 10,
//         zIndex: 999,
//         padding: "8px 12px",
//         backgroundColor: active ? "#e63946" : "#2a9d8f",
//         color: "#fff",
//         border: "none",
//         borderRadius: 4,
//         cursor: "pointer",
//       }}
//     >
//       {active ? "Stop Drawing" : "Start Drawing"}
//     </button>
//   );
// }
