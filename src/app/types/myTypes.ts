export interface SpatialReference {
  wkid: number;
  latestWkid: number;
}

export interface FieldInfo {
  fieldName: string;
  label: string;
  visible: boolean;
  format?: {
    digitSeparator?: boolean;
    places?: number;
  };
}

export interface FeatureLayerConfig {
  url: string;
  index: number;
  outFields: string[];
  popupEnabled: boolean;
  popupTemplate?: {
    title: string;
    content: Array<{
      type: string;
      fieldInfos?: FieldInfo[];
    }>;
  };
}

export interface HiddenSegmentRange {
  startSegmentIndex: number;
  endSegmentIndex: number;
}

export interface VertexPause {
  vertexIndex: number;
  durationMs: number;
}

export interface DirectionalSpriteFrames {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
}

export interface PolylineAnimation {
  enabled: boolean;
  motion: {
    durationMs: number;
    loop: boolean;
    reverse: boolean;
    autoPlay: boolean;
    startProgress: number; // 0..1
  };
  sprite: {
    frameMs: number;
    scale: number;
    offsetPxX: number;
    offsetPxY: number;
    anchor: "center" | "bottom";
    directionalFrames: DirectionalSpriteFrames;
  };
  behavior: {
    hiddenSegments: HiddenSegmentRange[];
    vertexPauses: VertexPause[];
  };
}

export interface PolygonDrawing {
  attributes: Record<string, any>;
  geometry: {
    type: "polygon";
    rings: number[][][];
    spatialReference: SpatialReference;
  };
  symbol: {
    type: "simple-fill";
    color: number[];
    outline: { color: number[]; width: number };
  };
}

export interface PolylineDrawing {
  attributes: Record<string, any> & {
    animation?: PolylineAnimation | null;
  };
  geometry: {
    type: "polyline";
    paths: number[][][];
    spatialReference: SpatialReference;
  };
  symbol: {
    type: "simple-line";
    color: number[];
    width: number;
  };
}

export interface PointDrawing {
  attributes: Record<string, any>;
  geometry: {
    type: "point";
    x: number;
    y: number;
    spatialReference: SpatialReference;
  };
  symbol: {
    type: "simple-marker";
    color: number[];
    size: number;
    outline: { color: number[]; width: number };
  };
}

export type DrawingExport = PolygonDrawing | PolylineDrawing | PointDrawing;

export interface Label {
  attributes: {
    parentId: string;
    showAtZoom: number | null;
    hideAtZoom: number | null;
    fontSize: number;
    color: number[];
    haloColor: number[];
    haloSize: number;
    text: string;
  };
  geometry: {
    type: string;
    x: number;
    y: number;
    spatialReference: SpatialReference;
  };
}

export interface EventPoint {
  attributes: {
    id: string;
    event_name: string;
    description?: string | null;
    date?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    poster_url?: string | null;
    locationTag?: string | null;
    fullLocationTag?: string | null;
    location?: string | null;
    location_at?: string | null;
    names?: string[] | null;
    original?: any | null;
    fromUser?: boolean;

    iconSize?: number | null;
    iconUrl?: string | null;
  };
  geometry: {
    type: "point";
    x: number;
    y: number;
    spatialReference: SpatialReference;
  };
}

export interface ExportBodySettingsForRef {
  zoom: number;
  center: { spatialReference: SpatialReference; x: number; y: number };
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
}

export interface SaveSettings {
  zoom: number;
  center: [number, number];
  constraints: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  } | null;
  featureLayers: FeatureLayerConfig[] | null;
  mapTile?: string | null;
  baseMap?: string | null;
  apiSources?: string[];
}

export interface ExportBody {
  userEmail: string;
  polygons: DrawingExport[];
  labels: Label[];
  settings: ExportBodySettingsForRef;
}

export interface MapSaveBody {
  userEmail: string;
  polygons: DrawingExport[];
  labels: Label[];
  events: EventPoint[];
  settings: SaveSettings;
}

