//src/app/components/map/admin/SketchTool.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  editingLayerRef,
  finalizedLayerRef,
  labelsLayerRef,
  MapViewRef,
  GraphicRef,
  settingsRef,
} from "../arcgisRefs";
import {
  createDefaultPolylineAnimation,
  normalizePolylineAnimation,
} from "@/app/types/myTypes";
import { useSession } from "next-auth/react";
import { useMapId } from "@/app/context/MapContext";
import { saveMapToServer } from "@/app/helper/saveMap";
import {
  clearPendingDrawingCreation,
  peekPendingDrawingCreation,
  subscribeDrawingCreation,
  type PendingDrawingCreation,
} from "../categories/drawingCreationStore";
import { applyMapVisibility } from "../categories/categoryVisibility";

type DrawableGeometryType = "polygon" | "polyline" | "point";

type SimpleFillAutocast = __esri.SimpleFillSymbolProperties & {
  type: "simple-fill";
};

type SimpleLineAutocast = __esri.SimpleLineSymbolProperties & {
  type: "simple-line";
};

type SimpleMarkerAutocast = __esri.SimpleMarkerSymbolProperties & {
  type: "simple-marker";
};

type DrawableSymbolAutocast =
  | SimpleFillAutocast
  | SimpleLineAutocast
  | SimpleMarkerAutocast;

