type SpatialReferenceLike = {
  wkid?: number;
  latestWkid?: number;
};

type SavedDrawing = {
  attributes?: Record<string, any>;
  geometry?: any;
  symbol?: any;
};

type SavedLabel = {
  attributes?: Record<string, any>;
  geometry?: any;
};

type SavedEvent = {
  attributes?: Record<string, any>;
  geometry?: any;
};

type Feature = {
  type: "Feature";
  geometry: any;
  properties: Record<string, any>;
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: Feature[];
};

type LiteMapDoc = {
  _id?: any;
  title?: string | null;
  url?: string | null;
  description?: string | null;
  polygons?: SavedDrawing[];
  labels?: SavedLabel[];
  events?: SavedEvent[];
  settings?: {
    zoom?: number;
    center?: [number, number];
    constraints?: any;
    featureLayers?: any[] | null;
    mapTile?: string | null;
    baseMap?: string | null;
    apiSources?: string[];
  } | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  isPrivate?: boolean;
};

const DEFAULT_CENTER: [number, number] = [-120.422045, 37.368169];
const DEFAULT_ZOOM = 15;
const DEFAULT_TILE_URL =
  "https://tiles.flavioherrera.com/v12/{level}/{col}/{row}.png";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isLonLat(x: number, y: number): boolean {
  return Math.abs(x) <= 180 && Math.abs(y) <= 90;
}

function toDateString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function webMercatorToLonLat(x: number, y: number): [number, number] {
  if (isLonLat(x, y)) return [x, y];

  const radius = 6378137;
  const lon = (x / radius) * (180 / Math.PI);
  const latRadians = 2 * Math.atan(Math.exp(y / radius)) - Math.PI / 2;
  const lat = latRadians * (180 / Math.PI);

  return [lon, lat];
}

function pointToLonLat(
  point: [number, number],
  spatialReference?: SpatialReferenceLike,
): [number, number] {
  const [x, y] = point;
  const wkid = spatialReference?.latestWkid ?? spatialReference?.wkid;

  if (wkid === 4326 || isLonLat(x, y)) return [x, y];
  return webMercatorToLonLat(x, y);
}

function rgbaParts(value: any, fallback: number[]): number[] {
  const source = Array.isArray(value) ? value : fallback;
  const r = Number(source[0]);
  const g = Number(source[1]);
  const b = Number(source[2]);
  const a = Number(source[3]);

  return [
    Number.isFinite(r) ? Math.max(0, Math.min(255, r)) : fallback[0],
    Number.isFinite(g) ? Math.max(0, Math.min(255, g)) : fallback[1],
    Number.isFinite(b) ? Math.max(0, Math.min(255, b)) : fallback[2],
    Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : fallback[3] ?? 1,
  ];
}

function rgbString(parts: number[]): string {
  return `rgb(${Math.round(parts[0])}, ${Math.round(parts[1])}, ${Math.round(
    parts[2],
  )})`;
}

function alpha(parts: number[], fallback = 1): number {
  return isFiniteNumber(parts[3]) ? parts[3] : fallback;
}

function stableId(prefix: string, value: any, index: number): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return `${prefix}-${index}`;
}

function closeRing(ring: number[][]): number[][] {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];

  if (first?.[0] === last?.[0] && first?.[1] === last?.[1]) return ring;
  return [...ring, first];
}

function drawingToFeature(drawing: SavedDrawing, index: number): Feature | null {
  const geometry = drawing.geometry;
  const attributes = drawing.attributes ?? {};
  const symbol = drawing.symbol ?? {};
  const spatialReference = geometry?.spatialReference;
  const id = stableId("drawing", attributes.id, index);
  const name = attributes.name ?? attributes.title ?? "";

  if (geometry?.type === "polygon" && Array.isArray(geometry.rings)) {
    const fill = rgbaParts(symbol.color, [76, 201, 240, 0.35]);
    const stroke = rgbaParts(symbol.outline?.color, [42, 42, 42, 1]);
    const coordinates = geometry.rings
      .filter((ring: any) => Array.isArray(ring) && ring.length >= 3)
      .map((ring: number[][]) =>
        closeRing(ring).map((point) =>
          pointToLonLat(point as [number, number], spatialReference),
        ),
      );

    if (!coordinates.length) return null;

    return {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates,
      },
      properties: {
        id,
        kind: "polygon",
        name,
        description: attributes.description ?? "",
        fillColor: rgbString(fill),
        fillOpacity: alpha(fill, 0.35),
        strokeColor: rgbString(stroke),
        strokeOpacity: alpha(stroke, 1),
        strokeWidth: isFiniteNumber(symbol.outline?.width)
          ? symbol.outline.width
          : 1,
      },
    };
  }

  if (geometry?.type === "polyline" && Array.isArray(geometry.paths)) {
    const line = rgbaParts(symbol.color, [37, 99, 235, 1]);
    const paths = geometry.paths
      .filter((path: any) => Array.isArray(path) && path.length >= 2)
      .map((path: number[][]) =>
        path.map((point) =>
          pointToLonLat(point as [number, number], spatialReference),
        ),
      );

    if (!paths.length) return null;

    return {
      type: "Feature",
      geometry:
        paths.length === 1
          ? {
              type: "LineString",
              coordinates: paths[0],
            }
          : {
              type: "MultiLineString",
              coordinates: paths,
            },
      properties: {
        id,
        kind: "polyline",
        name,
        description: attributes.description ?? "",
        animation: attributes.animation ?? null,
        lineColor: rgbString(line),
        lineOpacity: alpha(line, 1),
        lineWidth: isFiniteNumber(symbol.width) ? symbol.width : 3,
      },
    };
  }

  if (
    geometry?.type === "point" &&
    isFiniteNumber(geometry.x) &&
    isFiniteNumber(geometry.y)
  ) {
    const pointColor = rgbaParts(symbol.color, [239, 68, 68, 1]);
    const outlineColor = rgbaParts(symbol.outline?.color, [255, 255, 255, 1]);

    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: pointToLonLat([geometry.x, geometry.y], spatialReference),
      },
      properties: {
        id,
        kind: "point",
        name,
        description: attributes.description ?? "",
        pointColor: rgbString(pointColor),
        pointOpacity: alpha(pointColor, 1),
        pointRadius: isFiniteNumber(symbol.size)
          ? Math.max(3, symbol.size / 2)
          : 6,
        strokeColor: rgbString(outlineColor),
        strokeWidth: isFiniteNumber(symbol.outline?.width)
          ? symbol.outline.width
          : 1,
      },
    };
  }

  return null;
}

