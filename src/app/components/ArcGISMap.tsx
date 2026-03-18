"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
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
  resortByZ,
} from "./map/arcgisRefs";
import "./ArcGISMap.css";
import EventCalendarOverlay from "./map/MapControls/EventCalendarOverlay";
import DynamicEventLoader from "./map/MapControls/DynamicEventLoader";
import TurnByTurnOverlay from "./map/MapControls/TurnByTurnOverlay";
import { rebuildBuckets, labelBuckets } from "./map/bucketManager";
import { toGraphic as toEventGraphic } from "./map/MapControls/eventsLayer";
import type {
  DrawingExport,
  EventPoint,
  FeatureLayerConfig,
  Label,
  PolylineAnimation,
} from "@/app/types/myTypes";
import { normalizePolylineAnimation } from "@/app/types/myTypes";

/* ─────────────────────────────────────────
 * Types
 * ───────────────────────────────────── */

type ArcGISMapProps = {
  userEmail: string;
  polygons: DrawingExport[];
  labels: Label[];
  events?: EventPoint[];
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
    mapTile: string | null;
    baseMap: string | null;
    apiSources: string[];
  };
};

type FacingDirection = "up" | "down" | "left" | "right";

type PictureMarkerAutocast = __esri.PictureMarkerSymbolProperties & {
  type: "picture-marker";
};

type RuntimeNode = {
  point: __esri.Point;
  originalVertexIndex: number;
};

type SpriteScheduleItem =
  | {
      kind: "pause";
      durationMs: number;
      point: __esri.Point;
      facing: FacingDirection;
      originalVertexIndex: number;
    }
  | {
      kind: "move";
      durationMs: number;
      from: __esri.Point;
      to: __esri.Point;
      facing: FacingDirection;
      originalSegmentIndex: number;
    };

type SpriteRuntime = {
  graphic: __esri.Graphic;
  animation: PolylineAnimation;
  schedule: SpriteScheduleItem[];
  cycleDurationMs: number;
  cycleOffsetMs: number;
  lastUrl: string;
};

const DEFAULT_FACING: FacingDirection = "down";
const SPRITE_BASE_SIZE_PX = 42;
const DEFAULT_BASEMAP = "arcgis/nova";

/* ─────────────────────────────────────────
 * Component
 * ───────────────────────────────────── */

