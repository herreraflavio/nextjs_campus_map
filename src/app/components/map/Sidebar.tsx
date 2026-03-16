"use client";

import { useState, useEffect } from "react";
import {
  labelsLayerRef,
  finalizedLayerRef,
  MapViewRef,
  settingsRef,
  settingsEvents,
} from "./arcgisRefs";
import { rebuildBuckets } from "./bucketManager";
import Extent from "@arcgis/core/geometry/Extent";
import { useSession } from "next-auth/react";
import { useMapId } from "@/app/context/MapContext";
import { saveMapToServer } from "@/app/helper/saveMap";

// Icons
import SettingsIcon from "@mui/icons-material/Settings";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import CloseIcon from "@mui/icons-material/Close";

import {
  TextField,
  Slider,
  Typography,
  Button,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Box,
  IconButton,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
} from "@mui/material";

import MapControls, { Constraints } from "./MapControls";
import type {
  FeatureLayerConfig as SharedFeatureLayerConfig,
  HiddenSegmentRange,
  PolylineAnimation,
  VertexPause,
} from "@/app/types/myTypes";
import {
  createDefaultPolylineAnimation,
  normalizePolylineAnimation,
} from "@/app/types/myTypes";

// ─── Coordinate Helper Functions ──────────────────────────────────────
const R = 6378137;

function mercatorToLonLat(
  x: string | number,
  y: string | number,
): [number, number] {
  const xFloat = typeof x === "string" ? parseFloat(x) : x;
  const yFloat = typeof y === "string" ? parseFloat(y) : y;
  const lon = (xFloat / R) * (180 / Math.PI);
  const lat =
    (2 * Math.atan(Math.exp(yFloat / R)) - Math.PI / 2) * (180 / Math.PI);
  return [lon, lat];
}

function lonLatToMercator(
  lon: string | number,
  lat: string | number,
): [number, number] {
  const lonFloat = typeof lon === "string" ? parseFloat(lon) : lon;
  const latFloat = typeof lat === "string" ? parseFloat(lat) : lat;
  const x = lonFloat * (Math.PI / 180) * R;
  const latRad = latFloat * (Math.PI / 180);
  const y = R * Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  return [x, y];
}

export interface FeatureLayerConfig extends SharedFeatureLayerConfig {
  id: string;
}

type DrawableGeometryType = "polygon" | "polyline" | "point";
type SpriteDirection = "up" | "down" | "left" | "right";

const SPRITE_DIRECTIONS: SpriteDirection[] = ["up", "down", "left", "right"];