function labelToFeature(label: SavedLabel, index: number): Feature | null {
  const geometry = label.geometry;
  const attributes = label.attributes ?? {};

  if (!isFiniteNumber(geometry?.x) || !isFiniteNumber(geometry?.y)) return null;

  const textColor = rgbaParts(attributes.color, [17, 24, 39, 1]);
  const haloColor = rgbaParts(attributes.haloColor, [255, 255, 255, 1]);

  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: pointToLonLat(
        [geometry.x, geometry.y],
        geometry.spatialReference,
      ),
    },
    properties: {
      id: stableId("label", attributes.parentId, index),
      kind: "label",
      parentId: attributes.parentId ?? null,
      text: attributes.text ?? "",
      fontSize: isFiniteNumber(attributes.fontSize) ? attributes.fontSize : 12,
      textColor: rgbString(textColor),
      haloColor: rgbString(haloColor),
      haloWidth: isFiniteNumber(attributes.haloSize)
        ? attributes.haloSize
        : 1.5,
      showAtZoom: attributes.showAtZoom ?? null,
      hideAtZoom: attributes.hideAtZoom ?? null,
    },
  };
}

function eventToFeature(event: SavedEvent, index: number): Feature | null {
  const geometry = event.geometry;
  const attributes = event.attributes ?? {};

  if (
    geometry?.type !== "point" ||
    !isFiniteNumber(geometry.x) ||
    !isFiniteNumber(geometry.y)
  ) {
    return null;
  }

  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: pointToLonLat(
        [geometry.x, geometry.y],
        geometry.spatialReference,
      ),
    },
    properties: {
      id: stableId("event", attributes.id, index),
      kind: "event",
      name: attributes.event_name ?? attributes.name ?? "Event",
      event_name: attributes.event_name ?? attributes.name ?? "Event",
      description: attributes.description ?? "",
      date: attributes.date ?? null,
      startAt: attributes.startAt ?? null,
      endAt: attributes.endAt ?? null,
      location: attributes.location ?? attributes.location_at ?? null,
      locationTag: attributes.locationTag ?? null,
      fullLocationTag: attributes.fullLocationTag ?? null,
      poster_url: attributes.poster_url ?? null,
      names: Array.isArray(attributes.names)
        ? attributes.names.join(", ")
        : attributes.names ?? null,
      pointColor: "rgb(220, 38, 38)",
      pointOpacity: 1,
      pointRadius: isFiniteNumber(attributes.iconSize)
        ? Math.max(5, attributes.iconSize / 4)
        : 7,
      strokeColor: "rgb(255, 255, 255)",
      strokeWidth: 2,
    },
  };
}

function collection(features: Feature[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features,
  };
}

function normalizeCenter(settings?: LiteMapDoc["settings"]): [number, number] {
  const center = settings?.center;
  if (
    Array.isArray(center) &&
    isFiniteNumber(center[0]) &&
    isFiniteNumber(center[1])
  ) {
    return pointToLonLat(center, undefined);
  }

  return DEFAULT_CENTER;
}

export function createLiteMapPayload(map: LiteMapDoc) {
  const drawingFeatures = (map.polygons ?? [])
    .map(drawingToFeature)
    .filter((feature): feature is Feature => feature !== null);
  const labelFeatures = (map.labels ?? [])
    .map(labelToFeature)
    .filter((feature): feature is Feature => feature !== null);
  const eventFeatures = (map.events ?? [])
    .map(eventToFeature)
    .filter((feature): feature is Feature => feature !== null);

  return {
    schemaVersion: 1,
    id: String(map._id ?? ""),
    title: map.title ?? "Campus Map",
    url: map.url ?? null,
    description: map.description ?? null,
    isPrivate: Boolean(map.isPrivate),
    createdAt: toDateString(map.createdAt),
    updatedAt: toDateString(map.updatedAt),
    settings: {
      center: normalizeCenter(map.settings),
      zoom: isFiniteNumber(map.settings?.zoom)
        ? map.settings.zoom
        : DEFAULT_ZOOM,
      mapTile: map.settings?.mapTile ?? DEFAULT_TILE_URL,
      baseMap: map.settings?.baseMap ?? null,
      apiSources: Array.isArray(map.settings?.apiSources)
        ? map.settings?.apiSources
        : [],
    },
    counts: {
      drawings: drawingFeatures.length,
      labels: labelFeatures.length,
      events: eventFeatures.length,
      total:
        drawingFeatures.length + labelFeatures.length + eventFeatures.length,
    },
    drawings: collection(drawingFeatures),
    labels: collection(labelFeatures),
    events: collection(eventFeatures),
    all: collection([...drawingFeatures, ...eventFeatures, ...labelFeatures]),
  };
}