export default function ArcGISMap(mapData: ArcGISMapProps) {
  const mapDiv = useRef<HTMLDivElement>(null);

  type ActiveOverlay = "calendar" | "turn" | null;
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>(null);
  const [viewReady, setViewReady] = useState(false);

  const storeListenerRef = useRef<EventListener | null>(null);
  const spriteAnimRef = useRef<number | null>(null);

  useEffect(() => {
    let destroyed = false;
    let viewRef: __esri.MapView | null = null;
    let pollId: number | null = null;

    setViewReady(false);

    const startArcGIS = () => {
      if (destroyed) return;

      const amd = (window as any).require;
      if (!amd) return;

      amd(
        [
          "esri/config",
          "esri/Map",
          "esri/views/MapView",
          "esri/Graphic",
          "esri/layers/GraphicsLayer",
          "esri/geometry/Extent",
          "esri/geometry/Point",
          "esri/geometry/Polygon",
          "esri/geometry/Polyline",
          "esri/geometry/support/webMercatorUtils",
          "esri/geometry/geometryEngine",
          "esri/layers/FeatureLayer",
          "esri/layers/WebTileLayer",
          "esri/widgets/Locate",
          "esri/widgets/Track",
          "esri/layers/TileLayer",
        ],
        (
          esriConfig: any,
          EsriMap: any,
          MapView: any,
          Graphic: any,
          GraphicsLayer: any,
          Extent: any,
          Point: typeof __esri.Point,
          Polygon: typeof __esri.Polygon,
          Polyline: typeof __esri.Polyline,
          webMercatorUtils: any,
          geometryEngine: any,
          FeatureLayer: any,
          WebTileLayer: any,
          Locate: any,
          Track: any,
          TileLayer: any,
        ) => {
          if (destroyed) return;

          const isLonLat = (x: number, y: number) =>
            Math.abs(x) <= 180 && Math.abs(y) <= 90;

          const toViewSR = (geom: __esri.Geometry | any): __esri.Geometry => {
            const wkid = geom?.spatialReference?.wkid;

            if (wkid === 3857 || wkid === 102100) return geom;

            if (wkid === 4326) {
              return webMercatorUtils.geographicToWebMercator(geom);
            }

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
                }),
              );
            }

            return geom;
          };

          const computeLabelPoint = (poly: __esri.Polygon): __esri.Point => {
            try {
              const p = geometryEngine.labelPoints(poly);
              if (p) {
                return new Point({
                  x: p.x,
                  y: p.y,
                  spatialReference: { wkid: 3857 },
                });
              }
            } catch {}

            const c1 = (poly as any).centroid;
            if (c1) {
              return new Point({
                x: c1.x,
                y: c1.y,
                spatialReference: { wkid: 3857 },
              });
            }

            if (poly.extent?.center) {
              return new Point({
                x: poly.extent.center.x,
                y: poly.extent.center.y,
                spatialReference: { wkid: 3857 },
              });
            }

            const ring = poly.rings?.[0] ?? [];
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

          const getFacing = (
            a: __esri.Point,
            b: __esri.Point,
          ): FacingDirection => {
            const dx = b.x - a.x;
            const dy = b.y - a.y;

            if (Math.abs(dx) >= Math.abs(dy)) {
              return dx >= 0 ? "right" : "left";
            }

            return dy >= 0 ? "up" : "down";
          };

          const lerpPoint = (
            a: __esri.Point,
            b: __esri.Point,
            t: number,
          ): __esri.Point =>
            new Point({
              x: a.x + (b.x - a.x) * t,
              y: a.y + (b.y - a.y) * t,
              spatialReference: { wkid: 3857 },
            });

          const getDirectionalFrames = (
            animation: PolylineAnimation,
            facing: FacingDirection,
          ): string[] => {
            const frames = animation.sprite.directionalFrames;
            const primary = frames[facing];

            if (Array.isArray(primary) && primary.length > 0) {
              return primary;
            }

            const fallbacks = [
              frames.down,
              frames.up,
              frames.left,
              frames.right,
            ].filter(
              (arr): arr is string[] => Array.isArray(arr) && arr.length > 0,
            );

            return fallbacks[0] ?? [];
          };

          const createSpriteSymbol = (
            url: string,
            animation: PolylineAnimation,
          ): PictureMarkerAutocast => {
            const sizePx = Math.max(
              1,
              SPRITE_BASE_SIZE_PX * animation.sprite.scale,
            );

            const xoffset = animation.sprite.offsetPxX;
            const yoffset =
              (animation.sprite.anchor === "bottom" ? sizePx / 2 : 0) +
              animation.sprite.offsetPxY;

            return {
              type: "picture-marker",
              url,
              width: `${sizePx}px`,
              height: `${sizePx}px`,
              xoffset: `${xoffset}px`,
              yoffset: `${yoffset}px`,
            };
          };

          const isHiddenSegment = (
            originalSegmentIndex: number,
            animation: PolylineAnimation,
          ): boolean => {
            return animation.behavior.hiddenSegments.some(
              (range) =>
                originalSegmentIndex >= range.startSegmentIndex &&
                originalSegmentIndex <= range.endSegmentIndex,
            );
          };

          const buildSpriteRuntime = (
            lineGraphic: __esri.Graphic,
            spriteLayer: __esri.GraphicsLayer,
          ): SpriteRuntime | null => {
            if (lineGraphic.geometry?.type !== "polyline") return null;

            const animation = normalizePolylineAnimation(
              lineGraphic.attributes?.animation,
            );

            if (!animation.enabled) return null;

            const anyFrames =
              animation.sprite.directionalFrames.up.length +
                animation.sprite.directionalFrames.down.length +
                animation.sprite.directionalFrames.left.length +
                animation.sprite.directionalFrames.right.length >
              0;

            if (!anyFrames) return null;

            const line = lineGraphic.geometry as __esri.Polyline;
            if (!Array.isArray(line.paths) || line.paths.length === 0)
              return null;

            const originalPath = line.paths[0];
            if (!Array.isArray(originalPath) || originalPath.length < 2)
              return null;

            const originalNodes = originalPath.map(
              (coords) =>
                new Point({
                  x: coords[0],
                  y: coords[1],
                  spatialReference: line.spatialReference,
                }),
            );

            const reversed = animation.motion.reverse === true;

            const displayNodes: RuntimeNode[] = reversed
              ? [...originalNodes].reverse().map((point, reversedIndex) => ({
                  point,
                  originalVertexIndex: originalNodes.length - 1 - reversedIndex,
                }))
              : originalNodes.map((point, originalIndex) => ({
                  point,
                  originalVertexIndex: originalIndex,
                }));

            const segmentLengths: number[] = [];
            let totalLength = 0;

            for (let i = 0; i < displayNodes.length - 1; i++) {
              const a = displayNodes[i].point;
              const b = displayNodes[i + 1].point;
              const len = Math.hypot(b.x - a.x, b.y - a.y);
              segmentLengths.push(len);
              totalLength += len;
            }

            if (totalLength <= 0) return null;

            const pauseByVertex = new Map<number, number>();
            for (const pause of animation.behavior.vertexPauses) {
              pauseByVertex.set(
                pause.vertexIndex,
                (pauseByVertex.get(pause.vertexIndex) ?? 0) +
                  Math.max(0, pause.durationMs),
              );
            }

            const schedule: SpriteScheduleItem[] = [];

            const initialPause =
              pauseByVertex.get(displayNodes[0].originalVertexIndex) ?? 0;
            const initialFacing =
              displayNodes.length > 1
                ? getFacing(displayNodes[0].point, displayNodes[1].point)
                : DEFAULT_FACING;

            if (initialPause > 0) {
              schedule.push({
                kind: "pause",
                durationMs: initialPause,
                point: displayNodes[0].point,
                facing: initialFacing,
                originalVertexIndex: displayNodes[0].originalVertexIndex,
              });
            }

            const motionDurationMs = Math.max(0, animation.motion.durationMs);

            for (let i = 0; i < displayNodes.length - 1; i++) {
              const fromNode = displayNodes[i];
              const toNode = displayNodes[i + 1];
              const segmentLength = segmentLengths[i];
              const moveDurationMs =
                totalLength > 0
                  ? (motionDurationMs * segmentLength) / totalLength
                  : 0;

              const originalSegmentIndex = reversed
                ? originalNodes.length - 2 - i
                : i;

              const facing = getFacing(fromNode.point, toNode.point);

              schedule.push({
                kind: "move",
                durationMs: moveDurationMs,
                from: fromNode.point,
                to: toNode.point,
                facing,
                originalSegmentIndex,
              });

              const pauseAfter =
                pauseByVertex.get(toNode.originalVertexIndex) ?? 0;

              if (pauseAfter > 0) {
                schedule.push({
                  kind: "pause",
                  durationMs: pauseAfter,
                  point: toNode.point,
                  facing,
                  originalVertexIndex: toNode.originalVertexIndex,
                });
              }
            }

            const cycleDurationMs = schedule.reduce(
              (sum, item) => sum + Math.max(0, item.durationMs),
              0,
            );

            if (schedule.length === 0) return null;

            const cycleOffsetMs =
              Math.min(1, Math.max(0, animation.motion.startProgress)) *
              Math.max(0, cycleDurationMs);

            const initialFrames = getDirectionalFrames(
              animation,
              initialFacing,
            );
            const initialUrl = initialFrames[0];
            if (!initialUrl) return null;

            const spriteGraphic = new Graphic({
              geometry: displayNodes[0].point,
              symbol: createSpriteSymbol(initialUrl, animation),
              visible: true,
            });

            spriteLayer.add(spriteGraphic);

            return {
              graphic: spriteGraphic,
              animation,
              schedule,
              cycleDurationMs,
              cycleOffsetMs,
              lastUrl: initialUrl,
            };
          };

          const resolveRuntimeState = (
            runtime: SpriteRuntime,
            elapsedMs: number,
          ): {
            point: __esri.Point;
            facing: FacingDirection;
            visible: boolean;
            finished: boolean;
          } => {
            const cycleDurationMs = Math.max(0, runtime.cycleDurationMs);
            const rawTime = Math.max(0, elapsedMs + runtime.cycleOffsetMs);

            let timelineMs = rawTime;
            let finished = false;

            if (runtime.animation.motion.loop) {
              timelineMs = cycleDurationMs > 0 ? rawTime % cycleDurationMs : 0;
            } else if (rawTime >= cycleDurationMs) {
              timelineMs = cycleDurationMs;
              finished = true;
            }

            if (runtime.schedule.length === 0) {
              return {
                point: runtime.graphic.geometry as __esri.Point,
                facing: DEFAULT_FACING,
                visible: true,
                finished: true,
              };
            }

            if (cycleDurationMs === 0) {
              const first = runtime.schedule[0];
              if (first.kind === "pause") {
                return {
                  point: first.point,
                  facing: first.facing,
                  visible: true,
                  finished,
                };
              }

              return {
                point: first.to,
                facing: first.facing,
                visible: !isHiddenSegment(
                  first.originalSegmentIndex,
                  runtime.animation,
                ),
                finished,
              };
            }

            let remaining = timelineMs;

            for (let i = 0; i < runtime.schedule.length; i++) {
              const item = runtime.schedule[i];
              const isLast = i === runtime.schedule.length - 1;

              if (remaining <= item.durationMs || isLast) {
                if (item.kind === "pause") {
                  return {
                    point: item.point,
                    facing: item.facing,
                    visible: true,
                    finished,
                  };
                }

                const t =
                  item.durationMs <= 0
                    ? 1
                    : Math.max(0, Math.min(1, remaining / item.durationMs));

                return {
                  point: lerpPoint(item.from, item.to, t),
                  facing: item.facing,
                  visible: !isHiddenSegment(
                    item.originalSegmentIndex,
                    runtime.animation,
                  ),
                  finished,
                };
              }

              remaining -= item.durationMs;
            }

            const lastItem = runtime.schedule[runtime.schedule.length - 1];
            if (lastItem.kind === "pause") {
              return {
                point: lastItem.point,
                facing: lastItem.facing,
                visible: true,
                finished: true,
              };
            }

            return {
              point: lastItem.to,
              facing: lastItem.facing,
              visible: !isHiddenSegment(
                lastItem.originalSegmentIndex,
                runtime.animation,
              ),
              finished: true,
            };
          };

          const resolveFrameUrl = (
            animation: PolylineAnimation,
            facing: FacingDirection,
            ts: number,
          ): string | null => {
            const frames = getDirectionalFrames(animation, facing);
            if (frames.length === 0) return null;

            const frameMs = Math.max(1, animation.sprite.frameMs);
            const frameIndex = Math.floor(ts / frameMs) % frames.length;
            return frames[frameIndex] ?? frames[0] ?? null;
          };

          esriConfig.apiKey =
            (window as any).__ARCGIS_API_KEY__ ||
            process.env.NEXT_PUBLIC_ARCGIS_API_KEY;

          const map = new EsriMap({
            basemap: mapData.settings.baseMap ?? DEFAULT_BASEMAP,
          });

          const [cx, cy] = mapData.settings.center;
          const centerPoint =
            Math.abs(cx) <= 180 && Math.abs(cy) <= 90
              ? webMercatorUtils.geographicToWebMercator(
                  new Point({
                    x: cx,
                    y: cy,
                    spatialReference: { wkid: 4326 },
                  }),
                )
              : new Point({ x: cx, y: cy, spatialReference: { wkid: 3857 } });

          const view: __esri.MapView = new MapView({
            container: mapDiv.current as HTMLDivElement,
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

          viewRef = view;
          MapViewRef.current = view;

          const popup = view.popup;
          if (popup) {
            popup.dockEnabled = false;
            popup.dockOptions = { breakpoint: false };
          }

          view.ui.move("zoom", "bottom-right");

          const locateWidget = new Locate({ view });
          locateWidget.goToOverride = (view: __esri.MapView, options: any) => {
            options.target.scale = 1500;
            return view.goTo(options.target);
          };
          view.ui.add(locateWidget, "top-right");

          const trackWidget = new Track({
            view,
            graphic: new Graphic({
              symbol: {
                type: "simple-marker",
                size: "12px",
                color: "green",
                outline: {
                  color: "#efefef",
                  width: "1.5px",
                },
              },
            }),
            useHeadingEnabled: true,
          });
          view.ui.add(trackWidget, "top-right");

          const editingLayer = new GraphicsLayer({ id: "editing" });
          const finalizedLayer = new GraphicsLayer({ id: "finalized" });
          const labelsLayer = new GraphicsLayer({ id: "labels" });
          const eventsLayer = new GraphicsLayer({
            id: "events-layer",
            title: "Campus Events",
            listMode: "show",
          });
          const spriteLayer = new GraphicsLayer({
            id: "sprite-layer",
            title: "Animated Sprites",
            listMode: "hide",
          });

          eventsLayerRef.current = eventsLayer;

          const tileSrc = mapData.settings.mapTile;

          const campusTiles =
            tileSrc && /\/MapServer\/?$/i.test(tileSrc)
              ? new TileLayer({
                  url: tileSrc,
                  id: "campus-tiles",
                  opacity: 1,
                })
              : tileSrc
                ? new WebTileLayer({
                    urlTemplate: tileSrc,
                    id: "campus-xyz",
                    opacity: 1,
                  })
                : null;

          if (campusTiles) {
            (campusTiles as any).z = 15;
          }

          (finalizedLayer as any).z = 30;
          (editingLayer as any).z = 40;
          (spriteLayer as any).z = 65;
          (eventsLayer as any).z = 75;
          (labelsLayer as any).z = 80;

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
            ...(campusTiles ? [campusTiles] : []),
            ...featureLayers,
            finalizedLayer,
            editingLayer,
            eventsLayer,
            spriteLayer,
            labelsLayer,
          ].filter(Boolean);

          map.addMany(allLayers);
          resortByZ(map);
          (map.layers as any).on("change", () => resortByZ(map));

          const applyLabelVisibility = (zoom: number) => {
            labelBuckets.forEach((bucket) => {
              const show = zoom >= bucket.minZoom && zoom <= bucket.maxZoom;
              bucket.labels.forEach((lbl) => {
                lbl.visible = show;
              });
            });
          };

          const rebuildAllLabelsFromPolygons = (
            savedLabelMap: globalThis.Map<string, Label>,
          ) => {
            labelsLayer.removeAll();

            finalizedLayer.graphics.toArray().forEach((polyG: any) => {
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

          const startDynamicSprites = () => {
            spriteLayer.removeAll();

            if (spriteAnimRef.current !== null) {
              window.cancelAnimationFrame(spriteAnimRef.current);
              spriteAnimRef.current = null;
            }

            const runtimes: SpriteRuntime[] = [];

            finalizedLayer.graphics.toArray().forEach((g: any) => {
              if (g.geometry?.type !== "polyline") return;

              const runtime = buildSpriteRuntime(g, spriteLayer);
              if (!runtime) return;

              const initialState = resolveRuntimeState(runtime, 0);
              runtime.graphic.geometry = initialState.point;
              runtime.graphic.visible = initialState.visible;

              const initialUrl = resolveFrameUrl(
                runtime.animation,
                initialState.facing,
                performance.now(),
              );

              if (initialUrl) {
                runtime.graphic.symbol = createSpriteSymbol(
                  initialUrl,
                  runtime.animation,
                );
                runtime.lastUrl = initialUrl;
              }

              runtimes.push(runtime);
            });

            if (runtimes.length === 0) return;

            const animatedRuntimes = runtimes.filter(
              (runtime) => runtime.animation.motion.autoPlay,
            );

            if (animatedRuntimes.length === 0) return;

            let startTs: number | null = null;

            const frame = (ts: number) => {
              if (destroyed) return;
              if (startTs === null) startTs = ts;

              const elapsed = ts - startTs;
              let shouldContinue = false;

              for (const runtime of animatedRuntimes) {
                const state = resolveRuntimeState(runtime, elapsed);

                runtime.graphic.geometry = state.point;
                runtime.graphic.visible = state.visible;

                const nextUrl = resolveFrameUrl(
                  runtime.animation,
                  state.facing,
                  ts,
                );

                if (nextUrl && nextUrl !== runtime.lastUrl) {
                  runtime.graphic.symbol = createSpriteSymbol(
                    nextUrl,
                    runtime.animation,
                  );
                  runtime.lastUrl = nextUrl;
                }

                if (
                  runtime.animation.motion.loop ||
                  elapsed + runtime.cycleOffsetMs < runtime.cycleDurationMs
                ) {
                  shouldContinue = true;
                }
              }

              if (shouldContinue) {
                spriteAnimRef.current = window.requestAnimationFrame(frame);
              } else {
                spriteAnimRef.current = null;
              }
            };

            spriteAnimRef.current = window.requestAnimationFrame(frame);
          };

          const data = {
            polygons: mapData.polygons || [],
            labels: mapData.labels || [],
            events: mapData.events || [],
          };

          (data.polygons || []).forEach((p) => {
            try {
              let rawGeom: __esri.Geometry;

              if (p.geometry.type === "polyline") {
                rawGeom = Polyline.fromJSON(p.geometry as any);
              } else if (p.geometry.type === "polygon") {
                rawGeom = Polygon.fromJSON(p.geometry as any);
              } else {
                rawGeom = new Point({
                  x: p.geometry.x,
                  y: p.geometry.y,
                  spatialReference: p.geometry.spatialReference,
                });
              }

              const projectedGeom = toViewSR(rawGeom) as __esri.Geometry;

              const attributes =
                p.geometry.type === "polyline"
                  ? {
                      ...p.attributes,
                      animation:
                        p.attributes?.animation != null
                          ? normalizePolylineAnimation(p.attributes.animation)
                          : p.attributes?.animation,
                    }
                  : p.attributes;

              const graphic = new Graphic({
                geometry: projectedGeom,
                symbol: p.symbol,
                attributes,
                popupTemplate: {
                  title: p.attributes.name,
                  content: p.attributes.description,
                },
              });

              finalizedLayer.add(graphic);
            } catch (e) {
              console.error("Failed to load drawing:", p, e);
            }
          });

          const savedLabelMap = new globalThis.Map<string, Label>();
          (data.labels || []).forEach((l) => {
            if (l?.attributes?.parentId) {
              savedLabelMap.set(l.attributes.parentId, l);
            }
          });

          rebuildAllLabelsFromPolygons(savedLabelMap);

          (data.events || []).forEach((ev) => {
            try {
              const srcPt = new Point({
                x: ev.geometry.x,
                y: ev.geometry.y,
                spatialReference: {
                  wkid: 4326,
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
                locationTag:
                  (ev.attributes.fullLocationTag ||
                    ev.attributes.location_at) ??
                  undefined,
                location: ev.attributes.location ?? undefined,
                location_at: ev.attributes.location_at ?? undefined,
                names: ev.attributes.names ?? undefined,
                original: ev.attributes.original ?? undefined,
                geometry: { x: pt3857.x, y: pt3857.y, wkid: 3857 },
                fromUser: ev.attributes.fromUser ?? false,
                iconSize: ev.attributes.iconSize ?? 36,
                iconUrl: ev.attributes.iconUrl ?? "/icons/event-pin.png",
                poster_url: ev.attributes.poster_url ?? undefined,
              };

              eventsLayer.add(toEventGraphic(Graphic, ce));
            } catch (e) {
              console.error("Failed to load event:", ev, e);
            }
          });

          view.when(() => {
            applyLabelVisibility(view.zoom);
            setViewReady(true);
            startDynamicSprites();
          });

          finalizedLayerRef.events.dispatchEvent(new Event("change"));

          editingLayerRef.current = editingLayer;
          setFinalizedLayer(finalizedLayer);
          setLabelsLayer(labelsLayer);
          GraphicRef.current = Graphic;

          for (const ev of eventsStore.items) {
            let finalEv = ev;

            try {
              if (ev.geometry.wkid === 4326) {
                const pt = new Point({
                  x: ev.geometry.x,
                  y: ev.geometry.y,
                  spatialReference: { wkid: 4326 },
                });

                const proj = toViewSR(pt) as __esri.Point;
                finalEv = {
                  ...ev,
                  geometry: { x: proj.x, y: proj.y, wkid: 3857 },
                };
              }

              eventsLayer.add(toEventGraphic(Graphic, finalEv));
            } catch (e) {
              console.error("Error loading store event", e);
            }
          }

          const onEventAdded = (e: Event) => {
            const custom = e as CustomEvent<CampusEvent>;
            const ev = custom.detail;
            if (!ev) return;

            try {
              let finalEv = ev;

              if (ev.geometry.wkid === 4326) {
                const pt = new Point({
                  x: ev.geometry.x,
                  y: ev.geometry.y,
                  spatialReference: { wkid: 4326 },
                });

                const proj = toViewSR(pt) as __esri.Point;
                finalEv = {
                  ...ev,
                  geometry: { x: proj.x, y: proj.y, wkid: 3857 },
                };
              }

              eventsLayer.add(toEventGraphic(Graphic, finalEv));
              console.log(
                "📍 Added new dynamic event to map:",
                finalEv.event_name,
              );
            } catch (err) {
              console.error("Error adding dynamic event to map:", err);
            }
          };

          eventsStore.events.addEventListener("added", onEventAdded);
          storeListenerRef.current = onEventAdded;

          view.watch("zoom", (z: number) => applyLabelVisibility(z));

          finalizedLayer.graphics.on("change", () => {
            const savedLabelMap2 = new globalThis.Map<string, Label>();

            labelsLayer.graphics.toArray().forEach((lbl: any) => {
              const att = lbl.attributes;
              if (att?.parentId) {
                savedLabelMap2.set(att.parentId, {
                  attributes: att,
                  geometry: {
                    type: "point",
                    x: lbl.geometry.x,
                    y: lbl.geometry.y,
                    spatialReference: { wkid: 3857, latestWkid: 3857 },
                  },
                } as Label);
              }
            });

            rebuildAllLabelsFromPolygons(savedLabelMap2);
            startDynamicSprites();
          });
        },
      );
    };

    if ((window as any).require) {
      startArcGIS();
    } else {
      let tries = 0;

      pollId = window.setInterval(() => {
        if (destroyed) {
          if (pollId !== null) {
            window.clearInterval(pollId);
            pollId = null;
          }
          return;
        }

        if ((window as any).require) {
          if (pollId !== null) {
            window.clearInterval(pollId);
            pollId = null;
          }
          startArcGIS();
        } else if (tries++ > 200) {
          if (pollId !== null) {
            window.clearInterval(pollId);
            pollId = null;
          }
          console.error("ArcGIS AMD loader not available after waiting.");
        }
      }, 100) as unknown as number;
    }

    return () => {
      destroyed = true;

      if (pollId !== null) {
        window.clearInterval(pollId);
        pollId = null;
      }

      if (spriteAnimRef.current !== null) {
        window.cancelAnimationFrame(spriteAnimRef.current);
        spriteAnimRef.current = null;
      }

      if (storeListenerRef.current) {
        eventsStore.events.removeEventListener(
          "added",
          storeListenerRef.current,
        );
        storeListenerRef.current = null;
      }

      if (viewRef) {
        viewRef.destroy();
        viewRef = null;
        MapViewRef.current = null as any;
        eventsLayerRef.current = null as any;
        GraphicRef.current = null as any;
        setViewReady(false);
      }
    };
  }, [mapData]);

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

      {viewReady && (
        <DynamicEventLoader
          eventSources={mapData.eventSources ?? []}
          refreshMs={3000}
        />
      )}

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

      <EventCalendarOverlay
        expanded={activeOverlay === "calendar"}
        onClose={() => setActiveOverlay(null)}
      />

      <div
        style={{
          ...turnWrap,
          display: activeOverlay === "turn" ? "block" : "none",
          pointerEvents: activeOverlay === "turn" ? "auto" : "none",
        }}
      >
        <TurnByTurnOverlay viewReady={viewReady} />
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
    </div>
  );
}

/* ───────── Styles ───────── */

const dockWrap: CSSProperties = {
  position: "absolute",
  top: 5,
  left: 5,
  zIndex: 2000,
  pointerEvents: "auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const launcherBase: CSSProperties = {
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

const launcherActive: CSSProperties = {
  borderColor: "#2775ff",
  boxShadow: "0 0 0 3px rgba(39,117,255,0.25), 0 8px 22px rgba(0,0,0,0.22)",
};

const turnWrap: CSSProperties = {
  position: "absolute",
  top: 5,
  left: 55,
  zIndex: 1000,
  pointerEvents: "auto",
};

const closeTurnBtn: CSSProperties = {
  border: "none",
  background: "#fff",
  borderRadius: 8,
  cursor: "pointer",
  padding: "4px 8px",
  fontWeight: 700,
};

// "use client";

// import { useEffect, useRef, useState } from "react";
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
//   resortByZ,
// } from "./map/arcgisRefs";
// import "./ArcGISMap.css";
// import EventCalendarOverlay from "./map/MapControls/EventCalendarOverlay";
// import DynamicEventLoader from "./map/MapControls/DynamicEventLoader";
// import TurnByTurnOverlay from "./map/MapControls/TurnByTurnOverlay";
// import { rebuildBuckets, labelBuckets } from "./map/bucketManager";
// import { toGraphic as toEventGraphic } from "./map/MapControls/eventsLayer";

// /* ─────────────────────────────────────────
//  * Types from API payload & Sprite Config
//  * ───────────────────────────────────── */

// interface SpatialReference {
//   wkid: number;
//   latestWkid?: number;
// }

// type DrawingDTO = {
//   attributes: Record<string, any>;
//   geometry:
//     | {
//         type: "polygon";
//         rings: number[][][];
//         spatialReference: SpatialReference;
//       }
//     | {
//         type: "polyline";
//         paths: number[][][];
//         spatialReference: SpatialReference;
//       }
//     | {
//         type: "point";
//         x: number;
//         y: number;
//         spatialReference: SpatialReference;
//       };
//   symbol:
//     | {
//         type: "simple-fill";
//         color: number[];
//         outline: { color: number[]; width: number };
//       }
//     | {
//         type: "simple-line";
//         color: number[];
//         width: number;
//       }
//     | {
//         type: "simple-marker";
//         color: number[];
//         size: number;
//         outline: { color: number[]; width: number };
//       };
// };

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
//     fullLocationTag?: string | null;
//     location?: string | null;
//     location_at?: string | null;
//     names?: string[] | null;
//     original?: any | null;
//     fromUser: boolean;
//     iconSize?: number;
//     iconUrl?: string;
//     poster_url?: string;
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
//   polygons: DrawingDTO[]; // includes polygons + polylines + points
//   labels: LabelDTO[];
//   events?: EventPointDTO[];
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
//     mapTile: string | null;
//     baseMap: string;
//     apiSources: string[];
//   };
// }

// type FacingDirection = "up" | "down" | "left" | "right";

// const SPRITE_FRAMES = {
//   up: [
//     "/sprites/bobcat/up/up-1.png",
//     "/sprites/bobcat/up/up-2.png",
//     "/sprites/bobcat/up/up-3.png",
//     "/sprites/bobcat/up/up-4.png",
//   ],
//   down: [
//     "/sprites/bobcat/down/down-1.png",
//     "/sprites/bobcat/down/down-2.png",
//     "/sprites/bobcat/down/down-3.png",
//     "/sprites/bobcat/down/down-4.png",
//   ],
//   left: [
//     "/sprites/bobcat/left/left-1.png",
//     "/sprites/bobcat/left/left-2.png",
//     "/sprites/bobcat/left/left-3.png",
//     "/sprites/bobcat/left/left-4.png",
//   ],
//   right: [
//     "/sprites/bobcat/right/right-1.png",
//     "/sprites/bobcat/right/right-2.png",
//     "/sprites/bobcat/right/right-3.png",
//     "/sprites/bobcat/right/right-4.png",
//   ],
// } as const;

// const SPRITE_DURATION_MS = 300000 / 15;
// const SPRITE_FRAME_MS = 120;
// const SNAP_TOLERANCE_METERS = 5;

// /* ─────────────────────────────────────────
//  * Component
//  * ───────────────────────────────────── */

// export default function ArcGISMap(mapData: ExportBody) {
//   const mapDiv = useRef<HTMLDivElement>(null);

//   type ActiveOverlay = "calendar" | "turn" | null;
//   const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>(null);
//   const [viewReady, setViewReady] = useState(false);

//   const storeListenerRef = useRef<EventListener | null>(null);
//   const spriteAnimRef = useRef<number | null>(null);

//   useEffect(() => {
//     let destroyed = false;
//     let viewRef: __esri.MapView | null = null;
//     let pollId: number | null = null;

//     setViewReady(false);

//     const startArcGIS = () => {
//       if (destroyed) return;

//       const amd = (window as any).require;
//       if (!amd) return;

//       amd(
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
//           "esri/geometry/Polyline",
//           "esri/geometry/support/webMercatorUtils",
//           "esri/geometry/geometryEngine",
//           "esri/layers/FeatureLayer",
//           "esri/layers/WebTileLayer",
//           "esri/widgets/Locate",
//           "esri/widgets/Track",
//           "esri/layers/TileLayer",
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
//           Polyline: typeof __esri.Polyline,
//           webMercatorUtils: any,
//           geometryEngine: any,
//           FeatureLayer: any,
//           WebTileLayer: any,
//           Locate: any,
//           Track: any,
//           TileLayer: any,
//         ) => {
//           if (destroyed) return;

//           const isLonLat = (x: number, y: number) =>
//             Math.abs(x) <= 180 && Math.abs(y) <= 90;

//           const toViewSR = (geom: __esri.Geometry | any): __esri.Geometry => {
//             const wkid = geom?.spatialReference?.wkid;

//             if (wkid === 3857 || wkid === 102100) return geom;

//             if (wkid === 4326) {
//               return webMercatorUtils.geographicToWebMercator(geom);
//             }

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
//                 }),
//               );
//             }

//             return geom;
//           };

//           const computeLabelPoint = (poly: __esri.Polygon): __esri.Point => {
//             try {
//               const p = geometryEngine.labelPoints(poly);
//               if (p) {
//                 return new Point({
//                   x: p.x,
//                   y: p.y,
//                   spatialReference: { wkid: 3857 },
//                 });
//               }
//             } catch {}

//             const c1 = (poly as any).centroid;
//             if (c1) {
//               return new Point({
//                 x: c1.x,
//                 y: c1.y,
//                 spatialReference: { wkid: 3857 },
//               });
//             }

//             if (poly.extent?.center) {
//               return new Point({
//                 x: poly.extent.center.x,
//                 y: poly.extent.center.y,
//                 spatialReference: { wkid: 3857 },
//               });
//             }

//             const ring = poly.rings?.[0] ?? [];
//             let minX = Infinity;
//             let maxX = -Infinity;
//             let minY = Infinity;
//             let maxY = -Infinity;

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

//           const createSpriteSymbol = (url: string) => ({
//             type: "picture-marker",
//             url,
//             width: "42px",
//             height: "42px",
//             yoffset: "14px",
//           });

//           const getFacing = (
//             a: __esri.Point,
//             b: __esri.Point,
//           ): FacingDirection => {
//             const dx = b.x - a.x;
//             const dy = b.y - a.y;

//             if (Math.abs(dx) >= Math.abs(dy)) {
//               return dx >= 0 ? "right" : "left";
//             }

//             return dy >= 0 ? "up" : "down";
//           };

//           const lerpPoint = (
//             a: __esri.Point,
//             b: __esri.Point,
//             t: number,
//           ): __esri.Point =>
//             new Point({
//               x: a.x + (b.x - a.x) * t,
//               y: a.y + (b.y - a.y) * t,
//               spatialReference: { wkid: 3857 },
//             });

//           esriConfig.apiKey =
//             (window as any).__ARCGIS_API_KEY__ ||
//             process.env.NEXT_PUBLIC_ARCGIS_API_KEY;

//           const map = new EsriMap({ basemap: mapData.settings.baseMap });

//           const [cx, cy] = mapData.settings.center;
//           const centerPoint =
//             Math.abs(cx) <= 180 && Math.abs(cy) <= 90
//               ? webMercatorUtils.geographicToWebMercator(
//                   new Point({
//                     x: cx,
//                     y: cy,
//                     spatialReference: { wkid: 4326 },
//                   }),
//                 )
//               : new Point({ x: cx, y: cy, spatialReference: { wkid: 3857 } });

//           const view: __esri.MapView = new MapView({
//             container: mapDiv.current as HTMLDivElement,
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

//           viewRef = view;
//           MapViewRef.current = view;

//           const popup = view.popup;
//           if (popup) {
//             popup.dockEnabled = false;
//             popup.dockOptions = { breakpoint: false };
//           }

//           view.ui.move("zoom", "bottom-right");

//           const locateWidget = new Locate({ view });
//           locateWidget.goToOverride = (view: __esri.MapView, options: any) => {
//             options.target.scale = 1500;
//             return view.goTo(options.target);
//           };
//           view.ui.add(locateWidget, "top-right");

//           const trackWidget = new Track({
//             view,
//             graphic: new Graphic({
//               symbol: {
//                 type: "simple-marker",
//                 size: "12px",
//                 color: "green",
//                 outline: {
//                   color: "#efefef",
//                   width: "1.5px",
//                 },
//               },
//             }),
//             useHeadingEnabled: true,
//           });
//           view.ui.add(trackWidget, "top-right");

//           /* Layers */
//           const editingLayer = new GraphicsLayer({ id: "editing" });
//           const finalizedLayer = new GraphicsLayer({ id: "finalized" });
//           const labelsLayer = new GraphicsLayer({ id: "labels" });
//           const eventsLayer = new GraphicsLayer({
//             id: "events-layer",
//             title: "Campus Events",
//             listMode: "show",
//           });
//           const spriteLayer = new GraphicsLayer({
//             id: "sprite-layer",
//             title: "Animated Sprite",
//             listMode: "hide",
//           });

//           eventsLayerRef.current = eventsLayer;

//           const tileSrc = mapData.settings.mapTile;

//           const campusTiles =
//             tileSrc && /\/MapServer\/?$/i.test(tileSrc)
//               ? new TileLayer({
//                   url: tileSrc,
//                   id: "campus-tiles",
//                   opacity: 1,
//                 })
//               : tileSrc
//                 ? new WebTileLayer({
//                     urlTemplate: tileSrc,
//                     id: "campus-xyz",
//                     opacity: 1,
//                   })
//                 : null;

//           const mediaLayer = new (MediaLayer as any)({
//             source: [
//               new ImageElement({
//                 image:
//                   "https://campusmap.ucmercedhub.com/maps/images/rufa/rufa-mini.png",
//                 georeference: new ExtentAndRotationGeoreference({
//                   extent: new Extent({
//                     xmin: -13406409.47,
//                     ymin: 4488936.09,
//                     xmax: -13404924.08,
//                     ymax: 4490876.39,
//                     spatialReference: { wkid: 102100 },
//                   }),
//                   rotation: 0,
//                 }),
//               }),
//             ],
//           });

//           (mediaLayer as any).z = 20;
//           if (campusTiles) {
//             (campusTiles as any).z = 15;
//           }

//           (finalizedLayer as any).z = 30;
//           (editingLayer as any).z = 40;
//           (spriteLayer as any).z = 65;
//           (eventsLayer as any).z = 75;
//           (labelsLayer as any).z = 80;

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
//             ...(campusTiles ? [campusTiles] : []),
//             ...featureLayers,
//             finalizedLayer,
//             editingLayer,
//             eventsLayer,
//             spriteLayer,
//             labelsLayer,
//           ].filter(Boolean);

//           map.addMany(allLayers);
//           resortByZ(map);
//           (map.layers as any).on("change", () => resortByZ(map));

//           /* Labels visibility */
//           const applyLabelVisibility = (zoom: number) => {
//             labelBuckets.forEach((bucket) => {
//               const show = zoom >= bucket.minZoom && zoom <= bucket.maxZoom;
//               bucket.labels.forEach((lbl) => {
//                 lbl.visible = show;
//               });
//             });
//           };

//           /* Build labels from polygons only */
//           const rebuildAllLabelsFromPolygons = (
//             savedLabelMap: globalThis.Map<string, LabelDTO>,
//           ) => {
//             labelsLayer.removeAll();

//             finalizedLayer.graphics.toArray().forEach((polyG: any) => {
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

//           /* ─────────────────────────────────────────
//            * Multi-Sprite Dynamic Animation
//            * ───────────────────────────────────── */
//           const startDynamicSprites = () => {
//             spriteLayer.removeAll();

//             if (spriteAnimRef.current !== null) {
//               window.cancelAnimationFrame(spriteAnimRef.current);
//               spriteAnimRef.current = null;
//             }

//             const activeSpritesData: any[] = [];
//             const pointGraphics: __esri.Graphic[] = [];
//             const polylineGraphics: __esri.Graphic[] = [];

//             // 1. Separate points and polylines from the drawn data
//             finalizedLayer.graphics.forEach((g: any) => {
//               if (g.geometry?.type === "point") pointGraphics.push(g);
//               if (g.geometry?.type === "polyline") polylineGraphics.push(g);
//             });

//             // 2. Find paths for each point based on snapping
//             pointGraphics.forEach((ptG) => {
//               const pt = ptG.geometry as __esri.Point;
//               let matchedPolyline: __esri.Polyline | null = null;
//               let minDistance = Infinity;

//               // Check distance against all polylines
//               for (const lineG of polylineGraphics) {
//                 const line = lineG.geometry as __esri.Polyline;
//                 try {
//                   const dist = geometryEngine.distance(pt, line, "meters");
//                   if (
//                     dist !== null &&
//                     dist <= SNAP_TOLERANCE_METERS &&
//                     dist < minDistance
//                   ) {
//                     minDistance = dist;
//                     matchedPolyline = line;
//                   }
//                 } catch (e) {
//                   // Ignore mismatching SRs or geometry engine errors
//                 }
//               }

//               // Hide original point graphic so the sprite is the only thing visible
//               ptG.visible = false;

//               if (matchedPolyline && matchedPolyline.paths.length > 0) {
//                 // Point snapped to a polyline -> animate it along the path
//                 const pathCoords = matchedPolyline.paths[0];
//                 const pathNodes = pathCoords.map(
//                   (c) =>
//                     new Point({
//                       x: c[0],
//                       y: c[1],
//                       spatialReference: matchedPolyline!.spatialReference,
//                     }),
//                 );

//                 const segmentLengths: number[] = [];
//                 let totalLength = 0;

//                 for (let i = 0; i < pathNodes.length - 1; i++) {
//                   const a = pathNodes[i];
//                   const b = pathNodes[i + 1];
//                   const len = Math.hypot(b.x - a.x, b.y - a.y);
//                   segmentLengths.push(len);
//                   totalLength += len;
//                 }

//                 if (totalLength > 0) {
//                   const spriteGraphic = new Graphic({
//                     geometry: pathNodes[0],
//                     symbol: createSpriteSymbol(SPRITE_FRAMES.down[0]),
//                   });
//                   spriteLayer.add(spriteGraphic);

//                   activeSpritesData.push({
//                     graphic: spriteGraphic,
//                     pathNodes,
//                     segmentLengths,
//                     totalLength,
//                     lastUrl: "",
//                   });
//                 }
//               } else {
//                 // Point did NOT snap -> render as a stationary sprite
//                 const spriteGraphic = new Graphic({
//                   geometry: pt,
//                   symbol: createSpriteSymbol(SPRITE_FRAMES.down[0]),
//                 });
//                 spriteLayer.add(spriteGraphic);
//               }
//             });

//             // 3. Unified Animation Loop
//             let startTs: number | null = null;
//             const frame = (ts: number) => {
//               if (destroyed) return;
//               if (startTs === null) startTs = ts;

//               const elapsed = (ts - startTs) % SPRITE_DURATION_MS;

//               activeSpritesData.forEach((sprite) => {
//                 const targetDistance =
//                   (elapsed / SPRITE_DURATION_MS) * sprite.totalLength;
//                 let walked = 0;
//                 let segIndex = 0;

//                 while (
//                   segIndex < sprite.segmentLengths.length - 1 &&
//                   walked + sprite.segmentLengths[segIndex] < targetDistance
//                 ) {
//                   walked += sprite.segmentLengths[segIndex];
//                   segIndex++;
//                 }

//                 const fromNode = sprite.pathNodes[segIndex];
//                 const toNode = sprite.pathNodes[segIndex + 1];
//                 const segLen = sprite.segmentLengths[segIndex] || 1;
//                 const t = Math.max(
//                   0,
//                   Math.min(1, (targetDistance - walked) / segLen),
//                 );

//                 sprite.graphic.geometry = lerpPoint(fromNode, toNode, t);

//                 const facing = getFacing(fromNode, toNode);
//                 const frames = SPRITE_FRAMES[facing];
//                 const frameIndex =
//                   Math.floor(ts / SPRITE_FRAME_MS) % frames.length;
//                 const nextUrl = frames[frameIndex];

//                 if (nextUrl !== sprite.lastUrl) {
//                   sprite.graphic.symbol = createSpriteSymbol(nextUrl);
//                   sprite.lastUrl = nextUrl;
//                 }
//               });

//               spriteAnimRef.current = window.requestAnimationFrame(frame);
//             };

//             if (activeSpritesData.length > 0) {
//               spriteAnimRef.current = window.requestAnimationFrame(frame);
//             }
//           };

//           /* Initial data load */
//           const data = {
//             polygons: mapData.polygons || [],
//             labels: mapData.labels || [],
//             events: mapData.events || [],
//           };

//           (data.polygons || []).forEach((p) => {
//             try {
//               let rawGeom: __esri.Geometry;

//               if (p.geometry.type === "polyline") {
//                 rawGeom = Polyline.fromJSON(p.geometry as any);
//               } else if (p.geometry.type === "polygon") {
//                 rawGeom = Polygon.fromJSON(p.geometry as any);
//               } else {
//                 rawGeom = new Point({
//                   x: p.geometry.x,
//                   y: p.geometry.y,
//                   spatialReference: p.geometry.spatialReference,
//                 });
//               }

//               const projectedGeom = toViewSR(rawGeom) as __esri.Geometry;

//               const graphic = new Graphic({
//                 geometry: projectedGeom,
//                 symbol: p.symbol,
//                 attributes: p.attributes,
//                 popupTemplate: {
//                   title: p.attributes.name,
//                   content: p.attributes.description,
//                 },
//               });

//               finalizedLayer.add(graphic);
//             } catch (e) {
//               console.error("Failed to load drawing:", p, e);
//             }
//           });

//           const savedLabelMap = new globalThis.Map<string, LabelDTO>();
//           (data.labels || []).forEach((l) => {
//             if (l?.attributes?.parentId) {
//               savedLabelMap.set(l.attributes.parentId, l);
//             }
//           });

//           rebuildAllLabelsFromPolygons(savedLabelMap);

//           (data.events || []).forEach((ev) => {
//             try {
//               const srcPt = new Point({
//                 x: ev.geometry.x,
//                 y: ev.geometry.y,
//                 spatialReference: {
//                   wkid: 4326,
//                 },
//               });

//               const pt3857 = toViewSR(srcPt) as __esri.Point;

//               const ce: CampusEvent = {
//                 id: ev.attributes.id || `evt-${Date.now()}`,
//                 event_name: ev.attributes.event_name || "Event",
//                 description: ev.attributes.description ?? undefined,
//                 date: ev.attributes.date ?? undefined,
//                 startAt: ev.attributes.startAt ?? undefined,
//                 endAt: ev.attributes.endAt ?? undefined,
//                 locationTag:
//                   (ev.attributes.fullLocationTag ||
//                     ev.attributes.location_at) ??
//                   undefined,
//                 location: ev.attributes.location ?? undefined,
//                 location_at: ev.attributes.location_at ?? undefined,
//                 names: ev.attributes.names ?? undefined,
//                 original: ev.attributes.original ?? undefined,
//                 geometry: { x: pt3857.x, y: pt3857.y, wkid: 3857 },
//                 fromUser: ev.attributes.fromUser,
//                 iconSize: ev.attributes.iconSize ?? 36,
//                 iconUrl: ev.attributes.iconUrl ?? "/icons/event-pin.png",
//                 poster_url: ev.attributes.poster_url,
//               };

//               eventsLayer.add(toEventGraphic(Graphic, ce));
//             } catch (e) {
//               console.error("Failed to load event:", ev, e);
//             }
//           });

//           view.when(async () => {
//             applyLabelVisibility(view.zoom);
//             setViewReady(true);

//             // Start the sprite logic once the map is loaded
//             startDynamicSprites();
//           });

//           finalizedLayerRef.events.dispatchEvent(new Event("change"));

//           editingLayerRef.current = editingLayer;
//           setFinalizedLayer(finalizedLayer);
//           setLabelsLayer(labelsLayer);
//           GraphicRef.current = Graphic;

//           for (const ev of eventsStore.items) {
//             let finalEv = ev;

//             try {
//               if (ev.geometry.wkid === 4326) {
//                 const pt = new Point({
//                   x: ev.geometry.x,
//                   y: ev.geometry.y,
//                   spatialReference: { wkid: 4326 },
//                 });

//                 const proj = toViewSR(pt) as __esri.Point;
//                 finalEv = {
//                   ...ev,
//                   geometry: { x: proj.x, y: proj.y, wkid: 3857 },
//                 };
//               }

//               eventsLayer.add(toEventGraphic(Graphic, finalEv));
//             } catch (e) {
//               console.error("Error loading store event", e);
//             }
//           }

//           const onEventAdded = (e: Event) => {
//             const custom = e as CustomEvent<CampusEvent>;
//             const ev = custom.detail;
//             if (!ev) return;

//             try {
//               let finalEv = ev;

//               if (ev.geometry.wkid === 4326) {
//                 const pt = new Point({
//                   x: ev.geometry.x,
//                   y: ev.geometry.y,
//                   spatialReference: { wkid: 4326 },
//                 });

//                 const proj = toViewSR(pt) as __esri.Point;
//                 finalEv = {
//                   ...ev,
//                   geometry: { x: proj.x, y: proj.y, wkid: 3857 },
//                 };
//               }

//               eventsLayer.add(toEventGraphic(Graphic, finalEv));
//               console.log(
//                 "📍 Added new dynamic event to map:",
//                 finalEv.event_name,
//               );
//             } catch (err) {
//               console.error("Error adding dynamic event to map:", err);
//             }
//           };

//           eventsStore.events.addEventListener("added", onEventAdded);
//           storeListenerRef.current = onEventAdded;

//           view.watch("zoom", (z: number) => applyLabelVisibility(z));

//           finalizedLayer.graphics.on("change", () => {
//             const savedLabelMap2 = new globalThis.Map<string, LabelDTO>();

//             labelsLayer.graphics.toArray().forEach((lbl: any) => {
//               const att = lbl.attributes;
//               if (att?.parentId) {
//                 savedLabelMap2.set(att.parentId, {
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

//             rebuildAllLabelsFromPolygons(savedLabelMap2);

//             // Re-calculate sprites whenever graphics are added or removed
//             startDynamicSprites();
//           });
//         },
//       );
//     };

//     if ((window as any).require) {
//       startArcGIS();
//     } else {
//       let tries = 0;

//       pollId = window.setInterval(() => {
//         if (destroyed) {
//           if (pollId !== null) {
//             window.clearInterval(pollId);
//             pollId = null;
//           }
//           return;
//         }

//         if ((window as any).require) {
//           if (pollId !== null) {
//             window.clearInterval(pollId);
//             pollId = null;
//           }
//           startArcGIS();
//         } else if (tries++ > 200) {
//           if (pollId !== null) {
//             window.clearInterval(pollId);
//             pollId = null;
//           }
//           console.error("ArcGIS AMD loader not available after waiting.");
//         }
//       }, 100) as unknown as number;
//     }

//     return () => {
//       destroyed = true;

//       if (pollId !== null) {
//         window.clearInterval(pollId);
//         pollId = null;
//       }

//       if (spriteAnimRef.current !== null) {
//         window.cancelAnimationFrame(spriteAnimRef.current);
//         spriteAnimRef.current = null;
//       }

//       if (storeListenerRef.current) {
//         eventsStore.events.removeEventListener(
//           "added",
//           storeListenerRef.current,
//         );
//         storeListenerRef.current = null;
//       }

//       if (viewRef) {
//         viewRef.destroy();
//         viewRef = null;
//         MapViewRef.current = null as any;
//         eventsLayerRef.current = null as any;
//         GraphicRef.current = null as any;
//         setViewReady(false);
//       }
//     };
//   }, [mapData]);

//   const toggleCalendar = () => {
//     setActiveOverlay((cur) => (cur === "calendar" ? null : "calendar"));
//   };

//   const toggleTurn = () => {
//     setActiveOverlay((cur) => (cur === "turn" ? null : "turn"));
//   };

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

//       {viewReady && (
//         <DynamicEventLoader eventSources={mapData.eventSources ?? []} />
//       )}

//       <div style={dockWrap}>
//         <button
//           type="button"
//           aria-label="Calendar filters"
//           title="Calendar filters"
//           aria-pressed={activeOverlay === "calendar"}
//           onClick={toggleCalendar}
//           style={{
//             ...launcherBase,
//             ...(activeOverlay === "calendar" ? launcherActive : null),
//           }}
//         >
//           📅
//         </button>

//         <button
//           type="button"
//           aria-label="Turn-by-turn directions"
//           title="Turn-by-turn directions"
//           aria-pressed={activeOverlay === "turn"}
//           onClick={toggleTurn}
//           style={{
//             ...launcherBase,
//             marginTop: 11,
//             ...(activeOverlay === "turn" ? launcherActive : null),
//           }}
//         >
//           🧭
//         </button>
//       </div>

//       <EventCalendarOverlay
//         expanded={activeOverlay === "calendar"}
//         onClose={() => setActiveOverlay(null)}
//       />

//       <div
//         style={{
//           ...turnWrap,
//           display: activeOverlay === "turn" ? "block" : "none",
//           pointerEvents: activeOverlay === "turn" ? "auto" : "none",
//         }}
//       >
//         <TurnByTurnOverlay viewReady={viewReady} />
//         <div style={{ position: "absolute", top: 5, right: 5, zIndex: 9999 }}>
//           <button
//             onClick={() => setActiveOverlay(null)}
//             style={closeTurnBtn}
//             title="Close"
//           >
//             ⤫
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ───────── Styles ───────── */

// const dockWrap: React.CSSProperties = {
//   position: "absolute",
//   top: 5,
//   left: 5,
//   zIndex: 2000,
//   pointerEvents: "auto",
//   display: "flex",
//   flexDirection: "column",
//   alignItems: "center",
// };

// const launcherBase: React.CSSProperties = {
//   width: 44,
//   height: 44,
//   borderRadius: "50%",
//   border: "4px solid #000000ff",
//   background: "white",
//   boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
//   cursor: "pointer",
//   fontSize: 20,
//   display: "flex",
//   alignItems: "center",
//   justifyContent: "center",
// };

// const launcherActive: React.CSSProperties = {
//   borderColor: "#2775ff",
//   boxShadow: "0 0 0 3px rgba(39,117,255,0.25), 0 8px 22px rgba(0,0,0,0.22)",
// };

// const turnWrap: React.CSSProperties = {
//   position: "absolute",
//   top: 5,
//   left: 55,
//   zIndex: 1000,
//   pointerEvents: "auto",
// };

// const closeTurnBtn: React.CSSProperties = {
//   border: "none",
//   background: "#fff",
//   borderRadius: 8,
//   cursor: "pointer",
//   padding: "4px 8px",
//   fontWeight: 700,
// };
// "use client";

// import { useEffect, useRef, useState } from "react";
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
//   resortByZ,
// } from "./map/arcgisRefs";
// import "./ArcGISMap.css";
// import EventCalendarOverlay from "./map/MapControls/EventCalendarOverlay";
// import DynamicEventLoader from "./map/MapControls/DynamicEventLoader";
// import TurnByTurnOverlay from "./map/MapControls/TurnByTurnOverlay";
// import { rebuildBuckets, labelBuckets } from "./map/bucketManager";
// import { toGraphic as toEventGraphic } from "./map/MapControls/eventsLayer";

// /* ─────────────────────────────────────────
//  * Types from API payload
//  * ───────────────────────────────────── */

// interface SpatialReference {
//   wkid: number;
//   latestWkid: number;
// }

// type DrawingDTO = {
//   attributes: Record<string, any>;
//   geometry:
//     | {
//         type: "polygon";
//         rings: number[][][];
//         spatialReference: SpatialReference;
//       }
//     | {
//         type: "polyline";
//         paths: number[][][];
//         spatialReference: SpatialReference;
//       }
//     | {
//         type: "point";
//         x: number;
//         y: number;
//         spatialReference: SpatialReference;
//       };
//   symbol:
//     | {
//         type: "simple-fill";
//         color: number[];
//         outline: { color: number[]; width: number };
//       }
//     | {
//         type: "simple-line";
//         color: number[];
//         width: number;
//       }
//     | {
//         type: "simple-marker";
//         color: number[];
//         size: number;
//         outline: { color: number[]; width: number };
//       };
// };

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
//     fullLocationTag?: string | null;
//     location?: string | null;
//     location_at?: string | null;
//     names?: string[] | null;
//     original?: any | null;
//     fromUser: boolean;
//     iconSize?: number;
//     iconUrl?: string;
//     poster_url?: string;
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
//   polygons: DrawingDTO[]; // includes polygons + polylines + points
//   labels: LabelDTO[];
//   events?: EventPointDTO[];
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
//     mapTile: string | null;
//     baseMap: string;
//     apiSources: string[];
//   };
// }

// /* ─────────────────────────────────────────
//  * Sprite GeoJSON config
//  * ───────────────────────────────────── */

// type SupportedWkid = 4326 | 3857 | 102100;
// type PathPointId = string | number;

// type SpriteRoutePointFeature = {
//   type: "Feature";
//   id?: PathPointId;
//   geometry: {
//     type: "Point";
//     coordinates: [number, number];
//   };
//   properties: {
//     kind: "path-point";
//     order: number;
//     pointId?: PathPointId;
//     wkid?: SupportedWkid;
//     OBJECTID?: PathPointId;
//     [key: string]: any;
//   };
// };

// type SpriteRouteHiddenSegmentFeature = {
//   type: "Feature";
//   id?: string | number;
//   geometry: {
//     type: "LineString";
//     coordinates: [number, number][];
//   };
//   properties: {
//     kind: "hidden-segment";
//     fromId: PathPointId;
//     toId: PathPointId;
//     invisible?: boolean;
//     [key: string]: any;
//   };
// };

// type SpriteRouteFeature =
//   | SpriteRoutePointFeature
//   | SpriteRouteHiddenSegmentFeature;

// type SpriteRouteGeoJSON = {
//   type: "FeatureCollection";
//   crs?: {
//     type: "name";
//     properties: {
//       name: string;
//     };
//   };
//   features: SpriteRouteFeature[];
// };

// type FacingDirection = "up" | "down" | "left" | "right";

// type SpritePathNode = {
//   id: string;
//   point: __esri.Point;
// };

// const SPRITE_ROUTE_URL = "/sprite-route.geojson";

// const SPRITE_FRAMES = {
//   up: [
//     "/sprites/bobcat/up/up-1.png",
//     "/sprites/bobcat/up/up-2.png",
//     "/sprites/bobcat/up/up-3.png",
//     "/sprites/bobcat/up/up-4.png",
//   ],
//   down: [
//     "/sprites/bobcat/down/down-1.png",
//     "/sprites/bobcat/down/down-2.png",
//     "/sprites/bobcat/down/down-3.png",
//     "/sprites/bobcat/down/down-4.png",
//   ],
//   left: [
//     "/sprites/bobcat/left/left-1.png",
//     "/sprites/bobcat/left/left-2.png",
//     "/sprites/bobcat/left/left-3.png",
//     "/sprites/bobcat/left/left-4.png",
//   ],
//   right: [
//     "/sprites/bobcat/right/right-1.png",
//     "/sprites/bobcat/right/right-2.png",
//     "/sprites/bobcat/right/right-3.png",
//     "/sprites/bobcat/right/right-4.png",
//   ],
// } as const;

// const SPRITE_DURATION_MS = 300000;
// const SPRITE_FRAME_MS = 120;

// const normalizePathId = (id: PathPointId | null | undefined): string =>
//   String(id);

// const makeSegmentKey = (a: PathPointId, b: PathPointId): string => {
//   const aId = normalizePathId(a);
//   const bId = normalizePathId(b);
//   return aId < bId ? `${aId}--${bId}` : `${bId}--${aId}`;
// };

// const inferWkidFromCrs = (
//   geojson: SpriteRouteGeoJSON,
// ): SupportedWkid | undefined => {
//   const crsName = geojson.crs?.properties?.name?.toUpperCase() ?? "";

//   if (crsName.includes("3857")) return 3857;
//   if (crsName.includes("102100")) return 102100;
//   if (crsName.includes("4326")) return 4326;

//   return undefined;
// };

// const loadSpriteRouteGeoJSON = async (): Promise<SpriteRouteGeoJSON | null> => {
//   try {
//     const res = await fetch(SPRITE_ROUTE_URL, { cache: "no-store" });
//     if (!res.ok) {
//       console.error(
//         `Failed to load sprite route GeoJSON from ${SPRITE_ROUTE_URL}: ${res.status}`,
//       );
//       return null;
//     }

//     const json = (await res.json()) as SpriteRouteGeoJSON;

//     if (
//       !json ||
//       json.type !== "FeatureCollection" ||
//       !Array.isArray(json.features)
//     ) {
//       console.error("Invalid sprite route GeoJSON:", json);
//       return null;
//     }

//     return json;
//   } catch (err) {
//     console.error("Error loading sprite route GeoJSON:", err);
//     return null;
//   }
// };

// /* ─────────────────────────────────────────
//  * Component
//  * ───────────────────────────────────── */

// export default function ArcGISMap(mapData: ExportBody) {
//   const mapDiv = useRef<HTMLDivElement>(null);

//   type ActiveOverlay = "calendar" | "turn" | null;
//   const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>(null);
//   const [viewReady, setViewReady] = useState(false);

//   const storeListenerRef = useRef<EventListener | null>(null);
//   const spriteAnimRef = useRef<number | null>(null);

//   useEffect(() => {
//     let destroyed = false;
//     let viewRef: __esri.MapView | null = null;
//     let pollId: number | null = null;

//     setViewReady(false);

//     const startArcGIS = () => {
//       if (destroyed) return;

//       const amd = (window as any).require;
//       if (!amd) return;

//       amd(
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
//           "esri/geometry/Polyline",
//           "esri/geometry/support/webMercatorUtils",
//           "esri/geometry/geometryEngine",
//           "esri/layers/FeatureLayer",
//           "esri/layers/WebTileLayer",
//           "esri/widgets/Locate",
//           "esri/widgets/Track",
//           "esri/layers/TileLayer",
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
//           Polyline: typeof __esri.Polyline,
//           webMercatorUtils: any,
//           geometryEngine: any,
//           FeatureLayer: any,
//           WebTileLayer: any,
//           Locate: any,
//           Track: any,
//           TileLayer: any,
//         ) => {
//           if (destroyed) return;

//           const isLonLat = (x: number, y: number) =>
//             Math.abs(x) <= 180 && Math.abs(y) <= 90;

//           const toViewSR = (geom: __esri.Geometry | any): __esri.Geometry => {
//             const wkid = geom?.spatialReference?.wkid;

//             if (wkid === 3857 || wkid === 102100) return geom;

//             if (wkid === 4326) {
//               return webMercatorUtils.geographicToWebMercator(geom);
//             }

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
//                 }),
//               );
//             }

//             return geom;
//           };

//           const computeLabelPoint = (poly: __esri.Polygon): __esri.Point => {
//             try {
//               const p = geometryEngine.labelPoints(poly);
//               if (p) {
//                 return new Point({
//                   x: p.x,
//                   y: p.y,
//                   spatialReference: { wkid: 3857 },
//                 });
//               }
//             } catch {}

//             const c1 = (poly as any).centroid;
//             if (c1) {
//               return new Point({
//                 x: c1.x,
//                 y: c1.y,
//                 spatialReference: { wkid: 3857 },
//               });
//             }

//             if (poly.extent?.center) {
//               return new Point({
//                 x: poly.extent.center.x,
//                 y: poly.extent.center.y,
//                 spatialReference: { wkid: 3857 },
//               });
//             }

//             const ring = poly.rings?.[0] ?? [];
//             let minX = Infinity;
//             let maxX = -Infinity;
//             let minY = Infinity;
//             let maxY = -Infinity;

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

//           const createSpriteSymbol = (url: string) => ({
//             type: "picture-marker",
//             url,
//             width: "42px",
//             height: "42px",
//             yoffset: "14px",
//           });

//           const toPathPoint3857 = (
//             x: number,
//             y: number,
//             wkid: SupportedWkid,
//           ): __esri.Point => {
//             const pt = new Point({
//               x,
//               y,
//               spatialReference: { wkid },
//             });

//             return toViewSR(pt) as __esri.Point;
//           };

//           const getFacing = (
//             a: __esri.Point,
//             b: __esri.Point,
//           ): FacingDirection => {
//             const dx = b.x - a.x;
//             const dy = b.y - a.y;

//             if (Math.abs(dx) >= Math.abs(dy)) {
//               return dx >= 0 ? "right" : "left";
//             }

//             return dy >= 0 ? "up" : "down";
//           };

//           const lerpPoint = (
//             a: __esri.Point,
//             b: __esri.Point,
//             t: number,
//           ): __esri.Point =>
//             new Point({
//               x: a.x + (b.x - a.x) * t,
//               y: a.y + (b.y - a.y) * t,
//               spatialReference: { wkid: 3857 },
//             });

//           esriConfig.apiKey =
//             (window as any).__ARCGIS_API_KEY__ ||
//             process.env.NEXT_PUBLIC_ARCGIS_API_KEY;

//           const map = new EsriMap({ basemap: mapData.settings.baseMap });

//           const [cx, cy] = mapData.settings.center;
//           const centerPoint =
//             Math.abs(cx) <= 180 && Math.abs(cy) <= 90
//               ? webMercatorUtils.geographicToWebMercator(
//                   new Point({
//                     x: cx,
//                     y: cy,
//                     spatialReference: { wkid: 4326 },
//                   }),
//                 )
//               : new Point({ x: cx, y: cy, spatialReference: { wkid: 3857 } });

//           const view: __esri.MapView = new MapView({
//             container: mapDiv.current as HTMLDivElement,
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

//           viewRef = view;
//           MapViewRef.current = view;

//           const popup = view.popup;
//           if (popup) {
//             popup.dockEnabled = false;
//             popup.dockOptions = {
//               breakpoint: false,
//             };
//           }

//           view.ui.move("zoom", "bottom-right");

//           const locateWidget = new Locate({ view });
//           locateWidget.goToOverride = (view: __esri.MapView, options: any) => {
//             options.target.scale = 1500;
//             return view.goTo(options.target);
//           };
//           view.ui.add(locateWidget, "top-right");

//           const trackWidget = new Track({
//             view,
//             graphic: new Graphic({
//               symbol: {
//                 type: "simple-marker",
//                 size: "12px",
//                 color: "green",
//                 outline: {
//                   color: "#efefef",
//                   width: "1.5px",
//                 },
//               },
//             }),
//             useHeadingEnabled: true,
//           });
//           view.ui.add(trackWidget, "top-right");

//           /* Layers */
//           const editingLayer = new GraphicsLayer({ id: "editing" });
//           const finalizedLayer = new GraphicsLayer({ id: "finalized" });
//           const labelsLayer = new GraphicsLayer({ id: "labels" });
//           const eventsLayer = new GraphicsLayer({
//             id: "events-layer",
//             title: "Campus Events",
//             listMode: "show",
//           });
//           const spriteLayer = new GraphicsLayer({
//             id: "sprite-layer",
//             title: "Animated Sprite",
//             listMode: "hide",
//           });

//           eventsLayerRef.current = eventsLayer;

//           const tileSrc = mapData.settings.mapTile;

//           const campusTiles =
//             tileSrc && /\/MapServer\/?$/i.test(tileSrc)
//               ? new TileLayer({
//                   url: tileSrc,
//                   id: "campus-tiles",
//                   opacity: 1,
//                 })
//               : tileSrc
//                 ? new WebTileLayer({
//                     urlTemplate: tileSrc,
//                     id: "campus-xyz",
//                     opacity: 1,
//                   })
//                 : null;

//           const mediaLayer = new (MediaLayer as any)({
//             source: [
//               new ImageElement({
//                 image:
//                   "https://campusmap.ucmercedhub.com/maps/images/rufa/rufa-mini.png",
//                 georeference: new ExtentAndRotationGeoreference({
//                   extent: new Extent({
//                     xmin: -13406409.47,
//                     ymin: 4488936.09,
//                     xmax: -13404924.08,
//                     ymax: 4490876.39,
//                     spatialReference: { wkid: 102100 },
//                   }),
//                   rotation: 0,
//                 }),
//               }),
//             ],
//           });

//           (mediaLayer as any).z = 20;
//           if (campusTiles) {
//             (campusTiles as any).z = 15;
//           }

//           (finalizedLayer as any).z = 30;
//           (editingLayer as any).z = 40;
//           (spriteLayer as any).z = 65;
//           (eventsLayer as any).z = 75;
//           (labelsLayer as any).z = 80;

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
//             ...(campusTiles ? [campusTiles] : []),
//             ...featureLayers,
//             finalizedLayer,
//             editingLayer,
//             eventsLayer,
//             spriteLayer,
//             labelsLayer,
//           ].filter(Boolean);

//           map.addMany(allLayers);
//           resortByZ(map);
//           (map.layers as any).on("change", () => resortByZ(map));

//           /* Labels visibility */
//           const applyLabelVisibility = (zoom: number) => {
//             labelBuckets.forEach((bucket) => {
//               const show = zoom >= bucket.minZoom && zoom <= bucket.maxZoom;
//               bucket.labels.forEach((lbl) => {
//                 lbl.visible = show;
//               });
//             });
//           };

//           /* Build labels from polygons only */
//           const rebuildAllLabelsFromPolygons = (
//             savedLabelMap: globalThis.Map<string, LabelDTO>,
//           ) => {
//             labelsLayer.removeAll();

//             finalizedLayer.graphics.toArray().forEach((polyG: any) => {
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

//           /* Sprite animation */
//           const startSpriteAnimation = (routeGeoJSON: SpriteRouteGeoJSON) => {
//             const defaultWkid = inferWkidFromCrs(routeGeoJSON) ?? 3857;

//             const pointFeatures = routeGeoJSON.features
//               .filter(
//                 (feature): feature is SpriteRoutePointFeature =>
//                   feature.geometry?.type === "Point" &&
//                   feature.properties?.kind === "path-point",
//               )
//               .sort((a, b) => a.properties.order - b.properties.order);

//             const basePathNodes: SpritePathNode[] = pointFeatures.map(
//               (feature) => {
//                 const [x, y] = feature.geometry.coordinates;
//                 const pointId =
//                   feature.id ??
//                   feature.properties.pointId ??
//                   feature.properties.OBJECTID;

//                 return {
//                   id: normalizePathId(pointId),
//                   point: toPathPoint3857(
//                     x,
//                     y,
//                     feature.properties.wkid ?? defaultWkid,
//                   ),
//                 };
//               },
//             );

//             if (basePathNodes.length < 2) {
//               console.warn(
//                 "Sprite route GeoJSON needs at least 2 path-point features.",
//               );
//               return;
//             }

//             const hiddenSegmentKeys = new Set(
//               routeGeoJSON.features
//                 .filter(
//                   (feature): feature is SpriteRouteHiddenSegmentFeature =>
//                     feature.geometry?.type === "LineString" &&
//                     feature.properties?.kind === "hidden-segment",
//                 )
//                 .filter((feature) => feature.properties.invisible !== false)
//                 .map((feature) =>
//                   makeSegmentKey(
//                     feature.properties.fromId,
//                     feature.properties.toId,
//                   ),
//                 ),
//             );

//             const firstNode = basePathNodes[0];
//             const lastNode = basePathNodes[basePathNodes.length - 1];

//             const pathNodes =
//               firstNode.point.x === lastNode.point.x &&
//               firstNode.point.y === lastNode.point.y
//                 ? basePathNodes
//                 : [...basePathNodes, firstNode];

//             const segmentLengths: number[] = [];
//             let totalLength = 0;

//             for (let i = 0; i < pathNodes.length - 1; i++) {
//               const a = pathNodes[i].point;
//               const b = pathNodes[i + 1].point;
//               const len = Math.hypot(b.x - a.x, b.y - a.y);
//               segmentLengths.push(len);
//               totalLength += len;
//             }

//             if (totalLength <= 0) return;

//             const spriteGraphic = new Graphic({
//               geometry: pathNodes[0].point,
//               symbol: createSpriteSymbol(SPRITE_FRAMES.down[0]),
//               attributes: { id: "animated-sprite" },
//               visible: true,
//             });

//             spriteLayer.removeAll();
//             spriteLayer.add(spriteGraphic);

//             let startTs: number | null = null;
//             let lastUrl = "";

//             const frame = (ts: number) => {
//               if (destroyed) return;

//               if (startTs === null) startTs = ts;

//               const elapsed = (ts - startTs) % SPRITE_DURATION_MS;
//               const targetDistance =
//                 (elapsed / SPRITE_DURATION_MS) * totalLength;

//               let walked = 0;
//               let segIndex = 0;

//               while (
//                 segIndex < segmentLengths.length - 1 &&
//                 walked + segmentLengths[segIndex] < targetDistance
//               ) {
//                 walked += segmentLengths[segIndex];
//                 segIndex++;
//               }

//               const fromNode = pathNodes[segIndex];
//               const toNode = pathNodes[segIndex + 1];

//               const a = fromNode.point;
//               const b = toNode.point;
//               const segLen = segmentLengths[segIndex] || 1;
//               const t = Math.max(
//                 0,
//                 Math.min(1, (targetDistance - walked) / segLen),
//               );

//               spriteGraphic.geometry = lerpPoint(a, b, t);

//               const isHidden = hiddenSegmentKeys.has(
//                 makeSegmentKey(fromNode.id, toNode.id),
//               );

//               spriteGraphic.visible = !isHidden;

//               const facing = getFacing(a, b);
//               const frames = SPRITE_FRAMES[facing];
//               const frameIndex =
//                 Math.floor(ts / SPRITE_FRAME_MS) % frames.length;
//               const nextUrl = frames[frameIndex];

//               if (nextUrl !== lastUrl) {
//                 spriteGraphic.symbol = createSpriteSymbol(nextUrl);
//                 lastUrl = nextUrl;
//               }

//               spriteAnimRef.current = window.requestAnimationFrame(frame);
//             };

//             if (spriteAnimRef.current !== null) {
//               window.cancelAnimationFrame(spriteAnimRef.current);
//               spriteAnimRef.current = null;
//             }

//             spriteAnimRef.current = window.requestAnimationFrame(frame);
//           };

//           /* Initial data load */
//           const data = {
//             polygons: mapData.polygons || [],
//             labels: mapData.labels || [],
//             events: mapData.events || [],
//           };

//           (data.polygons || []).forEach((p) => {
//             try {
//               let rawGeom: __esri.Geometry;

//               if (p.geometry.type === "polyline") {
//                 rawGeom = Polyline.fromJSON(p.geometry as any);
//               } else if (p.geometry.type === "polygon") {
//                 rawGeom = Polygon.fromJSON(p.geometry as any);
//               } else {
//                 rawGeom = new Point({
//                   x: p.geometry.x,
//                   y: p.geometry.y,
//                   spatialReference: p.geometry.spatialReference,
//                 });
//               }

//               const projectedGeom = toViewSR(rawGeom) as __esri.Geometry;

//               const graphic = new Graphic({
//                 geometry: projectedGeom,
//                 symbol: p.symbol,
//                 attributes: p.attributes,
//                 popupTemplate: {
//                   title: p.attributes.name,
//                   content: p.attributes.description,
//                 },
//               });

//               finalizedLayer.add(graphic);
//             } catch (e) {
//               console.error("Failed to load drawing:", p, e);
//             }
//           });

//           const savedLabelMap = new globalThis.Map<string, LabelDTO>();
//           (data.labels || []).forEach((l) => {
//             if (l?.attributes?.parentId) {
//               savedLabelMap.set(l.attributes.parentId, l);
//             }
//           });

//           rebuildAllLabelsFromPolygons(savedLabelMap);

//           (data.events || []).forEach((ev) => {
//             try {
//               const srcPt = new Point({
//                 x: ev.geometry.x,
//                 y: ev.geometry.y,
//                 spatialReference: {
//                   wkid: 4326,
//                 },
//               });

//               const pt3857 = toViewSR(srcPt) as __esri.Point;

//               const ce: CampusEvent = {
//                 id: ev.attributes.id || `evt-${Date.now()}`,
//                 event_name: ev.attributes.event_name || "Event",
//                 description: ev.attributes.description ?? undefined,
//                 date: ev.attributes.date ?? undefined,
//                 startAt: ev.attributes.startAt ?? undefined,
//                 endAt: ev.attributes.endAt ?? undefined,
//                 locationTag:
//                   (ev.attributes.fullLocationTag ||
//                     ev.attributes.location_at) ??
//                   undefined,
//                 location: ev.attributes.location ?? undefined,
//                 location_at: ev.attributes.location_at ?? undefined,
//                 names: ev.attributes.names ?? undefined,
//                 original: ev.attributes.original ?? undefined,
//                 geometry: { x: pt3857.x, y: pt3857.y, wkid: 3857 },
//                 fromUser: ev.attributes.fromUser,
//                 iconSize: ev.attributes.iconSize ?? 36,
//                 iconUrl: ev.attributes.iconUrl ?? "/icons/event-pin.png",
//                 poster_url: ev.attributes.poster_url,
//               };

//               eventsLayer.add(toEventGraphic(Graphic, ce));
//             } catch (e) {
//               console.error("Failed to load event:", ev, e);
//             }
//           });

//           view.when(async () => {
//             applyLabelVisibility(view.zoom);
//             setViewReady(true);

//             const routeGeoJSON = await loadSpriteRouteGeoJSON();
//             if (destroyed || !routeGeoJSON) return;

//             startSpriteAnimation(routeGeoJSON);
//           });

//           finalizedLayerRef.events.dispatchEvent(new Event("change"));

//           editingLayerRef.current = editingLayer;
//           setFinalizedLayer(finalizedLayer);
//           setLabelsLayer(labelsLayer);
//           GraphicRef.current = Graphic;

//           for (const ev of eventsStore.items) {
//             let finalEv = ev;

//             try {
//               if (ev.geometry.wkid === 4326) {
//                 const pt = new Point({
//                   x: ev.geometry.x,
//                   y: ev.geometry.y,
//                   spatialReference: { wkid: 4326 },
//                 });

//                 const proj = toViewSR(pt) as __esri.Point;
//                 finalEv = {
//                   ...ev,
//                   geometry: { x: proj.x, y: proj.y, wkid: 3857 },
//                 };
//               }

//               eventsLayer.add(toEventGraphic(Graphic, finalEv));
//             } catch (e) {
//               console.error("Error loading store event", e);
//             }
//           }

//           const onEventAdded = (e: Event) => {
//             const custom = e as CustomEvent<CampusEvent>;
//             const ev = custom.detail;
//             if (!ev) return;

//             try {
//               let finalEv = ev;

//               if (ev.geometry.wkid === 4326) {
//                 const pt = new Point({
//                   x: ev.geometry.x,
//                   y: ev.geometry.y,
//                   spatialReference: { wkid: 4326 },
//                 });

//                 const proj = toViewSR(pt) as __esri.Point;
//                 finalEv = {
//                   ...ev,
//                   geometry: { x: proj.x, y: proj.y, wkid: 3857 },
//                 };
//               }

//               eventsLayer.add(toEventGraphic(Graphic, finalEv));
//               console.log(
//                 "📍 Added new dynamic event to map:",
//                 finalEv.event_name,
//               );
//             } catch (err) {
//               console.error("Error adding dynamic event to map:", err);
//             }
//           };

//           eventsStore.events.addEventListener("added", onEventAdded);
//           storeListenerRef.current = onEventAdded;

//           view.watch("zoom", (z: number) => applyLabelVisibility(z));

//           finalizedLayer.graphics.on("change", () => {
//             const savedLabelMap2 = new globalThis.Map<string, LabelDTO>();

//             labelsLayer.graphics.toArray().forEach((lbl: any) => {
//               const att = lbl.attributes;
//               if (att?.parentId) {
//                 savedLabelMap2.set(att.parentId, {
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

//             rebuildAllLabelsFromPolygons(savedLabelMap2);
//           });
//         },
//       );
//     };

//     if ((window as any).require) {
//       startArcGIS();
//     } else {
//       let tries = 0;

//       pollId = window.setInterval(() => {
//         if (destroyed) {
//           if (pollId !== null) {
//             window.clearInterval(pollId);
//             pollId = null;
//           }
//           return;
//         }

//         if ((window as any).require) {
//           if (pollId !== null) {
//             window.clearInterval(pollId);
//             pollId = null;
//           }
//           startArcGIS();
//         } else if (tries++ > 200) {
//           if (pollId !== null) {
//             window.clearInterval(pollId);
//             pollId = null;
//           }
//           console.error("ArcGIS AMD loader not available after waiting.");
//         }
//       }, 100) as unknown as number;
//     }

//     return () => {
//       destroyed = true;

//       if (pollId !== null) {
//         window.clearInterval(pollId);
//         pollId = null;
//       }

//       if (spriteAnimRef.current !== null) {
//         window.cancelAnimationFrame(spriteAnimRef.current);
//         spriteAnimRef.current = null;
//       }

//       if (storeListenerRef.current) {
//         eventsStore.events.removeEventListener(
//           "added",
//           storeListenerRef.current,
//         );
//         storeListenerRef.current = null;
//       }

//       if (viewRef) {
//         viewRef.destroy();
//         viewRef = null;
//         MapViewRef.current = null as any;
//         eventsLayerRef.current = null as any;
//         GraphicRef.current = null as any;
//         setViewReady(false);
//       }
//     };
//   }, [mapData]);

//   const toggleCalendar = () => {
//     setActiveOverlay((cur) => (cur === "calendar" ? null : "calendar"));
//   };

//   const toggleTurn = () => {
//     setActiveOverlay((cur) => (cur === "turn" ? null : "turn"));
//   };

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

//       {viewReady && (
//         <DynamicEventLoader eventSources={mapData.eventSources ?? []} />
//       )}

//       <div style={dockWrap}>
//         <button
//           type="button"
//           aria-label="Calendar filters"
//           title="Calendar filters"
//           aria-pressed={activeOverlay === "calendar"}
//           onClick={toggleCalendar}
//           style={{
//             ...launcherBase,
//             ...(activeOverlay === "calendar" ? launcherActive : null),
//           }}
//         >
//           📅
//         </button>

//         <button
//           type="button"
//           aria-label="Turn-by-turn directions"
//           title="Turn-by-turn directions"
//           aria-pressed={activeOverlay === "turn"}
//           onClick={toggleTurn}
//           style={{
//             ...launcherBase,
//             marginTop: 11,
//             ...(activeOverlay === "turn" ? launcherActive : null),
//           }}
//         >
//           🧭
//         </button>
//       </div>

//       <EventCalendarOverlay
//         expanded={activeOverlay === "calendar"}
//         onClose={() => setActiveOverlay(null)}
//       />

//       <div
//         style={{
//           ...turnWrap,
//           display: activeOverlay === "turn" ? "block" : "none",
//           pointerEvents: activeOverlay === "turn" ? "auto" : "none",
//         }}
//       >
//         <TurnByTurnOverlay viewReady={viewReady} />
//         <div style={{ position: "absolute", top: 5, right: 5, zIndex: 9999 }}>
//           <button
//             onClick={() => setActiveOverlay(null)}
//             style={closeTurnBtn}
//             title="Close"
//           >
//             ⤫
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ───────── Styles ───────── */

// const dockWrap: React.CSSProperties = {
//   position: "absolute",
//   top: 5,
//   left: 5,
//   zIndex: 2000,
//   pointerEvents: "auto",
//   display: "flex",
//   flexDirection: "column",
//   alignItems: "center",
// };

// const launcherBase: React.CSSProperties = {
//   width: 44,
//   height: 44,
//   borderRadius: "50%",
//   border: "4px solid #000000ff",
//   background: "white",
//   boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
//   cursor: "pointer",
//   fontSize: 20,
//   display: "flex",
//   alignItems: "center",
//   justifyContent: "center",
// };

// const launcherActive: React.CSSProperties = {
//   borderColor: "#2775ff",
//   boxShadow: "0 0 0 3px rgba(39,117,255,0.25), 0 8px 22px rgba(0,0,0,0.22)",
// };

// const turnWrap: React.CSSProperties = {
//   position: "absolute",
//   top: 5,
//   left: 55,
//   zIndex: 1000,
//   pointerEvents: "auto",
// };

// const closeTurnBtn: React.CSSProperties = {
//   border: "none",
//   background: "#fff",
//   borderRadius: 8,
//   cursor: "pointer",
//   padding: "4px 8px",
//   fontWeight: 700,
// };
// "use client";

// import { useEffect, useRef, useState } from "react";
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
//   resortByZ,
// } from "./map/arcgisRefs";
// import "./ArcGISMap.css";
// import EventCalendarOverlay from "./map/MapControls/EventCalendarOverlay";
// import DynamicEventLoader from "./map/MapControls/DynamicEventLoader";
// import TurnByTurnOverlay from "./map/MapControls/TurnByTurnOverlay";
// import { rebuildBuckets, labelBuckets } from "./map/bucketManager";
// import { toGraphic as toEventGraphic } from "./map/MapControls/eventsLayer";

// /* ─────────────────────────────────────────
//  * Types from API payload
//  * ───────────────────────────────────── */

// interface SpatialReference {
//   wkid: number;
//   latestWkid: number;
// }

// type DrawingDTO = {
//   attributes: Record<string, any>;
//   geometry:
//     | {
//         type: "polygon";
//         rings: number[][][];
//         spatialReference: SpatialReference;
//       }
//     | {
//         type: "polyline";
//         paths: number[][][];
//         spatialReference: SpatialReference;
//       };
//   symbol:
//     | {
//         type: "simple-fill";
//         color: number[];
//         outline: { color: number[]; width: number };
//       }
//     | {
//         type: "simple-line";
//         color: number[];
//         width: number;
//       };
// };

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
//     fullLocationTag?: string | null;
//     location?: string | null;
//     location_at?: string | null;
//     names?: string[] | null;
//     original?: any | null;
//     fromUser: boolean;
//     iconSize?: number;
//     iconUrl?: string;
//     poster_url?: string;
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
//   polygons: DrawingDTO[]; // includes polygons + polylines
//   labels: LabelDTO[];
//   events?: EventPointDTO[];
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
//     mapTile: string | null;
//     baseMap: string;
//     apiSources: string[];
//   };
// }

// /* ─────────────────────────────────────────
//  * Sprite GeoJSON config
//  * ───────────────────────────────────── */

// type SupportedWkid = 4326 | 3857 | 102100;
// type PathPointId = string | number;

// type SpriteRoutePointFeature = {
//   type: "Feature";
//   id?: PathPointId;
//   geometry: {
//     type: "Point";
//     coordinates: [number, number];
//   };
//   properties: {
//     kind: "path-point";
//     order: number;
//     pointId?: PathPointId;
//     wkid?: SupportedWkid;
//     OBJECTID?: PathPointId;
//     [key: string]: any;
//   };
// };

// type SpriteRouteHiddenSegmentFeature = {
//   type: "Feature";
//   id?: string | number;
//   geometry: {
//     type: "LineString";
//     coordinates: [number, number][];
//   };
//   properties: {
//     kind: "hidden-segment";
//     fromId: PathPointId;
//     toId: PathPointId;
//     invisible?: boolean;
//     [key: string]: any;
//   };
// };

// type SpriteRouteFeature =
//   | SpriteRoutePointFeature
//   | SpriteRouteHiddenSegmentFeature;

// type SpriteRouteGeoJSON = {
//   type: "FeatureCollection";
//   crs?: {
//     type: "name";
//     properties: {
//       name: string;
//     };
//   };
//   features: SpriteRouteFeature[];
// };

// type FacingDirection = "up" | "down" | "left" | "right";

// type SpritePathNode = {
//   id: string;
//   point: __esri.Point;
// };

// const SPRITE_ROUTE_URL = "/sprite-route.geojson";

// const SPRITE_FRAMES = {
//   up: [
//     "/sprites/bobcat/up/up-1.png",
//     "/sprites/bobcat/up/up-2.png",
//     "/sprites/bobcat/up/up-3.png",
//     "/sprites/bobcat/up/up-4.png",
//   ],
//   down: [
//     "/sprites/bobcat/down/down-1.png",
//     "/sprites/bobcat/down/down-2.png",
//     "/sprites/bobcat/down/down-3.png",
//     "/sprites/bobcat/down/down-4.png",
//   ],
//   left: [
//     "/sprites/bobcat/left/left-1.png",
//     "/sprites/bobcat/left/left-2.png",
//     "/sprites/bobcat/left/left-3.png",
//     "/sprites/bobcat/left/left-4.png",
//   ],
//   right: [
//     "/sprites/bobcat/right/right-1.png",
//     "/sprites/bobcat/right/right-2.png",
//     "/sprites/bobcat/right/right-3.png",
//     "/sprites/bobcat/right/right-4.png",
//   ],
// } as const;

// const SPRITE_DURATION_MS = 300000;
// const SPRITE_FRAME_MS = 120;

// const normalizePathId = (id: PathPointId | null | undefined): string =>
//   String(id);

// const makeSegmentKey = (a: PathPointId, b: PathPointId): string => {
//   const aId = normalizePathId(a);
//   const bId = normalizePathId(b);
//   return aId < bId ? `${aId}--${bId}` : `${bId}--${aId}`;
// };

// const inferWkidFromCrs = (
//   geojson: SpriteRouteGeoJSON,
// ): SupportedWkid | undefined => {
//   const crsName = geojson.crs?.properties?.name?.toUpperCase() ?? "";

//   if (crsName.includes("3857")) return 3857;
//   if (crsName.includes("102100")) return 102100;
//   if (crsName.includes("4326")) return 4326;

//   return undefined;
// };

// const loadSpriteRouteGeoJSON = async (): Promise<SpriteRouteGeoJSON | null> => {
//   try {
//     const res = await fetch(SPRITE_ROUTE_URL, { cache: "no-store" });
//     if (!res.ok) {
//       console.error(
//         `Failed to load sprite route GeoJSON from ${SPRITE_ROUTE_URL}: ${res.status}`,
//       );
//       return null;
//     }

//     const json = (await res.json()) as SpriteRouteGeoJSON;

//     if (
//       !json ||
//       json.type !== "FeatureCollection" ||
//       !Array.isArray(json.features)
//     ) {
//       console.error("Invalid sprite route GeoJSON:", json);
//       return null;
//     }

//     return json;
//   } catch (err) {
//     console.error("Error loading sprite route GeoJSON:", err);
//     return null;
//   }
// };

// /* ─────────────────────────────────────────
//  * Component
//  * ───────────────────────────────────── */

// export default function ArcGISMap(mapData: ExportBody) {
//   const mapDiv = useRef<HTMLDivElement>(null);

//   type ActiveOverlay = "calendar" | "turn" | null;
//   const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>(null);
//   const [viewReady, setViewReady] = useState(false);

//   const storeListenerRef = useRef<EventListener | null>(null);
//   const spriteAnimRef = useRef<number | null>(null);

//   useEffect(() => {
//     let destroyed = false;
//     let viewRef: __esri.MapView | null = null;
//     let pollId: number | null = null;

//     setViewReady(false);

//     const startArcGIS = () => {
//       if (destroyed) return;

//       const amd = (window as any).require;
//       if (!amd) return;

//       amd(
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
//           "esri/geometry/Polyline",
//           "esri/geometry/support/webMercatorUtils",
//           "esri/geometry/geometryEngine",
//           "esri/layers/FeatureLayer",
//           "esri/layers/WebTileLayer",
//           "esri/widgets/Locate",
//           "esri/widgets/Track",
//           "esri/layers/TileLayer",
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
//           Polyline: typeof __esri.Polyline,
//           webMercatorUtils: any,
//           geometryEngine: any,
//           FeatureLayer: any,
//           WebTileLayer: any,
//           Locate: any,
//           Track: any,
//           TileLayer: any,
//         ) => {
//           if (destroyed) return;

//           const isLonLat = (x: number, y: number) =>
//             Math.abs(x) <= 180 && Math.abs(y) <= 90;

//           const toViewSR = (geom: __esri.Geometry | any): __esri.Geometry => {
//             const wkid = geom?.spatialReference?.wkid;

//             if (wkid === 3857 || wkid === 102100) return geom;

//             if (wkid === 4326) {
//               return webMercatorUtils.geographicToWebMercator(geom);
//             }

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
//                 }),
//               );
//             }

//             return geom;
//           };

//           const computeLabelPoint = (poly: __esri.Polygon): __esri.Point => {
//             try {
//               const p = geometryEngine.labelPoints(poly);
//               if (p) {
//                 return new Point({
//                   x: p.x,
//                   y: p.y,
//                   spatialReference: { wkid: 3857 },
//                 });
//               }
//             } catch {}

//             const c1 = (poly as any).centroid;
//             if (c1) {
//               return new Point({
//                 x: c1.x,
//                 y: c1.y,
//                 spatialReference: { wkid: 3857 },
//               });
//             }

//             if (poly.extent?.center) {
//               return new Point({
//                 x: poly.extent.center.x,
//                 y: poly.extent.center.y,
//                 spatialReference: { wkid: 3857 },
//               });
//             }

//             const ring = poly.rings?.[0] ?? [];
//             let minX = Infinity;
//             let maxX = -Infinity;
//             let minY = Infinity;
//             let maxY = -Infinity;

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

//           const createSpriteSymbol = (url: string) => ({
//             type: "picture-marker",
//             url,
//             width: "42px",
//             height: "42px",
//             yoffset: "14px",
//           });

//           const toPathPoint3857 = (
//             x: number,
//             y: number,
//             wkid: SupportedWkid,
//           ): __esri.Point => {
//             const pt = new Point({
//               x,
//               y,
//               spatialReference: { wkid },
//             });

//             return toViewSR(pt) as __esri.Point;
//           };

//           const getFacing = (
//             a: __esri.Point,
//             b: __esri.Point,
//           ): FacingDirection => {
//             const dx = b.x - a.x;
//             const dy = b.y - a.y;

//             if (Math.abs(dx) >= Math.abs(dy)) {
//               return dx >= 0 ? "right" : "left";
//             }

//             return dy >= 0 ? "up" : "down";
//           };

//           const lerpPoint = (
//             a: __esri.Point,
//             b: __esri.Point,
//             t: number,
//           ): __esri.Point =>
//             new Point({
//               x: a.x + (b.x - a.x) * t,
//               y: a.y + (b.y - a.y) * t,
//               spatialReference: { wkid: 3857 },
//             });

//           esriConfig.apiKey =
//             (window as any).__ARCGIS_API_KEY__ ||
//             process.env.NEXT_PUBLIC_ARCGIS_API_KEY;

//           const map = new EsriMap({ basemap: mapData.settings.baseMap });

//           const [cx, cy] = mapData.settings.center;
//           const centerPoint =
//             Math.abs(cx) <= 180 && Math.abs(cy) <= 90
//               ? webMercatorUtils.geographicToWebMercator(
//                   new Point({
//                     x: cx,
//                     y: cy,
//                     spatialReference: { wkid: 4326 },
//                   }),
//                 )
//               : new Point({ x: cx, y: cy, spatialReference: { wkid: 3857 } });

//           const view: __esri.MapView = new MapView({
//             container: mapDiv.current as HTMLDivElement,
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

//           viewRef = view;
//           MapViewRef.current = view;

//           const popup = view.popup;
//           if (popup) {
//             popup.dockEnabled = false;
//             popup.dockOptions = {
//               breakpoint: false,
//             };
//           }

//           view.ui.move("zoom", "bottom-right");

//           const locateWidget = new Locate({ view });
//           locateWidget.goToOverride = (view: __esri.MapView, options: any) => {
//             options.target.scale = 1500;
//             return view.goTo(options.target);
//           };
//           view.ui.add(locateWidget, "top-right");

//           const trackWidget = new Track({
//             view,
//             graphic: new Graphic({
//               symbol: {
//                 type: "simple-marker",
//                 size: "12px",
//                 color: "green",
//                 outline: {
//                   color: "#efefef",
//                   width: "1.5px",
//                 },
//               },
//             }),
//             useHeadingEnabled: true,
//           });
//           view.ui.add(trackWidget, "top-right");

//           /* Layers */
//           const editingLayer = new GraphicsLayer({ id: "editing" });
//           const finalizedLayer = new GraphicsLayer({ id: "finalized" });
//           const labelsLayer = new GraphicsLayer({ id: "labels" });
//           const eventsLayer = new GraphicsLayer({
//             id: "events-layer",
//             title: "Campus Events",
//             listMode: "show",
//           });
//           const spriteLayer = new GraphicsLayer({
//             id: "sprite-layer",
//             title: "Animated Sprite",
//             listMode: "hide",
//           });

//           eventsLayerRef.current = eventsLayer;

//           const tileSrc = mapData.settings.mapTile;

//           const campusTiles =
//             tileSrc && /\/MapServer\/?$/i.test(tileSrc)
//               ? new TileLayer({
//                   url: tileSrc,
//                   id: "campus-tiles",
//                   opacity: 1,
//                 })
//               : tileSrc
//                 ? new WebTileLayer({
//                     urlTemplate: tileSrc,
//                     id: "campus-xyz",
//                     opacity: 1,
//                   })
//                 : null;

//           const mediaLayer = new (MediaLayer as any)({
//             source: [
//               new ImageElement({
//                 image:
//                   "https://campusmap.ucmercedhub.com/maps/images/rufa/rufa-mini.png",
//                 georeference: new ExtentAndRotationGeoreference({
//                   extent: new Extent({
//                     xmin: -13406409.47,
//                     ymin: 4488936.09,
//                     xmax: -13404924.08,
//                     ymax: 4490876.39,
//                     spatialReference: { wkid: 102100 },
//                   }),
//                   rotation: 0,
//                 }),
//               }),
//             ],
//           });

//           (mediaLayer as any).z = 20;
//           if (campusTiles) {
//             (campusTiles as any).z = 15;
//           }

//           (finalizedLayer as any).z = 30;
//           (editingLayer as any).z = 40;
//           (spriteLayer as any).z = 65;
//           (eventsLayer as any).z = 75;
//           (labelsLayer as any).z = 80;

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
//             ...(campusTiles ? [campusTiles] : []),
//             ...featureLayers,
//             finalizedLayer,
//             editingLayer,
//             eventsLayer,
//             spriteLayer,
//             labelsLayer,
//           ].filter(Boolean);

//           map.addMany(allLayers);
//           resortByZ(map);
//           (map.layers as any).on("change", () => resortByZ(map));

//           /* Labels visibility */
//           const applyLabelVisibility = (zoom: number) => {
//             labelBuckets.forEach((bucket) => {
//               const show = zoom >= bucket.minZoom && zoom <= bucket.maxZoom;
//               bucket.labels.forEach((lbl) => {
//                 lbl.visible = show;
//               });
//             });
//           };

//           /* Build labels from polygons only */
//           const rebuildAllLabelsFromPolygons = (
//             savedLabelMap: globalThis.Map<string, LabelDTO>,
//           ) => {
//             labelsLayer.removeAll();

//             finalizedLayer.graphics.toArray().forEach((polyG: any) => {
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

//           /* Sprite animation */
//           const startSpriteAnimation = (routeGeoJSON: SpriteRouteGeoJSON) => {
//             const defaultWkid = inferWkidFromCrs(routeGeoJSON) ?? 3857;

//             const pointFeatures = routeGeoJSON.features
//               .filter(
//                 (feature): feature is SpriteRoutePointFeature =>
//                   feature.geometry?.type === "Point" &&
//                   feature.properties?.kind === "path-point",
//               )
//               .sort((a, b) => a.properties.order - b.properties.order);

//             const basePathNodes: SpritePathNode[] = pointFeatures.map(
//               (feature) => {
//                 const [x, y] = feature.geometry.coordinates;
//                 const pointId =
//                   feature.id ??
//                   feature.properties.pointId ??
//                   feature.properties.OBJECTID;

//                 return {
//                   id: normalizePathId(pointId),
//                   point: toPathPoint3857(
//                     x,
//                     y,
//                     feature.properties.wkid ?? defaultWkid,
//                   ),
//                 };
//               },
//             );

//             if (basePathNodes.length < 2) {
//               console.warn(
//                 "Sprite route GeoJSON needs at least 2 path-point features.",
//               );
//               return;
//             }

//             const hiddenSegmentKeys = new Set(
//               routeGeoJSON.features
//                 .filter(
//                   (feature): feature is SpriteRouteHiddenSegmentFeature =>
//                     feature.geometry?.type === "LineString" &&
//                     feature.properties?.kind === "hidden-segment",
//                 )
//                 .filter((feature) => feature.properties.invisible !== false)
//                 .map((feature) =>
//                   makeSegmentKey(
//                     feature.properties.fromId,
//                     feature.properties.toId,
//                   ),
//                 ),
//             );

//             const firstNode = basePathNodes[0];
//             const lastNode = basePathNodes[basePathNodes.length - 1];

//             const pathNodes =
//               firstNode.point.x === lastNode.point.x &&
//               firstNode.point.y === lastNode.point.y
//                 ? basePathNodes
//                 : [...basePathNodes, firstNode];

//             const segmentLengths: number[] = [];
//             let totalLength = 0;

//             for (let i = 0; i < pathNodes.length - 1; i++) {
//               const a = pathNodes[i].point;
//               const b = pathNodes[i + 1].point;
//               const len = Math.hypot(b.x - a.x, b.y - a.y);
//               segmentLengths.push(len);
//               totalLength += len;
//             }

//             if (totalLength <= 0) return;

//             const spriteGraphic = new Graphic({
//               geometry: pathNodes[0].point,
//               symbol: createSpriteSymbol(SPRITE_FRAMES.down[0]),
//               attributes: { id: "animated-sprite" },
//               visible: true,
//             });

//             spriteLayer.removeAll();
//             spriteLayer.add(spriteGraphic);

//             let startTs: number | null = null;
//             let lastUrl = "";

//             const frame = (ts: number) => {
//               if (destroyed) return;

//               if (startTs === null) startTs = ts;

//               const elapsed = (ts - startTs) % SPRITE_DURATION_MS;
//               const targetDistance =
//                 (elapsed / SPRITE_DURATION_MS) * totalLength;

//               let walked = 0;
//               let segIndex = 0;

//               while (
//                 segIndex < segmentLengths.length - 1 &&
//                 walked + segmentLengths[segIndex] < targetDistance
//               ) {
//                 walked += segmentLengths[segIndex];
//                 segIndex++;
//               }

//               const fromNode = pathNodes[segIndex];
//               const toNode = pathNodes[segIndex + 1];

//               const a = fromNode.point;
//               const b = toNode.point;
//               const segLen = segmentLengths[segIndex] || 1;
//               const t = Math.max(
//                 0,
//                 Math.min(1, (targetDistance - walked) / segLen),
//               );

//               spriteGraphic.geometry = lerpPoint(a, b, t);

//               const isHidden = hiddenSegmentKeys.has(
//                 makeSegmentKey(fromNode.id, toNode.id),
//               );

//               spriteGraphic.visible = !isHidden;

//               const facing = getFacing(a, b);
//               const frames = SPRITE_FRAMES[facing];
//               const frameIndex =
//                 Math.floor(ts / SPRITE_FRAME_MS) % frames.length;
//               const nextUrl = frames[frameIndex];

//               if (nextUrl !== lastUrl) {
//                 spriteGraphic.symbol = createSpriteSymbol(nextUrl);
//                 lastUrl = nextUrl;
//               }

//               spriteAnimRef.current = window.requestAnimationFrame(frame);
//             };

//             if (spriteAnimRef.current !== null) {
//               window.cancelAnimationFrame(spriteAnimRef.current);
//               spriteAnimRef.current = null;
//             }

//             spriteAnimRef.current = window.requestAnimationFrame(frame);
//           };

//           /* Initial data load */
//           const data = {
//             polygons: mapData.polygons || [],
//             labels: mapData.labels || [],
//             events: mapData.events || [],
//           };

//           (data.polygons || []).forEach((p) => {
//             try {
//               const rawGeom =
//                 p.geometry.type === "polyline"
//                   ? Polyline.fromJSON(p.geometry as any)
//                   : Polygon.fromJSON(p.geometry as any);

//               const projectedGeom = toViewSR(rawGeom) as __esri.Geometry;

//               const graphic = new Graphic({
//                 geometry: projectedGeom,
//                 symbol: p.symbol,
//                 attributes: p.attributes,
//                 popupTemplate: {
//                   title: p.attributes.name,
//                   content: p.attributes.description,
//                 },
//               });

//               finalizedLayer.add(graphic);
//             } catch (e) {
//               console.error("Failed to load drawing:", p, e);
//             }
//           });

//           const savedLabelMap = new globalThis.Map<string, LabelDTO>();
//           (data.labels || []).forEach((l) => {
//             if (l?.attributes?.parentId) {
//               savedLabelMap.set(l.attributes.parentId, l);
//             }
//           });

//           rebuildAllLabelsFromPolygons(savedLabelMap);

//           (data.events || []).forEach((ev) => {
//             try {
//               const srcPt = new Point({
//                 x: ev.geometry.x,
//                 y: ev.geometry.y,
//                 spatialReference: {
//                   wkid: 4326,
//                 },
//               });

//               const pt3857 = toViewSR(srcPt) as __esri.Point;

//               const ce: CampusEvent = {
//                 id: ev.attributes.id || `evt-${Date.now()}`,
//                 event_name: ev.attributes.event_name || "Event",
//                 description: ev.attributes.description ?? undefined,
//                 date: ev.attributes.date ?? undefined,
//                 startAt: ev.attributes.startAt ?? undefined,
//                 endAt: ev.attributes.endAt ?? undefined,
//                 locationTag:
//                   (ev.attributes.fullLocationTag ||
//                     ev.attributes.location_at) ??
//                   undefined,
//                 location: ev.attributes.location ?? undefined,
//                 location_at: ev.attributes.location_at ?? undefined,
//                 names: ev.attributes.names ?? undefined,
//                 original: ev.attributes.original ?? undefined,
//                 geometry: { x: pt3857.x, y: pt3857.y, wkid: 3857 },
//                 fromUser: ev.attributes.fromUser,
//                 iconSize: ev.attributes.iconSize ?? 36,
//                 iconUrl: ev.attributes.iconUrl ?? "/icons/event-pin.png",
//                 poster_url: ev.attributes.poster_url,
//               };

//               eventsLayer.add(toEventGraphic(Graphic, ce));
//             } catch (e) {
//               console.error("Failed to load event:", ev, e);
//             }
//           });

//           view.when(async () => {
//             applyLabelVisibility(view.zoom);
//             setViewReady(true);

//             const routeGeoJSON = await loadSpriteRouteGeoJSON();
//             if (destroyed || !routeGeoJSON) return;

//             startSpriteAnimation(routeGeoJSON);
//           });

//           finalizedLayerRef.events.dispatchEvent(new Event("change"));

//           editingLayerRef.current = editingLayer;
//           setFinalizedLayer(finalizedLayer);
//           setLabelsLayer(labelsLayer);
//           GraphicRef.current = Graphic;

//           for (const ev of eventsStore.items) {
//             let finalEv = ev;

//             try {
//               if (ev.geometry.wkid === 4326) {
//                 const pt = new Point({
//                   x: ev.geometry.x,
//                   y: ev.geometry.y,
//                   spatialReference: { wkid: 4326 },
//                 });

//                 const proj = toViewSR(pt) as __esri.Point;
//                 finalEv = {
//                   ...ev,
//                   geometry: { x: proj.x, y: proj.y, wkid: 3857 },
//                 };
//               }

//               eventsLayer.add(toEventGraphic(Graphic, finalEv));
//             } catch (e) {
//               console.error("Error loading store event", e);
//             }
//           }

//           const onEventAdded = (e: Event) => {
//             const custom = e as CustomEvent<CampusEvent>;
//             const ev = custom.detail;
//             if (!ev) return;

//             try {
//               let finalEv = ev;

//               if (ev.geometry.wkid === 4326) {
//                 const pt = new Point({
//                   x: ev.geometry.x,
//                   y: ev.geometry.y,
//                   spatialReference: { wkid: 4326 },
//                 });

//                 const proj = toViewSR(pt) as __esri.Point;
//                 finalEv = {
//                   ...ev,
//                   geometry: { x: proj.x, y: proj.y, wkid: 3857 },
//                 };
//               }

//               eventsLayer.add(toEventGraphic(Graphic, finalEv));
//               console.log(
//                 "📍 Added new dynamic event to map:",
//                 finalEv.event_name,
//               );
//             } catch (err) {
//               console.error("Error adding dynamic event to map:", err);
//             }
//           };

//           eventsStore.events.addEventListener("added", onEventAdded);
//           storeListenerRef.current = onEventAdded;

//           view.watch("zoom", (z: number) => applyLabelVisibility(z));

//           finalizedLayer.graphics.on("change", () => {
//             const savedLabelMap2 = new globalThis.Map<string, LabelDTO>();

//             labelsLayer.graphics.toArray().forEach((lbl: any) => {
//               const att = lbl.attributes;
//               if (att?.parentId) {
//                 savedLabelMap2.set(att.parentId, {
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

//             rebuildAllLabelsFromPolygons(savedLabelMap2);
//           });
//         },
//       );
//     };

//     if ((window as any).require) {
//       startArcGIS();
//     } else {
//       let tries = 0;

//       pollId = window.setInterval(() => {
//         if (destroyed) {
//           if (pollId !== null) {
//             window.clearInterval(pollId);
//             pollId = null;
//           }
//           return;
//         }

//         if ((window as any).require) {
//           if (pollId !== null) {
//             window.clearInterval(pollId);
//             pollId = null;
//           }
//           startArcGIS();
//         } else if (tries++ > 200) {
//           if (pollId !== null) {
//             window.clearInterval(pollId);
//             pollId = null;
//           }
//           console.error("ArcGIS AMD loader not available after waiting.");
//         }
//       }, 100) as unknown as number;
//     }

//     return () => {
//       destroyed = true;

//       if (pollId !== null) {
//         window.clearInterval(pollId);
//         pollId = null;
//       }

//       if (spriteAnimRef.current !== null) {
//         window.cancelAnimationFrame(spriteAnimRef.current);
//         spriteAnimRef.current = null;
//       }

//       if (storeListenerRef.current) {
//         eventsStore.events.removeEventListener(
//           "added",
//           storeListenerRef.current,
//         );
//         storeListenerRef.current = null;
//       }

//       if (viewRef) {
//         viewRef.destroy();
//         viewRef = null;
//         MapViewRef.current = null as any;
//         eventsLayerRef.current = null as any;
//         GraphicRef.current = null as any;
//         setViewReady(false);
//       }
//     };
//   }, [mapData]);

//   const toggleCalendar = () => {
//     setActiveOverlay((cur) => (cur === "calendar" ? null : "calendar"));
//   };

//   const toggleTurn = () => {
//     setActiveOverlay((cur) => (cur === "turn" ? null : "turn"));
//   };

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

//       {viewReady && (
//         <DynamicEventLoader eventSources={mapData.eventSources ?? []} />
//       )}

//       <div style={dockWrap}>
//         <button
//           type="button"
//           aria-label="Calendar filters"
//           title="Calendar filters"
//           aria-pressed={activeOverlay === "calendar"}
//           onClick={toggleCalendar}
//           style={{
//             ...launcherBase,
//             ...(activeOverlay === "calendar" ? launcherActive : null),
//           }}
//         >
//           📅
//         </button>

//         <button
//           type="button"
//           aria-label="Turn-by-turn directions"
//           title="Turn-by-turn directions"
//           aria-pressed={activeOverlay === "turn"}
//           onClick={toggleTurn}
//           style={{
//             ...launcherBase,
//             marginTop: 11,
//             ...(activeOverlay === "turn" ? launcherActive : null),
//           }}
//         >
//           🧭
//         </button>
//       </div>

//       <EventCalendarOverlay
//         expanded={activeOverlay === "calendar"}
//         onClose={() => setActiveOverlay(null)}
//       />

//       <div
//         style={{
//           ...turnWrap,
//           display: activeOverlay === "turn" ? "block" : "none",
//           pointerEvents: activeOverlay === "turn" ? "auto" : "none",
//         }}
//       >
//         <TurnByTurnOverlay viewReady={viewReady} />
//         <div style={{ position: "absolute", top: 5, right: 5, zIndex: 9999 }}>
//           <button
//             onClick={() => setActiveOverlay(null)}
//             style={closeTurnBtn}
//             title="Close"
//           >
//             ⤫
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ───────── Styles ───────── */

// const dockWrap: React.CSSProperties = {
//   position: "absolute",
//   top: 5,
//   left: 5,
//   zIndex: 2000,
//   pointerEvents: "auto",
//   display: "flex",
//   flexDirection: "column",
//   alignItems: "center",
// };

// const launcherBase: React.CSSProperties = {
//   width: 44,
//   height: 44,
//   borderRadius: "50%",
//   border: "4px solid #000000ff",
//   background: "white",
//   boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
//   cursor: "pointer",
//   fontSize: 20,
//   display: "flex",
//   alignItems: "center",
//   justifyContent: "center",
// };

// const launcherActive: React.CSSProperties = {
//   borderColor: "#2775ff",
//   boxShadow: "0 0 0 3px rgba(39,117,255,0.25), 0 8px 22px rgba(0,0,0,0.22)",
// };

// const turnWrap: React.CSSProperties = {
//   position: "absolute",
//   top: 5,
//   left: 55,
//   zIndex: 1000,
//   pointerEvents: "auto",
// };

// const closeTurnBtn: React.CSSProperties = {
//   border: "none",
//   background: "#fff",
//   borderRadius: 8,
//   cursor: "pointer",
//   padding: "4px 8px",
//   fontWeight: 700,
// };
// "use client";

// import { useEffect, useRef, useState } from "react";
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
//   resortByZ,
// } from "./map/arcgisRefs";
// import "./ArcGISMap.css";
// import EventCalendarOverlay from "./map/MapControls/EventCalendarOverlay";
// import DynamicEventLoader from "./map/MapControls/DynamicEventLoader";
// import TurnByTurnOverlay from "./map/MapControls/TurnByTurnOverlay";
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
//     color: number[];
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
//     fullLocationTag?: string | null;
//     location?: string | null;
//     location_at?: string | null;
//     names?: string[] | null;
//     original?: any | null;
//     fromUser: boolean;
//     iconSize?: number;
//     iconUrl?: string;
//     poster_url?: string;
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
//     mapTile: string | null;
//     baseMap: string;
//     apiSources: string[];
//   };
// }

// /* ─────────────────────────────────────────
//  * Sprite GeoJSON config
//  * ───────────────────────────────────── */

// type SupportedWkid = 4326 | 3857 | 102100;
// type PathPointId = string | number;

// type SpriteRoutePointFeature = {
//   type: "Feature";
//   id?: PathPointId;
//   geometry: {
//     type: "Point";
//     coordinates: [number, number];
//   };
//   properties: {
//     kind: "path-point";
//     order: number;
//     pointId?: PathPointId;
//     wkid?: SupportedWkid;
//     OBJECTID?: PathPointId;
//     [key: string]: any;
//   };
// };

// type SpriteRouteHiddenSegmentFeature = {
//   type: "Feature";
//   id?: string | number;
//   geometry: {
//     type: "LineString";
//     coordinates: [number, number][];
//   };
//   properties: {
//     kind: "hidden-segment";
//     fromId: PathPointId;
//     toId: PathPointId;
//     invisible?: boolean;
//     [key: string]: any;
//   };
// };

// type SpriteRouteFeature =
//   | SpriteRoutePointFeature
//   | SpriteRouteHiddenSegmentFeature;

// type SpriteRouteGeoJSON = {
//   type: "FeatureCollection";
//   crs?: {
//     type: "name";
//     properties: {
//       name: string;
//     };
//   };
//   features: SpriteRouteFeature[];
// };

// type FacingDirection = "up" | "down" | "left" | "right";

// type SpritePathNode = {
//   id: string;
//   point: __esri.Point;
// };

// const SPRITE_ROUTE_URL = "/sprite-route.geojson";

// // 4 frames for each direction = 16 total
// const SPRITE_FRAMES = {
//   up: [
//     "/sprites/bobcat/up/up-1.png",
//     "/sprites/bobcat/up/up-2.png",
//     "/sprites/bobcat/up/up-3.png",
//     "/sprites/bobcat/up/up-4.png",
//   ],
//   down: [
//     "/sprites/bobcat/down/down-1.png",
//     "/sprites/bobcat/down/down-2.png",
//     "/sprites/bobcat/down/down-3.png",
//     "/sprites/bobcat/down/down-4.png",
//   ],
//   left: [
//     "/sprites/bobcat/left/left-1.png",
//     "/sprites/bobcat/left/left-2.png",
//     "/sprites/bobcat/left/left-3.png",
//     "/sprites/bobcat/left/left-4.png",
//   ],
//   right: [
//     "/sprites/bobcat/right/right-1.png",
//     "/sprites/bobcat/right/right-2.png",
//     "/sprites/bobcat/right/right-3.png",
//     "/sprites/bobcat/right/right-4.png",
//   ],
// } as const;

// // const SPRITE_DURATION_MS = 12000;
// const SPRITE_DURATION_MS = 300000;
// const SPRITE_FRAME_MS = 120;

// const normalizePathId = (id: PathPointId | null | undefined): string =>
//   String(id);

// const makeSegmentKey = (a: PathPointId, b: PathPointId): string => {
//   const aId = normalizePathId(a);
//   const bId = normalizePathId(b);
//   return aId < bId ? `${aId}--${bId}` : `${bId}--${aId}`;
// };

// const inferWkidFromCrs = (
//   geojson: SpriteRouteGeoJSON,
// ): SupportedWkid | undefined => {
//   const crsName = geojson.crs?.properties?.name?.toUpperCase() ?? "";

//   if (crsName.includes("3857")) return 3857;
//   if (crsName.includes("102100")) return 102100;
//   if (crsName.includes("4326")) return 4326;

//   return undefined;
// };

// const loadSpriteRouteGeoJSON = async (): Promise<SpriteRouteGeoJSON | null> => {
//   try {
//     const res = await fetch(SPRITE_ROUTE_URL, { cache: "no-store" });
//     if (!res.ok) {
//       console.error(
//         `Failed to load sprite route GeoJSON from ${SPRITE_ROUTE_URL}: ${res.status}`,
//       );
//       return null;
//     }

//     const json = (await res.json()) as SpriteRouteGeoJSON;

//     if (
//       !json ||
//       json.type !== "FeatureCollection" ||
//       !Array.isArray(json.features)
//     ) {
//       console.error("Invalid sprite route GeoJSON:", json);
//       return null;
//     }

//     return json;
//   } catch (err) {
//     console.error("Error loading sprite route GeoJSON:", err);
//     return null;
//   }
// };

// /* ─────────────────────────────────────────
//  * Component
//  * ───────────────────────────────────── */

// export default function ArcGISMap(mapData: ExportBody) {
//   const mapDiv = useRef<HTMLDivElement>(null);

//   type ActiveOverlay = "calendar" | "turn" | null;
//   const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>(null);

//   const [viewReady, setViewReady] = useState(false);

//   const storeListenerRef = useRef<EventListener | null>(null);
//   const spriteAnimRef = useRef<number | null>(null);

//   useEffect(() => {
//     let destroyed = false;
//     let viewRef: __esri.MapView | null = null;
//     let pollId: number | null = null;

//     setViewReady(false);

//     const startArcGIS = () => {
//       if (destroyed) return;

//       const amd = (window as any).require;
//       if (!amd) return;

//       amd(
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
//           "esri/layers/WebTileLayer",
//           "esri/widgets/Locate",
//           "esri/widgets/Track",
//           "esri/layers/TileLayer",
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
//           WebTileLayer: any,
//           Locate: any,
//           Track: any,
//           TileLayer: any,
//         ) => {
//           if (destroyed) return;

//           const isLonLat = (x: number, y: number) =>
//             Math.abs(x) <= 180 && Math.abs(y) <= 90;

//           const toViewSR = (geom: __esri.Geometry | any): __esri.Geometry => {
//             const wkid = geom?.spatialReference?.wkid;

//             if (wkid === 3857 || wkid === 102100) return geom;

//             if (wkid === 4326) {
//               return webMercatorUtils.geographicToWebMercator(geom);
//             }

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
//                 }),
//               );
//             }

//             return geom;
//           };

//           const computeLabelPoint = (poly: __esri.Polygon): __esri.Point => {
//             try {
//               const p = geometryEngine.labelPoints(poly);
//               if (p) {
//                 return new Point({
//                   x: p.x,
//                   y: p.y,
//                   spatialReference: { wkid: 3857 },
//                 });
//               }
//             } catch {}

//             const c1 = (poly as any).centroid;
//             if (c1) {
//               return new Point({
//                 x: c1.x,
//                 y: c1.y,
//                 spatialReference: { wkid: 3857 },
//               });
//             }

//             if (poly.extent?.center) {
//               return new Point({
//                 x: poly.extent.center.x,
//                 y: poly.extent.center.y,
//                 spatialReference: { wkid: 3857 },
//               });
//             }

//             const ring = poly.rings?.[0] ?? [];
//             let minX = Infinity;
//             let maxX = -Infinity;
//             let minY = Infinity;
//             let maxY = -Infinity;

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

//           const createSpriteSymbol = (url: string) => ({
//             type: "picture-marker",
//             url,
//             width: "42px",
//             height: "42px",
//             yoffset: "14px",
//           });

//           const toPathPoint3857 = (
//             x: number,
//             y: number,
//             wkid: SupportedWkid,
//           ): __esri.Point => {
//             const pt = new Point({
//               x,
//               y,
//               spatialReference: { wkid },
//             });

//             return toViewSR(pt) as __esri.Point;
//           };

//           const getFacing = (
//             a: __esri.Point,
//             b: __esri.Point,
//           ): FacingDirection => {
//             const dx = b.x - a.x;
//             const dy = b.y - a.y;

//             if (Math.abs(dx) >= Math.abs(dy)) {
//               return dx >= 0 ? "right" : "left";
//             }

//             return dy >= 0 ? "up" : "down";
//           };

//           const lerpPoint = (
//             a: __esri.Point,
//             b: __esri.Point,
//             t: number,
//           ): __esri.Point =>
//             new Point({
//               x: a.x + (b.x - a.x) * t,
//               y: a.y + (b.y - a.y) * t,
//               spatialReference: { wkid: 3857 },
//             });

//           esriConfig.apiKey =
//             (window as any).__ARCGIS_API_KEY__ ||
//             process.env.NEXT_PUBLIC_ARCGIS_API_KEY;

//           const map = new EsriMap({ basemap: mapData.settings.baseMap });

//           const [cx, cy] = mapData.settings.center;
//           const centerPoint =
//             Math.abs(cx) <= 180 && Math.abs(cy) <= 90
//               ? webMercatorUtils.geographicToWebMercator(
//                   new Point({
//                     x: cx,
//                     y: cy,
//                     spatialReference: { wkid: 4326 },
//                   }),
//                 )
//               : new Point({ x: cx, y: cy, spatialReference: { wkid: 3857 } });

//           const view: __esri.MapView = new MapView({
//             container: mapDiv.current as HTMLDivElement,
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

//           viewRef = view;
//           MapViewRef.current = view;

//           const popup = view.popup;
//           if (popup) {
//             popup.dockEnabled = false;
//             popup.dockOptions = {
//               breakpoint: false,
//             };
//           }

//           view.ui.move("zoom", "bottom-right");

//           const locateWidget = new Locate({ view });
//           locateWidget.goToOverride = (view: __esri.MapView, options: any) => {
//             options.target.scale = 1500;
//             return view.goTo(options.target);
//           };
//           view.ui.add(locateWidget, "top-right");

//           const trackWidget = new Track({
//             view,
//             graphic: new Graphic({
//               symbol: {
//                 type: "simple-marker",
//                 size: "12px",
//                 color: "green",
//                 outline: {
//                   color: "#efefef",
//                   width: "1.5px",
//                 },
//               },
//             }),
//             useHeadingEnabled: true,
//           });
//           view.ui.add(trackWidget, "top-right");

//           /* Layers */
//           const editingLayer = new GraphicsLayer({ id: "editing" });
//           const finalizedLayer = new GraphicsLayer({ id: "finalized" });
//           const labelsLayer = new GraphicsLayer({ id: "labels" });
//           const eventsLayer = new GraphicsLayer({
//             id: "events-layer",
//             title: "Campus Events",
//             listMode: "show",
//           });
//           const spriteLayer = new GraphicsLayer({
//             id: "sprite-layer",
//             title: "Animated Sprite",
//             listMode: "hide",
//           });

//           eventsLayerRef.current = eventsLayer;

//           const tileSrc = mapData.settings.mapTile;

//           const campusTiles =
//             tileSrc && /\/MapServer\/?$/i.test(tileSrc)
//               ? new TileLayer({
//                   url: tileSrc,
//                   id: "campus-tiles",
//                   opacity: 1,
//                 })
//               : tileSrc
//                 ? new WebTileLayer({
//                     urlTemplate: tileSrc,
//                     id: "campus-xyz",
//                     opacity: 1,
//                   })
//                 : null;

//           const mediaLayer = new (MediaLayer as any)({
//             source: [
//               new ImageElement({
//                 image:
//                   "https://campusmap.ucmercedhub.com/maps/images/rufa/rufa-mini.png",
//                 georeference: new ExtentAndRotationGeoreference({
//                   extent: new Extent({
//                     xmin: -13406409.47,
//                     ymin: 4488936.09,
//                     xmax: -13404924.08,
//                     ymax: 4490876.39,
//                     spatialReference: { wkid: 102100 },
//                   }),
//                   rotation: 0,
//                 }),
//               }),
//             ],
//           });

//           (mediaLayer as any).z = 20;
//           if (campusTiles) {
//             (campusTiles as any).z = 15;
//           }

//           (finalizedLayer as any).z = 30;
//           (editingLayer as any).z = 40;
//           (spriteLayer as any).z = 65;
//           (eventsLayer as any).z = 75;

//           (labelsLayer as any).z = 80;

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
//             ...(campusTiles ? [campusTiles] : []),
//             ...featureLayers,
//             // mediaLayer,
//             finalizedLayer,
//             editingLayer,
//             eventsLayer,
//             spriteLayer,
//             labelsLayer,
//           ].filter(Boolean);

//           map.addMany(allLayers);
//           resortByZ(map);
//           (map.layers as any).on("change", () => resortByZ(map));

//           /* Labels visibility */
//           const applyLabelVisibility = (zoom: number) => {
//             labelBuckets.forEach((bucket) => {
//               const show = zoom >= bucket.minZoom && zoom <= bucket.maxZoom;
//               bucket.labels.forEach((lbl) => {
//                 lbl.visible = show;
//               });
//             });
//           };

//           /* Build labels from polygons */
//           const rebuildAllLabelsFromPolygons = (
//             savedLabelMap: globalThis.Map<string, LabelDTO>,
//           ) => {
//             labelsLayer.removeAll();

//             finalizedLayer.graphics.toArray().forEach((polyG: any) => {
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

//           /* Sprite animation */
//           const startSpriteAnimation = (routeGeoJSON: SpriteRouteGeoJSON) => {
//             const defaultWkid = inferWkidFromCrs(routeGeoJSON) ?? 3857;

//             const pointFeatures = routeGeoJSON.features
//               .filter(
//                 (feature): feature is SpriteRoutePointFeature =>
//                   feature.geometry?.type === "Point" &&
//                   feature.properties?.kind === "path-point",
//               )
//               .sort((a, b) => a.properties.order - b.properties.order);

//             const basePathNodes: SpritePathNode[] = pointFeatures.map(
//               (feature) => {
//                 const [x, y] = feature.geometry.coordinates;
//                 const pointId =
//                   feature.id ??
//                   feature.properties.pointId ??
//                   feature.properties.OBJECTID;

//                 return {
//                   id: normalizePathId(pointId),
//                   point: toPathPoint3857(
//                     x,
//                     y,
//                     feature.properties.wkid ?? defaultWkid,
//                   ),
//                 };
//               },
//             );

//             if (basePathNodes.length < 2) {
//               console.warn(
//                 "Sprite route GeoJSON needs at least 2 path-point features.",
//               );
//               return;
//             }

//             const hiddenSegmentKeys = new Set(
//               routeGeoJSON.features
//                 .filter(
//                   (feature): feature is SpriteRouteHiddenSegmentFeature =>
//                     feature.geometry?.type === "LineString" &&
//                     feature.properties?.kind === "hidden-segment",
//                 )
//                 .filter((feature) => feature.properties.invisible !== false)
//                 .map((feature) =>
//                   makeSegmentKey(
//                     feature.properties.fromId,
//                     feature.properties.toId,
//                   ),
//                 ),
//             );

//             const firstNode = basePathNodes[0];
//             const lastNode = basePathNodes[basePathNodes.length - 1];

//             const pathNodes =
//               firstNode.point.x === lastNode.point.x &&
//               firstNode.point.y === lastNode.point.y
//                 ? basePathNodes
//                 : [...basePathNodes, firstNode];

//             const segmentLengths: number[] = [];
//             let totalLength = 0;

//             for (let i = 0; i < pathNodes.length - 1; i++) {
//               const a = pathNodes[i].point;
//               const b = pathNodes[i + 1].point;
//               const len = Math.hypot(b.x - a.x, b.y - a.y);
//               segmentLengths.push(len);
//               totalLength += len;
//             }

//             if (totalLength <= 0) return;

//             const spriteGraphic = new Graphic({
//               geometry: pathNodes[0].point,
//               symbol: createSpriteSymbol(SPRITE_FRAMES.down[0]),
//               attributes: { id: "animated-sprite" },
//               visible: true,
//             });

//             spriteLayer.removeAll();
//             spriteLayer.add(spriteGraphic);

//             let startTs: number | null = null;
//             let lastUrl = "";

//             const frame = (ts: number) => {
//               if (destroyed) return;

//               if (startTs === null) startTs = ts;

//               const elapsed = (ts - startTs) % SPRITE_DURATION_MS;
//               const targetDistance =
//                 (elapsed / SPRITE_DURATION_MS) * totalLength;

//               let walked = 0;
//               let segIndex = 0;

//               while (
//                 segIndex < segmentLengths.length - 1 &&
//                 walked + segmentLengths[segIndex] < targetDistance
//               ) {
//                 walked += segmentLengths[segIndex];
//                 segIndex++;
//               }

//               const fromNode = pathNodes[segIndex];
//               const toNode = pathNodes[segIndex + 1];

//               const a = fromNode.point;
//               const b = toNode.point;
//               const segLen = segmentLengths[segIndex] || 1;
//               const t = Math.max(
//                 0,
//                 Math.min(1, (targetDistance - walked) / segLen),
//               );

//               spriteGraphic.geometry = lerpPoint(a, b, t);

//               const isHidden = hiddenSegmentKeys.has(
//                 makeSegmentKey(fromNode.id, toNode.id),
//               );

//               spriteGraphic.visible = !isHidden;

//               const facing = getFacing(a, b);
//               const frames = SPRITE_FRAMES[facing];
//               const frameIndex =
//                 Math.floor(ts / SPRITE_FRAME_MS) % frames.length;
//               const nextUrl = frames[frameIndex];

//               if (nextUrl !== lastUrl) {
//                 spriteGraphic.symbol = createSpriteSymbol(nextUrl);
//                 lastUrl = nextUrl;
//               }

//               spriteAnimRef.current = window.requestAnimationFrame(frame);
//             };

//             if (spriteAnimRef.current !== null) {
//               window.cancelAnimationFrame(spriteAnimRef.current);
//               spriteAnimRef.current = null;
//             }

//             spriteAnimRef.current = window.requestAnimationFrame(frame);
//           };

//           /* Initial data load */
//           const data = {
//             polygons: mapData.polygons || [],
//             labels: mapData.labels || [],
//             events: mapData.events || [],
//           };

//           (data.polygons || []).forEach((p) => {
//             const polyGeom = Polygon.fromJSON(p.geometry);
//             const projectedGeom = toViewSR(polyGeom) as __esri.Polygon;

//             const polyGraphic = new Graphic({
//               geometry: projectedGeom,
//               symbol: p.symbol,
//               attributes: p.attributes,
//               popupTemplate: {
//                 title: p.attributes.name,
//                 content: p.attributes.description,
//               },
//             });

//             finalizedLayer.add(polyGraphic);
//           });

//           const savedLabelMap = new globalThis.Map<string, LabelDTO>();
//           (data.labels || []).forEach((l) => {
//             if (l?.attributes?.parentId) {
//               savedLabelMap.set(l.attributes.parentId, l);
//             }
//           });

//           rebuildAllLabelsFromPolygons(savedLabelMap);

//           (data.events || []).forEach((ev) => {
//             try {
//               const srcPt = new Point({
//                 x: ev.geometry.x,
//                 y: ev.geometry.y,
//                 spatialReference: {
//                   wkid: 4326,
//                 },
//               });

//               const pt3857 = toViewSR(srcPt) as __esri.Point;

//               console.log(ev);

//               const ce: CampusEvent = {
//                 id: ev.attributes.id || `evt-${Date.now()}`,
//                 event_name: ev.attributes.event_name || "Event",
//                 description: ev.attributes.description ?? undefined,
//                 date: ev.attributes.date ?? undefined,
//                 startAt: ev.attributes.startAt ?? undefined,
//                 endAt: ev.attributes.endAt ?? undefined,
//                 locationTag:
//                   (ev.attributes.fullLocationTag ||
//                     ev.attributes.location_at) ??
//                   undefined,
//                 location: ev.attributes.location ?? undefined,
//                 location_at: ev.attributes.location_at ?? undefined,
//                 names: ev.attributes.names ?? undefined,
//                 original: ev.attributes.original ?? undefined,
//                 geometry: { x: pt3857.x, y: pt3857.y, wkid: 3857 },
//                 fromUser: ev.attributes.fromUser,
//                 iconSize: ev.attributes.iconSize ?? 36,
//                 iconUrl: ev.attributes.iconUrl ?? "/icons/event-pin.png",
//                 poster_url: ev.attributes.poster_url,
//               };

//               eventsLayer.add(toEventGraphic(Graphic, ce));
//             } catch (e) {
//               console.error("Failed to load event:", ev, e);
//             }
//           });

//           view.when(async () => {
//             applyLabelVisibility(view.zoom);
//             setViewReady(true);

//             const routeGeoJSON = await loadSpriteRouteGeoJSON();
//             if (destroyed || !routeGeoJSON) return;

//             startSpriteAnimation(routeGeoJSON);
//           });

//           finalizedLayerRef.events.dispatchEvent(new Event("change"));

//           editingLayerRef.current = editingLayer;
//           setFinalizedLayer(finalizedLayer);
//           setLabelsLayer(labelsLayer);
//           GraphicRef.current = Graphic;

//           for (const ev of eventsStore.items) {
//             let finalEv = ev;

//             try {
//               if (ev.geometry.wkid === 4326) {
//                 const pt = new Point({
//                   x: ev.geometry.x,
//                   y: ev.geometry.y,
//                   spatialReference: { wkid: 4326 },
//                 });

//                 const proj = toViewSR(pt) as __esri.Point;
//                 finalEv = {
//                   ...ev,
//                   geometry: { x: proj.x, y: proj.y, wkid: 3857 },
//                 };
//               }

//               eventsLayer.add(toEventGraphic(Graphic, finalEv));
//             } catch (e) {
//               console.error("Error loading store event", e);
//             }
//           }

//           const onEventAdded = (e: Event) => {
//             const custom = e as CustomEvent<CampusEvent>;
//             const ev = custom.detail;
//             if (!ev) return;

//             try {
//               let finalEv = ev;

//               if (ev.geometry.wkid === 4326) {
//                 const pt = new Point({
//                   x: ev.geometry.x,
//                   y: ev.geometry.y,
//                   spatialReference: { wkid: 4326 },
//                 });

//                 const proj = toViewSR(pt) as __esri.Point;
//                 finalEv = {
//                   ...ev,
//                   geometry: { x: proj.x, y: proj.y, wkid: 3857 },
//                 };
//               }

//               eventsLayer.add(toEventGraphic(Graphic, finalEv));
//               console.log(
//                 "📍 Added new dynamic event to map:",
//                 finalEv.event_name,
//               );
//             } catch (err) {
//               console.error("Error adding dynamic event to map:", err);
//             }
//           };

//           eventsStore.events.addEventListener("added", onEventAdded);
//           storeListenerRef.current = onEventAdded;

//           view.watch("zoom", (z: number) => applyLabelVisibility(z));

//           finalizedLayer.graphics.on("change", () => {
//             const savedLabelMap2 = new globalThis.Map<string, LabelDTO>();

//             labelsLayer.graphics.toArray().forEach((lbl: any) => {
//               const att = lbl.attributes;
//               if (att?.parentId) {
//                 savedLabelMap2.set(att.parentId, {
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

//             rebuildAllLabelsFromPolygons(savedLabelMap2);
//           });
//         },
//       );
//     };

//     if ((window as any).require) {
//       startArcGIS();
//     } else {
//       let tries = 0;

//       pollId = window.setInterval(() => {
//         if (destroyed) {
//           if (pollId !== null) {
//             window.clearInterval(pollId);
//             pollId = null;
//           }
//           return;
//         }

//         if ((window as any).require) {
//           if (pollId !== null) {
//             window.clearInterval(pollId);
//             pollId = null;
//           }
//           startArcGIS();
//         } else if (tries++ > 200) {
//           if (pollId !== null) {
//             window.clearInterval(pollId);
//             pollId = null;
//           }
//           console.error("ArcGIS AMD loader not available after waiting.");
//         }
//       }, 100) as unknown as number;
//     }

//     return () => {
//       destroyed = true;

//       if (pollId !== null) {
//         window.clearInterval(pollId);
//         pollId = null;
//       }

//       if (spriteAnimRef.current !== null) {
//         window.cancelAnimationFrame(spriteAnimRef.current);
//         spriteAnimRef.current = null;
//       }

//       if (storeListenerRef.current) {
//         eventsStore.events.removeEventListener(
//           "added",
//           storeListenerRef.current,
//         );
//         storeListenerRef.current = null;
//       }

//       if (viewRef) {
//         viewRef.destroy();
//         viewRef = null;
//         MapViewRef.current = null as any;
//         eventsLayerRef.current = null as any;
//         GraphicRef.current = null as any;
//         setViewReady(false);
//       }
//     };
//   }, [mapData]);

//   const toggleCalendar = () => {
//     setActiveOverlay((cur) => (cur === "calendar" ? null : "calendar"));
//   };

//   const toggleTurn = () => {
//     setActiveOverlay((cur) => (cur === "turn" ? null : "turn"));
//   };

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

//       {viewReady && (
//         <DynamicEventLoader eventSources={mapData.eventSources ?? []} />
//       )}

//       <div style={dockWrap}>
//         <button
//           type="button"
//           aria-label="Calendar filters"
//           title="Calendar filters"
//           aria-pressed={activeOverlay === "calendar"}
//           onClick={toggleCalendar}
//           style={{
//             ...launcherBase,
//             ...(activeOverlay === "calendar" ? launcherActive : null),
//           }}
//         >
//           📅
//         </button>

//         <button
//           type="button"
//           aria-label="Turn-by-turn directions"
//           title="Turn-by-turn directions"
//           aria-pressed={activeOverlay === "turn"}
//           onClick={toggleTurn}
//           style={{
//             ...launcherBase,
//             marginTop: 11,
//             ...(activeOverlay === "turn" ? launcherActive : null),
//           }}
//         >
//           🧭
//         </button>
//       </div>

//       <EventCalendarOverlay
//         expanded={activeOverlay === "calendar"}
//         onClose={() => setActiveOverlay(null)}
//       />

//       <div
//         style={{
//           ...turnWrap,
//           display: activeOverlay === "turn" ? "block" : "none",
//           pointerEvents: activeOverlay === "turn" ? "auto" : "none",
//         }}
//       >
//         <TurnByTurnOverlay viewReady={viewReady} />
//         <div style={{ position: "absolute", top: 5, right: 5, zIndex: 9999 }}>
//           <button
//             onClick={() => setActiveOverlay(null)}
//             style={closeTurnBtn}
//             title="Close"
//           >
//             ⤫
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ───────── Styles ───────── */

// const dockWrap: React.CSSProperties = {
//   position: "absolute",
//   top: 5,
//   left: 5,
//   zIndex: 2000,
//   pointerEvents: "auto",
//   display: "flex",
//   flexDirection: "column",
//   alignItems: "center",
// };

// const launcherBase: React.CSSProperties = {
//   width: 44,
//   height: 44,
//   borderRadius: "50%",
//   border: "4px solid #000000ff",
//   background: "white",
//   boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
//   cursor: "pointer",
//   fontSize: 20,
//   display: "flex",
//   alignItems: "center",
//   justifyContent: "center",
// };

// const launcherActive: React.CSSProperties = {
//   borderColor: "#2775ff",
//   boxShadow: "0 0 0 3px rgba(39,117,255,0.25), 0 8px 22px rgba(0,0,0,0.22)",
// };

// const turnWrap: React.CSSProperties = {
//   position: "absolute",
//   top: 5,
//   left: 55,
//   zIndex: 1000,
//   pointerEvents: "auto",
// };

// const closeTurnBtn: React.CSSProperties = {
//   border: "none",
//   background: "#fff",
//   borderRadius: 8,
//   cursor: "pointer",
//   padding: "4px 8px",
//   fontWeight: 700,
// };
