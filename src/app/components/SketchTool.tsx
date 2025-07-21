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
  const labelMap = useRef<Map<string, __esri.Graphic>>(new Map());
  const smoothedCentroids = useRef<Map<string, { x: number; y: number }>>(
    new Map()
  );
  const lastCentroidTime = useRef<Map<string, number>>(new Map());
  const { data: session, status } = useSession();
  const userEmail = session?.user?.email;
  const mapId = useMapId();

  /** random [r,g,b,a] with 0.4–0.8 alpha */
  const makeRandomColor = (): number[] => {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    const a = 0.4 + Math.random() * 0.4;
    return [r, g, b, parseFloat(a.toFixed(2))];
  };

  /** compute centroid of one ring */
  const getPolygonCentroid = (ring: number[][]): [number, number] => {
    let signedArea = 0;
    let cx = 0;
    let cy = 0;
    // ensure closed ring
    if (
      ring.length > 0 &&
      (ring[0][0] !== ring[ring.length - 1][0] ||
        ring[0][1] !== ring[ring.length - 1][1])
    ) {
      ring.push([...ring[0]]);
    }
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[i + 1];
      const cross = x0 * y1 - x1 * y0;
      signedArea += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }
    signedArea = signedArea / 2;
    cx = cx / (6 * signedArea);
    cy = cy / (6 * signedArea);
    return [cx, cy];
  };

  /** create a text graphic at centroid of ring */
  const createLabelGraphic = (
    ring: number[][],
    labelText: string,
    parentId: string,
    view: __esri.MapView,
    Graphic: any
  ): __esri.Graphic => {
    const [cx, cy] = getPolygonCentroid(ring);
    return new Graphic({
      geometry: {
        type: "point",
        x: cx,
        y: cy,
        spatialReference: view.spatialReference,
      },
      symbol: {
        type: "text",
        text: labelText,
        color: "black",
        haloColor: "white",
        haloSize: "2px",
        font: {
          size: 12,
          family: "sans-serif",
          weight: "bold",
        },
      },
      attributes: {
        id: `label-${parentId}`,
        parentId,
        name: labelText,
      },
    });
  };

  const toggleSketch = () => {
    const view = MapViewRef.current as __esri.MapView;
    const editLayer = editingLayerRef.current;
    const finalLayer = finalizedLayerRef.current;
    const Graphic = GraphicRef.current;
    if (!view || !editLayer || !finalLayer || !Graphic) return;

    // ─────── START EDIT MODE ───────

    if (!active) {
      const labelsLayer = labelsLayerRef.current;
      const editLayer = editingLayerRef.current;
      const Graphic = GraphicRef.current;

      // 1) Move polygons back into editLayer (your existing code)
      finalizedLayerRef.current!.graphics.items.forEach((g: any) => {
        editLayer.add(
          new Graphic({
            geometry: g.geometry,
            symbol: g.symbol,
            attributes: { ...g.attributes },
            popupTemplate: g.popupTemplate,
          })
        );
      });
      finalizedLayerRef.current!.removeAll();

      // 2) **NEW**: Move labels back into editLayer & rebuild labelMap
      labelsLayer.graphics.items.forEach((lbl: __esri.Graphic) => {
        const clone = new Graphic({
          geometry: lbl.geometry,
          symbol: lbl.symbol,
          attributes: { ...lbl.attributes },
        });
        editLayer.add(clone);
        // store it under the parent polygon's id
        labelMap.current.set(clone.attributes.parentId, clone);
      });
      // clear out the permanent labelsLayer so you'll re-export them on Stop
      labelsLayer.removeAll();

      // load Sketch + Point AMD modules
      (window as any).require(
        ["esri/widgets/Sketch", "esri/geometry/Point"],
        (Sketch: any, Point: any) => {
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

          // when a new polygon is finished
          sketch.on("create", (evt: any) => {
            if (evt.state !== "complete") return;
            const g = evt.graphic;
            // determine color
            const rgba: number[] =
              typeof g.symbol?.color?.toRgba === "function"
                ? g.symbol.color.toRgba()
                : Array.isArray(g.attributes?.color)
                ? g.attributes.color
                : makeRandomColor();
            // assign id, name, description
            // const id = crypto.randomUUID();
            // alert(finalizedLayerRef.current!.graphics.items.length);
            console.log(editingLayerRef.current.graphics.items);
            const id =
              "polygon" +
              (editingLayerRef.current.graphics.items.length + 1) / 2;
            console.log(id);
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
              content: `<p><b>Description:</b> {description}</p><p><i>Coordinates:</i><br/>${JSON.stringify(
                g.geometry.rings
              )}</p>`,
            };
            // add a label
            const label = createLabelGraphic(
              g.geometry.rings[0],
              name,
              id,
              view,
              Graphic
            );
            editLayer.add(label);
            labelMap.current.set(id, label);
          });

          // sketch.on("update", (evt: any) => {
          //   if (evt.state === "complete") return;

          //   const now = performance.now();

          //   evt.graphics.forEach((g: any) => {
          //     const id = g.attributes?.id;
          //     const label = labelMap.current.get(id);
          //     if (!label || g.geometry?.type !== "polygon") return;

          //     const [cx, cy] = getPolygonCentroid(g.geometry.rings[0]);
          //     const prev = smoothedCentroids.current.get(id) ?? {
          //       x: cx,
          //       y: cy,
          //     };
          //     const prevTime = lastCentroidTime.current.get(id) ?? now;

          //     // Compute velocity (pixels/ms)
          //     const dt = now - prevTime;
          //     const dx = cx - prev.x;
          //     const dy = cy - prev.y;
          //     const distance = Math.sqrt(dx * dx + dy * dy);
          //     const velocity = dt > 0 ? distance / dt : 0; // pixels/ms

          //     lastCentroidTime.current.set(id, now);

          //     // Convert velocity to alpha (higher speed = less smoothing)
          //     // Tune these as needed
          //     const minAlpha = 0.1; // max smoothing
          //     const maxAlpha = 0.6; // less smoothing
          //     const velocityThreshold = 0.5; // pixels/ms

          //     const alpha = Math.min(
          //       maxAlpha,
          //       Math.max(minAlpha, velocity / velocityThreshold)
          //     );

          //     const newX = alpha * cx + (1 - alpha) * prev.x;
          //     const newY = alpha * cy + (1 - alpha) * prev.y;

          //     smoothedCentroids.current.set(id, { x: newX, y: newY });

          //     label.geometry = new Point({
          //       x: newX,
          //       y: newY,
          //       spatialReference: view.spatialReference,
          //     });
          //   });
          // });
          sketch.on("update", (evt: any) => {
            if (evt.state === "complete") {
              // Handle completion - check for duplicated polygons that need new IDs
              const processedIds = new Set();

              evt.graphics.forEach((g: any) => {
                if (g.geometry?.type !== "polygon") return;

                const existingId = g.attributes?.id;

                // Skip if we already processed this ID or if it doesn't have an ID yet
                if (!existingId || processedIds.has(existingId)) return;

                // Find all polygons with the same ID
                const duplicates = editLayer.graphics.items.filter(
                  (graphic: any) =>
                    graphic.attributes?.id === existingId &&
                    graphic.geometry?.type === "polygon" &&
                    graphic !== g // exclude the current graphic
                );

                // If we found duplicates, only process them (keep the original)
                duplicates.forEach((duplicate: any) => {
                  // Generate new unique ID for the duplicate
                  const newId =
                    "polygon" + Date.now() + Math.floor(Math.random() * 1000);
                  const originalName =
                    duplicate.attributes?.name ?? "New Polygon";
                  const copyName = originalName.includes("(Copy)")
                    ? originalName
                    : `${originalName} (Copy)`;

                  // Update the duplicate's attributes
                  duplicate.attributes = {
                    ...duplicate.attributes,
                    id: newId,
                    name: copyName,
                    description:
                      duplicate.attributes?.description ??
                      `Duplicated at ${new Date().toLocaleTimeString()}`,
                  };

                  // Update popup template to fix the content error
                  duplicate.popupTemplate = {
                    title: "{name}",
                    content: `<p><b>Description:</b> {description}</p><p><i>ID:</i> {id}</p>`,
                  };

                  // Remove old label if it exists
                  const oldLabel = labelMap.current.get(existingId);
                  if (oldLabel) {
                    // Don't remove the original label, just create a new one for duplicate
                  }

                  // Create a new label for the duplicate
                  const newLabel = createLabelGraphic(
                    duplicate.geometry.rings[0],
                    copyName,
                    newId,
                    view,
                    Graphic
                  );
                  editLayer.add(newLabel);
                  labelMap.current.set(newId, newLabel);

                  // Initialize smoothed centroid for the new polygon
                  const [cx, cy] = getPolygonCentroid(
                    duplicate.geometry.rings[0]
                  );
                  smoothedCentroids.current.set(newId, { x: cx, y: cy });
                  lastCentroidTime.current.set(newId, performance.now());
                });

                processedIds.add(existingId);
              });
              return;
            }

            // Handle ongoing updates (your existing smoothing logic)
            const now = performance.now();

            evt.graphics.forEach((g: any) => {
              const id = g.attributes?.id;
              const label = labelMap.current.get(id);
              if (!label || g.geometry?.type !== "polygon") return;

              const [cx, cy] = getPolygonCentroid(g.geometry.rings[0]);
              const prev = smoothedCentroids.current.get(id) ?? {
                x: cx,
                y: cy,
              };
              const prevTime = lastCentroidTime.current.get(id) ?? now;

              // Compute velocity (pixels/ms)
              const dt = now - prevTime;
              const dx = cx - prev.x;
              const dy = cy - prev.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const velocity = dt > 0 ? distance / dt : 0; // pixels/ms

              lastCentroidTime.current.set(id, now);

              // Convert velocity to alpha (higher speed = less smoothing)
              const minAlpha = 0.1; // max smoothing
              const maxAlpha = 0.6; // less smoothing
              const velocityThreshold = 0.5; // pixels/ms

              const alpha = Math.min(
                maxAlpha,
                Math.max(minAlpha, velocity / velocityThreshold)
              );

              const newX = alpha * cx + (1 - alpha) * prev.x;
              const newY = alpha * cy + (1 - alpha) * prev.y;

              smoothedCentroids.current.set(id, { x: newX, y: newY });

              // Ensure we have valid coordinates before creating Point
              if (isFinite(newX) && isFinite(newY)) {
                label.geometry = new Point({
                  x: newX,
                  y: newY,
                  spatialReference: view.spatialReference,
                });
              }
            });
          });

          view.ui.add(sketch, "top-right");
          sketchRef.current = sketch;
          setActive(true);
        }
      );

      return;
    }

    // ─────── STOP EDIT MODE ───────
    const labelsLayer = labelsLayerRef.current as __esri.GraphicsLayer;

    editLayer.graphics.items.forEach((g: any, idx: any) => {
      // text symbols → permanent labels layer
      if (g.symbol?.type === "text") {
        labelsLayer.add(g.clone());
        return;
      }

      // otherwise polygon → final layer
      const order = g.attributes.order ?? idx;
      const fillColor: number[] =
        typeof g.symbol?.color?.toRgba === "function"
          ? g.symbol.color.toRgba()
          : Array.isArray(g.attributes.color)
          ? g.attributes.color
          : makeRandomColor();
      const name = g.attributes.name ?? `Polygon ${order + 1}`;

      finalLayer.add(
        new Graphic({
          geometry: g.geometry,
          symbol: {
            type: "simple-fill",
            color: fillColor,
            outline: g.symbol?.outline ?? { color: [0, 0, 0, 1], width: 1 },
          },
          attributes: {
            ...g.attributes,
            order,
            name,
            color: fillColor,
          },
          popupTemplate: g.popupTemplate,
        })
      );
    });

    // clear edit layer and map state
    editLayer.removeAll();
    labelMap.current.clear();
    finalizedLayerRef.events?.dispatchEvent(new Event("change"));
    if (userEmail) {
      saveMapToServer(mapId, userEmail, settingsRef.current);
    }

    if (sketchRef.current) {
      sketchRef.current.cancel();
      sketchRef.current.destroy();
      view.ui.remove(sketchRef.current);
      sketchRef.current = null;
    }
    setActive(false);
  };

  return (
    <button
      onClick={toggleSketch}
      style={{
        top: 10,
        left: 10,
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
