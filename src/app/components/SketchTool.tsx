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