export function cloneJsonValue<T>(value: T): T {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

export function createEmptyDirectionalFrames(): DirectionalSpriteFrames {
  return {
    // up: [],
    // down: [],
    // left: [],
    // right: [],
    up: [
      "/sprites/bobcat/up/up-1.png",
      "/sprites/bobcat/up/up-2.png",
      "/sprites/bobcat/up/up-3.png",
      "/sprites/bobcat/up/up-4.png",
    ],
    down: [
      "/sprites/bobcat/down/down-1.png",
      "/sprites/bobcat/down/down-2.png",
      "/sprites/bobcat/down/down-3.png",
      "/sprites/bobcat/down/down-4.png",
    ],
    left: [
      "/sprites/bobcat/left/left-1.png",
      "/sprites/bobcat/left/left-2.png",
      "/sprites/bobcat/left/left-3.png",
      "/sprites/bobcat/left/left-4.png",
    ],
    right: [
      "/sprites/bobcat/right/right-1.png",
      "/sprites/bobcat/right/right-2.png",
      "/sprites/bobcat/right/right-3.png",
      "/sprites/bobcat/right/right-4.png",
    ],
  };
}

export function createDefaultPolylineAnimation(): PolylineAnimation {
  return {
    enabled: false,
    motion: {
      durationMs: 20000,
      loop: true,
      reverse: false,
      autoPlay: true,
      startProgress: 0,
    },
    sprite: {
      frameMs: 120,
      scale: 1,
      offsetPxX: 0,
      offsetPxY: 0,
      anchor: "bottom",
      directionalFrames: createEmptyDirectionalFrames(),
    },
    behavior: {
      hiddenSegments: [],
      vertexPauses: [],
    },
  };
}

function normalizeFrameList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 4);
}

function normalizeHiddenSegments(value: unknown): HiddenSegmentRange[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => typeof item === "object" && item !== null)
    .map((item: any) => ({
      startSegmentIndex:
        Number.isInteger(item.startSegmentIndex) && item.startSegmentIndex >= 0
          ? item.startSegmentIndex
          : 0,
      endSegmentIndex:
        Number.isInteger(item.endSegmentIndex) && item.endSegmentIndex >= 0
          ? item.endSegmentIndex
          : 0,
    }))
    .filter((item) => item.endSegmentIndex >= item.startSegmentIndex);
}

function normalizeVertexPauses(value: unknown): VertexPause[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => typeof item === "object" && item !== null)
    .map((item: any) => ({
      vertexIndex:
        Number.isInteger(item.vertexIndex) && item.vertexIndex >= 0
          ? item.vertexIndex
          : 0,
      durationMs:
        typeof item.durationMs === "number" && Number.isFinite(item.durationMs)
          ? Math.max(0, item.durationMs)
          : 0,
    }));
}

export function normalizePolylineAnimation(value: unknown): PolylineAnimation {
  const defaults = createDefaultPolylineAnimation();

  if (!value || typeof value !== "object") {
    return defaults;
  }

  const src = value as any;

  return {
    enabled: typeof src.enabled === "boolean" ? src.enabled : defaults.enabled,

    motion: {
      durationMs:
        typeof src.motion?.durationMs === "number" &&
        Number.isFinite(src.motion.durationMs)
          ? Math.max(0, src.motion.durationMs)
          : defaults.motion.durationMs,
      loop:
        typeof src.motion?.loop === "boolean"
          ? src.motion.loop
          : defaults.motion.loop,
      reverse:
        typeof src.motion?.reverse === "boolean"
          ? src.motion.reverse
          : defaults.motion.reverse,
      autoPlay:
        typeof src.motion?.autoPlay === "boolean"
          ? src.motion.autoPlay
          : defaults.motion.autoPlay,
      startProgress:
        typeof src.motion?.startProgress === "number" &&
        Number.isFinite(src.motion.startProgress)
          ? Math.min(1, Math.max(0, src.motion.startProgress))
          : defaults.motion.startProgress,
    },

    sprite: {
      frameMs:
        typeof src.sprite?.frameMs === "number" &&
        Number.isFinite(src.sprite.frameMs)
          ? Math.max(0, src.sprite.frameMs)
          : defaults.sprite.frameMs,
      scale:
        typeof src.sprite?.scale === "number" &&
        Number.isFinite(src.sprite.scale)
          ? Math.max(0.0001, src.sprite.scale)
          : defaults.sprite.scale,
      offsetPxX:
        typeof src.sprite?.offsetPxX === "number" &&
        Number.isFinite(src.sprite.offsetPxX)
          ? src.sprite.offsetPxX
          : defaults.sprite.offsetPxX,
      offsetPxY:
        typeof src.sprite?.offsetPxY === "number" &&
        Number.isFinite(src.sprite.offsetPxY)
          ? src.sprite.offsetPxY
          : defaults.sprite.offsetPxY,
      anchor:
        src.sprite?.anchor === "center" || src.sprite?.anchor === "bottom"
          ? src.sprite.anchor
          : defaults.sprite.anchor,
      directionalFrames: {
        up: normalizeFrameList(src.sprite?.directionalFrames?.up),
        down: normalizeFrameList(src.sprite?.directionalFrames?.down),
        left: normalizeFrameList(src.sprite?.directionalFrames?.left),
        right: normalizeFrameList(src.sprite?.directionalFrames?.right),
      },
    },

    behavior: {
      hiddenSegments: normalizeHiddenSegments(src.behavior?.hiddenSegments),
      vertexPauses: normalizeVertexPauses(src.behavior?.vertexPauses),
    },
  };
}