export default function ToggleSketchTool() {
  const sketchRef = useRef<any>(null);
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const pendingCreationRef = useRef<PendingDrawingCreation | null>(null);

  const labelMap = useRef<Map<string, __esri.Graphic>>(new Map());

  const pointCtorRef = useRef<any>(null);
  const geometryEngineRef = useRef<any>(null);

  const { data: session } = useSession();
  const userEmail = session?.user?.email;
  const mapId = useMapId();

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  function emitFinalizedChange() {
    const finalLayer = finalizedLayerRef.current as any;
    if (!finalLayer) return;
    if (!finalLayer.events) finalLayer.events = new EventTarget();
    finalLayer.events.dispatchEvent(new Event("change"));
  }

  const isTextGraphic = (g: any) => g?.symbol?.type === "text";
  const isPolygonGraphic = (g: any) => g?.geometry?.type === "polygon";
  const isPolylineGraphic = (g: any) => g?.geometry?.type === "polyline";
  const isPointGraphic = (g: any) => g?.geometry?.type === "point";

  const isDrawableGraphic = (g: any) =>
    isPolygonGraphic(g) || isPolylineGraphic(g) || isPointGraphic(g);

  const defaultNameForGeometry = (type: DrawableGeometryType) => {
    if (type === "polygon") return "New Polygon";
    if (type === "polyline") return "New Polyline";
    return "New Point";
  };

  const makeGraphicId = (type: DrawableGeometryType) =>
    `${type}${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const makeCopyName = (name: string) =>
    name.includes("(Copy)") ? name : `${name} (Copy)`;

  const makePopupTemplate = () => ({
    title: "{name}",
    content: `<p><b>Description:</b> {description}</p><p><i>ID:</i> {id}</p>`,
  });

  const makeRandomColor = (): number[] => {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    const a = 0.4 + Math.random() * 0.4;
    return [r, g, b, parseFloat(a.toFixed(2))];
  };

  const getGraphicColor = (g: any): number[] => {
    if (typeof g?.symbol?.color?.toRgba === "function") {
      return g.symbol.color.toRgba();
    }
    if (Array.isArray(g?.attributes?.color)) {
      return g.attributes.color;
    }
    return makeRandomColor();
  };

  const buildPolygonSymbol = (
    _g: any,
    color: number[],
  ): SimpleFillAutocast => ({
    type: "simple-fill",
    color,
    // outline: { color, width: 1 },
    outline: { color: [0, 0, 0, 1], width: 2 },
  });

  const buildPolylineSymbol = (
    g: any,
    color: number[],
  ): SimpleLineAutocast => ({
    type: "simple-line",
    color,
    width:
      typeof (g.symbol as any)?.width === "number"
        ? (g.symbol as any).width
        : typeof g.attributes?.width === "number"
          ? g.attributes.width
          : 3,
  });

  const buildPointSymbol = (g: any, color: number[]): SimpleMarkerAutocast => ({
    type: "simple-marker",
    style: "circle",
    color,
    size:
      typeof (g.symbol as any)?.size === "number"
        ? (g.symbol as any).size
        : typeof g.attributes?.size === "number"
          ? g.attributes.size
          : 10,
    outline: { color: [255, 0, 0, 1], width: 1 },
  });

  const buildSymbolForGeometry = (
    type: DrawableGeometryType,
    g: any,
    color: number[],
  ): DrawableSymbolAutocast => {
    if (type === "polygon") return buildPolygonSymbol(g, color);
    if (type === "polyline") return buildPolylineSymbol(g, color);
    return buildPointSymbol(g, color);
  };

  function bboxCenter(
    ring: number[][],
    sr: __esri.SpatialReference,
    Point: any,
  ) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

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

  function labelPointForPolygon(
    polygon: __esri.Polygon,
    view: __esri.MapView,
    Point: any,
    geometryEngine: any,
  ): __esri.Point {
    try {
      if (geometryEngine) {
        const p = geometryEngine.labelPoints(polygon);
        if (p) {
          return new Point({
            x: p.x,
            y: p.y,
            spatialReference: view.spatialReference,
          });
        }

        const c = geometryEngine.centroid?.(polygon);
        if (c) {
          return new Point({
            x: c.x,
            y: c.y,
            spatialReference: view.spatialReference,
          });
        }
      }
    } catch {}

    const c1 = (polygon as any).centroid;
    if (c1) {
      return new Point({
        x: c1.x,
        y: c1.y,
        spatialReference: view.spatialReference,
      });
    }

    if (polygon.extent?.center) {
      return new Point({
        x: polygon.extent.center.x,
        y: polygon.extent.center.y,
        spatialReference: view.spatialReference,
      });
    }

    return bboxCenter(
      polygon.rings[0],
      view.spatialReference,
      pointCtorRef.current,
    );
  }

  const createLabelGraphic = (
    polygon: __esri.Polygon,
    labelText: string,
    parentId: string,
    view: __esri.MapView,
    Graphic: any,
    Point: any,
    geometryEngine: any,
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

  function ensureUniqueIdsInEditLayer(
    editLayer: __esri.GraphicsLayer,
    view: __esri.MapView,
    Graphic: any,
  ) {
    const Point = pointCtorRef.current;
    const geometryEngine = geometryEngineRef.current;

    const drawables = editLayer.graphics
      .toArray()
      .filter((g: any) => isDrawableGraphic(g));

    const byId = new Map<string, __esri.Graphic[]>();

    for (const g of drawables) {
      const id = g.attributes?.id;
      if (!id) continue;
      const arr = byId.get(id) || [];
      arr.push(g);
      byId.set(id, arr);
    }

    byId.forEach((arr) => {
      if (arr.length <= 1) return;

      for (let i = 1; i < arr.length; i++) {
        const duplicate = arr[i];
        const geomType = duplicate.geometry?.type as DrawableGeometryType;
        if (
          geomType !== "polygon" &&
          geomType !== "polyline" &&
          geomType !== "point"
        ) {
          continue;
        }

        const newId = makeGraphicId(geomType);
        const baseName =
          duplicate.attributes?.name ?? defaultNameForGeometry(geomType);
        const copyName = makeCopyName(baseName);
        const color = getGraphicColor(duplicate);

        duplicate.attributes = {
          ...duplicate.attributes,
          id: newId,
          name: copyName,
          description:
            duplicate.attributes?.description ??
            `Duplicated at ${new Date().toLocaleTimeString()}`,
          color,
        };

        if (geomType === "polyline") {
          duplicate.attributes.width =
            typeof (duplicate.symbol as any)?.width === "number"
              ? (duplicate.symbol as any).width
              : typeof duplicate.attributes?.width === "number"
                ? duplicate.attributes.width
                : 3;

          duplicate.attributes.animation = normalizePolylineAnimation(
            duplicate.attributes?.animation,
          );
        }

        if (geomType === "point") {
          duplicate.attributes.size =
            typeof (duplicate.symbol as any)?.size === "number"
              ? (duplicate.symbol as any).size
              : typeof duplicate.attributes?.size === "number"
                ? duplicate.attributes.size
                : 10;
        }

        duplicate.symbol = buildSymbolForGeometry(
          geomType,
          duplicate,
          color,
        ) as any;
        duplicate.popupTemplate = makePopupTemplate();

        if (geomType === "polygon") {
          const newLabel = createLabelGraphic(
            duplicate.geometry as __esri.Polygon,
            copyName,
            newId,
            view,
            Graphic,
            Point,
            geometryEngine,
          );
          editLayer.add(newLabel);
          labelMap.current.set(newId, newLabel);
        }
      }
    });
  }

  const toggleSketch = () => {
    const view = MapViewRef.current as __esri.MapView;
    const editLayer = editingLayerRef.current!;
    const finalLayer = finalizedLayerRef.current!;
    const Graphic = GraphicRef.current!;
    if (!view || !editLayer || !finalLayer || !Graphic) return;

    if (!active) {
      const requestedTool = pendingCreationRef.current?.geometryType;
      const labelsLayer = labelsLayerRef.current!;
      labelMap.current.clear();

      finalLayer.graphics.toArray().forEach((g: any) => {
        const clonedAttributes = { ...g.attributes };

        if (g.geometry?.type === "polyline") {
          clonedAttributes.animation = normalizePolylineAnimation(
            g.attributes?.animation,
          );
        }

        editLayer.add(
          new Graphic({
            geometry: g.geometry,
            symbol: g.symbol,
            attributes: clonedAttributes,
            popupTemplate: g.popupTemplate,
          }),
        );
      });
      finalLayer.removeAll();

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
            availableCreateTools: ["polygon", "polyline", "point"],
            creationMode: "update",
            snappingOptions: {
              enabled: true,
              selfEnabled: true,
              featureEnabled: true,
              distance: 10,
            },
          });

          sketch.on("create", (evt: any) => {
            if (evt.state !== "complete") return;

            const g = evt.graphic;
            const geomType = g.geometry?.type as DrawableGeometryType;
            if (
              geomType !== "polygon" &&
              geomType !== "polyline" &&
              geomType !== "point"
            ) {
              return;
            }

            const color = getGraphicColor(g);
            const id = makeGraphicId(geomType);
            const pending = pendingCreationRef.current;
            const name =
              pending?.name?.trim() ||
              g.attributes?.name ||
              defaultNameForGeometry(geomType);

            g.attributes = {
              ...g.attributes,
              id,
              name,
              categoryId: pending?.categoryId ?? null,
              iconUrl: pending?.iconUrl ?? null,
              description:
                g.attributes?.description ??
                `Drawn at ${new Date().toLocaleTimeString()}`,
              color,
            };

            if (geomType === "polyline") {
              g.attributes.width =
                typeof (g.symbol as any)?.width === "number"
                  ? (g.symbol as any).width
                  : 3;

              g.attributes.animation = createDefaultPolylineAnimation();
            }

            if (geomType === "point") {
              g.attributes.size =
                typeof (g.symbol as any)?.size === "number"
                  ? (g.symbol as any).size
                  : 10;
            }

            g.symbol = buildSymbolForGeometry(geomType, g, color) as any;
            g.popupTemplate = makePopupTemplate();

            if (geomType === "polygon") {
              const label = createLabelGraphic(
                g.geometry as __esri.Polygon,
                name,
                id,
                view,
                Graphic,
                Point,
                geometryEngine,
              );
              editLayer.add(label);
              labelMap.current.set(id, label);
            }

            pendingCreationRef.current = null;
            clearPendingDrawingCreation();
          });

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
                  geometryEngineRef.current,
                );
              });
            }
          });

          view.ui.add(sketch, "top-right");
          sketchRef.current = sketch;
          if (requestedTool) {
            sketch.create(requestedTool);
          }
          setActive(true);
          activeRef.current = true;
        },
      );

      return;
    }

    ensureUniqueIdsInEditLayer(
      editLayer,
      MapViewRef.current as __esri.MapView,
      Graphic,
    );

    const labelsLayer = labelsLayerRef.current!;

    editLayer.graphics.toArray().forEach((g: any, idx: number) => {
      if (isTextGraphic(g)) {
        labelsLayer.add(g.clone());
        return;
      }

      if (!isDrawableGraphic(g)) return;

      const geomType = g.geometry.type as DrawableGeometryType;
      const order = g.attributes?.order ?? idx;
      const color = getGraphicColor(g);
      const name = g.attributes?.name ?? defaultNameForGeometry(geomType);

      if (geomType === "polygon") {
        finalizedLayerRef.current!.add(
          new Graphic({
            geometry: g.geometry,
            symbol: buildPolygonSymbol(g, color) as any,
            attributes: { ...g.attributes, order, name, color },
            popupTemplate: g.popupTemplate ?? makePopupTemplate(),
          }),
        );
        return;
      }

      if (geomType === "polyline") {
        finalizedLayerRef.current!.add(
          new Graphic({
            geometry: g.geometry,
            symbol: buildPolylineSymbol(g, color) as any,
            attributes: {
              ...g.attributes,
              order,
              name,
              color,
              width:
                typeof (g.symbol as any)?.width === "number"
                  ? (g.symbol as any).width
                  : typeof g.attributes?.width === "number"
                    ? g.attributes.width
                    : 3,
              animation: normalizePolylineAnimation(g.attributes?.animation),
            },
            popupTemplate: g.popupTemplate ?? makePopupTemplate(),
          }),
        );
        return;
      }

      finalizedLayerRef.current!.add(
        new Graphic({
          geometry: g.geometry,
          symbol: buildPointSymbol(g, color) as any,
          attributes: {
            ...g.attributes,
            order,
            name,
            color,
            size:
              typeof (g.symbol as any)?.size === "number"
                ? (g.symbol as any).size
                : typeof g.attributes?.size === "number"
                  ? g.attributes.size
                  : 10,
          },
          popupTemplate: g.popupTemplate ?? makePopupTemplate(),
        }),
      );
    });

    editingLayerRef.current!.removeAll();
    labelMap.current.clear();

    emitFinalizedChange();
    finalizedLayerRef.events.dispatchEvent(new Event("change"));
    applyMapVisibility((MapViewRef.current as __esri.MapView | null)?.zoom);

    if (userEmail) {
      const s = settingsRef.current!;
      saveMapToServer(mapId, userEmail, {
        zoom: s.zoom,
        center: [s.center.x, s.center.y] as [number, number],
        constraints: s.constraints,
        featureLayers: s.featureLayers,
        mapTile: s.mapTile,
        baseMap: s.baseMap,
        apiSources: s.apiSources,
      });
    }

    if (sketchRef.current) {
      sketchRef.current.cancel();
      sketchRef.current.destroy();
      (MapViewRef.current as __esri.MapView).ui.remove(sketchRef.current);
      sketchRef.current = null;
    }

    setActive(false);
    activeRef.current = false;
  };

  useEffect(() => {
    const unsubscribe = subscribeDrawingCreation((creation) => {
      pendingCreationRef.current = creation;

      if (sketchRef.current && activeRef.current) {
        sketchRef.current.create(creation.geometryType);
        return;
      }

      toggleSketch();
    });

    const pending = peekPendingDrawingCreation();
    if (pending) {
      pendingCreationRef.current = pending;
    }

    return unsubscribe;
  });

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
