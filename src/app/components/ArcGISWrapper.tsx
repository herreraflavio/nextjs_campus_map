//ArcGISWrapper.tsx
"use client";

import ArcGISMap from "./ArcGISMap";
import { useMapId } from "@/app/context/MapContext";
import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { settingsEvents, settingsRef } from "../components/map/arcgisRefs";
import {
  isCategoryAdminVisibleInList,
  normalizeCategories,
  resetCategories,
  setCategories,
} from "./map/categories/categoryStore";
import { resetMapVisibility } from "./map/categories/categoryVisibility";
import {
  MAP_TOP_BAR_LOADED,
  normalizeMapTopBar,
  type MapTopBarSettings,
} from "@/app/types/mapTopBar";
import type {
  DrawingExport,
  EventPoint,
  FeatureLayerConfig,
  Label,
  MapCategory,
} from "@/app/types/myTypes";
import { normalizePolylineAnimation } from "@/app/types/myTypes";
import { createMapLoadTrace, type MapLoadTrace } from "./map/mapLoadTrace";
import { beginMapHydration } from "./map/mapHydration";

/* ─────────────────────────────────────────
 * Types
 * ───────────────────────────────────── */

interface LooseSpatialReference {
  wkid: number;
  latestWkid?: number;
}

type LooseDrawing = {
  attributes: Record<string, any>;
  geometry:
    | {
        type: "polygon";
        rings: number[][][];
        spatialReference: LooseSpatialReference;
      }
    | {
        type: "polyline";
        paths: number[][][];
        spatialReference: LooseSpatialReference;
      }
    | {
        type: "point";
        x: number;
        y: number;
        spatialReference: LooseSpatialReference;
      };
  symbol:
    | {
        type: "simple-fill";
        color: number[];
        outline: { color: number[]; width: number };
      }
    | {
        type: "simple-line";
        color: number[];
        width: number;
      }
    | {
        type: "simple-marker";
        color: number[];
        size: number;
        outline: { color: number[]; width: number };
      };
};