function genId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `layer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeLayers(
  layers: Partial<FeatureLayerConfig>[],
): FeatureLayerConfig[] {
  return [...(layers ?? [])]
    .map((l, i) => ({
      id: (l as FeatureLayerConfig).id ?? genId(),
      url: String(l.url ?? ""),
      index: typeof l.index === "number" ? l.index : i,
      outFields: (l.outFields as string[]) ?? ["*"],
      popupEnabled: !!l.popupEnabled,
      popupTemplate: l.popupTemplate as FeatureLayerConfig["popupTemplate"],
    }))
    .sort((a, b) => a.index - b.index);
}

const DEFAULT_APISOURCES: string[] = [];

function coerceStringArray(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function sanitizeFrameList(value: string[]): string[] {
  return value
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 4);
}

function getUploadUrlFromResponse(payload: any): string | null {
  const candidates = [
    payload?.url,
    payload?.imageUrl,
    payload?.location,
    payload?.fileUrl,
    payload?.data?.url,
    payload?.data?.imageUrl,
    payload?.data?.location,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

// ─── Interactive SVG Map Renderer ─────────────────────────────────────
const PolylineMap = ({
  paths,
  hiddenSegments,
  baseWidth,
  baseHeight,
  interactive,
}: {
  paths: number[][][];
  hiddenSegments: HiddenSegmentRange[];
  baseWidth: number;
  baseHeight: number;
  interactive: boolean;
}) => {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Reset transform when new paths are loaded
  useEffect(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, [paths]);

  // Calculate bounding box for initial fitting
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  paths.forEach((path) =>
    path.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }),
  );

  const padding = 20;
  const rangeX = Math.max(maxX - minX, 0.0001);
  const rangeY = Math.max(maxY - minY, 0.0001);

  const scaleX = (baseWidth - 2 * padding) / rangeX;
  const scaleY = (baseHeight - 2 * padding) / rangeY;
  const initialScale = Math.min(scaleX, scaleY);

  const toSvgCoords = (x: number, y: number) => {
    const svgX =
      padding +
      (x - minX) * initialScale +
      (baseWidth - 2 * padding - rangeX * initialScale) / 2;
    const svgY =
      padding +
      (maxY - y) * initialScale +
      (baseHeight - 2 * padding - rangeY * initialScale) / 2; // Flip Y
    return { x: svgX, y: svgY };
  };

  // Interactivity Handlers
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newScale = Math.max(0.2, Math.min(transform.scale * zoomFactor, 50));
    const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
    const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale);

    setTransform({ x: newX, y: newY, scale: newScale });
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive || !isDragging) return;
    setTransform({
      ...transform,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Safe scale to prevent division by zero in styling
  const currentScale = Math.max(0.01, transform.scale);

  let segmentGlobalIndex = 0;
  const elements: React.ReactNode[] = [];

  paths.forEach((path, pIdx) => {
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = toSvgCoords(path[i][0], path[i][1]);
      const p2 = toSvgCoords(path[i + 1][0], path[i + 1][1]);
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const currentSegIndex = segmentGlobalIndex++;

      const isHidden = hiddenSegments.some(
        (h) =>
          currentSegIndex >= h.startSegmentIndex &&
          currentSegIndex <= h.endSegmentIndex,
      );

      // Draw line segment
      elements.push(
        <line
          key={`line-${pIdx}-${i}`}
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={isHidden ? "#f44336" : "#1976d2"}
          strokeWidth={(isHidden ? 2 : 3) / currentScale}
          strokeDasharray={
            isHidden ? `${4 / currentScale},${4 / currentScale}` : "none"
          }
        />,
      );

      // Draw vertex points
      elements.push(
        <circle
          key={`pt-${pIdx}-${i}`}
          cx={p1.x}
          cy={p1.y}
          r={3 / currentScale}
          fill="#555"
        />,
      );
      if (i === path.length - 2) {
        elements.push(
          <circle
            key={`pt-${pIdx}-${i + 1}`}
            cx={p2.x}
            cy={p2.y}
            r={3 / currentScale}
            fill="#555"
          />,
        );
      }

      // Draw segment number at midpoint
      elements.push(
        <text
          key={`txt-${pIdx}-${i}`}
          x={midX}
          y={midY - 6 / currentScale}
          fontSize={11 / currentScale}
          fill={isHidden ? "#f44336" : "#000"}
          textAnchor="middle"
          fontWeight="bold"
          style={{
            paintOrder: "stroke",
            stroke: "#fff",
            strokeWidth: 3 / currentScale,
            strokeLinecap: "butt",
            strokeLinejoin: "miter",
            userSelect: "none",
          }}
        >
          {currentSegIndex}
        </text>,
      );
    }
  });

  return (
    <svg
      width="100%"
      height={baseHeight}
      viewBox={`0 0 ${baseWidth} ${baseHeight}`}
      style={{
        backgroundColor: "#f9f9f9",
        borderRadius: interactive ? 0 : 8,
        border: interactive ? "none" : "1px solid #e0e0e0",
        cursor: interactive ? (isDragging ? "grabbing" : "grab") : "default",
        touchAction: "none", // Prevents page scrolling when panning on touch/trackpads
      }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <g
        transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
      >
        {elements}
      </g>
    </svg>
  );
};

// ─── Main Polyline Preview Component (Handles Modal) ──────────────────
const PolylinePreview = ({
  paths,
  hiddenSegments,
}: {
  paths: number[][][];
  hiddenSegments: HiddenSegmentRange[];
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!paths || paths.length === 0 || paths[0].length < 2) {
    return (
      <Typography variant="body2">No polyline data to preview.</Typography>
    );
  }

  return (
    <Box sx={{ mt: 1, mb: 2, position: "relative" }}>
      {/* Mini Map */}
      <PolylineMap
        paths={paths}
        hiddenSegments={hiddenSegments}
        baseWidth={340}
        baseHeight={150}
        interactive={false}
      />

      <IconButton
        size="small"
        sx={{
          position: "absolute",
          top: 4,
          right: 4,
          bgcolor: "rgba(255,255,255,0.8)",
          "&:hover": { bgcolor: "white" },
        }}
        onClick={() => setExpanded(true)}
      >
        <FullscreenIcon fontSize="small" />
      </IconButton>

      {/* Expanded Interactive Map Dialog */}
      <Dialog
        open={expanded}
        onClose={() => setExpanded(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          Expanded Polyline Preview
          <IconButton onClick={() => setExpanded(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent
          dividers
          sx={{ p: 0, overflow: "hidden", position: "relative" }}
        >
          <PolylineMap
            paths={paths}
            hiddenSegments={hiddenSegments}
            baseWidth={800}
            baseHeight={550}
            interactive={true}
          />
          <Typography
            variant="caption"
            sx={{
              position: "absolute",
              bottom: 16,
              left: 16,
              bgcolor: "rgba(255,255,255,0.85)",
              px: 1,
              py: 0.5,
              borderRadius: 1,
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              pointerEvents: "none",
            }}
          >
            Scroll to zoom, drag to pan
          </Typography>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default function Sidebar() {
  // ─── Drawing-editing state ───────────────────────────────────────────
  const [polygonList, setPolygonList] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingGeometryType, setEditingGeometryType] =
    useState<DrawableGeometryType | null>(null);

  // Track geometry paths for polyline preview
  const [editingPaths, setEditingPaths] = useState<number[][][]>([]);

  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#ffffff");
  const [editAlpha, setEditAlpha] = useState(0.6);
  const [editHTML, setEditHTML] = useState("");
  const [editFontSize, setEditFontSize] = useState(12);
  const [editWidth, setEditWidth] = useState(3);
  const [editPointSize, setEditPointSize] = useState(10);

  const [minZoomEnabled, setMinZoomEnabled] = useState(false);
  const [maxZoomEnabled, setMaxZoomEnabled] = useState(false);
  const [minZoomLevel, setMinZoomLevel] = useState<string>("14");
  const [maxZoomLevel, setMaxZoomLevel] = useState<string>("18");

  // ─── Polyline animation state ───────────────────────────────────────
  const [animationEnabled, setAnimationEnabled] = useState(false);
  const [motionDurationMs, setMotionDurationMs] = useState(20000);
  const [motionLoop, setMotionLoop] = useState(true);
  const [motionReverse, setMotionReverse] = useState(false);
  const [motionAutoPlay, setMotionAutoPlay] = useState(true);
  const [motionStartProgress, setMotionStartProgress] = useState(0);

  const [spriteFrameMs, setSpriteFrameMs] = useState(120);
  const [spriteScale, setSpriteScale] = useState(1);
  const [spriteOffsetPxX, setSpriteOffsetPxX] = useState(0);
  const [spriteOffsetPxY, setSpriteOffsetPxY] = useState(0);
  const [spriteAnchor, setSpriteAnchor] = useState<"center" | "bottom">(
    "bottom",
  );

  const [directionalFrames, setDirectionalFrames] = useState<
    Record<SpriteDirection, string[]>
  >({
    up: [],
    down: [],
    left: [],
    right: [],
  });

  const [hiddenSegments, setHiddenSegments] = useState<HiddenSegmentRange[]>(
    [],
  );
  const [vertexPauses, setVertexPauses] = useState<VertexPause[]>([]);

  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ─── Auth & map context ─────────────────────────────────────────────
  const { data: session } = useSession();
  const userEmail = session?.user?.email;
  const mapId = useMapId();

  // ─── Map Settings UI state ──────────────────────────────────────────
  const [openSettings, setOpenSettings] = useState(false);

  // Center is stored as Lon/Lat strings for UI
  const [center, setCenter] = useState({ x: "", y: "" });
  const [zoom, setZoom] = useState(10);

  const [layers, setLayers] = useState<FeatureLayerConfig[]>([]);
  const [mapTile, setMapTile] = useState<string | null>(null);
  const [baseMap, setBaseMap] = useState<string | null>(null);
  const [apiSources, setApiSources] = useState<string[]>(DEFAULT_APISOURCES);
  const [fieldNameById, setFieldNameById] = useState<Record<string, string>>(
    {},
  );

  // Constraints stored as Lon/Lat strings for UI
  const [constraints, setConstraints] = useState<Constraints>({
    xmin: "",
    ymin: "",
    xmax: "",
    ymax: "",
  });

  const view = MapViewRef.current!;

  function resetAnimationEditorFrom(animation?: unknown) {
    const a = normalizePolylineAnimation(
      animation ?? createDefaultPolylineAnimation(),
    );

    setAnimationEnabled(a.enabled);
    setMotionDurationMs(a.motion.durationMs);
    setMotionLoop(a.motion.loop);
    setMotionReverse(a.motion.reverse);
    setMotionAutoPlay(a.motion.autoPlay);
    setMotionStartProgress(a.motion.startProgress);

    setSpriteFrameMs(a.sprite.frameMs);
    setSpriteScale(a.sprite.scale);
    setSpriteOffsetPxX(a.sprite.offsetPxX);
    setSpriteOffsetPxY(a.sprite.offsetPxY);
    setSpriteAnchor(a.sprite.anchor);

    setDirectionalFrames({
      up: [...a.sprite.directionalFrames.up],
      down: [...a.sprite.directionalFrames.down],
      left: [...a.sprite.directionalFrames.left],
      right: [...a.sprite.directionalFrames.right],
    });

    setHiddenSegments(a.behavior.hiddenSegments.map((item) => ({ ...item })));
    setVertexPauses(a.behavior.vertexPauses.map((item) => ({ ...item })));
  }

  // ─── Helper: store center in the MapView SR (Web Mercator) ──────────
  function setMapCenterInViewSR(x: number, y: number) {
    const sr = MapViewRef.current?.spatialReference ?? {
      wkid: 3857,
      latestWkid: 3857,
    };
    settingsRef.current.center = { spatialReference: sr, x, y } as any;
    settingsEvents.dispatchEvent(new Event("change"));
  }

  // ─── Capture Actions (Use Current View) ─────────────────────────────
  const handleCapture = (type: "center" | "zoom" | "constraints") => {
    const v = MapViewRef.current;
    if (!v) return;

    if (type === "center") {
      const { x, y } = v.center;
      const [lon, lat] = mercatorToLonLat(x, y);
      setCenter({ x: lon.toFixed(6), y: lat.toFixed(6) });
    }

    if (type === "zoom") {
      setZoom(v.zoom);
    }

    if (type === "constraints") {
      const ext = v.extent;
      if (ext) {
        const [minLon, minLat] = mercatorToLonLat(ext.xmin, ext.ymin);
        const [maxLon, maxLat] = mercatorToLonLat(ext.xmax, ext.ymax);

        setConstraints({
          xmin: minLon.toFixed(6),
          ymin: minLat.toFixed(6),
          xmax: maxLon.toFixed(6),
          ymax: maxLat.toFixed(6),
        });
      }
    }
  };

  // ─── Toggle Settings (Load from State) ──────────────────────────────
  const toggleSettings = () => {
    if (!openSettings && view) {
      const c = settingsRef.current.center as { x: number; y: number };
      const [lon, lat] = mercatorToLonLat(c.x, c.y);
      setCenter({ x: String(lon), y: String(lat) });

      setZoom(settingsRef.current.zoom);

      const cons = settingsRef.current.constraints;
      if (cons) {
        const [minLon, minLat] = mercatorToLonLat(cons.xmin, cons.ymin);
        const [maxLon, maxLat] = mercatorToLonLat(cons.xmax, cons.ymax);
        setConstraints({
          xmin: String(minLon),
          ymin: String(minLat),
          xmax: String(maxLon),
          ymax: String(maxLat),
        });
      } else {
        setConstraints({ xmin: "", ymin: "", xmax: "", ymax: "" });
      }
    }

    const featureLayers = normalizeLayers(
      (settingsRef.current.featureLayers ??
        []) as Partial<FeatureLayerConfig>[],
    );
    setLayers(featureLayers);
    setMapTile(settingsRef.current.mapTile);
    setBaseMap(settingsRef.current.baseMap);

    const sAny = settingsRef.current as any;
    const fromRef = coerceStringArray(sAny.apiSources);
    setApiSources(fromRef.length > 0 ? fromRef : DEFAULT_APISOURCES);

    setOpenSettings((o) => !o);
  };

  // ─── Input Handlers ─────────────────────────────────────────────────
  const handleCenterChange = (field: "x" | "y", value: string) =>
    setCenter((prev) => ({ ...prev, [field]: value }));
  const handleZoomChange = (value: number) => setZoom(value);
  const handleConstraintChange = (field: keyof Constraints, value: string) =>
    setConstraints((prev) => ({ ...prev, [field]: value }));

  const updateApiSource = (index: number, value: string) => {
    setApiSources((prev) => prev.map((v, i) => (i === index ? value : v)));
  };
  const addApiSource = () => setApiSources((prev) => [...prev, ""]);
  const removeApiSource = (index: number) =>
    setApiSources((prev) => prev.filter((_, i) => i !== index));
  const resetApiSources = () => setApiSources(DEFAULT_APISOURCES);

  // ─── Animation field handlers ───────────────────────────────────────
  const addDirectionFrame = (direction: SpriteDirection) => {
    setDirectionalFrames((prev) => {
      if (prev[direction].length >= 4) return prev;
      return { ...prev, [direction]: [...prev[direction], ""] };
    });
  };

  const removeDirectionFrame = (
    direction: SpriteDirection,
    frameIndex: number,
  ) => {
    setDirectionalFrames((prev) => ({
      ...prev,
      [direction]: prev[direction].filter((_, i) => i !== frameIndex),
    }));
  };

  const updateDirectionFrame = (
    direction: SpriteDirection,
    frameIndex: number,
    value: string,
  ) => {
    setDirectionalFrames((prev) => ({
      ...prev,
      [direction]: prev[direction].map((item, i) =>
        i === frameIndex ? value : item,
      ),
    }));
  };

  const handleFrameUpload = async (
    direction: SpriteDirection,
    frameIndex: number,
    file: File | null,
  ) => {
    if (!file) return;

    const key = `${direction}-${frameIndex}`;
    setUploadingKey(key);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed (${response.status})`);
      }

      const payload = await response.json();
      const url = getUploadUrlFromResponse(payload);

      if (!url) {
        throw new Error(
          "Upload succeeded but no image URL was returned by /api/upload.",
        );
      }

      updateDirectionFrame(direction, frameIndex, url);
    } catch (err: any) {
      console.error(err);
      setUploadError(err?.message ?? "Upload failed.");
    } finally {
      setUploadingKey(null);
    }
  };

  const addHiddenSegment = () =>
    setHiddenSegments((prev) => [
      ...prev,
      { startSegmentIndex: 0, endSegmentIndex: 0 },
    ]);

  const updateHiddenSegment = (
    index: number,
    field: keyof HiddenSegmentRange,
    value: number,
  ) => {
    setHiddenSegments((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const removeHiddenSegment = (index: number) =>
    setHiddenSegments((prev) => prev.filter((_, i) => i !== index));

  const addVertexPause = () =>
    setVertexPauses((prev) => [...prev, { vertexIndex: 0, durationMs: 1000 }]);

  const updateVertexPause = (
    index: number,
    field: keyof VertexPause,
    value: number,
  ) => {
    setVertexPauses((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const removeVertexPause = (index: number) =>
    setVertexPauses((prev) => prev.filter((_, i) => i !== index));

  // ─── Apply Settings (Save back as Mercator) ─────────────────────────
  const applySettings = () => {
    const { xmin, ymin, xmax, ymax } = constraints;

    let finalExtent = null;
    if (xmin && ymin && xmax && ymax) {
      const [mercMinX, mercMinY] = lonLatToMercator(xmin, ymin);
      const [mercMaxX, mercMaxY] = lonLatToMercator(xmax, ymax);

      finalExtent = new Extent({
        xmin: mercMinX,
        ymin: mercMinY,
        xmax: mercMaxX,
        ymax: mercMaxY,
        spatialReference: view.spatialReference,
      });

      view.constraints.geometry = finalExtent;
    } else {
      // @ts-ignore
      view.constraints.geometry = null;
    }

    settingsRef.current.zoom = zoom;

    const [mercX, mercY] = lonLatToMercator(center.x, center.y);
    setMapCenterInViewSR(mercX, mercY);

    settingsRef.current.constraints = finalExtent
      ? {
          xmin: finalExtent.xmin,
          ymin: finalExtent.ymin,
          xmax: finalExtent.xmax,
          ymax: finalExtent.ymax,
        }
      : (null as any);

    const layersSorted = normalizeLayers(layers);
    settingsRef.current.featureLayers = layersSorted;
    settingsRef.current.mapTile = mapTile;
    settingsRef.current.baseMap = baseMap;

    const cleaned = apiSources.map((s) => s.trim()).filter((s) => s.length > 0);
    const withFallback = cleaned.length > 0 ? cleaned : DEFAULT_APISOURCES;
    const deduped = Array.from(new Set(withFallback));
    (settingsRef.current as any).apiSources = deduped;

    if (userEmail) {
      const s = settingsRef.current as any;
      saveMapToServer(mapId, userEmail, {
        zoom: s.zoom,
        center: [s.center.x, s.center.y] as [number, number],
        constraints: s.constraints,
        featureLayers: layersSorted,
        mapTile: mapTile,
        baseMap: baseMap,
        apiSources: deduped,
      });
    }

    setOpenSettings(false);
  };

  // ─── Drawing/Editing Effects ────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      const items = finalizedLayerRef.current?.graphics?.items ?? [];
      setPolygonList(
        items
          .slice()
          .sort(
            (a: any, b: any) =>
              (a.attributes?.order ?? 0) - (b.attributes?.order ?? 0),
          ),
      );

      if (editingId) {
        const g = items.find((gr: any) => gr.attributes.id === editingId);
        if (g) {
          const geomType = g.geometry?.type as DrawableGeometryType;
          setEditingGeometryType(geomType);

          setEditName(g.attributes.name ?? "");
          const { r, g: grn, b, a } = g.symbol.color;
          setEditColor(
            `#${[r, grn, b]
              .map((v: number) => v.toString(16).padStart(2, "0"))
              .join("")}`,
          );
          setEditAlpha(typeof a === "number" ? a : 0.6);
          setEditHTML(
            g.popupTemplate?.content ?? g.attributes.description ?? "",
          );

          if (geomType === "polyline") {
            setEditingPaths(g.geometry.paths || []);
            setEditWidth(
              typeof g.symbol?.width === "number"
                ? g.symbol.width
                : typeof g.attributes?.width === "number"
                  ? g.attributes.width
                  : 3,
            );
            resetAnimationEditorFrom(g.attributes?.animation);
          } else {
            setEditingPaths([]);
            resetAnimationEditorFrom(createDefaultPolylineAnimation());
          }

          if (geomType === "point") {
            setEditPointSize(
              typeof g.symbol?.size === "number"
                ? g.symbol.size
                : typeof g.attributes?.size === "number"
                  ? g.attributes.size
                  : 10,
            );
          } else {
            setEditPointSize(10);
          }

          const label = labelsLayerRef.current?.graphics.items.find(
            (l: any) => l.attributes.parentId === editingId,
          );

          if (label) {
            const size = (label.symbol as any).font.size;
            setEditFontSize(typeof size === "number" ? size : 12);
            const show = label.attributes.showAtZoom;
            const hide = label.attributes.hideAtZoom;
            setMinZoomEnabled(show != null);
            setMaxZoomEnabled(hide != null);
            if (show != null) setMinZoomLevel(String(show));
            if (hide != null) setMaxZoomLevel(String(hide));
          } else {
            setEditFontSize(12);
            setMinZoomEnabled(false);
            setMaxZoomEnabled(false);
            setMinZoomLevel("14");
            setMaxZoomLevel("18");
          }
        }
      }
    };

    finalizedLayerRef.events.addEventListener("change", handler);
    handler();

    return () =>
      finalizedLayerRef.events.removeEventListener("change", handler);
  }, [editingId]);

  const goTo = (graphic: any) => {
    const target = graphic.geometry.extent?.center || graphic.geometry;
    view
      .goTo({ target, zoom: 18 })
      .then(() => view.popup.open({ features: [graphic], location: target }));
  };

  const startEditing = (graphic: any) => {
    setEditingId(graphic.attributes.id);
    setEditingGeometryType(graphic.geometry?.type ?? null);
    setUploadError(null);
  };

  const applyEdits = () => {
    if (!editingId) return;
    const layer = finalizedLayerRef.current!;
    const g = layer.graphics.find((gr: any) => gr.attributes.id === editingId);
    if (!g) return;

    g.attributes.name = editName;
    g.popupTemplate = {
      title: editName,
      content: editHTML,
    };
    g.attributes.description = editHTML;

    const hex = editColor.slice(1);
    const r = parseInt(hex.substr(0, 2), 16);
    const grn = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const newSym = (g.symbol as any).clone();
    newSym.color = [r, grn, b, +editAlpha.toFixed(2)];

    if (editingGeometryType === "polyline") {
      newSym.width = editWidth;
      g.attributes.width = editWidth;

      const nextAnimation: PolylineAnimation = normalizePolylineAnimation({
        enabled: animationEnabled,
        motion: {
          durationMs: motionDurationMs,
          loop: motionLoop,
          reverse: motionReverse,
          autoPlay: motionAutoPlay,
          startProgress: motionStartProgress,
        },
        sprite: {
          frameMs: spriteFrameMs,
          scale: spriteScale,
          offsetPxX: spriteOffsetPxX,
          offsetPxY: spriteOffsetPxY,
          anchor: spriteAnchor,
          directionalFrames: {
            up: sanitizeFrameList(directionalFrames.up),
            down: sanitizeFrameList(directionalFrames.down),
            left: sanitizeFrameList(directionalFrames.left),
            right: sanitizeFrameList(directionalFrames.right),
          },
        },
        behavior: {
          hiddenSegments: hiddenSegments
            .map((item) => ({
              startSegmentIndex: Math.max(
                0,
                Math.floor(item.startSegmentIndex || 0),
              ),
              endSegmentIndex: Math.max(
                0,
                Math.floor(item.endSegmentIndex || 0),
              ),
            }))
            .filter((item) => item.endSegmentIndex >= item.startSegmentIndex),
          vertexPauses: vertexPauses
            .map((item) => ({
              vertexIndex: Math.max(0, Math.floor(item.vertexIndex || 0)),
              durationMs: Math.max(0, Number(item.durationMs || 0)),
            }))
            .filter((item) => Number.isFinite(item.durationMs)),
        },
      });

      g.attributes.animation = nextAnimation;
    }

    if (editingGeometryType === "point") {
      newSym.size = editPointSize;
      g.attributes.size = editPointSize;
    }

    g.symbol = newSym;

    const labelsLayer = labelsLayerRef.current!;
    const label = labelsLayer.graphics.find(
      (l: any) => l.attributes.parentId === editingId,
    );

    if (label) {
      if (minZoomEnabled) label.attributes.showAtZoom = +minZoomLevel;
      else delete label.attributes.showAtZoom;

      if (maxZoomEnabled) label.attributes.hideAtZoom = +maxZoomLevel;
      else delete label.attributes.hideAtZoom;

      (label.symbol as any).text = editName;
      (label.symbol as any).font.size = editFontSize;

      (window as any).require(
        ["esri/geometry/Point", "esri/geometry/geometryEngine"],
        (P: any, geometryEngine: any) => {
          let pt: __esri.Point | null = null;
          try {
            pt = geometryEngine.labelPoints(g.geometry);
          } catch {}

          if (pt) {
            label.geometry = new P({
              x: pt.x,
              y: pt.y,
              spatialReference: view.spatialReference,
            });
          } else {
            const c = (g.geometry as any).centroid ?? g.geometry.extent?.center;
            if (c) {
              label.geometry = new P({
                x: c.x,
                y: c.y,
                spatialReference: view.spatialReference,
              });
            }
          }
          rebuildBuckets(labelsLayer);
        },
      );
    }

    const s = settingsRef.current as any;
    const featureLayersSnapshot = normalizeLayers(
      (s.featureLayers ?? []) as Partial<FeatureLayerConfig>[],
    );
    s.featureLayers = featureLayersSnapshot;

    const apiSourcesSnapshot = (() => {
      const cleaned = coerceStringArray(s.apiSources);
      return cleaned.length > 0 ? cleaned : DEFAULT_APISOURCES;
    })();

    if (userEmail) {
      saveMapToServer(mapId, userEmail, {
        zoom: s.zoom,
        center: [s.center.x, s.center.y] as [number, number],
        constraints: s.constraints,
        featureLayers: featureLayersSnapshot,
        mapTile: s.mapTile,
        baseMap: s.baseMap,
        apiSources: apiSourcesSnapshot,
      });
    }

    finalizedLayerRef.events.dispatchEvent(new Event("change"));
    setEditingId(null);
    setEditingGeometryType(null);
    setEditingPaths([]);
    setUploadError(null);
  };

  const cancelEdits = () => {
    setEditingId(null);
    setEditingGeometryType(null);
    setEditingPaths([]);
    setUploadError(null);
  };

  // ─── Sync (External Changes) ────────────────────────────────────────
  useEffect(() => {
    const sync = () => {
      const s = settingsRef.current as any;

      const [lon, lat] = mercatorToLonLat(s.center.x, s.center.y);
      setCenter({ x: String(lon), y: String(lat) });

      const featureLayers = normalizeLayers(
        (s.featureLayers ?? []) as Partial<FeatureLayerConfig>[],
      );
      setLayers(featureLayers);
      setMapTile(settingsRef.current.mapTile);
      setBaseMap(settingsRef.current.baseMap);
      setZoom(s.zoom);

      const fromRef = coerceStringArray(s.apiSources);
      setApiSources(fromRef.length > 0 ? fromRef : DEFAULT_APISOURCES);

      if (s.constraints) {
        const [minLon, minLat] = mercatorToLonLat(
          s.constraints.xmin,
          s.constraints.ymin,
        );
        const [maxLon, maxLat] = mercatorToLonLat(
          s.constraints.xmax,
          s.constraints.ymax,
        );
        setConstraints({
          xmin: String(minLon),
          ymin: String(minLat),
          xmax: String(maxLon),
          ymax: String(maxLat),
        });
      }
    };

    settingsEvents.addEventListener("change", sync);
    sync();

    return () => settingsEvents.removeEventListener("change", sync);
  }, []);

  return (
    <Box sx={{ height: "100%", overflowY: "auto", p: 2 }}>
      <IconButton
        onClick={toggleSettings}
        sx={{
          position: "absolute",
          bottom: 25,
          left: 260,
          width: 50,
          height: 50,
          bgcolor: "background.paper",
          border: 1,
          zIndex: 9999,
        }}
      >
        <SettingsIcon fontSize="large" />
      </IconButton>

      {openSettings && (
        <Box
          sx={{
            position: "absolute",
            bottom: 25,
            left: 320,
            zIndex: 99,
            bgcolor: "background.paper",
            border: 1,
            p: 1,
            width: 300,
            height: 500,
            overflow: "scroll",
          }}
        >
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <div>╔═</div>
            <Typography variant="h6">Map Settings</Typography>
            <div>═╗</div>
          </Box>

          <Box mt={1}>
            <MapControls
              centerX={center.x}
              centerY={center.y}
              onCenterChange={handleCenterChange}
              zoom={zoom}
              onZoomChange={handleZoomChange}
              constraints={constraints}
              onConstraintChange={handleConstraintChange}
              layers={layers}
              setLayers={setLayers}
              fieldNameById={fieldNameById}
              setFieldNameById={setFieldNameById}
              mapTile={mapTile}
              setMapTile={setMapTile}
              baseMap={baseMap}
              setBaseMap={setBaseMap}
              onCapture={handleCapture}
            />

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              API Sources
            </Typography>
            <Box sx={{ mt: 1 }}>
              {apiSources.map((url, idx) => (
                <Box
                  key={`${idx}-${url}`}
                  sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}
                >
                  <TextField
                    label={`API Source ${idx + 1}`}
                    value={url}
                    onChange={(e) => updateApiSource(idx, e.target.value)}
                    size="small"
                    fullWidth
                  />
                  <IconButton onClick={() => removeApiSource(idx)} size="small">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={addApiSource}
                  startIcon={<AddIcon />}
                >
                  Add
                </Button>
                <Button
                  size="small"
                  variant="text"
                  onClick={resetApiSources}
                  startIcon={<RestartAltIcon />}
                >
                  Reset defaults
                </Button>
              </Box>
            </Box>
          </Box>

          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Button onClick={toggleSettings}>Cancel</Button>
            <Button variant="contained" onClick={applySettings} sx={{ ml: 1 }}>
              Apply All Edits
            </Button>
          </Box>
        </Box>
      )}

      {/* Drawings List */}
      <Box display="flex" justifyContent="space-between" mb={1}>
        <div>╔═</div>
        <Typography component="h3">Drawings</Typography>
        <div>═╗</div>
      </Box>

      <ul style={{ paddingLeft: 20 }}>
        {polygonList.map((graphic) => (
          <li key={graphic.attributes.id} style={{ margin: "8px 0" }}>
            {graphic.attributes.name}{" "}
            <Typography
              component="span"
              variant="caption"
              sx={{ opacity: 0.7 }}
            >
              ({graphic.geometry?.type})
            </Typography>
            <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => goTo(graphic)}
              >
                Go to
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => startEditing(graphic)}
              >
                Edit
              </Button>
            </Box>
          </li>
        ))}
      </ul>

      {/* Edit Modal */}
      {editingId && (
        <Box
          sx={{
            position: "absolute",
            top: 90,
            right: 25,
            zIndex: 999,
            bgcolor: "background.paper",
            p: 2,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            borderRadius: 1,
            width: 380,
            maxHeight: "82vh",
            overflowY: "auto",
          }}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            Edit {editingGeometryType ?? "Drawing"}
          </Typography>

          <TextField
            label="Name"
            fullWidth
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            size="small"
            margin="dense"
          />

          <InputLabel sx={{ mt: 2 }}>Color</InputLabel>
          <input
            type="color"
            value={editColor}
            onChange={(e) => setEditColor(e.target.value)}
            style={{
              width: "100%",
              height: 40,
              border: "none",
              margin: "8px 0",
            }}
          />

          <Typography gutterBottom>Opacity: {editAlpha.toFixed(2)}</Typography>
          <Slider
            value={editAlpha}
            min={0}
            max={1}
            step={0.01}
            onChange={(_, v) => setEditAlpha(v as number)}
          />

          {editingGeometryType === "polyline" && (
            <TextField
              label="Line Width"
              type="number"
              fullWidth
              inputProps={{ min: 1, step: 1 }}
              value={editWidth}
              onChange={(e) => setEditWidth(Math.max(1, +e.target.value || 1))}
              size="small"
              margin="dense"
            />
          )}

          {editingGeometryType === "point" && (
            <TextField
              label="Point Size"
              type="number"
              fullWidth
              inputProps={{ min: 1, step: 1 }}
              value={editPointSize}
              onChange={(e) =>
                setEditPointSize(Math.max(1, +e.target.value || 1))
              }
              size="small"
              margin="dense"
            />
          )}

          {editingGeometryType === "polygon" && (
            <>
              <TextField
                label="Font Size"
                type="number"
                fullWidth
                inputProps={{ min: 6, max: 48 }}
                value={editFontSize}
                onChange={(e) => setEditFontSize(+e.target.value)}
                size="small"
                margin="dense"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={minZoomEnabled}
                    onChange={(e) => setMinZoomEnabled(e.target.checked)}
                  />
                }
                label="Hide below zoom (inclusive)"
              />
              <TextField
                label="Min Zoom"
                fullWidth
                value={minZoomLevel}
                onChange={(e) => setMinZoomLevel(e.target.value)}
                size="small"
                margin="dense"
                disabled={!minZoomEnabled}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={maxZoomEnabled}
                    onChange={(e) => setMaxZoomEnabled(e.target.checked)}
                  />
                }
                label="Hide above zoom (exclusive)"
              />
              <TextField
                label="Max Zoom"
                fullWidth
                value={maxZoomLevel}
                onChange={(e) => setMaxZoomLevel(e.target.value)}
                size="small"
                margin="dense"
                disabled={!maxZoomEnabled}
              />
            </>
          )}

          <TextField
            label="Popup HTML"
            multiline
            fullWidth
            rows={4}
            value={editHTML}
            onChange={(e) => setEditHTML(e.target.value)}
            size="small"
            margin="dense"
          />

          {editingGeometryType === "polyline" && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Animation
              </Typography>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={animationEnabled}
                    onChange={(e) => setAnimationEnabled(e.target.checked)}
                  />
                }
                label="Animated"
              />

              <TextField
                label="Duration (ms)"
                type="number"
                fullWidth
                value={motionDurationMs}
                onChange={(e) =>
                  setMotionDurationMs(Math.max(0, +e.target.value || 0))
                }
                size="small"
                margin="dense"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={motionLoop}
                    onChange={(e) => setMotionLoop(e.target.checked)}
                  />
                }
                label="Loop"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={motionReverse}
                    onChange={(e) => setMotionReverse(e.target.checked)}
                  />
                }
                label="Reverse"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={motionAutoPlay}
                    onChange={(e) => setMotionAutoPlay(e.target.checked)}
                  />
                }
                label="Auto play"
              />

              <Typography gutterBottom>
                Start Progress: {motionStartProgress.toFixed(2)}
              </Typography>
              <Slider
                value={motionStartProgress}
                min={0}
                max={1}
                step={0.01}
                onChange={(_, v) => setMotionStartProgress(v as number)}
              />

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Sprite
              </Typography>

              <TextField
                label="Frame Duration (ms)"
                type="number"
                fullWidth
                value={spriteFrameMs}
                onChange={(e) =>
                  setSpriteFrameMs(Math.max(0, +e.target.value || 0))
                }
                size="small"
                margin="dense"
              />

              <TextField
                label="Scale"
                type="number"
                fullWidth
                value={spriteScale}
                onChange={(e) =>
                  setSpriteScale(Math.max(0.01, +e.target.value || 0.01))
                }
                size="small"
                margin="dense"
              />

              <TextField
                label="Offset X (px)"
                type="number"
                fullWidth
                value={spriteOffsetPxX}
                onChange={(e) => setSpriteOffsetPxX(+e.target.value || 0)}
                size="small"
                margin="dense"
              />

              <TextField
                label="Offset Y (px)"
                type="number"
                fullWidth
                value={spriteOffsetPxY}
                onChange={(e) => setSpriteOffsetPxY(+e.target.value || 0)}
                size="small"
                margin="dense"
              />

              <TextField
                label="Anchor"
                fullWidth
                select
                SelectProps={{ native: true }}
                value={spriteAnchor}
                onChange={(e) =>
                  setSpriteAnchor(e.target.value as "center" | "bottom")
                }
                size="small"
                margin="dense"
              >
                <option value="bottom">bottom</option>
                <option value="center">center</option>
              </TextField>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Sprite Frames
              </Typography>

              {SPRITE_DIRECTIONS.map((direction) => (
                <Box
                  key={direction}
                  sx={{
                    border: "1px solid #ddd",
                    borderRadius: 1,
                    p: 1.5,
                    mt: 1.5,
                  }}
                >
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={1}
                  >
                    <Typography sx={{ textTransform: "capitalize" }}>
                      {direction}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => addDirectionFrame(direction)}
                      disabled={directionalFrames[direction].length >= 4}
                      startIcon={<AddIcon />}
                    >
                      Add Frame
                    </Button>
                  </Box>

                  {directionalFrames[direction].length === 0 && (
                    <Typography variant="body2" sx={{ opacity: 0.7 }}>
                      No frames yet.
                    </Typography>
                  )}

                  {directionalFrames[direction].map((frameUrl, frameIndex) => {
                    const key = `${direction}-${frameIndex}`;
                    const busy = uploadingKey === key;

                    return (
                      <Box
                        key={key}
                        sx={{
                          border: "1px solid #eee",
                          borderRadius: 1,
                          p: 1,
                          mb: 1,
                        }}
                      >
                        <TextField
                          label={`Frame ${frameIndex + 1} URL`}
                          fullWidth
                          value={frameUrl}
                          onChange={(e) =>
                            updateDirectionFrame(
                              direction,
                              frameIndex,
                              e.target.value,
                            )
                          }
                          size="small"
                          margin="dense"
                        />

                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            alignItems: "center",
                            mt: 1,
                            flexWrap: "wrap",
                          }}
                        >
                          <Button
                            component="label"
                            variant="outlined"
                            size="small"
                            startIcon={
                              busy ? (
                                <CircularProgress size={14} />
                              ) : (
                                <UploadFileIcon />
                              )
                            }
                            disabled={busy}
                          >
                            {busy ? "Uploading..." : "Upload"}
                            <input
                              hidden
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                void handleFrameUpload(
                                  direction,
                                  frameIndex,
                                  file,
                                );
                                e.currentTarget.value = "";
                              }}
                            />
                          </Button>

                          <Button
                            color="error"
                            size="small"
                            variant="text"
                            startIcon={<DeleteIcon />}
                            onClick={() =>
                              removeDirectionFrame(direction, frameIndex)
                            }
                          >
                            Remove
                          </Button>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              ))}

              {uploadError && (
                <Typography color="error" sx={{ mt: 1 }}>
                  {uploadError}
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Hidden Segments
              </Typography>

              {/* Expandable Polyline Map Preview */}
              <PolylinePreview
                paths={editingPaths}
                hiddenSegments={hiddenSegments}
              />

              {hiddenSegments.map((item, index) => (
                <Box
                  key={`hidden-${index}`}
                  sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}
                >
                  <TextField
                    label="Start Segment"
                    type="number"
                    size="small"
                    value={item.startSegmentIndex}
                    onChange={(e) =>
                      updateHiddenSegment(
                        index,
                        "startSegmentIndex",
                        Math.max(0, +e.target.value || 0),
                      )
                    }
                  />
                  <TextField
                    label="End Segment"
                    type="number"
                    size="small"
                    value={item.endSegmentIndex}
                    onChange={(e) =>
                      updateHiddenSegment(
                        index,
                        "endSegmentIndex",
                        Math.max(0, +e.target.value || 0),
                      )
                    }
                  />
                  <IconButton onClick={() => removeHiddenSegment(index)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}

              <Button
                sx={{ mt: 1 }}
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addHiddenSegment}
              >
                Add Hidden Segment
              </Button>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Vertex Pauses
              </Typography>

              {vertexPauses.map((item, index) => (
                <Box
                  key={`pause-${index}`}
                  sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}
                >
                  <TextField
                    label="Vertex Index"
                    type="number"
                    size="small"
                    value={item.vertexIndex}
                    onChange={(e) =>
                      updateVertexPause(
                        index,
                        "vertexIndex",
                        Math.max(0, +e.target.value || 0),
                      )
                    }
                  />
                  <TextField
                    label="Duration (ms)"
                    type="number"
                    size="small"
                    value={item.durationMs}
                    onChange={(e) =>
                      updateVertexPause(
                        index,
                        "durationMs",
                        Math.max(0, +e.target.value || 0),
                      )
                    }
                  />
                  <IconButton onClick={() => removeVertexPause(index)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}

              <Button
                sx={{ mt: 1 }}
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addVertexPause}
              >
                Add Vertex Pause
              </Button>
            </>
          )}

          <Box sx={{ textAlign: "right", mt: 2 }}>
            <Button onClick={cancelEdits} sx={{ mr: 1 }}>
              Cancel
            </Button>
            <Button variant="contained" onClick={applyEdits}>
              Save
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
// "use client";

// import { useState, useEffect } from "react";
// import {
//   labelsLayerRef,
//   finalizedLayerRef,
//   MapViewRef,
//   settingsRef,
//   settingsEvents,
// } from "./arcgisRefs";
// import { rebuildBuckets } from "./bucketManager";
// import Extent from "@arcgis/core/geometry/Extent";
// import { useSession } from "next-auth/react";
// import { useMapId } from "@/app/context/MapContext";
// import { saveMapToServer } from "@/app/helper/saveMap";
// import SettingsIcon from "@mui/icons-material/Settings";
// import DeleteIcon from "@mui/icons-material/Delete";
// import AddIcon from "@mui/icons-material/Add";
// import RestartAltIcon from "@mui/icons-material/RestartAlt";
// import UploadFileIcon from "@mui/icons-material/UploadFile";
// import {
//   TextField,
//   Slider,
//   Typography,
//   Button,
//   InputLabel,
//   Checkbox,
//   FormControlLabel,
//   Box,
//   IconButton,
//   Divider,
//   CircularProgress,
// } from "@mui/material";
// import MapControls, { Constraints } from "./MapControls";
// import type {
//   FeatureLayerConfig as SharedFeatureLayerConfig,
//   HiddenSegmentRange,
//   PolylineAnimation,
//   VertexPause,
// } from "@/app/types/myTypes";
// import {
//   createDefaultPolylineAnimation,
//   normalizePolylineAnimation,
// } from "@/app/types/myTypes";

// // ─── Coordinate Helper Functions ──────────────────────────────────────
// const R = 6378137;

// function mercatorToLonLat(
//   x: string | number,
//   y: string | number,
// ): [number, number] {
//   const xFloat = typeof x === "string" ? parseFloat(x) : x;
//   const yFloat = typeof y === "string" ? parseFloat(y) : y;
//   const lon = (xFloat / R) * (180 / Math.PI);
//   const lat =
//     (2 * Math.atan(Math.exp(yFloat / R)) - Math.PI / 2) * (180 / Math.PI);
//   return [lon, lat];
// }

// function lonLatToMercator(
//   lon: string | number,
//   lat: string | number,
// ): [number, number] {
//   const lonFloat = typeof lon === "string" ? parseFloat(lon) : lon;
//   const latFloat = typeof lat === "string" ? parseFloat(lat) : lat;
//   const x = lonFloat * (Math.PI / 180) * R;
//   const latRad = latFloat * (Math.PI / 180);
//   const y = R * Math.log(Math.tan(Math.PI / 4 + latRad / 2));
//   return [x, y];
// }

// interface FieldInfo {
//   fieldName: string;
//   label: string;
//   visible: boolean;
//   format?: {
//     digitSeparator?: boolean;
//     places?: number;
//   };
// }

// export interface FeatureLayerConfig extends SharedFeatureLayerConfig {
//   id: string;
// }

// type DrawableGeometryType = "polygon" | "polyline" | "point";
// type SpriteDirection = "up" | "down" | "left" | "right";

// const SPRITE_DIRECTIONS: SpriteDirection[] = ["up", "down", "left", "right"];

// function genId() {
//   if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
//     return crypto.randomUUID();
//   }
//   return `layer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
// }

// function normalizeLayers(
//   layers: Partial<FeatureLayerConfig>[],
// ): FeatureLayerConfig[] {
//   return [...(layers ?? [])]
//     .map((l, i) => ({
//       id: (l as FeatureLayerConfig).id ?? genId(),
//       url: String(l.url ?? ""),
//       index: typeof l.index === "number" ? l.index : i,
//       outFields: (l.outFields as string[]) ?? ["*"],
//       popupEnabled: !!l.popupEnabled,
//       popupTemplate: l.popupTemplate as FeatureLayerConfig["popupTemplate"],
//     }))
//     .sort((a, b) => a.index - b.index);
// }

// const DEFAULT_APISOURCES: string[] = [];

// function coerceStringArray(value: any): string[] {
//   if (!Array.isArray(value)) return [];
//   return value
//     .filter((v): v is string => typeof v === "string")
//     .map((s) => s.trim())
//     .filter((s) => s.length > 0);
// }

// function sanitizeFrameList(value: string[]): string[] {
//   return value
//     .map((s) => s.trim())
//     .filter((s) => s.length > 0)
//     .slice(0, 4);
// }

// function getUploadUrlFromResponse(payload: any): string | null {
//   const candidates = [
//     payload?.url,
//     payload?.imageUrl,
//     payload?.location,
//     payload?.fileUrl,
//     payload?.data?.url,
//     payload?.data?.imageUrl,
//     payload?.data?.location,
//   ];

//   for (const candidate of candidates) {
//     if (typeof candidate === "string" && candidate.trim().length > 0) {
//       return candidate.trim();
//     }
//   }

//   return null;
// }

// export default function Sidebar() {
//   // ─── Drawing-editing state ───────────────────────────────────────────
//   const [polygonList, setPolygonList] = useState<any[]>([]);
//   const [editingId, setEditingId] = useState<string | null>(null);
//   const [editingGeometryType, setEditingGeometryType] =
//     useState<DrawableGeometryType | null>(null);

//   const [editName, setEditName] = useState("");
//   const [editColor, setEditColor] = useState("#ffffff");
//   const [editAlpha, setEditAlpha] = useState(0.6);
//   const [editHTML, setEditHTML] = useState("");
//   const [editFontSize, setEditFontSize] = useState(12);
//   const [editWidth, setEditWidth] = useState(3);
//   const [editPointSize, setEditPointSize] = useState(10);

//   const [minZoomEnabled, setMinZoomEnabled] = useState(false);
//   const [maxZoomEnabled, setMaxZoomEnabled] = useState(false);
//   const [minZoomLevel, setMinZoomLevel] = useState<string>("14");
//   const [maxZoomLevel, setMaxZoomLevel] = useState<string>("18");

//   // ─── Polyline animation state ───────────────────────────────────────
//   const [animationEnabled, setAnimationEnabled] = useState(false);
//   const [motionDurationMs, setMotionDurationMs] = useState(20000);
//   const [motionLoop, setMotionLoop] = useState(true);
//   const [motionReverse, setMotionReverse] = useState(false);
//   const [motionAutoPlay, setMotionAutoPlay] = useState(true);
//   const [motionStartProgress, setMotionStartProgress] = useState(0);

//   const [spriteFrameMs, setSpriteFrameMs] = useState(120);
//   const [spriteScale, setSpriteScale] = useState(1);
//   const [spriteOffsetPxX, setSpriteOffsetPxX] = useState(0);
//   const [spriteOffsetPxY, setSpriteOffsetPxY] = useState(0);
//   const [spriteAnchor, setSpriteAnchor] = useState<"center" | "bottom">(
//     "bottom",
//   );

//   const [directionalFrames, setDirectionalFrames] = useState<
//     Record<SpriteDirection, string[]>
//   >({
//     up: [],
//     down: [],
//     left: [],
//     right: [],
//   });

//   const [hiddenSegments, setHiddenSegments] = useState<HiddenSegmentRange[]>(
//     [],
//   );
//   const [vertexPauses, setVertexPauses] = useState<VertexPause[]>([]);

//   const [uploadingKey, setUploadingKey] = useState<string | null>(null);
//   const [uploadError, setUploadError] = useState<string | null>(null);

//   // ─── Auth & map context ─────────────────────────────────────────────
//   const { data: session } = useSession();
//   const userEmail = session?.user?.email;
//   const mapId = useMapId();

//   // ─── Map Settings UI state ──────────────────────────────────────────
//   const [openSettings, setOpenSettings] = useState(false);

//   // Center is stored as Lon/Lat strings for UI
//   const [center, setCenter] = useState({ x: "", y: "" });
//   const [zoom, setZoom] = useState(10);

//   const [layers, setLayers] = useState<FeatureLayerConfig[]>([]);
//   const [mapTile, setMapTile] = useState<string | null>(null);
//   const [baseMap, setBaseMap] = useState<string | null>(null);
//   const [apiSources, setApiSources] = useState<string[]>(DEFAULT_APISOURCES);
//   const [fieldNameById, setFieldNameById] = useState<Record<string, string>>(
//     {},
//   );

//   // Constraints stored as Lon/Lat strings for UI
//   const [constraints, setConstraints] = useState<Constraints>({
//     xmin: "",
//     ymin: "",
//     xmax: "",
//     ymax: "",
//   });

//   const view = MapViewRef.current!;

//   function resetAnimationEditorFrom(animation?: unknown) {
//     const a = normalizePolylineAnimation(
//       animation ?? createDefaultPolylineAnimation(),
//     );

//     setAnimationEnabled(a.enabled);
//     setMotionDurationMs(a.motion.durationMs);
//     setMotionLoop(a.motion.loop);
//     setMotionReverse(a.motion.reverse);
//     setMotionAutoPlay(a.motion.autoPlay);
//     setMotionStartProgress(a.motion.startProgress);

//     setSpriteFrameMs(a.sprite.frameMs);
//     setSpriteScale(a.sprite.scale);
//     setSpriteOffsetPxX(a.sprite.offsetPxX);
//     setSpriteOffsetPxY(a.sprite.offsetPxY);
//     setSpriteAnchor(a.sprite.anchor);

//     setDirectionalFrames({
//       up: [...a.sprite.directionalFrames.up],
//       down: [...a.sprite.directionalFrames.down],
//       left: [...a.sprite.directionalFrames.left],
//       right: [...a.sprite.directionalFrames.right],
//     });

//     setHiddenSegments(a.behavior.hiddenSegments.map((item) => ({ ...item })));
//     setVertexPauses(a.behavior.vertexPauses.map((item) => ({ ...item })));
//   }

//   // ─── Helper: store center in the MapView SR (Web Mercator) ──────────
//   function setMapCenterInViewSR(x: number, y: number) {
//     const sr = MapViewRef.current?.spatialReference ?? {
//       wkid: 3857,
//       latestWkid: 3857,
//     };
//     settingsRef.current.center = { spatialReference: sr, x, y } as any;
//     settingsEvents.dispatchEvent(new Event("change"));
//   }

//   // ─── Capture Actions (Use Current View) ─────────────────────────────
//   const handleCapture = (type: "center" | "zoom" | "constraints") => {
//     const v = MapViewRef.current;
//     if (!v) return;

//     if (type === "center") {
//       const { x, y } = v.center;
//       const [lon, lat] = mercatorToLonLat(x, y);
//       setCenter({ x: lon.toFixed(6), y: lat.toFixed(6) });
//     }

//     if (type === "zoom") {
//       setZoom(v.zoom);
//     }

//     if (type === "constraints") {
//       const ext = v.extent;
//       if (ext) {
//         const [minLon, minLat] = mercatorToLonLat(ext.xmin, ext.ymin);
//         const [maxLon, maxLat] = mercatorToLonLat(ext.xmax, ext.ymax);

//         setConstraints({
//           xmin: minLon.toFixed(6),
//           ymin: minLat.toFixed(6),
//           xmax: maxLon.toFixed(6),
//           ymax: maxLat.toFixed(6),
//         });
//       }
//     }
//   };

//   // ─── Toggle Settings (Load from State) ──────────────────────────────
//   const toggleSettings = () => {
//     if (!openSettings && view) {
//       const c = settingsRef.current.center as { x: number; y: number };
//       const [lon, lat] = mercatorToLonLat(c.x, c.y);
//       setCenter({ x: String(lon), y: String(lat) });

//       setZoom(settingsRef.current.zoom);

//       const cons = settingsRef.current.constraints;
//       if (cons) {
//         const [minLon, minLat] = mercatorToLonLat(cons.xmin, cons.ymin);
//         const [maxLon, maxLat] = mercatorToLonLat(cons.xmax, cons.ymax);
//         setConstraints({
//           xmin: String(minLon),
//           ymin: String(minLat),
//           xmax: String(maxLon),
//           ymax: String(maxLat),
//         });
//       } else {
//         setConstraints({ xmin: "", ymin: "", xmax: "", ymax: "" });
//       }
//     }

//     const featureLayers = normalizeLayers(
//       (settingsRef.current.featureLayers ??
//         []) as Partial<FeatureLayerConfig>[],
//     );
//     setLayers(featureLayers);
//     setMapTile(settingsRef.current.mapTile);
//     setBaseMap(settingsRef.current.baseMap);

//     const sAny = settingsRef.current as any;
//     const fromRef = coerceStringArray(sAny.apiSources);
//     setApiSources(fromRef.length > 0 ? fromRef : DEFAULT_APISOURCES);

//     setOpenSettings((o) => !o);
//   };

//   // ─── Input Handlers ─────────────────────────────────────────────────
//   const handleCenterChange = (field: "x" | "y", value: string) =>
//     setCenter((prev) => ({ ...prev, [field]: value }));
//   const handleZoomChange = (value: number) => setZoom(value);
//   const handleConstraintChange = (field: keyof Constraints, value: string) =>
//     setConstraints((prev) => ({ ...prev, [field]: value }));

//   const updateApiSource = (index: number, value: string) => {
//     setApiSources((prev) => prev.map((v, i) => (i === index ? value : v)));
//   };
//   const addApiSource = () => setApiSources((prev) => [...prev, ""]);
//   const removeApiSource = (index: number) =>
//     setApiSources((prev) => prev.filter((_, i) => i !== index));
//   const resetApiSources = () => setApiSources(DEFAULT_APISOURCES);

//   // ─── Animation field handlers ───────────────────────────────────────
//   const addDirectionFrame = (direction: SpriteDirection) => {
//     setDirectionalFrames((prev) => {
//       if (prev[direction].length >= 4) return prev;
//       return { ...prev, [direction]: [...prev[direction], ""] };
//     });
//   };

//   const removeDirectionFrame = (
//     direction: SpriteDirection,
//     frameIndex: number,
//   ) => {
//     setDirectionalFrames((prev) => ({
//       ...prev,
//       [direction]: prev[direction].filter((_, i) => i !== frameIndex),
//     }));
//   };

//   const updateDirectionFrame = (
//     direction: SpriteDirection,
//     frameIndex: number,
//     value: string,
//   ) => {
//     setDirectionalFrames((prev) => ({
//       ...prev,
//       [direction]: prev[direction].map((item, i) =>
//         i === frameIndex ? value : item,
//       ),
//     }));
//   };

//   const handleFrameUpload = async (
//     direction: SpriteDirection,
//     frameIndex: number,
//     file: File | null,
//   ) => {
//     if (!file) return;

//     const key = `${direction}-${frameIndex}`;
//     setUploadingKey(key);
//     setUploadError(null);

//     try {
//       const formData = new FormData();
//       formData.append("file", file);

//       const response = await fetch("/api/upload", {
//         method: "POST",
//         body: formData,
//       });

//       if (!response.ok) {
//         throw new Error(`Upload failed (${response.status})`);
//       }

//       const payload = await response.json();
//       const url = getUploadUrlFromResponse(payload);

//       if (!url) {
//         throw new Error(
//           "Upload succeeded but no image URL was returned by /api/upload.",
//         );
//       }

//       updateDirectionFrame(direction, frameIndex, url);
//     } catch (err: any) {
//       console.error(err);
//       setUploadError(err?.message ?? "Upload failed.");
//     } finally {
//       setUploadingKey(null);
//     }
//   };

//   const addHiddenSegment = () =>
//     setHiddenSegments((prev) => [
//       ...prev,
//       { startSegmentIndex: 0, endSegmentIndex: 0 },
//     ]);

//   const updateHiddenSegment = (
//     index: number,
//     field: keyof HiddenSegmentRange,
//     value: number,
//   ) => {
//     setHiddenSegments((prev) =>
//       prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
//     );
//   };

//   const removeHiddenSegment = (index: number) =>
//     setHiddenSegments((prev) => prev.filter((_, i) => i !== index));

//   const addVertexPause = () =>
//     setVertexPauses((prev) => [...prev, { vertexIndex: 0, durationMs: 1000 }]);

//   const updateVertexPause = (
//     index: number,
//     field: keyof VertexPause,
//     value: number,
//   ) => {
//     setVertexPauses((prev) =>
//       prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
//     );
//   };

//   const removeVertexPause = (index: number) =>
//     setVertexPauses((prev) => prev.filter((_, i) => i !== index));

//   // ─── Apply Settings (Save back as Mercator) ─────────────────────────
//   const applySettings = () => {
//     const { xmin, ymin, xmax, ymax } = constraints;

//     let finalExtent = null;
//     if (xmin && ymin && xmax && ymax) {
//       const [mercMinX, mercMinY] = lonLatToMercator(xmin, ymin);
//       const [mercMaxX, mercMaxY] = lonLatToMercator(xmax, ymax);

//       finalExtent = new Extent({
//         xmin: mercMinX,
//         ymin: mercMinY,
//         xmax: mercMaxX,
//         ymax: mercMaxY,
//         spatialReference: view.spatialReference,
//       });

//       view.constraints.geometry = finalExtent;
//     } else {
//       // @ts-ignore
//       view.constraints.geometry = null;
//     }

//     settingsRef.current.zoom = zoom;

//     const [mercX, mercY] = lonLatToMercator(center.x, center.y);
//     setMapCenterInViewSR(mercX, mercY);

//     settingsRef.current.constraints = finalExtent
//       ? {
//           xmin: finalExtent.xmin,
//           ymin: finalExtent.ymin,
//           xmax: finalExtent.xmax,
//           ymax: finalExtent.ymax,
//         }
//       : (null as any);

//     const layersSorted = normalizeLayers(layers);
//     settingsRef.current.featureLayers = layersSorted;
//     settingsRef.current.mapTile = mapTile;
//     settingsRef.current.baseMap = baseMap;

//     const cleaned = apiSources.map((s) => s.trim()).filter((s) => s.length > 0);
//     const withFallback = cleaned.length > 0 ? cleaned : DEFAULT_APISOURCES;
//     const deduped = Array.from(new Set(withFallback));
//     (settingsRef.current as any).apiSources = deduped;

//     if (userEmail) {
//       const s = settingsRef.current as any;
//       saveMapToServer(mapId, userEmail, {
//         zoom: s.zoom,
//         center: [s.center.x, s.center.y] as [number, number],
//         constraints: s.constraints,
//         featureLayers: layersSorted,
//         mapTile: mapTile,
//         baseMap: baseMap,
//         apiSources: deduped,
//       });
//     }

//     setOpenSettings(false);
//   };

//   // ─── Drawing/Editing Effects ────────────────────────────────────────
//   useEffect(() => {
//     const handler = () => {
//       const items = finalizedLayerRef.current?.graphics?.items ?? [];
//       setPolygonList(
//         items
//           .slice()
//           .sort(
//             (a: any, b: any) =>
//               (a.attributes?.order ?? 0) - (b.attributes?.order ?? 0),
//           ),
//       );

//       if (editingId) {
//         const g = items.find((gr: any) => gr.attributes.id === editingId);
//         if (g) {
//           const geomType = g.geometry?.type as DrawableGeometryType;
//           setEditingGeometryType(geomType);

//           setEditName(g.attributes.name ?? "");
//           const { r, g: grn, b, a } = g.symbol.color;
//           setEditColor(
//             `#${[r, grn, b]
//               .map((v: number) => v.toString(16).padStart(2, "0"))
//               .join("")}`,
//           );
//           setEditAlpha(typeof a === "number" ? a : 0.6);
//           setEditHTML(
//             g.popupTemplate?.content ?? g.attributes.description ?? "",
//           );

//           if (geomType === "polyline") {
//             setEditWidth(
//               typeof g.symbol?.width === "number"
//                 ? g.symbol.width
//                 : typeof g.attributes?.width === "number"
//                   ? g.attributes.width
//                   : 3,
//             );
//             resetAnimationEditorFrom(g.attributes?.animation);
//           } else {
//             resetAnimationEditorFrom(createDefaultPolylineAnimation());
//           }

//           if (geomType === "point") {
//             setEditPointSize(
//               typeof g.symbol?.size === "number"
//                 ? g.symbol.size
//                 : typeof g.attributes?.size === "number"
//                   ? g.attributes.size
//                   : 10,
//             );
//           } else {
//             setEditPointSize(10);
//           }

//           const label = labelsLayerRef.current?.graphics.items.find(
//             (l: any) => l.attributes.parentId === editingId,
//           );

//           if (label) {
//             const size = (label.symbol as any).font.size;
//             setEditFontSize(typeof size === "number" ? size : 12);
//             const show = label.attributes.showAtZoom;
//             const hide = label.attributes.hideAtZoom;
//             setMinZoomEnabled(show != null);
//             setMaxZoomEnabled(hide != null);
//             if (show != null) setMinZoomLevel(String(show));
//             if (hide != null) setMaxZoomLevel(String(hide));
//           } else {
//             setEditFontSize(12);
//             setMinZoomEnabled(false);
//             setMaxZoomEnabled(false);
//             setMinZoomLevel("14");
//             setMaxZoomLevel("18");
//           }
//         }
//       }
//     };

//     finalizedLayerRef.events.addEventListener("change", handler);
//     handler();

//     return () =>
//       finalizedLayerRef.events.removeEventListener("change", handler);
//   }, [editingId]);

//   const goTo = (graphic: any) => {
//     const target = graphic.geometry.extent?.center || graphic.geometry;
//     view
//       .goTo({ target, zoom: 18 })
//       .then(() => view.popup.open({ features: [graphic], location: target }));
//   };

//   const startEditing = (graphic: any) => {
//     setEditingId(graphic.attributes.id);
//     setEditingGeometryType(graphic.geometry?.type ?? null);
//     setUploadError(null);
//   };

//   const applyEdits = () => {
//     if (!editingId) return;
//     const layer = finalizedLayerRef.current!;
//     const g = layer.graphics.find((gr: any) => gr.attributes.id === editingId);
//     if (!g) return;

//     g.attributes.name = editName;
//     g.popupTemplate = {
//       title: editName,
//       content: editHTML,
//     };
//     g.attributes.description = editHTML;

//     const hex = editColor.slice(1);
//     const r = parseInt(hex.substr(0, 2), 16);
//     const grn = parseInt(hex.substr(2, 2), 16);
//     const b = parseInt(hex.substr(4, 2), 16);

//     const newSym = (g.symbol as any).clone();
//     newSym.color = [r, grn, b, +editAlpha.toFixed(2)];

//     if (editingGeometryType === "polyline") {
//       newSym.width = editWidth;
//       g.attributes.width = editWidth;

//       const nextAnimation: PolylineAnimation = normalizePolylineAnimation({
//         enabled: animationEnabled,
//         motion: {
//           durationMs: motionDurationMs,
//           loop: motionLoop,
//           reverse: motionReverse,
//           autoPlay: motionAutoPlay,
//           startProgress: motionStartProgress,
//         },
//         sprite: {
//           frameMs: spriteFrameMs,
//           scale: spriteScale,
//           offsetPxX: spriteOffsetPxX,
//           offsetPxY: spriteOffsetPxY,
//           anchor: spriteAnchor,
//           directionalFrames: {
//             up: sanitizeFrameList(directionalFrames.up),
//             down: sanitizeFrameList(directionalFrames.down),
//             left: sanitizeFrameList(directionalFrames.left),
//             right: sanitizeFrameList(directionalFrames.right),
//           },
//         },
//         behavior: {
//           hiddenSegments: hiddenSegments
//             .map((item) => ({
//               startSegmentIndex: Math.max(
//                 0,
//                 Math.floor(item.startSegmentIndex || 0),
//               ),
//               endSegmentIndex: Math.max(
//                 0,
//                 Math.floor(item.endSegmentIndex || 0),
//               ),
//             }))
//             .filter((item) => item.endSegmentIndex >= item.startSegmentIndex),
//           vertexPauses: vertexPauses
//             .map((item) => ({
//               vertexIndex: Math.max(0, Math.floor(item.vertexIndex || 0)),
//               durationMs: Math.max(0, Number(item.durationMs || 0)),
//             }))
//             .filter((item) => Number.isFinite(item.durationMs)),
//         },
//       });

//       g.attributes.animation = nextAnimation;
//     }

//     if (editingGeometryType === "point") {
//       newSym.size = editPointSize;
//       g.attributes.size = editPointSize;
//     }

//     g.symbol = newSym;

//     const labelsLayer = labelsLayerRef.current!;
//     const label = labelsLayer.graphics.find(
//       (l: any) => l.attributes.parentId === editingId,
//     );

//     if (label) {
//       if (minZoomEnabled) label.attributes.showAtZoom = +minZoomLevel;
//       else delete label.attributes.showAtZoom;

//       if (maxZoomEnabled) label.attributes.hideAtZoom = +maxZoomLevel;
//       else delete label.attributes.hideAtZoom;

//       (label.symbol as any).text = editName;
//       (label.symbol as any).font.size = editFontSize;

//       (window as any).require(
//         ["esri/geometry/Point", "esri/geometry/geometryEngine"],
//         (P: any, geometryEngine: any) => {
//           let pt: __esri.Point | null = null;
//           try {
//             pt = geometryEngine.labelPoints(g.geometry);
//           } catch {}

//           if (pt) {
//             label.geometry = new P({
//               x: pt.x,
//               y: pt.y,
//               spatialReference: view.spatialReference,
//             });
//           } else {
//             const c = (g.geometry as any).centroid ?? g.geometry.extent?.center;
//             if (c) {
//               label.geometry = new P({
//                 x: c.x,
//                 y: c.y,
//                 spatialReference: view.spatialReference,
//               });
//             }
//           }
//           rebuildBuckets(labelsLayer);
//         },
//       );
//     }

//     const s = settingsRef.current as any;
//     const featureLayersSnapshot = normalizeLayers(
//       (s.featureLayers ?? []) as Partial<FeatureLayerConfig>[],
//     );
//     s.featureLayers = featureLayersSnapshot;

//     const apiSourcesSnapshot = (() => {
//       const cleaned = coerceStringArray(s.apiSources);
//       return cleaned.length > 0 ? cleaned : DEFAULT_APISOURCES;
//     })();

//     if (userEmail) {
//       saveMapToServer(mapId, userEmail, {
//         zoom: s.zoom,
//         center: [s.center.x, s.center.y] as [number, number],
//         constraints: s.constraints,
//         featureLayers: featureLayersSnapshot,
//         mapTile: s.mapTile,
//         baseMap: s.baseMap,
//         apiSources: apiSourcesSnapshot,
//       });
//     }

//     finalizedLayerRef.events.dispatchEvent(new Event("change"));
//     setEditingId(null);
//     setEditingGeometryType(null);
//     setUploadError(null);
//   };

//   const cancelEdits = () => {
//     setEditingId(null);
//     setEditingGeometryType(null);
//     setUploadError(null);
//   };

//   // ─── Sync (External Changes) ────────────────────────────────────────
//   useEffect(() => {
//     const sync = () => {
//       const s = settingsRef.current as any;

//       const [lon, lat] = mercatorToLonLat(s.center.x, s.center.y);
//       setCenter({ x: String(lon), y: String(lat) });

//       const featureLayers = normalizeLayers(
//         (s.featureLayers ?? []) as Partial<FeatureLayerConfig>[],
//       );
//       setLayers(featureLayers);
//       setMapTile(settingsRef.current.mapTile);
//       setBaseMap(settingsRef.current.baseMap);
//       setZoom(s.zoom);

//       const fromRef = coerceStringArray(s.apiSources);
//       setApiSources(fromRef.length > 0 ? fromRef : DEFAULT_APISOURCES);

//       if (s.constraints) {
//         const [minLon, minLat] = mercatorToLonLat(
//           s.constraints.xmin,
//           s.constraints.ymin,
//         );
//         const [maxLon, maxLat] = mercatorToLonLat(
//           s.constraints.xmax,
//           s.constraints.ymax,
//         );
//         setConstraints({
//           xmin: String(minLon),
//           ymin: String(minLat),
//           xmax: String(maxLon),
//           ymax: String(maxLat),
//         });
//       }
//     };

//     settingsEvents.addEventListener("change", sync);
//     sync();

//     return () => settingsEvents.removeEventListener("change", sync);
//   }, []);

//   return (
//     <Box sx={{ height: "100%", overflowY: "auto", p: 2 }}>
//       <IconButton
//         onClick={toggleSettings}
//         sx={{
//           position: "absolute",
//           bottom: 25,
//           left: 260,
//           width: 50,
//           height: 50,
//           bgcolor: "background.paper",
//           border: 1,
//           zIndex: 9999,
//         }}
//       >
//         <SettingsIcon fontSize="large" />
//       </IconButton>

//       {openSettings && (
//         <Box
//           sx={{
//             position: "absolute",
//             bottom: 25,
//             left: 320,
//             zIndex: 99,
//             bgcolor: "background.paper",
//             border: 1,
//             p: 1,
//             width: 300,
//             height: 500,
//             overflow: "scroll",
//           }}
//         >
//           <Box
//             display="flex"
//             justifyContent="space-between"
//             alignItems="center"
//           >
//             <div>╔═</div>
//             <Typography variant="h6">Map Settings</Typography>
//             <div>═╗</div>
//           </Box>

//           <Box mt={1}>
//             <MapControls
//               centerX={center.x}
//               centerY={center.y}
//               onCenterChange={handleCenterChange}
//               zoom={zoom}
//               onZoomChange={handleZoomChange}
//               constraints={constraints}
//               onConstraintChange={handleConstraintChange}
//               layers={layers}
//               setLayers={setLayers}
//               fieldNameById={fieldNameById}
//               setFieldNameById={setFieldNameById}
//               mapTile={mapTile}
//               setMapTile={setMapTile}
//               baseMap={baseMap}
//               setBaseMap={setBaseMap}
//               onCapture={handleCapture}
//             />

//             <Divider sx={{ my: 2 }} />
//             <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
//               API Sources
//             </Typography>
//             <Box sx={{ mt: 1 }}>
//               {apiSources.map((url, idx) => (
//                 <Box
//                   key={`${idx}-${url}`}
//                   sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}
//                 >
//                   <TextField
//                     label={`API Source ${idx + 1}`}
//                     value={url}
//                     onChange={(e) => updateApiSource(idx, e.target.value)}
//                     size="small"
//                     fullWidth
//                   />
//                   <IconButton onClick={() => removeApiSource(idx)} size="small">
//                     <DeleteIcon fontSize="small" />
//                   </IconButton>
//                 </Box>
//               ))}
//               <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
//                 <Button
//                   size="small"
//                   variant="outlined"
//                   onClick={addApiSource}
//                   startIcon={<AddIcon />}
//                 >
//                   Add
//                 </Button>
//                 <Button
//                   size="small"
//                   variant="text"
//                   onClick={resetApiSources}
//                   startIcon={<RestartAltIcon />}
//                 >
//                   Reset defaults
//                 </Button>
//               </Box>
//             </Box>
//           </Box>

//           <Box display="flex" justifyContent="flex-end" mt={2}>
//             <Button onClick={toggleSettings}>Cancel</Button>
//             <Button variant="contained" onClick={applySettings} sx={{ ml: 1 }}>
//               Apply All Edits
//             </Button>
//           </Box>
//         </Box>
//       )}

//       {/* Drawings List */}
//       <Box display="flex" justifyContent="space-between" mb={1}>
//         <div>╔═</div>
//         <Typography component="h3">Drawings</Typography>
//         <div>═╗</div>
//       </Box>

//       <ul style={{ paddingLeft: 20 }}>
//         {polygonList.map((graphic) => (
//           <li key={graphic.attributes.id} style={{ margin: "8px 0" }}>
//             {graphic.attributes.name}{" "}
//             <Typography
//               component="span"
//               variant="caption"
//               sx={{ opacity: 0.7 }}
//             >
//               ({graphic.geometry?.type})
//             </Typography>
//             <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
//               <Button
//                 size="small"
//                 variant="outlined"
//                 onClick={() => goTo(graphic)}
//               >
//                 Go to
//               </Button>
//               <Button
//                 size="small"
//                 variant="outlined"
//                 onClick={() => startEditing(graphic)}
//               >
//                 Edit
//               </Button>
//             </Box>
//           </li>
//         ))}
//       </ul>

//       {/* Edit Modal */}
//       {editingId && (
//         <Box
//           sx={{
//             position: "absolute",
//             top: 90,
//             right: 25,
//             zIndex: 999,
//             bgcolor: "background.paper",
//             p: 2,
//             boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
//             borderRadius: 1,
//             width: 380,
//             maxHeight: "82vh",
//             overflowY: "auto",
//           }}
//         >
//           <Typography variant="h6" sx={{ mb: 1 }}>
//             Edit {editingGeometryType ?? "Drawing"}
//           </Typography>

//           <TextField
//             label="Name"
//             fullWidth
//             value={editName}
//             onChange={(e) => setEditName(e.target.value)}
//             size="small"
//             margin="dense"
//           />

//           <InputLabel sx={{ mt: 2 }}>Color</InputLabel>
//           <input
//             type="color"
//             value={editColor}
//             onChange={(e) => setEditColor(e.target.value)}
//             style={{
//               width: "100%",
//               height: 40,
//               border: "none",
//               margin: "8px 0",
//             }}
//           />

//           <Typography gutterBottom>Opacity: {editAlpha.toFixed(2)}</Typography>
//           <Slider
//             value={editAlpha}
//             min={0}
//             max={1}
//             step={0.01}
//             onChange={(_, v) => setEditAlpha(v as number)}
//           />

//           {editingGeometryType === "polyline" && (
//             <TextField
//               label="Line Width"
//               type="number"
//               fullWidth
//               inputProps={{ min: 1, step: 1 }}
//               value={editWidth}
//               onChange={(e) => setEditWidth(Math.max(1, +e.target.value || 1))}
//               size="small"
//               margin="dense"
//             />
//           )}

//           {editingGeometryType === "point" && (
//             <TextField
//               label="Point Size"
//               type="number"
//               fullWidth
//               inputProps={{ min: 1, step: 1 }}
//               value={editPointSize}
//               onChange={(e) =>
//                 setEditPointSize(Math.max(1, +e.target.value || 1))
//               }
//               size="small"
//               margin="dense"
//             />
//           )}

//           {editingGeometryType === "polygon" && (
//             <>
//               <TextField
//                 label="Font Size"
//                 type="number"
//                 fullWidth
//                 inputProps={{ min: 6, max: 48 }}
//                 value={editFontSize}
//                 onChange={(e) => setEditFontSize(+e.target.value)}
//                 size="small"
//                 margin="dense"
//               />

//               <FormControlLabel
//                 control={
//                   <Checkbox
//                     checked={minZoomEnabled}
//                     onChange={(e) => setMinZoomEnabled(e.target.checked)}
//                   />
//                 }
//                 label="Hide below zoom (inclusive)"
//               />
//               <TextField
//                 label="Min Zoom"
//                 fullWidth
//                 value={minZoomLevel}
//                 onChange={(e) => setMinZoomLevel(e.target.value)}
//                 size="small"
//                 margin="dense"
//                 disabled={!minZoomEnabled}
//               />

//               <FormControlLabel
//                 control={
//                   <Checkbox
//                     checked={maxZoomEnabled}
//                     onChange={(e) => setMaxZoomEnabled(e.target.checked)}
//                   />
//                 }
//                 label="Hide above zoom (exclusive)"
//               />
//               <TextField
//                 label="Max Zoom"
//                 fullWidth
//                 value={maxZoomLevel}
//                 onChange={(e) => setMaxZoomLevel(e.target.value)}
//                 size="small"
//                 margin="dense"
//                 disabled={!maxZoomEnabled}
//               />
//             </>
//           )}

//           <TextField
//             label="Popup HTML"
//             multiline
//             fullWidth
//             rows={4}
//             value={editHTML}
//             onChange={(e) => setEditHTML(e.target.value)}
//             size="small"
//             margin="dense"
//           />

//           {editingGeometryType === "polyline" && (
//             <>
//               <Divider sx={{ my: 2 }} />
//               <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
//                 Animation
//               </Typography>

//               <FormControlLabel
//                 control={
//                   <Checkbox
//                     checked={animationEnabled}
//                     onChange={(e) => setAnimationEnabled(e.target.checked)}
//                   />
//                 }
//                 label="Animated"
//               />

//               <TextField
//                 label="Duration (ms)"
//                 type="number"
//                 fullWidth
//                 value={motionDurationMs}
//                 onChange={(e) =>
//                   setMotionDurationMs(Math.max(0, +e.target.value || 0))
//                 }
//                 size="small"
//                 margin="dense"
//               />

//               <FormControlLabel
//                 control={
//                   <Checkbox
//                     checked={motionLoop}
//                     onChange={(e) => setMotionLoop(e.target.checked)}
//                   />
//                 }
//                 label="Loop"
//               />
//               <FormControlLabel
//                 control={
//                   <Checkbox
//                     checked={motionReverse}
//                     onChange={(e) => setMotionReverse(e.target.checked)}
//                   />
//                 }
//                 label="Reverse"
//               />
//               <FormControlLabel
//                 control={
//                   <Checkbox
//                     checked={motionAutoPlay}
//                     onChange={(e) => setMotionAutoPlay(e.target.checked)}
//                   />
//                 }
//                 label="Auto play"
//               />

//               <Typography gutterBottom>
//                 Start Progress: {motionStartProgress.toFixed(2)}
//               </Typography>
//               <Slider
//                 value={motionStartProgress}
//                 min={0}
//                 max={1}
//                 step={0.01}
//                 onChange={(_, v) => setMotionStartProgress(v as number)}
//               />

//               <Divider sx={{ my: 2 }} />
//               <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
//                 Sprite
//               </Typography>

//               <TextField
//                 label="Frame Duration (ms)"
//                 type="number"
//                 fullWidth
//                 value={spriteFrameMs}
//                 onChange={(e) =>
//                   setSpriteFrameMs(Math.max(0, +e.target.value || 0))
//                 }
//                 size="small"
//                 margin="dense"
//               />

//               <TextField
//                 label="Scale"
//                 type="number"
//                 fullWidth
//                 value={spriteScale}
//                 onChange={(e) =>
//                   setSpriteScale(Math.max(0.01, +e.target.value || 0.01))
//                 }
//                 size="small"
//                 margin="dense"
//               />

//               <TextField
//                 label="Offset X (px)"
//                 type="number"
//                 fullWidth
//                 value={spriteOffsetPxX}
//                 onChange={(e) => setSpriteOffsetPxX(+e.target.value || 0)}
//                 size="small"
//                 margin="dense"
//               />

//               <TextField
//                 label="Offset Y (px)"
//                 type="number"
//                 fullWidth
//                 value={spriteOffsetPxY}
//                 onChange={(e) => setSpriteOffsetPxY(+e.target.value || 0)}
//                 size="small"
//                 margin="dense"
//               />

//               <TextField
//                 label="Anchor"
//                 fullWidth
//                 select
//                 SelectProps={{ native: true }}
//                 value={spriteAnchor}
//                 onChange={(e) =>
//                   setSpriteAnchor(e.target.value as "center" | "bottom")
//                 }
//                 size="small"
//                 margin="dense"
//               >
//                 <option value="bottom">bottom</option>
//                 <option value="center">center</option>
//               </TextField>

//               <Divider sx={{ my: 2 }} />
//               <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
//                 Sprite Frames
//               </Typography>

//               {SPRITE_DIRECTIONS.map((direction) => (
//                 <Box
//                   key={direction}
//                   sx={{
//                     border: "1px solid #ddd",
//                     borderRadius: 1,
//                     p: 1.5,
//                     mt: 1.5,
//                   }}
//                 >
//                   <Box
//                     display="flex"
//                     justifyContent="space-between"
//                     alignItems="center"
//                     mb={1}
//                   >
//                     <Typography sx={{ textTransform: "capitalize" }}>
//                       {direction}
//                     </Typography>
//                     <Button
//                       size="small"
//                       variant="outlined"
//                       onClick={() => addDirectionFrame(direction)}
//                       disabled={directionalFrames[direction].length >= 4}
//                       startIcon={<AddIcon />}
//                     >
//                       Add Frame
//                     </Button>
//                   </Box>

//                   {directionalFrames[direction].length === 0 && (
//                     <Typography variant="body2" sx={{ opacity: 0.7 }}>
//                       No frames yet.
//                     </Typography>
//                   )}

//                   {directionalFrames[direction].map((frameUrl, frameIndex) => {
//                     const key = `${direction}-${frameIndex}`;
//                     const busy = uploadingKey === key;

//                     return (
//                       <Box
//                         key={key}
//                         sx={{
//                           border: "1px solid #eee",
//                           borderRadius: 1,
//                           p: 1,
//                           mb: 1,
//                         }}
//                       >
//                         <TextField
//                           label={`Frame ${frameIndex + 1} URL`}
//                           fullWidth
//                           value={frameUrl}
//                           onChange={(e) =>
//                             updateDirectionFrame(
//                               direction,
//                               frameIndex,
//                               e.target.value,
//                             )
//                           }
//                           size="small"
//                           margin="dense"
//                         />

//                         <Box
//                           sx={{
//                             display: "flex",
//                             gap: 1,
//                             alignItems: "center",
//                             mt: 1,
//                             flexWrap: "wrap",
//                           }}
//                         >
//                           <Button
//                             component="label"
//                             variant="outlined"
//                             size="small"
//                             startIcon={
//                               busy ? (
//                                 <CircularProgress size={14} />
//                               ) : (
//                                 <UploadFileIcon />
//                               )
//                             }
//                             disabled={busy}
//                           >
//                             {busy ? "Uploading..." : "Upload"}
//                             <input
//                               hidden
//                               type="file"
//                               accept="image/*"
//                               onChange={(e) => {
//                                 const file = e.target.files?.[0] ?? null;
//                                 void handleFrameUpload(
//                                   direction,
//                                   frameIndex,
//                                   file,
//                                 );
//                                 e.currentTarget.value = "";
//                               }}
//                             />
//                           </Button>

//                           <Button
//                             color="error"
//                             size="small"
//                             variant="text"
//                             startIcon={<DeleteIcon />}
//                             onClick={() =>
//                               removeDirectionFrame(direction, frameIndex)
//                             }
//                           >
//                             Remove
//                           </Button>
//                         </Box>
//                       </Box>
//                     );
//                   })}
//                 </Box>
//               ))}

//               {uploadError && (
//                 <Typography color="error" sx={{ mt: 1 }}>
//                   {uploadError}
//                 </Typography>
//               )}

//               <Divider sx={{ my: 2 }} />
//               <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
//                 Hidden Segments
//               </Typography>

//               {hiddenSegments.map((item, index) => (
//                 <Box
//                   key={`hidden-${index}`}
//                   sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}
//                 >
//                   <TextField
//                     label="Start Segment"
//                     type="number"
//                     size="small"
//                     value={item.startSegmentIndex}
//                     onChange={(e) =>
//                       updateHiddenSegment(
//                         index,
//                         "startSegmentIndex",
//                         Math.max(0, +e.target.value || 0),
//                       )
//                     }
//                   />
//                   <TextField
//                     label="End Segment"
//                     type="number"
//                     size="small"
//                     value={item.endSegmentIndex}
//                     onChange={(e) =>
//                       updateHiddenSegment(
//                         index,
//                         "endSegmentIndex",
//                         Math.max(0, +e.target.value || 0),
//                       )
//                     }
//                   />
//                   <IconButton onClick={() => removeHiddenSegment(index)}>
//                     <DeleteIcon fontSize="small" />
//                   </IconButton>
//                 </Box>
//               ))}

//               <Button
//                 sx={{ mt: 1 }}
//                 size="small"
//                 variant="outlined"
//                 startIcon={<AddIcon />}
//                 onClick={addHiddenSegment}
//               >
//                 Add Hidden Segment
//               </Button>

//               <Divider sx={{ my: 2 }} />
//               <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
//                 Vertex Pauses
//               </Typography>

//               {vertexPauses.map((item, index) => (
//                 <Box
//                   key={`pause-${index}`}
//                   sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}
//                 >
//                   <TextField
//                     label="Vertex Index"
//                     type="number"
//                     size="small"
//                     value={item.vertexIndex}
//                     onChange={(e) =>
//                       updateVertexPause(
//                         index,
//                         "vertexIndex",
//                         Math.max(0, +e.target.value || 0),
//                       )
//                     }
//                   />
//                   <TextField
//                     label="Duration (ms)"
//                     type="number"
//                     size="small"
//                     value={item.durationMs}
//                     onChange={(e) =>
//                       updateVertexPause(
//                         index,
//                         "durationMs",
//                         Math.max(0, +e.target.value || 0),
//                       )
//                     }
//                   />
//                   <IconButton onClick={() => removeVertexPause(index)}>
//                     <DeleteIcon fontSize="small" />
//                   </IconButton>
//                 </Box>
//               ))}

//               <Button
//                 sx={{ mt: 1 }}
//                 size="small"
//                 variant="outlined"
//                 startIcon={<AddIcon />}
//                 onClick={addVertexPause}
//               >
//                 Add Vertex Pause
//               </Button>
//             </>
//           )}

//           <Box sx={{ textAlign: "right", mt: 2 }}>
//             <Button onClick={cancelEdits} sx={{ mr: 1 }}>
//               Cancel
//             </Button>
//             <Button variant="contained" onClick={applyEdits}>
//               Save
//             </Button>
//           </Box>
//         </Box>
//       )}
//     </Box>
//   );
// }
// "use client";

// import { useState, useEffect } from "react";
// import {
//   labelsLayerRef,
//   finalizedLayerRef,
//   MapViewRef,
//   settingsRef,
//   settingsEvents,
// } from "./arcgisRefs";
// import { rebuildBuckets } from "./bucketManager";
// import Extent from "@arcgis/core/geometry/Extent";
// import { useSession } from "next-auth/react";
// import { useMapId } from "@/app/context/MapContext";
// import { saveMapToServer } from "@/app/helper/saveMap";
// import SettingsIcon from "@mui/icons-material/Settings";
// import DeleteIcon from "@mui/icons-material/Delete";
// import AddIcon from "@mui/icons-material/Add";
// import RestartAltIcon from "@mui/icons-material/RestartAlt";
// import {
//   TextField,
//   Slider,
//   Typography,
//   Button,
//   InputLabel,
//   Checkbox,
//   FormControlLabel,
//   Box,
//   IconButton,
//   Divider,
// } from "@mui/material";
// import MapControls, { Constraints } from "./MapControls";

// // ─── Coordinate Helper Functions ──────────────────────────────────────
// const R = 6378137;

// function mercatorToLonLat(
//   x: string | number,
//   y: string | number,
// ): [number, number] {
//   const xFloat = typeof x === "string" ? parseFloat(x) : x;
//   const yFloat = typeof y === "string" ? parseFloat(y) : y;
//   const lon = (xFloat / R) * (180 / Math.PI);
//   const lat =
//     (2 * Math.atan(Math.exp(yFloat / R)) - Math.PI / 2) * (180 / Math.PI);
//   return [lon, lat];
// }

// function lonLatToMercator(
//   lon: string | number,
//   lat: string | number,
// ): [number, number] {
//   const lonFloat = typeof lon === "string" ? parseFloat(lon) : lon;
//   const latFloat = typeof lat === "string" ? parseFloat(lat) : lat;
//   const x = lonFloat * (Math.PI / 180) * R;
//   const latRad = latFloat * (Math.PI / 180);
//   const y = R * Math.log(Math.tan(Math.PI / 4 + latRad / 2));
//   return [x, y];
// }

// interface FieldInfo {
//   fieldName: string;
//   label: string;
//   visible: boolean;
//   format?: {
//     digitSeparator?: boolean;
//     places?: number;
//   };
// }

// export interface FeatureLayerConfig {
//   id: string;
//   url: string;
//   index: number;
//   outFields: string[];
//   popupEnabled: boolean;
//   popupTemplate?: {
//     title: string;
//     content: Array<{
//       type: string;
//       fieldInfos?: FieldInfo[];
//     }>;
//   };
// }

// function genId() {
//   if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
//     return crypto.randomUUID();
//   }
//   return `layer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
// }

// function normalizeLayers(
//   layers: Partial<FeatureLayerConfig>[],
// ): FeatureLayerConfig[] {
//   return [...(layers ?? [])]
//     .map((l, i) => ({
//       id: (l as FeatureLayerConfig).id ?? genId(),
//       url: String(l.url ?? ""),
//       index: typeof l.index === "number" ? l.index : i,
//       outFields: (l.outFields as string[]) ?? ["*"],
//       popupEnabled: !!l.popupEnabled,
//       popupTemplate: l.popupTemplate as FeatureLayerConfig["popupTemplate"],
//     }))
//     .sort((a, b) => a.index - b.index);
// }

// const DEFAULT_APISOURCES: string[] = [];

// function coerceStringArray(value: any): string[] {
//   if (!Array.isArray(value)) return [];
//   return value
//     .filter((v): v is string => typeof v === "string")
//     .map((s) => s.trim())
//     .filter((s) => s.length > 0);
// }

// export default function Sidebar() {
//   // ─── Polygon‐editing state ───────────────────────────────────────────
//   const [polygonList, setPolygonList] = useState<any[]>([]);
//   const [editingId, setEditingId] = useState<string | null>(null);
//   const [editName, setEditName] = useState("");
//   const [editColor, setEditColor] = useState("#ffffff");
//   const [editAlpha, setEditAlpha] = useState(0.6);
//   const [editHTML, setEditHTML] = useState("");
//   const [editFontSize, setEditFontSize] = useState(12);
//   const [minZoomEnabled, setMinZoomEnabled] = useState(false);
//   const [maxZoomEnabled, setMaxZoomEnabled] = useState(false);
//   const [minZoomLevel, setMinZoomLevel] = useState<string>("14");
//   const [maxZoomLevel, setMaxZoomLevel] = useState<string>("18");

//   // ─── Auth & map context ─────────────────────────────────────────────
//   const { data: session } = useSession();
//   const userEmail = session?.user?.email;
//   const mapId = useMapId();

//   // ─── Map Settings UI state ──────────────────────────────────────────
//   const [openSettings, setOpenSettings] = useState(false);

//   // Center is stored as Lon/Lat strings for UI
//   const [center, setCenter] = useState({ x: "", y: "" });
//   const [zoom, setZoom] = useState(10);

//   const [layers, setLayers] = useState<FeatureLayerConfig[]>([]);
//   const [mapTile, setMapTile] = useState<string | null>(null);
//   const [baseMap, setBaseMap] = useState<string | null>(null);
//   const [apiSources, setApiSources] = useState<string[]>(DEFAULT_APISOURCES);
//   const [fieldNameById, setFieldNameById] = useState<Record<string, string>>(
//     {},
//   );

//   // Constraints stored as Lon/Lat strings for UI
//   const [constraints, setConstraints] = useState<Constraints>({
//     xmin: "", // Min Lon
//     ymin: "", // Min Lat
//     xmax: "", // Max Lon
//     ymax: "", // Max Lat
//   });

//   const view = MapViewRef.current!;

//   // ─── Helper: store center in the MapView SR (Web Mercator) ──────────
//   function setMapCenterInViewSR(x: number, y: number) {
//     const sr = MapViewRef.current?.spatialReference ?? {
//       wkid: 3857,
//       latestWkid: 3857,
//     };
//     settingsRef.current.center = { spatialReference: sr, x, y } as any;
//     settingsEvents.dispatchEvent(new Event("change"));
//   }

//   // ─── Capture Actions (Use Current View) ─────────────────────────────
//   const handleCapture = (type: "center" | "zoom" | "constraints") => {
//     const v = MapViewRef.current;
//     if (!v) return;

//     if (type === "center") {
//       const { x, y } = v.center;
//       const [lon, lat] = mercatorToLonLat(x, y);
//       setCenter({ x: lon.toFixed(6), y: lat.toFixed(6) });
//     }

//     if (type === "zoom") {
//       setZoom(v.zoom);
//     }

//     if (type === "constraints") {
//       const ext = v.extent;
//       if (ext) {
//         // Convert the extent corners from Mercator to Lon/Lat
//         const [minLon, minLat] = mercatorToLonLat(ext.xmin, ext.ymin);
//         const [maxLon, maxLat] = mercatorToLonLat(ext.xmax, ext.ymax);

//         setConstraints({
//           xmin: minLon.toFixed(6),
//           ymin: minLat.toFixed(6),
//           xmax: maxLon.toFixed(6),
//           ymax: maxLat.toFixed(6),
//         });
//       }
//     }
//   };

//   // ─── Toggle Settings (Load from State) ──────────────────────────────
//   const toggleSettings = () => {
//     if (!openSettings && view) {
//       // 1. Center: Convert Mercator Ref -> UI Lon/Lat
//       const c = settingsRef.current.center as { x: number; y: number };
//       const [lon, lat] = mercatorToLonLat(c.x, c.y);
//       setCenter({ x: String(lon), y: String(lat) });

//       setZoom(settingsRef.current.zoom);

//       // 2. Constraints: Convert Mercator Ref -> UI Lon/Lat
//       const cons = settingsRef.current.constraints;
//       if (cons) {
//         const [minLon, minLat] = mercatorToLonLat(cons.xmin, cons.ymin);
//         const [maxLon, maxLat] = mercatorToLonLat(cons.xmax, cons.ymax);
//         setConstraints({
//           xmin: String(minLon),
//           ymin: String(minLat),
//           xmax: String(maxLon),
//           ymax: String(maxLat),
//         });
//       } else {
//         setConstraints({ xmin: "", ymin: "", xmax: "", ymax: "" });
//       }
//     }

//     const featureLayers = normalizeLayers(
//       (settingsRef.current.featureLayers ??
//         []) as Partial<FeatureLayerConfig>[],
//     );
//     setLayers(featureLayers);
//     setMapTile(settingsRef.current.mapTile);
//     setBaseMap(settingsRef.current.baseMap);

//     const sAny = settingsRef.current as any;
//     const fromRef = coerceStringArray(sAny.apiSources);
//     setApiSources(fromRef.length > 0 ? fromRef : DEFAULT_APISOURCES);

//     setOpenSettings((o) => !o);
//   };

//   // ─── Input Handlers ─────────────────────────────────────────────────
//   const handleCenterChange = (field: "x" | "y", value: string) =>
//     setCenter((prev) => ({ ...prev, [field]: value }));
//   const handleZoomChange = (value: number) => setZoom(value);
//   const handleConstraintChange = (field: keyof Constraints, value: string) =>
//     setConstraints((prev) => ({ ...prev, [field]: value }));

//   const updateApiSource = (index: number, value: string) => {
//     setApiSources((prev) => prev.map((v, i) => (i === index ? value : v)));
//   };
//   const addApiSource = () => setApiSources((prev) => [...prev, ""]);
//   const removeApiSource = (index: number) =>
//     setApiSources((prev) => prev.filter((_, i) => i !== index));
//   const resetApiSources = () => setApiSources(DEFAULT_APISOURCES);

//   // ─── Apply Edits (Save back as Mercator) ────────────────────────────
//   const applySettings = () => {
//     const { xmin, ymin, xmax, ymax } = constraints;

//     // 1. Convert UI Constraints (Lon/Lat) -> Map Constraints (Mercator)
//     let finalExtent = null;
//     if (xmin && ymin && xmax && ymax) {
//       const [mercMinX, mercMinY] = lonLatToMercator(xmin, ymin);
//       const [mercMaxX, mercMaxY] = lonLatToMercator(xmax, ymax);

//       finalExtent = new Extent({
//         xmin: mercMinX,
//         ymin: mercMinY,
//         xmax: mercMaxX,
//         ymax: mercMaxY,
//         spatialReference: view.spatialReference,
//       });

//       view.constraints.geometry = finalExtent;
//     } else {
//       // @ts-ignore
//       view.constraints.geometry = null;
//     }

//     // 2. Persist Zoom
//     settingsRef.current.zoom = zoom;

//     // 3. Persist Center (UI Lon/Lat -> Mercator)
//     const [mercX, mercY] = lonLatToMercator(center.x, center.y);
//     setMapCenterInViewSR(mercX, mercY);

//     // 4. Persist Constraints object (Mercator)
//     settingsRef.current.constraints = finalExtent
//       ? {
//           xmin: finalExtent.xmin,
//           ymin: finalExtent.ymin,
//           xmax: finalExtent.xmax,
//           ymax: finalExtent.ymax,
//         }
//       : (null as any);

//     // 5. Layers & Tile
//     const layersSorted = normalizeLayers(layers);
//     settingsRef.current.featureLayers = layersSorted;
//     settingsRef.current.mapTile = mapTile;
//     settingsRef.current.baseMap = baseMap;

//     // 6. API Sources
//     const cleaned = apiSources.map((s) => s.trim()).filter((s) => s.length > 0);
//     const withFallback = cleaned.length > 0 ? cleaned : DEFAULT_APISOURCES;
//     const deduped = Array.from(new Set(withFallback));
//     (settingsRef.current as any).apiSources = deduped;

//     // 7. Save to Server
//     if (userEmail) {
//       const s = settingsRef.current as any;
//       saveMapToServer(mapId, userEmail, {
//         zoom: s.zoom,
//         center: [s.center.x, s.center.y] as [number, number],
//         constraints: s.constraints,
//         featureLayers: layersSorted,
//         mapTile: mapTile,
//         baseMap: baseMap,
//         apiSources: deduped,
//       });
//     }

//     setOpenSettings(false);
//   };

//   // ─── Polygon/Editing Effects (Unchanged Logic) ──────────────────────
//   useEffect(() => {
//     const handler = () => {
//       const items = finalizedLayerRef.current?.graphics?.items ?? [];
//       setPolygonList(
//         items
//           .slice()
//           .sort((a: any, b: any) => a.attributes.order - b.attributes.order),
//       );

//       if (editingId) {
//         const g = items.find((gr: any) => gr.attributes.id === editingId);
//         if (g) {
//           console.log(g.geometry.type);
//           setEditName(g.attributes.name);
//           const { r, g: grn, b, a } = g.symbol.color;
//           setEditColor(
//             `#${[r, grn, b]
//               .map((v: number) => v.toString(16).padStart(2, "0"))
//               .join("")}`,
//           );
//           setEditAlpha(typeof a === "number" ? a : 0.6);
//           setEditHTML(g.popupTemplate.content);

//           const label = labelsLayerRef.current?.graphics.items.find(
//             (l: any) => l.attributes.parentId === editingId,
//           );
//           if (label) {
//             const size = (label.symbol as any).font.size;
//             setEditFontSize(typeof size === "number" ? size : 12);
//             const show = label.attributes.showAtZoom;
//             const hide = label.attributes.hideAtZoom;
//             setMinZoomEnabled(show != null);
//             setMaxZoomEnabled(hide != null);
//             if (show != null) setMinZoomLevel(String(show));
//             if (hide != null) setMaxZoomLevel(String(hide));
//           }
//         }
//       }
//     };
//     finalizedLayerRef.events.addEventListener("change", handler);
//     handler();
//     return () =>
//       finalizedLayerRef.events.removeEventListener("change", handler);
//   }, [editingId]);

//   const goTo = (graphic: any) => {
//     const target = graphic.geometry.extent?.center || graphic.geometry;
//     view
//       .goTo({ target, zoom: 18 })
//       .then(() =>
//         view.popup.open({ features: [graphic], location_at: target }),
//       );
//   };
//   const startEditing = (graphic: any) => setEditingId(graphic.attributes.id);

//   const applyEdits = () => {
//     if (!editingId) return;
//     const layer = finalizedLayerRef.current!;
//     const g = layer.graphics.find((gr: any) => gr.attributes.id === editingId);
//     if (!g) return;

//     g.attributes.name = editName;
//     g.popupTemplate.content = editHTML;
//     g.attributes.description = editHTML;
//     const hex = editColor.slice(1);
//     const r = parseInt(hex.substr(0, 2), 16);
//     const grn = parseInt(hex.substr(2, 2), 16);
//     const b = parseInt(hex.substr(4, 2), 16);
//     const newSym = (g.symbol as any).clone();
//     newSym.color = [r, grn, b, +editAlpha.toFixed(2)];
//     g.symbol = newSym;

//     const labelsLayer = labelsLayerRef.current!;
//     const label = labelsLayer.graphics.find(
//       (l: any) => l.attributes.parentId === editingId,
//     );
//     if (label) {
//       if (minZoomEnabled) label.attributes.showAtZoom = +minZoomLevel;
//       else delete label.attributes.showAtZoom;
//       if (maxZoomEnabled) label.attributes.hideAtZoom = +maxZoomLevel;
//       else delete label.attributes.hideAtZoom;

//       (label.symbol as any).text = editName;
//       (label.symbol as any).font.size = editFontSize;

//       (window as any).require(
//         ["esri/geometry/Point", "esri/geometry/geometryEngine"],
//         (P: any, geometryEngine: any) => {
//           let pt: __esri.Point | null = null;
//           try {
//             pt = geometryEngine.labelPoints(g.geometry);
//           } catch {}
//           if (pt) {
//             label.geometry = new P({
//               x: pt.x,
//               y: pt.y,
//               spatialReference: view.spatialReference,
//             });
//           } else {
//             const c = (g.geometry as any).centroid ?? g.geometry.extent?.center;
//             if (c) {
//               label.geometry = new P({
//                 x: c.x,
//                 y: c.y,
//                 spatialReference: view.spatialReference,
//               });
//             }
//           }
//           rebuildBuckets(labelsLayer);
//         },
//       );
//     }

//     const s = settingsRef.current as any;
//     const featureLayersSnapshot = normalizeLayers(
//       (s.featureLayers ?? []) as Partial<FeatureLayerConfig>[],
//     );
//     s.featureLayers = featureLayersSnapshot;

//     const apiSourcesSnapshot = (() => {
//       const cleaned = coerceStringArray(s.apiSources);
//       return cleaned.length > 0 ? cleaned : DEFAULT_APISOURCES;
//     })();

//     if (userEmail) {
//       saveMapToServer(mapId, userEmail, {
//         zoom: s.zoom,
//         center: [s.center.x, s.center.y] as [number, number],
//         constraints: s.constraints,
//         featureLayers: featureLayersSnapshot,
//         mapTile: s.mapTile,
//         baseMap: s.baseMap,
//         apiSources: apiSourcesSnapshot,
//       });
//     }

//     finalizedLayerRef.events.dispatchEvent(new Event("change"));
//     setEditingId(null);
//   };

//   const cancelEdits = () => setEditingId(null);

//   // ─── Sync (External Changes) ────────────────────────────────────────
//   useEffect(() => {
//     const sync = () => {
//       const s = settingsRef.current as any;
//       // Sync Center (Mercator -> Lon/Lat)
//       const [lon, lat] = mercatorToLonLat(s.center.x, s.center.y);
//       setCenter({ x: String(lon), y: String(lat) });

//       const featureLayers = normalizeLayers(
//         (s.featureLayers ?? []) as Partial<FeatureLayerConfig>[],
//       );
//       setLayers(featureLayers);
//       setMapTile(settingsRef.current.mapTile);
//       setBaseMap(settingsRef.current.baseMap);
//       setZoom(s.zoom);

//       const fromRef = coerceStringArray(s.apiSources);
//       setApiSources(fromRef.length > 0 ? fromRef : DEFAULT_APISOURCES);

//       // Sync Constraints (Mercator -> Lon/Lat)
//       if (s.constraints) {
//         const [minLon, minLat] = mercatorToLonLat(
//           s.constraints.xmin,
//           s.constraints.ymin,
//         );
//         const [maxLon, maxLat] = mercatorToLonLat(
//           s.constraints.xmax,
//           s.constraints.ymax,
//         );
//         setConstraints({
//           xmin: String(minLon),
//           ymin: String(minLat),
//           xmax: String(maxLon),
//           ymax: String(maxLat),
//         });
//       }
//     };
//     settingsEvents.addEventListener("change", sync);
//     sync();
//     return () => settingsEvents.removeEventListener("change", sync);
//   }, []);

//   return (
//     <Box sx={{ height: "100%", overflowY: "auto", p: 2 }}>
//       <IconButton
//         onClick={toggleSettings}
//         sx={{
//           position: "absolute",
//           bottom: 25,
//           left: 260,
//           width: 50,
//           height: 50,
//           bgcolor: "background.paper",
//           border: 1,
//           zIndex: 9999,
//         }}
//       >
//         <SettingsIcon fontSize="large" />
//       </IconButton>

//       {openSettings && (
//         <Box
//           sx={{
//             position: "absolute",
//             bottom: 25,
//             left: 320,
//             zIndex: 99,
//             bgcolor: "background.paper",
//             border: 1,
//             p: 1,
//             width: 300,
//             height: 500,
//             overflow: "scroll",
//           }}
//         >
//           <Box
//             display="flex"
//             justifyContent="space-between"
//             alignItems="center"
//           >
//             <div>╔═</div>
//             <Typography variant="h6">Map Settings</Typography>
//             <div>═╗</div>
//           </Box>

//           <Box mt={1}>
//             <MapControls
//               centerX={center.x}
//               centerY={center.y}
//               onCenterChange={handleCenterChange}
//               zoom={zoom}
//               onZoomChange={handleZoomChange}
//               constraints={constraints}
//               onConstraintChange={handleConstraintChange}
//               layers={layers}
//               setLayers={setLayers}
//               fieldNameById={fieldNameById}
//               setFieldNameById={setFieldNameById}
//               mapTile={mapTile}
//               setMapTile={setMapTile}
//               baseMap={baseMap}
//               setBaseMap={setBaseMap}
//               onCapture={handleCapture}
//             />

//             <Divider sx={{ my: 2 }} />
//             <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
//               API Sources
//             </Typography>
//             <Box sx={{ mt: 1 }}>
//               {apiSources.map((url, idx) => (
//                 <Box
//                   key={`${idx}-${url}`}
//                   sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}
//                 >
//                   <TextField
//                     label={`API Source ${idx + 1}`}
//                     value={url}
//                     onChange={(e) => updateApiSource(idx, e.target.value)}
//                     size="small"
//                     fullWidth
//                   />
//                   <IconButton onClick={() => removeApiSource(idx)} size="small">
//                     <DeleteIcon fontSize="small" />
//                   </IconButton>
//                 </Box>
//               ))}
//               <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
//                 <Button
//                   size="small"
//                   variant="outlined"
//                   onClick={addApiSource}
//                   startIcon={<AddIcon />}
//                 >
//                   Add
//                 </Button>
//                 <Button
//                   size="small"
//                   variant="text"
//                   onClick={resetApiSources}
//                   startIcon={<RestartAltIcon />}
//                 >
//                   Reset defaults
//                 </Button>
//               </Box>
//             </Box>
//           </Box>

//           <Box display="flex" justifyContent="flex-end" mt={2}>
//             <Button onClick={toggleSettings}>Cancel</Button>
//             <Button variant="contained" onClick={applySettings} sx={{ ml: 1 }}>
//               Apply All Edits
//             </Button>
//           </Box>
//         </Box>
//       )}

//       {/* Polygon List (Unchanged) */}
//       <Box display="flex" justifyContent="space-between" mb={1}>
//         <div>╔═</div>
//         <Typography component="h3">Polygons</Typography>
//         <div>═╗</div>
//       </Box>
//       <ul style={{ paddingLeft: 20 }}>
//         {polygonList.map((poly) => (
//           <li key={poly.attributes.id} style={{ margin: "8px 0" }}>
//             {poly.attributes.name}
//             <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
//               <Button
//                 size="small"
//                 variant="outlined"
//                 onClick={() => goTo(poly)}
//               >
//                 Go to
//               </Button>
//               <Button
//                 size="small"
//                 variant="outlined"
//                 onClick={() => startEditing(poly)}
//               >
//                 Edit
//               </Button>
//             </Box>
//           </li>
//         ))}
//       </ul>

//       {/* Edit Modal (Unchanged) */}
//       {editingId && (
//         <Box
//           sx={{
//             position: "absolute",
//             top: 90,
//             right: 25,
//             zIndex: 999,
//             bgcolor: "background.paper",
//             p: 2,
//             boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
//             borderRadius: 1,
//             width: 260,
//           }}
//         >
//           <Typography variant="h6">Edit Polygon</Typography>
//           <TextField
//             label="Name"
//             fullWidth
//             value={editName}
//             onChange={(e) => setEditName(e.target.value)}
//             size="small"
//             margin="dense"
//           />
//           <InputLabel sx={{ mt: 2 }}>Fill Color</InputLabel>
//           <input
//             type="color"
//             value={editColor}
//             onChange={(e) => setEditColor(e.target.value)}
//             style={{
//               width: "100%",
//               height: 40,
//               border: "none",
//               margin: "8px 0",
//             }}
//           />
//           <Typography gutterBottom>Opacity: {editAlpha.toFixed(2)}</Typography>
//           <Slider
//             value={editAlpha}
//             min={0}
//             max={1}
//             step={0.01}
//             onChange={(_, v) => setEditAlpha(v as number)}
//           />
//           <TextField
//             label="Font Size"
//             type="number"
//             fullWidth
//             inputProps={{ min: 6, max: 48 }}
//             value={editFontSize}
//             onChange={(e) => setEditFontSize(+e.target.value)}
//             size="small"
//             margin="dense"
//           />
//           <FormControlLabel
//             control={
//               <Checkbox
//                 checked={minZoomEnabled}
//                 onChange={(e) => setMinZoomEnabled(e.target.checked)}
//               />
//             }
//             label="Hide below zoom (inclusive)"
//           />
//           <TextField
//             label="Min Zoom"
//             fullWidth
//             value={minZoomLevel}
//             onChange={(e) => setMinZoomLevel(e.target.value)}
//             size="small"
//             margin="dense"
//             disabled={!minZoomEnabled}
//           />
//           <FormControlLabel
//             control={
//               <Checkbox
//                 checked={maxZoomEnabled}
//                 onChange={(e) => setMaxZoomEnabled(e.target.checked)}
//               />
//             }
//             label="Hide above zoom (exclusive)"
//           />
//           <TextField
//             label="Max Zoom"
//             fullWidth
//             value={maxZoomLevel}
//             onChange={(e) => setMaxZoomLevel(e.target.value)}
//             size="small"
//             margin="dense"
//             disabled={!maxZoomEnabled}
//           />
//           <TextField
//             label="Popup HTML"
//             multiline
//             fullWidth
//             rows={4}
//             value={editHTML}
//             onChange={(e) => setEditHTML(e.target.value)}
//             size="small"
//             margin="dense"
//           />
//           <Box sx={{ textAlign: "right", mt: 1 }}>
//             <Button onClick={cancelEdits} sx={{ mr: 1 }}>
//               Cancel
//             </Button>
//             <Button variant="contained" onClick={applyEdits}>
//               Save
//             </Button>
//           </Box>
//         </Box>
//       )}
//     </Box>
//   );
// }
