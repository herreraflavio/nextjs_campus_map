"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { useSession } from "next-auth/react";
import { useMapId } from "@/app/context/MapContext";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputLabel,
  Slider,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import {
  finalizedLayerRef,
  labelsLayerRef,
  MapViewRef,
  settingsRef,
} from "../arcgisRefs";
import { rebuildBuckets } from "../bucketManager";
import { useMapCategories } from "../categories/useMapCategories";
import {
  getCategoryDepth,
  ROOT_CATEGORY_ID,
  resolveCategoryId,
} from "../categories/categoryStore";
import {
  requestDrawingCreation,
  type DrawableGeometryType,
} from "../categories/drawingCreationStore";
import { applyMapVisibility } from "../categories/categoryVisibility";
import { saveMapToServer } from "@/app/helper/saveMap";
import type {
  FeatureLayerConfig,
  HiddenSegmentRange,
  MapCategory,
  PolylineAnimation,
  VertexPause,
} from "@/app/types/myTypes";
import {
  createDefaultPolylineAnimation,
  normalizePolylineAnimation,
} from "@/app/types/myTypes";

type SpriteDirection = "up" | "down" | "left" | "right";

const SPRITE_DIRECTIONS: SpriteDirection[] = ["up", "down", "left", "right"];
const DEFAULT_APISOURCES: string[] = [];

type EditPanelProps =
  | {
      mode: "edit";
      editingId: string;
      initialCategoryId?: never;
      onClose: () => void;
    }
  | {
      mode: "create";
      editingId?: never;
      initialCategoryId: string;
      onClose: () => void;
    };

function coerceStringArray(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function sanitizeFrameList(value: string[]): string[] {
  return value
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
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
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function colorToHexAlpha(color: any): { hex: string; alpha: number } {
  const rgba =
    typeof color?.toRgba === "function"
      ? color.toRgba()
      : Array.isArray(color)
        ? color
        : [
            typeof color?.r === "number" ? color.r : 255,
            typeof color?.g === "number" ? color.g : 255,
            typeof color?.b === "number" ? color.b : 255,
            typeof color?.a === "number" ? color.a : 0.6,
          ];

  const [r, g, b, a] = rgba;
  return {
    hex: `#${[r, g, b]
      .map((value) =>
        Math.max(0, Math.min(255, Math.round(value)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`,
    alpha: typeof a === "number" ? a : 0.6,
  };
}

function buildCategoryOptions(categories: MapCategory[]) {
  const byParent = new Map<string | null, MapCategory[]>();

  categories.forEach((category) => {
    const parentId = category.parentId ?? null;
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), category]);
  });

  byParent.forEach((items, parentId) => {
    byParent.set(
      parentId,
      [...items].sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.name.localeCompare(b.name);
      }),
    );
  });

  const options: Array<{ id: string; label: string }> = [
    { id: ROOT_CATEGORY_ID, label: "Home" },
  ];

  const visit = (parentId: string | null, seen: Set<string>) => {
    for (const category of byParent.get(parentId) ?? []) {
      if (seen.has(category.id)) continue;

      const depth = getCategoryDepth(category.id);
      options.push({
        id: category.id,
        label: `${"  ".repeat(depth)}${category.name}`,
      });

      seen.add(category.id);
      visit(category.id, seen);
      seen.delete(category.id);
    }
  };

  visit(null, new Set());
  return options;
}