type ArcGISMapPayload = {
  polygons: DrawingExport[];
  labels: Label[];
  events: EventPoint[];
  categories: MapCategory[];
  eventSources: string[];
  settings: {
    topBar?: MapTopBarSettings;
    zoom: number;
    center: [number, number];
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

type RawArcGISMapPayload = Partial<ArcGISMapPayload> & {
  eventSources?: string[];
};

type ArcGISWrapperProps = {
  includeAdminHiddenCategories?: boolean;
};

/* ─────────────────────────────────────────
 * Defaults
 * ───────────────────────────────────── */

const DEFAULT_CENTER: ArcGISMapPayload["settings"]["center"] = [
  -120.422045, 37.368169,
];
const DEFAULT_ZOOM = 15;
const NO_CONSTRAINTS: ArcGISMapPayload["settings"]["constraints"] = null;
const DEFAULT_TILELAYER =
  "https://tiles.flavioherrera.com/v12/{level}/{col}/{row}.png";
const DEFAULT_BASEMAP = "arcgis/nova";
const DEFAULT_APISOURCES: string[] = [];
const MAP_DATA_FETCH_RETRY_DELAYS_MS = [300, 900, 1800];
const RETRYABLE_HTTP_STATUS_CODES = new Set([
  408, 425, 429, 500, 502, 503, 504,
]);

const DEFAULT_EVENT_SOURCES: string[] = [
  //"https://uc-merced-campus-event-api-backend.onrender.com/get/events",
  //"https://api.ucmercedhub.com/crimelogs",
  //"https://uc-merced-campus-event-api-backend.onrender.com/presence_events",
  //"http://127.0.0.1:8050/presence_events",
];

/* ─────────────────────────────────────────
 * Guards / normalizers
 * ───────────────────────────────────── */

function isSpatialReference(value: any): value is LooseSpatialReference {
  if (!value || typeof value !== "object" || typeof value.wkid !== "number") {
    return false;
  }

  if (typeof value.latestWkid !== "number") {
    console.warn(
      `[SpatialReference Warning] Missing or invalid 'latestWkid' for wkid: ${value.wkid}. Accepting geometry anyway.`,
      value,
    );
  }

  return true;
}

function isPolygonDrawing(value: any): boolean {
  return (
    value &&
    typeof value === "object" &&
    value.geometry?.type === "polygon" &&
    Array.isArray(value.geometry?.rings) &&
    isSpatialReference(value.geometry?.spatialReference) &&
    typeof value.symbol === "object" &&
    value.symbol?.type === "simple-fill"
  );
}

function isPolylineDrawing(value: any): boolean {
  return (
    value &&
    typeof value === "object" &&
    value.geometry?.type === "polyline" &&
    Array.isArray(value.geometry?.paths) &&
    isSpatialReference(value.geometry?.spatialReference) &&
    typeof value.symbol === "object" &&
    value.symbol?.type === "simple-line"
  );
}

function isPointDrawing(value: any): boolean {
  return (
    value &&
    typeof value === "object" &&
    value.geometry?.type === "point" &&
    typeof value.geometry?.x === "number" &&
    typeof value.geometry?.y === "number" &&
    isSpatialReference(value.geometry?.spatialReference) &&
    typeof value.symbol === "object" &&
    value.symbol?.type === "simple-marker" &&
    Array.isArray(value.symbol?.color) &&
    typeof value.symbol?.size === "number" &&
    value.symbol?.outline &&
    Array.isArray(value.symbol?.outline?.color) &&
    typeof value.symbol?.outline?.width === "number"
  );
}

function normalizeDrawing(value: any): DrawingExport | null {
  if (isPolygonDrawing(value)) {
    return value as DrawingExport;
  }

  if (isPointDrawing(value)) {
    return value as DrawingExport;
  }

  if (isPolylineDrawing(value)) {
    const normalized: LooseDrawing = {
      ...value,
      attributes: {
        ...value.attributes,
      },
    };

    if (normalized.attributes?.animation != null) {
      normalized.attributes.animation = normalizePolylineAnimation(
        normalized.attributes.animation,
      );
    }

    return normalized as DrawingExport;
  }

  return null;
}

function isLabel(value: any): value is Label {
  return (
    value &&
    typeof value === "object" &&
    value.attributes &&
    typeof value.attributes.parentId === "string" &&
    value.geometry &&
    typeof value.geometry.x === "number" &&
    typeof value.geometry.y === "number" &&
    isSpatialReference(value.geometry.spatialReference)
  );
}

function isEventPoint(value: any): value is EventPoint {
  return (
    value &&
    typeof value === "object" &&
    value.attributes &&
    typeof value.attributes.id === "string" &&
    typeof value.attributes.event_name === "string" &&
    value.geometry?.type === "point" &&
    typeof value.geometry?.x === "number" &&
    typeof value.geometry?.y === "number" &&
    isSpatialReference(value.geometry?.spatialReference)
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorStatus(error: unknown): number | null {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : null;
}

function shouldRetryInitialLoad(error: unknown): boolean {
  if ((error as { name?: string })?.name === "AbortError") return false;

  const status = errorStatus(error);
  if (status == null) return true;
  return RETRYABLE_HTTP_STATUS_CODES.has(status);
}

async function responseError(response: Response): Promise<Error> {
  let detail = response.statusText;

  try {
    const body = await response.clone().json();
    if (typeof body?.error === "string" && body.error.trim()) {
      detail = body.error.trim();
    }
  } catch {
    try {
      const text = await response.clone().text();
      if (text.trim()) detail = text.trim();
    } catch {
      // Keep the HTTP status if the error body cannot be read.
    }
  }

  const error = new Error(
    detail ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status}`,
  );
  (error as Error & { status?: number }).status = response.status;
  return error;
}

async function fetchJsonWithRetry<T>(
  url: string,
  init: RequestInit,
  retryDelaysMs = MAP_DATA_FETCH_RETRY_DELAYS_MS,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (!response.ok) throw await responseError(response);
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      const retryDelay = retryDelaysMs[attempt];

      if (retryDelay == null || !shouldRetryInitialLoad(error)) {
        throw error;
      }

      console.warn(
        `Initial map data load failed; retrying in ${retryDelay}ms.`,
        error,
      );
      await delay(retryDelay);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Map data load failed");
}

function drawingId(drawing: DrawingExport): string | null {
  const id = drawing.attributes?.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function filterAdminVisibleMapData(
  polygons: DrawingExport[],
  labels: Label[],
  categories: MapCategory[],
): {
  polygons: DrawingExport[];
  labels: Label[];
  categories: MapCategory[];
} {
  const visiblePolygons = polygons.filter((drawing) =>
    isCategoryAdminVisibleInList(
      categories,
      drawing.attributes?.categoryId ?? null,
    ),
  );
  const visibleIds = new Set(
    visiblePolygons
      .map((drawing) => drawingId(drawing))
      .filter((id): id is string => id !== null),
  );

  return {
    polygons: visiblePolygons,
    labels: labels.filter((label) => visibleIds.has(label.attributes.parentId)),
    categories: categories.filter((category) =>
      isCategoryAdminVisibleInList(categories, category.id),
    ),
  };
}

/* ─────────────────────────────────────────
 * Component
 * ───────────────────────────────────── */

export default function ArcGISWrapper({
  includeAdminHiddenCategories = false,
}: ArcGISWrapperProps) {
  const mapId = useMapId();
  // Scope results to the request so a map switch cannot briefly expose old data.
  const requestKey = `${mapId}:${includeAdminHiddenCategories}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    data: ArcGISMapPayload;
    trace: MapLoadTrace;
    hydration: ReturnType<typeof beginMapHydration>;
  } | null>(null);
  const [readyData, setReadyData] = useState<ArcGISMapPayload | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const mapData = loaded?.key === requestKey ? loaded.data : null;
  const trace = loaded?.key === requestKey ? loaded.trace : null;
  const error = failure?.key === requestKey ? failure.message : null;
  const loading = Boolean(mapId) && !error && (!mapData || readyData !== mapData);
  const onInitialReady = useCallback(() => setReadyData(mapData), [mapData]);
  const onSavedDataReady = useCallback(() => {
    if (loaded?.key === requestKey) loaded.hydration.complete();
  }, [loaded, requestKey]);
  const onInitialError = useCallback(
    (cause: unknown) => {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (loaded?.key === requestKey) loaded.hydration.cancel();
      setFailure({ key: requestKey, message: `Failed to initialize map: ${message}` });
    },
    [loaded, requestKey],
  );
  // Record the DOM commit before child effects start SDK work.
  useLayoutEffect(() => {
    if (mapData) {
      trace?.mark("config-hydrated");
      trace?.mark("sidebar-ready");
    }
    if (mapData && readyData === mapData) trace?.mark("map-visible");
  }, [mapData, readyData, trace]);

  useEffect(() => {
    if (!mapId) {
      setLoaded(null);
      setFailure(null);
      setReadyData(null);
      resetCategories();
      resetMapVisibility();
      return;
    }

    setLoaded(null);
    setFailure(null);
    setReadyData(null);

    const controller = new AbortController();
    const hydration = beginMapHydration(mapId);
    const loadTrace = createMapLoadTrace(mapId);
    loadTrace.mark("config-request");
    let cancelled = false;

    fetchJsonWithRetry<RawArcGISMapPayload>(`/api/maps/${mapId}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((data) => {
        if (cancelled) return;
        loadTrace.mark("config-loaded");

        const polygons = Array.isArray(data.polygons)
          ? data.polygons
              .map((item) => {
                const normalized = normalizeDrawing(item);
                if (!normalized) {
                  console.warn(
                    "Discarded drawing item (failed type guard):",
                    item,
                  );
                }
                return normalized;
              })
              .filter((item): item is DrawingExport => item !== null)
          : [];

        const labels = Array.isArray(data.labels)
          ? data.labels.filter(isLabel)
          : [];

        const events = Array.isArray((data as any).events)
          ? ((data as any).events as any[]).filter(isEventPoint)
          : [];

        const categories = normalizeCategories((data as any).categories);
        setCategories(categories);
        resetMapVisibility();

        const eventSources =
          Array.isArray((data as any)?.settings?.apiSources) &&
          (data as any).settings.apiSources.length > 0 &&
          (data as any).settings.apiSources.every(
            (u: any) => typeof u === "string",
          )
            ? ((data as any).settings.apiSources as string[])
            : DEFAULT_EVENT_SOURCES;

        const rawS: Partial<ArcGISMapPayload["settings"]> = data.settings ?? {};

        const center =
          Array.isArray(rawS.center) &&
          rawS.center.length === 2 &&
          typeof rawS.center[0] === "number" &&
          typeof rawS.center[1] === "number"
            ? (rawS.center as [number, number])
            : DEFAULT_CENTER;

        const zoom =
          typeof rawS.zoom === "number" && rawS.zoom >= 1 && rawS.zoom <= 23
            ? rawS.zoom
            : DEFAULT_ZOOM;

        const constraints =
          rawS.constraints &&
          typeof rawS.constraints === "object" &&
          typeof rawS.constraints.xmin === "number" &&
          typeof rawS.constraints.ymin === "number" &&
          typeof rawS.constraints.xmax === "number" &&
          typeof rawS.constraints.ymax === "number"
            ? rawS.constraints
            : NO_CONSTRAINTS;

        const mapTile =
          typeof rawS.mapTile === "string" && rawS.mapTile.trim().length > 0
            ? rawS.mapTile
            : DEFAULT_TILELAYER;

        const baseMap =
          typeof rawS.baseMap === "string" && rawS.baseMap.trim().length > 0
            ? rawS.baseMap
            : DEFAULT_BASEMAP;

        const rawApiSources = Array.isArray(rawS.apiSources)
          ? rawS.apiSources
              .filter((v): v is string => typeof v === "string")
              .map((s) => s.trim())
              .filter((s) => s.length > 0 && isHttpUrl(s))
          : DEFAULT_APISOURCES;

        const apiSources =
          rawApiSources.length > 0 ? rawApiSources : DEFAULT_APISOURCES;

        const settings: ArcGISMapPayload["settings"] = {
          topBar: normalizeMapTopBar(rawS.topBar),
          zoom,
          center,
          constraints,
          featureLayers: rawS.featureLayers ?? null,
          mapTile,
          baseMap,
          apiSources,
        };

        try {
          settingsRef.current.center = {
            spatialReference: { wkid: 4326, latestWkid: 4326 },
            x: settings.center[0],
            y: settings.center[1],
          };
          settingsRef.current.zoom = settings.zoom;
          settingsRef.current.featureLayers = settings.featureLayers ?? null;
          settingsRef.current.constraints = settings.constraints;
          settingsRef.current.mapTile = settings.mapTile;
          settingsRef.current.baseMap = settings.baseMap;
          settingsRef.current.apiSources = settings.apiSources;
          settingsRef.current.topBar = settings.topBar;
        } catch {
          // ignore
        }

        const visibleMapData = includeAdminHiddenCategories
          ? { polygons, labels, categories }
          : filterAdminVisibleMapData(polygons, labels, categories);

        setLoaded({
          key: requestKey,
          trace: loadTrace,
          hydration,
          data: {
            polygons: visibleMapData.polygons,
            labels: visibleMapData.labels,
            events,
            categories: visibleMapData.categories,
            eventSources,
            settings,
          },
        });
        settingsEvents.dispatchEvent(new CustomEvent(MAP_TOP_BAR_LOADED, {
          detail: { mapId, settings: settings.topBar },
        }));
      })
      .catch((err) => {
        if (cancelled || err?.name === "AbortError") return;

        console.error(err);
        hydration.cancel();
        setFailure({
          key: requestKey,
          message: `Failed to load map data: ${err.message}`,
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
      hydration.cancel();
    };
  }, [includeAdminHiddenCategories, mapId, requestKey]);

  return (
    <div
      data-map-loading={loading}
      aria-busy={loading}
      style={{ position: "relative", width: "100%", height: "100%", minWidth: 0 }}
    >
      <div
        data-map-content
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        {mapData && (
          <ArcGISMap
            {...mapData}
            onInitialReady={onInitialReady}
            onInitialError={onInitialError}
            onSavedDataReady={onSavedDataReady}
            loadTrace={trace ?? undefined}
          />
        )}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            position: "absolute",
            inset: 16,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "#ffebee",
            borderRadius: 4,
            zIndex: 3000,
            fontSize: 18,
            color: "#d32f2f",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && !mapId && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9,
            fontSize: 18,
            color: "#666",
          }}
        >
          No map selected
        </div>
      )}
    </div>
  );
}