function PolylineMap({
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
}) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, [paths]);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

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
  const currentScale = Math.max(0.01, transform.scale);

  const toSvgCoords = (x: number, y: number) => ({
    x:
      padding +
      (x - minX) * initialScale +
      (baseWidth - 2 * padding - rangeX * initialScale) / 2,
    y:
      padding +
      (maxY - y) * initialScale +
      (baseHeight - 2 * padding - rangeY * initialScale) / 2,
  });

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    if (!interactive) return;

    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const newScale = Math.max(0.2, Math.min(transform.scale * zoomFactor, 50));

    setTransform({
      scale: newScale,
      x: mouseX - (mouseX - transform.x) * (newScale / transform.scale),
      y: mouseY - (mouseY - transform.y) * (newScale / transform.scale),
    });
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    setIsDragging(true);
    setDragStart({
      x: event.clientX - transform.x,
      y: event.clientY - transform.y,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive || !isDragging) return;
    setTransform({
      ...transform,
      x: event.clientX - dragStart.x,
      y: event.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  let segmentGlobalIndex = 0;
  const elements: React.ReactNode[] = [];

  paths.forEach((path, pathIndex) => {
    for (let i = 0; i < path.length - 1; i += 1) {
      const p1 = toSvgCoords(path[i][0], path[i][1]);
      const p2 = toSvgCoords(path[i + 1][0], path[i + 1][1]);
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const currentSegIndex = segmentGlobalIndex++;
      const isHidden = hiddenSegments.some(
        (range) =>
          currentSegIndex >= range.startSegmentIndex &&
          currentSegIndex <= range.endSegmentIndex,
      );

      elements.push(
        <line
          key={`line-${pathIndex}-${i}`}
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={isHidden ? "#d32f2f" : "#1976d2"}
          strokeWidth={(isHidden ? 2 : 3) / currentScale}
          strokeDasharray={
            isHidden ? `${4 / currentScale},${4 / currentScale}` : "none"
          }
        />,
      );
      elements.push(
        <circle
          key={`pt-${pathIndex}-${i}`}
          cx={p1.x}
          cy={p1.y}
          r={3 / currentScale}
          fill="#555"
        />,
      );
      if (i === path.length - 2) {
        elements.push(
          <circle
            key={`pt-${pathIndex}-${i + 1}`}
            cx={p2.x}
            cy={p2.y}
            r={3 / currentScale}
            fill="#555"
          />,
        );
      }
      elements.push(
        <text
          key={`txt-${pathIndex}-${i}`}
          x={midX}
          y={midY - 6 / currentScale}
          fontSize={11 / currentScale}
          fill={isHidden ? "#d32f2f" : "#000"}
          textAnchor="middle"
          fontWeight="bold"
          style={{
            paintOrder: "stroke",
            stroke: "#fff",
            strokeWidth: 3 / currentScale,
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
        borderRadius: interactive ? 0 : 4,
        border: interactive ? "none" : "1px solid #e0e0e0",
        cursor: interactive ? (isDragging ? "grabbing" : "grab") : "default",
        touchAction: "none",
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
}

function PolylinePreview({
  paths,
  hiddenSegments,
}: {
  paths: number[][][];
  hiddenSegments: HiddenSegmentRange[];
}) {
  const [expanded, setExpanded] = useState(false);

  if (!paths || paths.length === 0 || paths[0].length < 2) {
    return (
      <Typography variant="body2">No polyline data to preview.</Typography>
    );
  }

  return (
    <Box sx={{ mt: 1, mb: 2, position: "relative" }}>
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
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default function EditPanel(props: EditPanelProps) {
  const editingId = props.mode === "edit" ? props.editingId : null;
  const initialCategoryId =
    props.mode === "create" ? props.initialCategoryId : ROOT_CATEGORY_ID;
  const categories = useMapCategories();
  const categoryOptions = useMemo(
    () => buildCategoryOptions(categories),
    [categories],
  );

  const { data: session } = useSession();
  const userEmail = session?.user?.email;
  const mapId = useMapId();

  const [editingGeometryType, setEditingGeometryType] =
    useState<DrawableGeometryType>("polygon");
  const [editingPaths, setEditingPaths] = useState<number[][][]>([]);
  const [editName, setEditName] = useState(
    props.mode === "create" ? "New Item" : "",
  );
  const [editColor, setEditColor] = useState("#ffffff");
  const [editAlpha, setEditAlpha] = useState(0.6);
  const [editHTML, setEditHTML] = useState("");
  const [editFontSize, setEditFontSize] = useState(12);
  const [editWidth, setEditWidth] = useState(3);
  const [editPointSize, setEditPointSize] = useState(10);
  const [editCategoryId, setEditCategoryId] = useState(
    props.mode === "create"
      ? resolveCategoryId(initialCategoryId)
      : ROOT_CATEGORY_ID,
  );
  const [editIconUrl, setEditIconUrl] = useState("");

  const [minZoomEnabled, setMinZoomEnabled] = useState(false);
  const [maxZoomEnabled, setMaxZoomEnabled] = useState(false);
  const [minZoomLevel, setMinZoomLevel] = useState("14");
  const [maxZoomLevel, setMaxZoomLevel] = useState("18");

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

  function resetAnimationEditorFrom(animation?: unknown) {
    const normalized = normalizePolylineAnimation(
      animation ?? createDefaultPolylineAnimation(),
    );

    setAnimationEnabled(normalized.enabled);
    setMotionDurationMs(normalized.motion.durationMs);
    setMotionLoop(normalized.motion.loop);
    setMotionReverse(normalized.motion.reverse);
    setMotionAutoPlay(normalized.motion.autoPlay);
    setMotionStartProgress(normalized.motion.startProgress);
    setSpriteFrameMs(normalized.sprite.frameMs);
    setSpriteScale(normalized.sprite.scale);
    setSpriteOffsetPxX(normalized.sprite.offsetPxX);
    setSpriteOffsetPxY(normalized.sprite.offsetPxY);
    setSpriteAnchor(normalized.sprite.anchor);
    setDirectionalFrames({
      up: [...normalized.sprite.directionalFrames.up],
      down: [...normalized.sprite.directionalFrames.down],
      left: [...normalized.sprite.directionalFrames.left],
      right: [...normalized.sprite.directionalFrames.right],
    });
    setHiddenSegments(
      normalized.behavior.hiddenSegments.map((item) => ({ ...item })),
    );
    setVertexPauses(
      normalized.behavior.vertexPauses.map((item) => ({ ...item })),
    );
  }

  useEffect(() => {
    if (props.mode !== "edit" || !editingId) return;

    const graphic = finalizedLayerRef.current?.graphics.find(
      (candidate: any) => candidate.attributes?.id === editingId,
    );
    if (!graphic) return;

    const geomType = graphic.geometry?.type as DrawableGeometryType;
    setEditingGeometryType(geomType);
    setEditName(graphic.attributes?.name ?? "");

    const color = colorToHexAlpha(graphic.symbol?.color);
    setEditColor(color.hex);
    setEditAlpha(color.alpha);
    setEditHTML(
      graphic.popupTemplate?.content ?? graphic.attributes?.description ?? "",
    );
    setEditCategoryId(resolveCategoryId(graphic.attributes?.categoryId));
    setEditIconUrl(
      typeof graphic.attributes?.iconUrl === "string"
        ? graphic.attributes.iconUrl
        : "",
    );

    if (geomType === "polyline") {
      setEditingPaths(graphic.geometry.paths || []);
      setEditWidth(
        typeof graphic.symbol?.width === "number"
          ? graphic.symbol.width
          : typeof graphic.attributes?.width === "number"
            ? graphic.attributes.width
            : 3,
      );
      resetAnimationEditorFrom(graphic.attributes?.animation);
    } else {
      setEditingPaths([]);
      resetAnimationEditorFrom(createDefaultPolylineAnimation());
    }

    if (geomType === "point") {
      setEditPointSize(
        typeof graphic.symbol?.size === "number"
          ? graphic.symbol.size
          : typeof graphic.attributes?.size === "number"
            ? graphic.attributes.size
            : 10,
      );
    } else {
      setEditPointSize(10);
    }

    const label = labelsLayerRef.current?.graphics.items.find(
      (item: any) => item.attributes.parentId === editingId,
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
  }, [props.mode, editingId]);

  const handleImageUpload = async (key: string, file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Only image uploads are supported.");
      return;
    }

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

      if (key === "item-icon") {
        setEditIconUrl(url);
      } else {
        const [direction, frameIndex] = key.split("-");
        updateDirectionFrame(
          direction as SpriteDirection,
          Number(frameIndex),
          url,
        );
      }
    } catch (error: any) {
      console.error(error);
      setUploadError(error?.message ?? "Upload failed.");
    } finally {
      setUploadingKey(null);
    }
  };

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

  const startCreate = () => {
    requestDrawingCreation({
      name: editName.trim() || "New Item",
      categoryId:
        editCategoryId === ROOT_CATEGORY_ID ? null : editCategoryId,
      iconUrl: editIconUrl.trim() || null,
      geometryType: editingGeometryType,
    });
    props.onClose();
  };

  const saveCurrentMap = () => {
    if (!userEmail) return;

    const s = settingsRef.current as any;
    const featureLayersSnapshot =
      (s.featureLayers ?? []) as FeatureLayerConfig[] | null;
    const apiSourcesSnapshot = (() => {
      const cleaned = coerceStringArray(s.apiSources);
      return cleaned.length > 0 ? cleaned : DEFAULT_APISOURCES;
    })();

    saveMapToServer(mapId, userEmail, {
      zoom: s.zoom,
      center: [s.center.x, s.center.y] as [number, number],
      constraints: s.constraints,
      featureLayers: featureLayersSnapshot,
      mapTile: s.mapTile,
      baseMap: s.baseMap,
      apiSources: apiSourcesSnapshot,
    });
  };

  const applyEdits = () => {
    if (props.mode !== "edit" || !editingId) return;

    const view = MapViewRef.current;
    const layer = finalizedLayerRef.current;
    const graphic = layer?.graphics.find(
      (candidate: any) => candidate.attributes.id === editingId,
    );
    if (!graphic || !view) return;

    graphic.attributes.name = editName;
    graphic.attributes.categoryId =
      editCategoryId === ROOT_CATEGORY_ID ? null : editCategoryId;
    graphic.attributes.iconUrl = editIconUrl.trim() || null;
    graphic.popupTemplate = {
      title: editName,
      content: editHTML,
    };
    graphic.attributes.description = editHTML;

    const hex = editColor.slice(1);
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const newSym = (graphic.symbol as any).clone();
    newSym.color = [r, g, b, +editAlpha.toFixed(2)];

    if (editingGeometryType === "polyline") {
      newSym.width = editWidth;
      graphic.attributes.width = editWidth;

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

      graphic.attributes.animation = nextAnimation;
    }

    if (editingGeometryType === "point") {
      newSym.size = editPointSize;
      graphic.attributes.size = editPointSize;
    }

    graphic.symbol = newSym;

    const labelsLayer = labelsLayerRef.current;
    const label = labelsLayer?.graphics.find(
      (candidate: any) => candidate.attributes.parentId === editingId,
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
        (Point: any, geometryEngine: any) => {
          let point: __esri.Point | null = null;
          try {
            point = geometryEngine.labelPoints(graphic.geometry);
          } catch {}

          if (point) {
            label.geometry = new Point({
              x: point.x,
              y: point.y,
              spatialReference: view.spatialReference,
            });
          } else {
            const center =
              (graphic.geometry as any).centroid ??
              graphic.geometry.extent?.center;
            if (center) {
              label.geometry = new Point({
                x: center.x,
                y: center.y,
                spatialReference: view.spatialReference,
              });
            }
          }
          rebuildBuckets(labelsLayer);
          applyMapVisibility(view.zoom);
        },
      );
    }

    saveCurrentMap();
    finalizedLayerRef.events.dispatchEvent(new Event("change"));
    applyMapVisibility(view.zoom);
    props.onClose();
  };

  const panelTitle =
    props.mode === "create"
      ? "New Item"
      : `Edit ${editingGeometryType ?? "Drawing"}`;

  return (
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
        {panelTitle}
      </Typography>

      <TextField
        label="Name"
        fullWidth
        value={editName}
        onChange={(event) => setEditName(event.target.value)}
        size="small"
        margin="dense"
      />

      <TextField
        label="Category"
        fullWidth
        select
        SelectProps={{ native: true }}
        value={editCategoryId}
        onChange={(event) => setEditCategoryId(event.target.value)}
        size="small"
        margin="dense"
      >
        {categoryOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </TextField>

      <Box sx={{ mt: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Sidebar Icon
        </Typography>
        {editIconUrl && (
          <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
            <img
              src={editIconUrl}
              alt=""
              style={{
                width: 44,
                height: 44,
                objectFit: "cover",
                borderRadius: 4,
                border: "1px solid #ddd",
              }}
            />
            <Button size="small" onClick={() => setEditIconUrl("")}>
              Clear
            </Button>
          </Box>
        )}
        <Box sx={{ mt: 1, display: "flex", gap: 1, alignItems: "center" }}>
          <Button
            component="label"
            variant="outlined"
            size="small"
            startIcon={
              uploadingKey === "item-icon" ? (
                <CircularProgress size={14} />
              ) : (
                <UploadFileIcon />
              )
            }
            disabled={uploadingKey === "item-icon"}
          >
            {uploadingKey === "item-icon" ? "Uploading..." : "Upload"}
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={(event) => {
                void handleImageUpload(
                  "item-icon",
                  event.target.files?.[0] ?? null,
                );
                event.currentTarget.value = "";
              }}
            />
          </Button>
        </Box>
      </Box>

      {props.mode === "create" && (
        <TextField
          label="Geometry Type"
          fullWidth
          select
          SelectProps={{ native: true }}
          value={editingGeometryType}
          onChange={(event) =>
            setEditingGeometryType(event.target.value as DrawableGeometryType)
          }
          size="small"
          margin="dense"
          sx={{ mt: 1 }}
        >
          <option value="polygon">polygon</option>
          <option value="polyline">polyline</option>
          <option value="point">point</option>
        </TextField>
      )}

      {props.mode === "edit" && (
        <>
          <InputLabel sx={{ mt: 2 }}>Color</InputLabel>
          <input
            type="color"
            value={editColor}
            onChange={(event) => setEditColor(event.target.value)}
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
            onChange={(_, value) => setEditAlpha(value as number)}
          />

          {editingGeometryType === "polyline" && (
            <TextField
              label="Line Width"
              type="number"
              fullWidth
              inputProps={{ min: 1, step: 1 }}
              value={editWidth}
              onChange={(event) =>
                setEditWidth(Math.max(1, +event.target.value || 1))
              }
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
              onChange={(event) =>
                setEditPointSize(Math.max(1, +event.target.value || 1))
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
                onChange={(event) => setEditFontSize(+event.target.value)}
                size="small"
                margin="dense"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={minZoomEnabled}
                    onChange={(event) =>
                      setMinZoomEnabled(event.target.checked)
                    }
                  />
                }
                label="Hide below zoom (inclusive)"
              />
              <TextField
                label="Min Zoom"
                fullWidth
                value={minZoomLevel}
                onChange={(event) => setMinZoomLevel(event.target.value)}
                size="small"
                margin="dense"
                disabled={!minZoomEnabled}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={maxZoomEnabled}
                    onChange={(event) =>
                      setMaxZoomEnabled(event.target.checked)
                    }
                  />
                }
                label="Hide above zoom (exclusive)"
              />
              <TextField
                label="Max Zoom"
                fullWidth
                value={maxZoomLevel}
                onChange={(event) => setMaxZoomLevel(event.target.value)}
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
            onChange={(event) => setEditHTML(event.target.value)}
            size="small"
            margin="dense"
          />
        </>
      )}

      {props.mode === "edit" && editingGeometryType === "polyline" && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Animation
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                checked={animationEnabled}
                onChange={(event) => setAnimationEnabled(event.target.checked)}
              />
            }
            label="Animated"
          />

          <TextField
            label="Duration (ms)"
            type="number"
            fullWidth
            value={motionDurationMs}
            onChange={(event) =>
              setMotionDurationMs(Math.max(0, +event.target.value || 0))
            }
            size="small"
            margin="dense"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={motionLoop}
                onChange={(event) => setMotionLoop(event.target.checked)}
              />
            }
            label="Loop"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={motionReverse}
                onChange={(event) => setMotionReverse(event.target.checked)}
              />
            }
            label="Reverse"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={motionAutoPlay}
                onChange={(event) => setMotionAutoPlay(event.target.checked)}
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
            onChange={(_, value) => setMotionStartProgress(value as number)}
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
            onChange={(event) =>
              setSpriteFrameMs(Math.max(0, +event.target.value || 0))
            }
            size="small"
            margin="dense"
          />
          <TextField
            label="Scale"
            type="number"
            fullWidth
            value={spriteScale}
            onChange={(event) =>
              setSpriteScale(Math.max(0.01, +event.target.value || 0.01))
            }
            size="small"
            margin="dense"
          />
          <TextField
            label="Offset X (px)"
            type="number"
            fullWidth
            value={spriteOffsetPxX}
            onChange={(event) => setSpriteOffsetPxX(+event.target.value || 0)}
            size="small"
            margin="dense"
          />
          <TextField
            label="Offset Y (px)"
            type="number"
            fullWidth
            value={spriteOffsetPxY}
            onChange={(event) => setSpriteOffsetPxY(+event.target.value || 0)}
            size="small"
            margin="dense"
          />
          <TextField
            label="Anchor"
            fullWidth
            select
            SelectProps={{ native: true }}
            value={spriteAnchor}
            onChange={(event) =>
              setSpriteAnchor(event.target.value as "center" | "bottom")
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
                      onChange={(event) =>
                        updateDirectionFrame(
                          direction,
                          frameIndex,
                          event.target.value,
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
                          onChange={(event) => {
                            void handleImageUpload(
                              key,
                              event.target.files?.[0] ?? null,
                            );
                            event.currentTarget.value = "";
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

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Hidden Segments
          </Typography>

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
                onChange={(event) =>
                  updateHiddenSegment(
                    index,
                    "startSegmentIndex",
                    Math.max(0, +event.target.value || 0),
                  )
                }
              />
              <TextField
                label="End Segment"
                type="number"
                size="small"
                value={item.endSegmentIndex}
                onChange={(event) =>
                  updateHiddenSegment(
                    index,
                    "endSegmentIndex",
                    Math.max(0, +event.target.value || 0),
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
                onChange={(event) =>
                  updateVertexPause(
                    index,
                    "vertexIndex",
                    Math.max(0, +event.target.value || 0),
                  )
                }
              />
              <TextField
                label="Duration (ms)"
                type="number"
                size="small"
                value={item.durationMs}
                onChange={(event) =>
                  updateVertexPause(
                    index,
                    "durationMs",
                    Math.max(0, +event.target.value || 0),
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

      {uploadError && (
        <Typography color="error" sx={{ mt: 1 }}>
          {uploadError}
        </Typography>
      )}

      <Box sx={{ textAlign: "right", mt: 2 }}>
        <Button onClick={props.onClose} sx={{ mr: 1 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={props.mode === "create" ? startCreate : applyEdits}
        >
          {props.mode === "create" ? "Start Drawing" : "Save"}
        </Button>
      </Box>
    </Box>
  );
}
