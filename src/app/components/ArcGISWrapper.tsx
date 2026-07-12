"use client";

import dynamic from "next/dynamic";
import { useMapId } from "@/app/context/MapContext";
import { useState, useEffect } from "react";
import { settingsRef } from "../components/map/arcgisRefs";
import type {
  DrawingExport,
  EventPoint,
  FeatureLayerConfig,
  Label,
} from "@/app/types/myTypes";
import { normalizePolylineAnimation } from "@/app/types/myTypes";

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
  userEmail: string;
  polygons: DrawingExport[];
  labels: Label[];
  events: EventPoint[];
  eventSources: string[];
  settings: {
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

const DEFAULT_SETTINGS: ArcGISMapPayload["settings"] = {
  zoom: DEFAULT_ZOOM,
  center: DEFAULT_CENTER,
  constraints: NO_CONSTRAINTS,
  featureLayers: null,
  mapTile: DEFAULT_TILELAYER,
  baseMap: DEFAULT_BASEMAP,
  apiSources: DEFAULT_APISOURCES,
};

const DEFAULT_EVENT_SOURCES: string[] = [
  //"https://uc-merced-campus-event-api-backend.onrender.com/get/events",
  //"https://api.ucmercedhub.com/crimelogs",
  //"https://uc-merced-campus-event-api-backend.onrender.com/presence_events",
  //"http://127.0.0.1:8050/presence_events",
];

/* ─────────────────────────────────────────
 * Temporary simulated database polygon payload
 *
 * This array is intentionally JSON-compatible. The objects inside it are the
 * same shape you could store in MongoDB under the normal `polygons` array.
 *
 * Important: ArcGISWrapper.tsx does not create the popup UI. It only simulates
 * a mixed database payload. ArcGISMap.tsx reads these attributes and decides
 * whether to render the old static popup or the advanced structured popup.
 *
 * Set this to false when you want to stop injecting these sample objects.
 * ───────────────────────────────────── */

const ENABLE_SAMPLE_DATABASE_POLYGON_PAYLOAD = true;

const SAMPLE_DATABASE_POLYGON_PAYLOAD: any[] = [
  {
    "attributes": {
      "id": "sample-static-polygon",
      "name": "Sample Static Polygon",
      "description": "This is a normal static polygon popup. It has no popupMode and no advancedPopup object, so ArcGISMap.tsx should use the old static popup behavior."
    },
    "geometry": {
      "type": "polygon",
      "rings": [
        [
          [-120.4261, 37.36895],
          [-120.4256, 37.36895],
          [-120.4256, 37.36845],
          [-120.4261, 37.36845],
          [-120.4261, 37.36895]
        ]
      ],
      "spatialReference": {
        "wkid": 4326,
        "latestWkid": 4326
      }
    },
    "symbol": {
      "type": "simple-fill",
      "color": [120, 120, 120, 0.2],
      "outline": {
        "color": [80, 80, 80, 1],
        "width": 2
      }
    }
  },
  {
    "attributes": {
      "id": "sample-advanced-library-polygon",
      "name": "Sample Advanced Library",
      "description": "Static fallback for the library polygon before the localhost popup API responds.",
      "popupMode": "advanced",
      "location_id": 707001,
      "image_urls": [],
      "label": {
        "name": "Sample Advanced Library",
        "hideBefore": null,
        "hideAfter": null
      },
      "nested_content": [
        {
          "title": "Fallback content stored on polygon JSON",
          "tabs": [
            {
              "title": "Static fallback",
              "sections": [
                {
                  "header": "Before API response",
                  "image_urls": [],
                  "bullets": [
                    "This fallback content is stored directly on the polygon object.",
                    "ArcGISMap.tsx can replace or enrich this content after fetching the local endpoint.",
                    "Endpoint configured for this polygon: http://localhost:7070/api/popup/library"
                  ]
                }
              ]
            }
          ]
        }
      ],
      "advancedPopup": {
        "enabled": true,
        "endpoint": "http://localhost:7070/api/popup/library",
        "method": "POST",
        "triggerOnOpen": true,
        "showFetchButton": true,
        "buttonText": "Refresh library popup",
        "loadingText": "Loading library popup data from localhost:7070...",
        "source": "simulated-database-polygon-json",
        "flags": {
          "sample": true,
          "popupKind": "library",
          "includeImages": true,
          "includeNestedContent": true
        },
        "requestBody": {
          "polygonId": "sample-advanced-library-polygon",
          "locationId": 707001,
          "source": "ArcGISWrapper.tsx simulated database payload"
        },
        "template": {
          "id": "{{api_id}}",
          "description": "{{api_description}}",
          "image_urls": "{{api_image_urls}}",
          "label": "{{api_label}}",
          "location_id": "{{api_location_id}}",
          "nested_content": "{{api_nested_content}}",
          "nested_content_image_urls": "{{api_nested_content_image_urls}}"
        }
      }
    },
    "geometry": {
      "type": "polygon",
      "rings": [
        [
          [-120.425, 37.369],
          [-120.4245, 37.369],
          [-120.4245, 37.3685],
          [-120.425, 37.3685],
          [-120.425, 37.369]
        ]
      ],
      "spatialReference": {
        "wkid": 4326,
        "latestWkid": 4326
      }
    },
    "symbol": {
      "type": "simple-fill",
      "color": [39, 117, 255, 0.22],
      "outline": {
        "color": [39, 117, 255, 1],
        "width": 2
      }
    }
  },
  {
    "attributes": {
      "id": "sample-advanced-dining-polygon",
      "name": "Sample Advanced Dining",
      "description": "Static fallback for the dining polygon before the localhost popup API responds.",
      "popupMode": "advanced",
      "location_id": 707002,
      "image_urls": [],
      "label": {
        "name": "Sample Advanced Dining",
        "hideBefore": null,
        "hideAfter": null
      },
      "nested_content": [
        {
          "title": "Fallback content stored on polygon JSON",
          "tabs": [
            {
              "title": "Static fallback",
              "sections": [
                {
                  "header": "Before API response",
                  "image_urls": [],
                  "bullets": [
                    "This fallback content is stored directly on the polygon object.",
                    "ArcGISMap.tsx can replace or enrich this content after fetching the local endpoint.",
                    "Endpoint configured for this polygon: http://localhost:7070/api/popup/dining"
                  ]
                }
              ]
            }
          ]
        }
      ],
      "advancedPopup": {
        "enabled": true,
        "endpoint": "http://localhost:7070/api/popup/dining",
        "method": "POST",
        "triggerOnOpen": true,
        "showFetchButton": true,
        "buttonText": "Refresh dining popup",
        "loadingText": "Loading dining popup data from localhost:7070...",
        "source": "simulated-database-polygon-json",
        "flags": {
          "sample": true,
          "popupKind": "dining",
          "includeImages": true,
          "includeNestedContent": true
        },
        "requestBody": {
          "polygonId": "sample-advanced-dining-polygon",
          "locationId": 707002,
          "source": "ArcGISWrapper.tsx simulated database payload"
        },
        "template": {
          "id": "{{api_id}}",
          "description": "{{api_description}}",
          "image_urls": "{{api_image_urls}}",
          "label": "{{api_label}}",
          "location_id": "{{api_location_id}}",
          "nested_content": "{{api_nested_content}}",
          "nested_content_image_urls": "{{api_nested_content_image_urls}}"
        }
      }
    },
    "geometry": {
      "type": "polygon",
      "rings": [
        [
          [-120.4215, 37.3685],
          [-120.421, 37.3685],
          [-120.421, 37.368],
          [-120.4215, 37.368],
          [-120.4215, 37.3685]
        ]
      ],
      "spatialReference": {
        "wkid": 4326,
        "latestWkid": 4326
      }
    },
    "symbol": {
      "type": "simple-fill",
      "color": [46, 160, 67, 0.22],
      "outline": {
        "color": [46, 160, 67, 1],
        "width": 2
      }
    }
  },
  {
    "attributes": {
      "id": "sample-advanced-parking-polygon",
      "name": "Sample Advanced Parking",
      "description": "Static fallback for the parking polygon before the localhost popup API responds.",
      "popupMode": "advanced",
      "location_id": 707003,
      "image_urls": [],
      "label": {
        "name": "Sample Advanced Parking",
        "hideBefore": null,
        "hideAfter": null
      },
      "nested_content": [
        {
          "title": "Fallback content stored on polygon JSON",
          "tabs": [
            {
              "title": "Static fallback",
              "sections": [
                {
                  "header": "Before API response",
                  "image_urls": [],
                  "bullets": [
                    "This fallback content is stored directly on the polygon object.",
                    "ArcGISMap.tsx can replace or enrich this content after fetching the local endpoint.",
                    "Endpoint configured for this polygon: http://localhost:7070/api/popup/parking"
                  ]
                }
              ]
            }
          ]
        }
      ],
      "advancedPopup": {
        "enabled": true,
        "endpoint": "http://localhost:7070/api/popup/parking",
        "method": "POST",
        "triggerOnOpen": true,
        "showFetchButton": true,
        "buttonText": "Refresh parking popup",
        "loadingText": "Loading parking popup data from localhost:7070...",
        "source": "simulated-database-polygon-json",
        "flags": {
          "sample": true,
          "popupKind": "parking",
          "includeImages": true,
          "includeNestedContent": true
        },
        "requestBody": {
          "polygonId": "sample-advanced-parking-polygon",
          "locationId": 707003,
          "source": "ArcGISWrapper.tsx simulated database payload"
        },
        "template": {
          "id": "{{api_id}}",
          "description": "{{api_description}}",
          "image_urls": "{{api_image_urls}}",
          "label": "{{api_label}}",
          "location_id": "{{api_location_id}}",
          "nested_content": "{{api_nested_content}}",
          "nested_content_image_urls": "{{api_nested_content_image_urls}}"
        }
      }
    },
    "geometry": {
      "type": "polygon",
      "rings": [
        [
          [-120.4195, 37.3678],
          [-120.419, 37.3678],
          [-120.419, 37.3673],
          [-120.4195, 37.3673],
          [-120.4195, 37.3678]
        ]
      ],
      "spatialReference": {
        "wkid": 4326,
        "latestWkid": 4326
      }
    },
    "symbol": {
      "type": "simple-fill",
      "color": [255, 149, 0, 0.24],
      "outline": {
        "color": [255, 149, 0, 1],
        "width": 2
      }
    }
  }
];

const ArcGISMap = dynamic(() => import("./ArcGISMap"), { ssr: false });

/* ─────────────────────────────────────────
 * Guards / normalizers
 * ───────────────────────────────────── */

function toFiniteNumber(value: any): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function isSpatialReference(value: any): value is LooseSpatialReference {
  if (!value || typeof value !== "object") return false;

  const wkid = toFiniteNumber(value.wkid);
  if (wkid === null) return false;

  if (value.latestWkid != null && toFiniteNumber(value.latestWkid) === null) {
    console.warn(
      `[SpatialReference Warning] Invalid 'latestWkid' for wkid: ${value.wkid}. Accepting geometry anyway.`,
      value,
    );
  }

  if (value.latestWkid == null) {
    console.warn(
      `[SpatialReference Warning] Missing 'latestWkid' for wkid: ${value.wkid}. Accepting geometry anyway.`,
      value,
    );
  }

  return true;
}

function normalizeSpatialReference(value: any): LooseSpatialReference | null {
  if (!isSpatialReference(value)) return null;

  const wkid = toFiniteNumber(value.wkid);
  const latestWkid = toFiniteNumber(value.latestWkid);

  if (wkid === null) return null;

  return {
    wkid,
    ...(latestWkid !== null ? { latestWkid } : {}),
  };
}

function normalizeCoordinatePair(value: any): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;

  const x = toFiniteNumber(value[0]);
  const y = toFiniteNumber(value[1]);

  if (x === null || y === null) return null;

  return [x, y];
}

function normalizeCoordinateGroups(value: any): number[][][] | null {
  if (!Array.isArray(value)) return null;

  const groups = value
    .map((group) => {
      if (!Array.isArray(group)) return null;

      const coords = group
        .map(normalizeCoordinatePair)
        .filter((pair): pair is [number, number] => pair !== null);

      return coords.length > 0 ? coords : null;
    })
    .filter((group): group is [number, number][] => group !== null);

  return groups.length > 0 ? groups : null;
}

function normalizeLooseGeometry(value: any): LooseDrawing["geometry"] | null {
  if (!value || typeof value !== "object") return null;

  const spatialReference = normalizeSpatialReference(value.spatialReference);
  if (!spatialReference) return null;

  if (value.type === "polygon") {
    const rings = normalizeCoordinateGroups(value.rings);
    if (!rings) return null;

    return {
      type: "polygon",
      rings,
      spatialReference,
    };
  }

  if (value.type === "polyline") {
    const paths = normalizeCoordinateGroups(value.paths);
    if (!paths) return null;

    return {
      type: "polyline",
      paths,
      spatialReference,
    };
  }

  if (value.type === "point") {
    const x = toFiniteNumber(value.x);
    const y = toFiniteNumber(value.y);

    if (x === null || y === null) return null;

    return {
      type: "point",
      x,
      y,
      spatialReference,
    };
  }

  return null;
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
  if (!value || typeof value !== "object") return null;

  const geometry = normalizeLooseGeometry(value.geometry);
  if (!geometry) return null;

  const normalized: LooseDrawing = {
    ...value,
    geometry,
    attributes: {
      ...(value.attributes ?? {}),
    },
  };

  if (isPolylineDrawing(normalized)) {
    if (normalized.attributes?.animation != null) {
      normalized.attributes.animation = normalizePolylineAnimation(
        normalized.attributes.animation,
      );
    }

    return normalized as DrawingExport;
  }

  if (isPolygonDrawing(normalized)) {
    return normalized as DrawingExport;
  }

  if (isPointDrawing(normalized)) {
    return normalized as DrawingExport;
  }

  return null;
}

function isLabel(value: any): value is Label {
  const spatialReference = normalizeSpatialReference(
    value?.geometry?.spatialReference,
  );
  const x = toFiniteNumber(value?.geometry?.x);
  const y = toFiniteNumber(value?.geometry?.y);

  return (
    value &&
    typeof value === "object" &&
    value.attributes &&
    typeof value.attributes.parentId === "string" &&
    value.geometry &&
    x !== null &&
    y !== null &&
    spatialReference !== null
  );
}

function normalizeLabel(value: any): Label | null {
  if (!isLabel(value)) return null;

  const spatialReference = normalizeSpatialReference(value.geometry.spatialReference);
  const x = toFiniteNumber(value.geometry.x);
  const y = toFiniteNumber(value.geometry.y);

  if (!spatialReference || x === null || y === null) return null;

  return {
    ...value,
    geometry: {
      ...value.geometry,
      x,
      y,
      spatialReference,
    },
  } as Label;
}

function isEventPoint(value: any): value is EventPoint {
  const spatialReference = normalizeSpatialReference(
    value?.geometry?.spatialReference,
  );
  const x = toFiniteNumber(value?.geometry?.x);
  const y = toFiniteNumber(value?.geometry?.y);

  return (
    value &&
    typeof value === "object" &&
    value.attributes &&
    typeof value.attributes.id === "string" &&
    typeof value.attributes.event_name === "string" &&
    value.geometry?.type === "point" &&
    x !== null &&
    y !== null &&
    spatialReference !== null
  );
}

function normalizeEventPoint(value: any): EventPoint | null {
  if (!isEventPoint(value)) return null;

  const spatialReference = normalizeSpatialReference(value.geometry.spatialReference);
  const x = toFiniteNumber(value.geometry.x);
  const y = toFiniteNumber(value.geometry.y);

  if (!spatialReference || x === null || y === null) return null;

  return {
    ...value,
    geometry: {
      ...value.geometry,
      x,
      y,
      spatialReference,
    },
  } as EventPoint;
}

function isHttpOrLocalApiUrl(value: string): boolean {
  const trimmed = value.trim();

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return true;
  }

  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/* ─────────────────────────────────────────
 * Component
 * ───────────────────────────────────── */

export default function ArcGISWrapper() {
  const mapId = useMapId();
  const [mapData, setMapData] = useState<ArcGISMapPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mapId) {
      setMapData(null);
      setError(null);
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    fetch(`/api/maps/${mapId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json() as Promise<
          Partial<ArcGISMapPayload> & {
            eventSources?: string[];
            userEmail?: string;
          }
        >;
      })
      .then((data) => {
        const userEmail =
          typeof data.userEmail === "string" ? data.userEmail : "";

        const databasePolygonsPayload = [
          ...(Array.isArray(data.polygons) ? data.polygons : []),
          ...(ENABLE_SAMPLE_DATABASE_POLYGON_PAYLOAD
            ? SAMPLE_DATABASE_POLYGON_PAYLOAD
            : []),
        ];

        const polygons = databasePolygonsPayload
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
          .filter((item): item is DrawingExport => item !== null);

        const labels = Array.isArray(data.labels)
          ? data.labels
              .map(normalizeLabel)
              .filter((item): item is Label => item !== null)
          : [];

        const events = Array.isArray((data as any).events)
          ? ((data as any).events as any[])
              .map(normalizeEventPoint)
              .filter((item): item is EventPoint => item !== null)
          : [];

        console.log("Loaded map data:", data);
        console.log(
          "Simulated database polygons payload sent to ArcGISMap.tsx:",
          databasePolygonsPayload,
        );

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
          typeof rawS.zoom === "number" && rawS.zoom >= 1 && rawS.zoom <= 20
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
              .filter((s) => s.length > 0 && isHttpOrLocalApiUrl(s))
          : DEFAULT_APISOURCES;

        const apiSources =
          rawApiSources.length > 0 ? rawApiSources : DEFAULT_APISOURCES;

        const settings: ArcGISMapPayload["settings"] = {
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
        } catch {
          // ignore
        }

        setMapData({
          userEmail,
          polygons,
          labels,
          events,
          eventSources,
          settings,
        });
      })
      .catch((err) => {
        console.error(err);
        setError(`Failed to load map data: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [mapId]);

  const effectiveMapData: ArcGISMapPayload = mapData ?? {
    userEmail: "",
    polygons: [],
    labels: [],
    events: [],
    eventSources: DEFAULT_EVENT_SOURCES,
    settings: DEFAULT_SETTINGS,
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ArcGISMap {...effectiveMapData} />

      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "rgba(255,255,255,0.8)",
            zIndex: 10,
            fontSize: 18,
            color: "#666",
          }}
        >
          Loading map data...
        </div>
      )}

      {error && (
        <div
          style={{
            position: "absolute",
            inset: 16,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "#ffebee",
            borderRadius: 4,
            zIndex: 11,
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
// "use client";

// import dynamic from "next/dynamic";
// import { useMapId } from "@/app/context/MapContext";
// import { useState, useEffect } from "react";
// import { settingsRef } from "../components/map/arcgisRefs";
// import type {
//   DrawingExport,
//   EventPoint,
//   FeatureLayerConfig,
//   Label,
// } from "@/app/types/myTypes";
// import { normalizePolylineAnimation } from "@/app/types/myTypes";

// /* ─────────────────────────────────────────
//  * Types
//  * ───────────────────────────────────── */

// interface LooseSpatialReference {
//   wkid: number;
//   latestWkid?: number;
// }

// type LooseDrawing = {
//   attributes: Record<string, any>;
//   geometry:
//     | {
//         type: "polygon";
//         rings: number[][][];
//         spatialReference: LooseSpatialReference;
//       }
//     | {
//         type: "polyline";
//         paths: number[][][];
//         spatialReference: LooseSpatialReference;
//       }
//     | {
//         type: "point";
//         x: number;
//         y: number;
//         spatialReference: LooseSpatialReference;
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

// type ArcGISMapPayload = {
//   userEmail: string;
//   polygons: DrawingExport[];
//   labels: Label[];
//   events: EventPoint[];
//   eventSources: string[];
//   settings: {
//     zoom: number;
//     center: [number, number];
//     constraints: {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     } | null;
//     featureLayers: FeatureLayerConfig[] | null;
//     mapTile: string | null;
//     baseMap: string | null;
//     apiSources: string[];
//   };
// };

// /* ─────────────────────────────────────────
//  * Defaults
//  * ───────────────────────────────────── */

// const DEFAULT_CENTER: ArcGISMapPayload["settings"]["center"] = [
//   -120.422045, 37.368169,
// ];
// const DEFAULT_ZOOM = 15;
// const NO_CONSTRAINTS: ArcGISMapPayload["settings"]["constraints"] = null;
// const DEFAULT_TILELAYER =
//   "https://tiles.flavioherrera.com/v12/{level}/{col}/{row}.png";
// const DEFAULT_BASEMAP = "arcgis/nova";
// const DEFAULT_APISOURCES: string[] = [];

// const DEFAULT_SETTINGS: ArcGISMapPayload["settings"] = {
//   zoom: DEFAULT_ZOOM,
//   center: DEFAULT_CENTER,
//   constraints: NO_CONSTRAINTS,
//   featureLayers: null,
//   mapTile: DEFAULT_TILELAYER,
//   baseMap: DEFAULT_BASEMAP,
//   apiSources: DEFAULT_APISOURCES,
// };

// const DEFAULT_EVENT_SOURCES: string[] = [
//   //"https://uc-merced-campus-event-api-backend.onrender.com/get/events",
//   //"https://api.ucmercedhub.com/crimelogs",
//   //"https://uc-merced-campus-event-api-backend.onrender.com/presence_events",
//   //"http://127.0.0.1:8050/presence_events",
// ];

// const ArcGISMap = dynamic(() => import("./ArcGISMap"), { ssr: false });

// /* ─────────────────────────────────────────
//  * Guards / normalizers
//  * ───────────────────────────────────── */

// function toFiniteNumber(value: any): number | null {
//   if (typeof value === "number" && Number.isFinite(value)) return value;

//   if (typeof value === "string" && value.trim().length > 0) {
//     const n = Number(value);
//     return Number.isFinite(n) ? n : null;
//   }

//   return null;
// }

// function isSpatialReference(value: any): value is LooseSpatialReference {
//   if (!value || typeof value !== "object") return false;

//   const wkid = toFiniteNumber(value.wkid);
//   if (wkid === null) return false;

//   if (value.latestWkid != null && toFiniteNumber(value.latestWkid) === null) {
//     console.warn(
//       `[SpatialReference Warning] Invalid 'latestWkid' for wkid: ${value.wkid}. Accepting geometry anyway.`,
//       value,
//     );
//   }

//   if (value.latestWkid == null) {
//     console.warn(
//       `[SpatialReference Warning] Missing 'latestWkid' for wkid: ${value.wkid}. Accepting geometry anyway.`,
//       value,
//     );
//   }

//   return true;
// }

// function normalizeSpatialReference(value: any): LooseSpatialReference | null {
//   if (!isSpatialReference(value)) return null;

//   const wkid = toFiniteNumber(value.wkid);
//   const latestWkid = toFiniteNumber(value.latestWkid);

//   if (wkid === null) return null;

//   return {
//     wkid,
//     ...(latestWkid !== null ? { latestWkid } : {}),
//   };
// }

// function normalizeCoordinatePair(value: any): [number, number] | null {
//   if (!Array.isArray(value) || value.length < 2) return null;

//   const x = toFiniteNumber(value[0]);
//   const y = toFiniteNumber(value[1]);

//   if (x === null || y === null) return null;

//   return [x, y];
// }

// function normalizeCoordinateGroups(value: any): number[][][] | null {
//   if (!Array.isArray(value)) return null;

//   const groups = value
//     .map((group) => {
//       if (!Array.isArray(group)) return null;

//       const coords = group
//         .map(normalizeCoordinatePair)
//         .filter((pair): pair is [number, number] => pair !== null);

//       return coords.length > 0 ? coords : null;
//     })
//     .filter((group): group is [number, number][] => group !== null);

//   return groups.length > 0 ? groups : null;
// }

// function normalizeLooseGeometry(value: any): LooseDrawing["geometry"] | null {
//   if (!value || typeof value !== "object") return null;

//   const spatialReference = normalizeSpatialReference(value.spatialReference);
//   if (!spatialReference) return null;

//   if (value.type === "polygon") {
//     const rings = normalizeCoordinateGroups(value.rings);
//     if (!rings) return null;

//     return {
//       type: "polygon",
//       rings,
//       spatialReference,
//     };
//   }

//   if (value.type === "polyline") {
//     const paths = normalizeCoordinateGroups(value.paths);
//     if (!paths) return null;

//     return {
//       type: "polyline",
//       paths,
//       spatialReference,
//     };
//   }

//   if (value.type === "point") {
//     const x = toFiniteNumber(value.x);
//     const y = toFiniteNumber(value.y);

//     if (x === null || y === null) return null;

//     return {
//       type: "point",
//       x,
//       y,
//       spatialReference,
//     };
//   }

//   return null;
// }

// function isPolygonDrawing(value: any): boolean {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.geometry?.type === "polygon" &&
//     Array.isArray(value.geometry?.rings) &&
//     isSpatialReference(value.geometry?.spatialReference) &&
//     typeof value.symbol === "object" &&
//     value.symbol?.type === "simple-fill"
//   );
// }

// function isPolylineDrawing(value: any): boolean {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.geometry?.type === "polyline" &&
//     Array.isArray(value.geometry?.paths) &&
//     isSpatialReference(value.geometry?.spatialReference) &&
//     typeof value.symbol === "object" &&
//     value.symbol?.type === "simple-line"
//   );
// }

// function isPointDrawing(value: any): boolean {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.geometry?.type === "point" &&
//     typeof value.geometry?.x === "number" &&
//     typeof value.geometry?.y === "number" &&
//     isSpatialReference(value.geometry?.spatialReference) &&
//     typeof value.symbol === "object" &&
//     value.symbol?.type === "simple-marker" &&
//     Array.isArray(value.symbol?.color) &&
//     typeof value.symbol?.size === "number" &&
//     value.symbol?.outline &&
//     Array.isArray(value.symbol?.outline?.color) &&
//     typeof value.symbol?.outline?.width === "number"
//   );
// }

// function normalizeDrawing(value: any): DrawingExport | null {
//   if (!value || typeof value !== "object") return null;

//   const geometry = normalizeLooseGeometry(value.geometry);
//   if (!geometry) return null;

//   const normalized: LooseDrawing = {
//     ...value,
//     geometry,
//     attributes: {
//       ...(value.attributes ?? {}),
//     },
//   };

//   if (isPolylineDrawing(normalized)) {
//     if (normalized.attributes?.animation != null) {
//       normalized.attributes.animation = normalizePolylineAnimation(
//         normalized.attributes.animation,
//       );
//     }

//     return normalized as DrawingExport;
//   }

//   if (isPolygonDrawing(normalized)) {
//     return normalized as DrawingExport;
//   }

//   if (isPointDrawing(normalized)) {
//     return normalized as DrawingExport;
//   }

//   return null;
// }

// function isLabel(value: any): value is Label {
//   const spatialReference = normalizeSpatialReference(
//     value?.geometry?.spatialReference,
//   );
//   const x = toFiniteNumber(value?.geometry?.x);
//   const y = toFiniteNumber(value?.geometry?.y);

//   return (
//     value &&
//     typeof value === "object" &&
//     value.attributes &&
//     typeof value.attributes.parentId === "string" &&
//     value.geometry &&
//     x !== null &&
//     y !== null &&
//     spatialReference !== null
//   );
// }

// function normalizeLabel(value: any): Label | null {
//   if (!isLabel(value)) return null;

//   const spatialReference = normalizeSpatialReference(value.geometry.spatialReference);
//   const x = toFiniteNumber(value.geometry.x);
//   const y = toFiniteNumber(value.geometry.y);

//   if (!spatialReference || x === null || y === null) return null;

//   return {
//     ...value,
//     geometry: {
//       ...value.geometry,
//       x,
//       y,
//       spatialReference,
//     },
//   } as Label;
// }

// function isEventPoint(value: any): value is EventPoint {
//   const spatialReference = normalizeSpatialReference(
//     value?.geometry?.spatialReference,
//   );
//   const x = toFiniteNumber(value?.geometry?.x);
//   const y = toFiniteNumber(value?.geometry?.y);

//   return (
//     value &&
//     typeof value === "object" &&
//     value.attributes &&
//     typeof value.attributes.id === "string" &&
//     typeof value.attributes.event_name === "string" &&
//     value.geometry?.type === "point" &&
//     x !== null &&
//     y !== null &&
//     spatialReference !== null
//   );
// }

// function normalizeEventPoint(value: any): EventPoint | null {
//   if (!isEventPoint(value)) return null;

//   const spatialReference = normalizeSpatialReference(value.geometry.spatialReference);
//   const x = toFiniteNumber(value.geometry.x);
//   const y = toFiniteNumber(value.geometry.y);

//   if (!spatialReference || x === null || y === null) return null;

//   return {
//     ...value,
//     geometry: {
//       ...value.geometry,
//       x,
//       y,
//       spatialReference,
//     },
//   } as EventPoint;
// }

// function isHttpOrLocalApiUrl(value: string): boolean {
//   const trimmed = value.trim();

//   if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
//     return true;
//   }

//   try {
//     const u = new URL(trimmed);
//     return u.protocol === "http:" || u.protocol === "https:";
//   } catch {
//     return false;
//   }
// }

// /* ─────────────────────────────────────────
//  * Component
//  * ───────────────────────────────────── */

// export default function ArcGISWrapper() {
//   const mapId = useMapId();
//   const [mapData, setMapData] = useState<ArcGISMapPayload | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     if (!mapId) {
//       setMapData(null);
//       setError(null);
//       setLoading(false);
//       return;
//     }

//     setError(null);
//     setLoading(true);

//     fetch(`/api/maps/${mapId}`)
//       .then((res) => {
//         if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
//         return res.json() as Promise<
//           Partial<ArcGISMapPayload> & {
//             eventSources?: string[];
//             userEmail?: string;
//           }
//         >;
//       })
//       .then((data) => {
//         const userEmail =
//           typeof data.userEmail === "string" ? data.userEmail : "";

//         const polygons = Array.isArray(data.polygons)
//           ? data.polygons
//               .map((item) => {
//                 const normalized = normalizeDrawing(item);
//                 if (!normalized) {
//                   console.warn(
//                     "Discarded drawing item (failed type guard):",
//                     item,
//                   );
//                 }
//                 return normalized;
//               })
//               .filter((item): item is DrawingExport => item !== null)
//           : [];

//         const labels = Array.isArray(data.labels)
//           ? data.labels
//               .map(normalizeLabel)
//               .filter((item): item is Label => item !== null)
//           : [];

//         const events = Array.isArray((data as any).events)
//           ? ((data as any).events as any[])
//               .map(normalizeEventPoint)
//               .filter((item): item is EventPoint => item !== null)
//           : [];

//         console.log("Loaded map data:", data);

//         const eventSources =
//           Array.isArray((data as any)?.settings?.apiSources) &&
//           (data as any).settings.apiSources.length > 0 &&
//           (data as any).settings.apiSources.every(
//             (u: any) => typeof u === "string",
//           )
//             ? ((data as any).settings.apiSources as string[])
//             : DEFAULT_EVENT_SOURCES;

//         const rawS: Partial<ArcGISMapPayload["settings"]> = data.settings ?? {};

//         const center =
//           Array.isArray(rawS.center) &&
//           rawS.center.length === 2 &&
//           typeof rawS.center[0] === "number" &&
//           typeof rawS.center[1] === "number"
//             ? (rawS.center as [number, number])
//             : DEFAULT_CENTER;

//         const zoom =
//           typeof rawS.zoom === "number" && rawS.zoom >= 1 && rawS.zoom <= 20
//             ? rawS.zoom
//             : DEFAULT_ZOOM;

//         const constraints =
//           rawS.constraints &&
//           typeof rawS.constraints === "object" &&
//           typeof rawS.constraints.xmin === "number" &&
//           typeof rawS.constraints.ymin === "number" &&
//           typeof rawS.constraints.xmax === "number" &&
//           typeof rawS.constraints.ymax === "number"
//             ? rawS.constraints
//             : NO_CONSTRAINTS;

//         const mapTile =
//           typeof rawS.mapTile === "string" && rawS.mapTile.trim().length > 0
//             ? rawS.mapTile
//             : DEFAULT_TILELAYER;

//         const baseMap =
//           typeof rawS.baseMap === "string" && rawS.baseMap.trim().length > 0
//             ? rawS.baseMap
//             : DEFAULT_BASEMAP;

//         const rawApiSources = Array.isArray(rawS.apiSources)
//           ? rawS.apiSources
//               .filter((v): v is string => typeof v === "string")
//               .map((s) => s.trim())
//               .filter((s) => s.length > 0 && isHttpOrLocalApiUrl(s))
//           : DEFAULT_APISOURCES;

//         const apiSources =
//           rawApiSources.length > 0 ? rawApiSources : DEFAULT_APISOURCES;

//         const settings: ArcGISMapPayload["settings"] = {
//           zoom,
//           center,
//           constraints,
//           featureLayers: rawS.featureLayers ?? null,
//           mapTile,
//           baseMap,
//           apiSources,
//         };

//         try {
//           settingsRef.current.center = {
//             spatialReference: { wkid: 4326, latestWkid: 4326 },
//             x: settings.center[0],
//             y: settings.center[1],
//           };
//           settingsRef.current.zoom = settings.zoom;
//           settingsRef.current.featureLayers = settings.featureLayers ?? null;
//           settingsRef.current.constraints = settings.constraints;
//           settingsRef.current.mapTile = settings.mapTile;
//           settingsRef.current.baseMap = settings.baseMap;
//           settingsRef.current.apiSources = settings.apiSources;
//         } catch {
//           // ignore
//         }

//         setMapData({
//           userEmail,
//           polygons,
//           labels,
//           events,
//           eventSources,
//           settings,
//         });
//       })
//       .catch((err) => {
//         console.error(err);
//         setError(`Failed to load map data: ${err.message}`);
//       })
//       .finally(() => setLoading(false));
//   }, [mapId]);

//   const effectiveMapData: ArcGISMapPayload = mapData ?? {
//     userEmail: "",
//     polygons: [],
//     labels: [],
//     events: [],
//     eventSources: DEFAULT_EVENT_SOURCES,
//     settings: DEFAULT_SETTINGS,
//   };

//   return (
//     <div style={{ position: "relative", width: "100%", height: "100%" }}>
//       <ArcGISMap {...effectiveMapData} />

//       {loading && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 0,
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             background: "rgba(255,255,255,0.8)",
//             zIndex: 10,
//             fontSize: 18,
//             color: "#666",
//           }}
//         >
//           Loading map data...
//         </div>
//       )}

//       {error && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 16,
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             background: "#ffebee",
//             borderRadius: 4,
//             zIndex: 11,
//             fontSize: 18,
//             color: "#d32f2f",
//           }}
//         >
//           {error}
//         </div>
//       )}

//       {!loading && !error && !mapId && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 0,
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             zIndex: 9,
//             fontSize: 18,
//             color: "#666",
//           }}
//         >
//           No map selected
//         </div>
//       )}
//     </div>
//   );
// }

// //ArcGISWrapper.tsx
// "use client";

// import dynamic from "next/dynamic";
// import { useMapId } from "@/app/context/MapContext";
// import { useState, useEffect } from "react";
// import { settingsRef } from "../components/map/arcgisRefs";
// import type {
//   DrawingExport,
//   EventPoint,
//   FeatureLayerConfig,
//   Label,
// } from "@/app/types/myTypes";
// import { normalizePolylineAnimation } from "@/app/types/myTypes";

// /* ─────────────────────────────────────────
//  * Types
//  * ───────────────────────────────────── */

// interface LooseSpatialReference {
//   wkid: number;
//   latestWkid?: number;
// }

// type LooseDrawing = {
//   attributes: Record<string, any>;
//   geometry:
//     | {
//         type: "polygon";
//         rings: number[][][];
//         spatialReference: LooseSpatialReference;
//       }
//     | {
//         type: "polyline";
//         paths: number[][][];
//         spatialReference: LooseSpatialReference;
//       }
//     | {
//         type: "point";
//         x: number;
//         y: number;
//         spatialReference: LooseSpatialReference;
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

// type ArcGISMapPayload = {
//   userEmail: string;
//   polygons: DrawingExport[];
//   labels: Label[];
//   events: EventPoint[];
//   eventSources: string[];
//   settings: {
//     zoom: number;
//     center: [number, number];
//     constraints: {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     } | null;
//     featureLayers: FeatureLayerConfig[] | null;
//     mapTile: string | null;
//     baseMap: string | null;
//     apiSources: string[];
//   };
// };

// /* ─────────────────────────────────────────
//  * Defaults
//  * ───────────────────────────────────── */

// const DEFAULT_CENTER: ArcGISMapPayload["settings"]["center"] = [
//   -120.422045, 37.368169,
// ];
// const DEFAULT_ZOOM = 15;
// const NO_CONSTRAINTS: ArcGISMapPayload["settings"]["constraints"] = null;
// const DEFAULT_TILELAYER =
//   "https://tiles.flavioherrera.com/v12/{level}/{col}/{row}.png";
// const DEFAULT_BASEMAP = "arcgis/nova";
// const DEFAULT_APISOURCES: string[] = [];

// const DEFAULT_SETTINGS: ArcGISMapPayload["settings"] = {
//   zoom: DEFAULT_ZOOM,
//   center: DEFAULT_CENTER,
//   constraints: NO_CONSTRAINTS,
//   featureLayers: null,
//   mapTile: DEFAULT_TILELAYER,
//   baseMap: DEFAULT_BASEMAP,
//   apiSources: DEFAULT_APISOURCES,
// };

// const DEFAULT_EVENT_SOURCES: string[] = [
//   //"https://uc-merced-campus-event-api-backend.onrender.com/get/events",
//   //"https://api.ucmercedhub.com/crimelogs",
//   //"https://uc-merced-campus-event-api-backend.onrender.com/presence_events",
//   //"http://127.0.0.1:8050/presence_events",
// ];

// const ArcGISMap = dynamic(() => import("./ArcGISMap"), { ssr: false });

// /* ─────────────────────────────────────────
//  * Guards / normalizers
//  * ───────────────────────────────────── */

// function isSpatialReference(value: any): value is LooseSpatialReference {
//   if (!value || typeof value !== "object" || typeof value.wkid !== "number") {
//     return false;
//   }

//   if (typeof value.latestWkid !== "number") {
//     console.warn(
//       `[SpatialReference Warning] Missing or invalid 'latestWkid' for wkid: ${value.wkid}. Accepting geometry anyway.`,
//       value,
//     );
//   }

//   return true;
// }

// function isPolygonDrawing(value: any): boolean {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.geometry?.type === "polygon" &&
//     Array.isArray(value.geometry?.rings) &&
//     isSpatialReference(value.geometry?.spatialReference) &&
//     typeof value.symbol === "object" &&
//     value.symbol?.type === "simple-fill"
//   );
// }

// function isPolylineDrawing(value: any): boolean {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.geometry?.type === "polyline" &&
//     Array.isArray(value.geometry?.paths) &&
//     isSpatialReference(value.geometry?.spatialReference) &&
//     typeof value.symbol === "object" &&
//     value.symbol?.type === "simple-line"
//   );
// }

// function isPointDrawing(value: any): boolean {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.geometry?.type === "point" &&
//     typeof value.geometry?.x === "number" &&
//     typeof value.geometry?.y === "number" &&
//     isSpatialReference(value.geometry?.spatialReference) &&
//     typeof value.symbol === "object" &&
//     value.symbol?.type === "simple-marker" &&
//     Array.isArray(value.symbol?.color) &&
//     typeof value.symbol?.size === "number" &&
//     value.symbol?.outline &&
//     Array.isArray(value.symbol?.outline?.color) &&
//     typeof value.symbol?.outline?.width === "number"
//   );
// }

// function normalizeDrawing(value: any): DrawingExport | null {
//   if (isPolygonDrawing(value)) {
//     return value as DrawingExport;
//   }

//   if (isPointDrawing(value)) {
//     return value as DrawingExport;
//   }

//   if (isPolylineDrawing(value)) {
//     const normalized: LooseDrawing = {
//       ...value,
//       attributes: {
//         ...value.attributes,
//       },
//     };

//     if (normalized.attributes?.animation != null) {
//       normalized.attributes.animation = normalizePolylineAnimation(
//         normalized.attributes.animation,
//       );
//     }

//     return normalized as DrawingExport;
//   }

//   return null;
// }

// function isLabel(value: any): value is Label {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.attributes &&
//     typeof value.attributes.parentId === "string" &&
//     value.geometry &&
//     typeof value.geometry.x === "number" &&
//     typeof value.geometry.y === "number" &&
//     isSpatialReference(value.geometry.spatialReference)
//   );
// }

// function isEventPoint(value: any): value is EventPoint {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.attributes &&
//     typeof value.attributes.id === "string" &&
//     typeof value.attributes.event_name === "string" &&
//     value.geometry?.type === "point" &&
//     typeof value.geometry?.x === "number" &&
//     typeof value.geometry?.y === "number" &&
//     isSpatialReference(value.geometry?.spatialReference)
//   );
// }

// function isHttpUrl(value: string): boolean {
//   try {
//     const u = new URL(value);
//     return u.protocol === "http:" || u.protocol === "https:";
//   } catch {
//     return false;
//   }
// }

// /* ─────────────────────────────────────────
//  * Component
//  * ───────────────────────────────────── */

// export default function ArcGISWrapper() {
//   const mapId = useMapId();
//   const [mapData, setMapData] = useState<ArcGISMapPayload | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     if (!mapId) {
//       setMapData(null);
//       setError(null);
//       setLoading(false);
//       return;
//     }

//     setError(null);
//     setLoading(true);

//     fetch(`/api/maps/${mapId}`)
//       .then((res) => {
//         if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
//         return res.json() as Promise<
//           Partial<ArcGISMapPayload> & {
//             eventSources?: string[];
//             userEmail?: string;
//           }
//         >;
//       })
//       .then((data) => {
//         const userEmail =
//           typeof data.userEmail === "string" ? data.userEmail : "";

//         const polygons = Array.isArray(data.polygons)
//           ? data.polygons
//               .map((item) => {
//                 const normalized = normalizeDrawing(item);
//                 if (!normalized) {
//                   console.warn(
//                     "Discarded drawing item (failed type guard):",
//                     item,
//                   );
//                 }
//                 return normalized;
//               })
//               .filter((item): item is DrawingExport => item !== null)
//           : [];

//         const labels = Array.isArray(data.labels)
//           ? data.labels.filter(isLabel)
//           : [];

//         const events = Array.isArray((data as any).events)
//           ? ((data as any).events as any[]).filter(isEventPoint)
//           : [];

//         console.log("Loaded map data:", data);

//         const eventSources =
//           Array.isArray((data as any)?.settings?.apiSources) &&
//           (data as any).settings.apiSources.length > 0 &&
//           (data as any).settings.apiSources.every(
//             (u: any) => typeof u === "string",
//           )
//             ? ((data as any).settings.apiSources as string[])
//             : DEFAULT_EVENT_SOURCES;

//         const rawS: Partial<ArcGISMapPayload["settings"]> = data.settings ?? {};

//         const center =
//           Array.isArray(rawS.center) &&
//           rawS.center.length === 2 &&
//           typeof rawS.center[0] === "number" &&
//           typeof rawS.center[1] === "number"
//             ? (rawS.center as [number, number])
//             : DEFAULT_CENTER;

//         const zoom =
//           typeof rawS.zoom === "number" && rawS.zoom >= 1 && rawS.zoom <= 20
//             ? rawS.zoom
//             : DEFAULT_ZOOM;

//         const constraints =
//           rawS.constraints &&
//           typeof rawS.constraints === "object" &&
//           typeof rawS.constraints.xmin === "number" &&
//           typeof rawS.constraints.ymin === "number" &&
//           typeof rawS.constraints.xmax === "number" &&
//           typeof rawS.constraints.ymax === "number"
//             ? rawS.constraints
//             : NO_CONSTRAINTS;

//         const mapTile =
//           typeof rawS.mapTile === "string" && rawS.mapTile.trim().length > 0
//             ? rawS.mapTile
//             : DEFAULT_TILELAYER;

//         const baseMap =
//           typeof rawS.baseMap === "string" && rawS.baseMap.trim().length > 0
//             ? rawS.baseMap
//             : DEFAULT_BASEMAP;

//         const rawApiSources = Array.isArray(rawS.apiSources)
//           ? rawS.apiSources
//               .filter((v): v is string => typeof v === "string")
//               .map((s) => s.trim())
//               .filter((s) => s.length > 0 && isHttpUrl(s))
//           : DEFAULT_APISOURCES;

//         const apiSources =
//           rawApiSources.length > 0 ? rawApiSources : DEFAULT_APISOURCES;

//         const settings: ArcGISMapPayload["settings"] = {
//           zoom,
//           center,
//           constraints,
//           featureLayers: rawS.featureLayers ?? null,
//           mapTile,
//           baseMap,
//           apiSources,
//         };

//         try {
//           settingsRef.current.center = {
//             spatialReference: { wkid: 4326, latestWkid: 4326 },
//             x: settings.center[0],
//             y: settings.center[1],
//           };
//           settingsRef.current.zoom = settings.zoom;
//           settingsRef.current.featureLayers = settings.featureLayers ?? null;
//           settingsRef.current.constraints = settings.constraints;
//           settingsRef.current.mapTile = settings.mapTile;
//           settingsRef.current.baseMap = settings.baseMap;
//           settingsRef.current.apiSources = settings.apiSources;
//         } catch {
//           // ignore
//         }

//         setMapData({
//           userEmail,
//           polygons,
//           labels,
//           events,
//           eventSources,
//           settings,
//         });
//       })
//       .catch((err) => {
//         console.error(err);
//         setError(`Failed to load map data: ${err.message}`);
//       })
//       .finally(() => setLoading(false));
//   }, [mapId]);

//   const effectiveMapData: ArcGISMapPayload = mapData ?? {
//     userEmail: "",
//     polygons: [],
//     labels: [],
//     events: [],
//     eventSources: DEFAULT_EVENT_SOURCES,
//     settings: DEFAULT_SETTINGS,
//   };

//   return (
//     <div style={{ position: "relative", width: "100%", height: "100%" }}>
//       <ArcGISMap {...effectiveMapData} />

//       {loading && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 0,
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             background: "rgba(255,255,255,0.8)",
//             zIndex: 10,
//             fontSize: 18,
//             color: "#666",
//           }}
//         >
//           Loading map data...
//         </div>
//       )}

//       {error && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 16,
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             background: "#ffebee",
//             borderRadius: 4,
//             zIndex: 11,
//             fontSize: 18,
//             color: "#d32f2f",
//           }}
//         >
//           {error}
//         </div>
//       )}

//       {!loading && !error && !mapId && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 0,
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             zIndex: 9,
//             fontSize: 18,
//             color: "#666",
//           }}
//         >
//           No map selected
//         </div>
//       )}
//     </div>
//   );
// }
// "use client";

// import dynamic from "next/dynamic";
// import { useMapId } from "@/app/context/MapContext";
// import { useState, useEffect } from "react";
// import { settingsRef } from "../components/map/arcgisRefs";

// /* ─────────────────────────────────────────
//  * Types
//  * ───────────────────────────────────── */

// interface SpatialReference {
//   wkid: number;
//   latestWkid?: number; // Made optional to prevent strict failures
// }

// /**
//  * Backward-compatible name.
//  * `polygons` now contains polygon, polyline, and point drawings.
//  */
// interface Polygon {
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
// }

// interface Label {
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

// interface EventPoint {
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
//   format?: {
//     digitSeparator?: boolean;
//     places?: number;
//   };
// }

// interface FeatureLayerConfig {
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

// interface ExportBody {
//   userEmail: string;
//   polygons: Polygon[]; // includes polygons + polylines + points
//   labels: Label[];
//   events: EventPoint[];
//   /** list of external event API endpoints */
//   eventSources: string[];

//   settings: {
//     zoom: number;
//     center: [number, number];
//     constraints: {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     } | null;
//     featureLayers: FeatureLayerConfig[] | null;
//     mapTile: string;
//     baseMap: string;
//     apiSources: string[];
//   };
// }

// /* ─────────────────────────────────────────
//  * Defaults
//  * ───────────────────────────────────── */

// const DEFAULT_CENTER: ExportBody["settings"]["center"] = [
//   -120.422045, 37.368169,
// ];
// const DEFAULT_ZOOM = 15;
// const NO_CONSTRAINTS: ExportBody["settings"]["constraints"] = null;
// const DEFAULT_TILELAYER =
//   "https://tiles.flavioherrera.com/v12/{level}/{col}/{row}.png";
// const DEFAULT_BASEMAP = "arcgis/nova";
// const DEFAULT_APISOURCES: string[] = [];

// const DEFAULT_SETTINGS: ExportBody["settings"] = {
//   zoom: DEFAULT_ZOOM,
//   center: DEFAULT_CENTER,
//   constraints: NO_CONSTRAINTS,
//   featureLayers: null,
//   mapTile: DEFAULT_TILELAYER,
//   baseMap: DEFAULT_BASEMAP,
//   apiSources: DEFAULT_APISOURCES,
// };

// /** fallback external event endpoints */
// const DEFAULT_EVENT_SOURCES: string[] = [
//   //"https://uc-merced-campus-event-api-backend.onrender.com/get/events",
//   //"https://api.ucmercedhub.com/crimelogs",
//   //"https://uc-merced-campus-event-api-backend.onrender.com/presence_events",
//   //"http://127.0.0.1:8050/presence_events",
// ];

// const ArcGISMap = dynamic(() => import("./ArcGISMap"), { ssr: false });

// /* ─────────────────────────────────────────
//  * Guards
//  * ───────────────────────────────────── */

// function isSpatialReference(value: any): value is SpatialReference {
//   // 1. Strict fail if it's not an object or is missing the core wkid
//   if (!value || typeof value !== "object" || typeof value.wkid !== "number") {
//     return false;
//   }

//   // 2. Loose check for latestWkid + warning
//   if (typeof value.latestWkid !== "number") {
//     console.warn(
//       `[SpatialReference Warning] Missing or invalid 'latestWkid' for wkid: ${value.wkid}. Accepting geometry anyway.`,
//       value,
//     );
//   }

//   // 3. Allow it through
//   return true;
// }

// function isPolygonDrawing(value: any): boolean {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.geometry?.type === "polygon" &&
//     Array.isArray(value.geometry?.rings) &&
//     isSpatialReference(value.geometry?.spatialReference) &&
//     typeof value.symbol === "object" &&
//     value.symbol?.type === "simple-fill"
//   );
// }

// function isPolylineDrawing(value: any): boolean {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.geometry?.type === "polyline" &&
//     Array.isArray(value.geometry?.paths) &&
//     isSpatialReference(value.geometry?.spatialReference) &&
//     typeof value.symbol === "object" &&
//     value.symbol?.type === "simple-line"
//   );
// }

// function isPointDrawing(value: any): boolean {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.geometry?.type === "point" &&
//     typeof value.geometry?.x === "number" &&
//     typeof value.geometry?.y === "number" &&
//     isSpatialReference(value.geometry?.spatialReference) &&
//     typeof value.symbol === "object" &&
//     value.symbol?.type === "simple-marker" &&
//     Array.isArray(value.symbol?.color) &&
//     typeof value.symbol?.size === "number" &&
//     value.symbol?.outline &&
//     Array.isArray(value.symbol?.outline?.color) &&
//     typeof value.symbol?.outline?.width === "number"
//   );
// }

// function isDrawing(value: any): value is Polygon {
//   return (
//     isPolygonDrawing(value) || isPolylineDrawing(value) || isPointDrawing(value)
//   );
// }

// function isLabel(value: any): value is Label {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.attributes &&
//     typeof value.attributes.parentId === "string" &&
//     value.geometry &&
//     typeof value.geometry.x === "number" &&
//     typeof value.geometry.y === "number" &&
//     isSpatialReference(value.geometry.spatialReference)
//   );
// }

// function isEventPoint(value: any): value is EventPoint {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.attributes &&
//     typeof value.attributes.id === "string" &&
//     typeof value.attributes.event_name === "string" &&
//     value.geometry?.type === "point" &&
//     typeof value.geometry?.x === "number" &&
//     typeof value.geometry?.y === "number" &&
//     isSpatialReference(value.geometry?.spatialReference)
//   );
// }

// function isHttpUrl(value: string): boolean {
//   try {
//     const u = new URL(value);
//     return u.protocol === "http:" || u.protocol === "https:";
//   } catch {
//     return false;
//   }
// }

// /* ─────────────────────────────────────────
//  * Component
//  * ───────────────────────────────────── */

// export default function ArcGISWrapper() {
//   const mapId = useMapId();
//   const [mapData, setMapData] = useState<ExportBody | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     if (!mapId) {
//       setMapData(null);
//       setError(null);
//       setLoading(false);
//       return;
//     }

//     setError(null);
//     setLoading(true);

//     fetch(`/api/maps/${mapId}`)
//       .then((res) => {
//         if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
//         return res.json() as Promise<
//           Partial<ExportBody> & { eventSources?: string[]; userEmail?: string }
//         >;
//       })
//       .then((data) => {
//         const userEmail =
//           typeof data.userEmail === "string" ? data.userEmail : "";

//         // Updated filtering logic to catch and log discarded items
//         const polygons = Array.isArray(data.polygons)
//           ? data.polygons.filter((item) => {
//               const isValid = isDrawing(item);
//               if (!isValid) {
//                 console.warn(
//                   "Discarded drawing item (failed type guard):",
//                   item,
//                 );
//               }
//               return isValid;
//             })
//           : [];

//         const labels = Array.isArray(data.labels)
//           ? data.labels.filter(isLabel)
//           : [];

//         const events = Array.isArray((data as any).events)
//           ? ((data as any).events as any[]).filter(isEventPoint)
//           : [];

//         console.log("Loaded map data:", data);

//         // event sources: from settings.apiSources if present, else fallback
//         const eventSources =
//           Array.isArray((data as any)?.settings?.apiSources) &&
//           (data as any).settings.apiSources.length > 0 &&
//           (data as any).settings.apiSources.every(
//             (u: any) => typeof u === "string",
//           )
//             ? ((data as any).settings.apiSources as string[])
//             : DEFAULT_EVENT_SOURCES;

//         const rawS: Partial<ExportBody["settings"]> = data.settings ?? {};

//         const center =
//           Array.isArray(rawS.center) &&
//           rawS.center.length === 2 &&
//           typeof rawS.center[0] === "number" &&
//           typeof rawS.center[1] === "number"
//             ? (rawS.center as [number, number])
//             : DEFAULT_CENTER;

//         const zoom =
//           typeof rawS.zoom === "number" && rawS.zoom >= 1 && rawS.zoom <= 20
//             ? rawS.zoom
//             : DEFAULT_ZOOM;

//         const constraints =
//           rawS.constraints &&
//           typeof rawS.constraints === "object" &&
//           typeof rawS.constraints.xmin === "number" &&
//           typeof rawS.constraints.ymin === "number" &&
//           typeof rawS.constraints.xmax === "number" &&
//           typeof rawS.constraints.ymax === "number"
//             ? rawS.constraints
//             : NO_CONSTRAINTS;

//         const mapTile =
//           typeof rawS.mapTile === "string" && rawS.mapTile.trim().length > 0
//             ? rawS.mapTile
//             : DEFAULT_TILELAYER;

//         const baseMap =
//           typeof rawS.baseMap === "string" && rawS.baseMap.trim().length > 0
//             ? rawS.baseMap
//             : DEFAULT_BASEMAP;

//         const rawApiSources = Array.isArray(rawS.apiSources)
//           ? rawS.apiSources
//               .filter((v): v is string => typeof v === "string")
//               .map((s) => s.trim())
//               .filter((s) => s.length > 0 && isHttpUrl(s))
//           : DEFAULT_APISOURCES;

//         const apiSources =
//           rawApiSources.length > 0 ? rawApiSources : DEFAULT_APISOURCES;

//         const settings: ExportBody["settings"] = {
//           zoom,
//           center,
//           constraints,
//           featureLayers: rawS.featureLayers ?? null,
//           mapTile,
//           baseMap,
//           apiSources,
//         };

//         // update global settings ref for other modules
//         try {
//           settingsRef.current.center = {
//             spatialReference: { wkid: 4326, latestWkid: 4326 },
//             x: settings.center[0],
//             y: settings.center[1],
//           };
//           settingsRef.current.zoom = settings.zoom;
//           settingsRef.current.featureLayers = settings.featureLayers ?? null;
//           settingsRef.current.constraints = settings.constraints;
//           settingsRef.current.mapTile = settings.mapTile;
//           settingsRef.current.baseMap = settings.baseMap;
//           settingsRef.current.apiSources = settings.apiSources;
//         } catch {
//           // ignore
//         }

//         setMapData({
//           userEmail,
//           polygons,
//           labels,
//           events,
//           eventSources,
//           settings,
//         });
//       })
//       .catch((err) => {
//         console.error(err);
//         setError(`Failed to load map data: ${err.message}`);
//       })
//       .finally(() => setLoading(false));
//   }, [mapId]);

//   const effectiveMapData: ExportBody = mapData ?? {
//     userEmail: "",
//     polygons: [],
//     labels: [],
//     events: [],
//     eventSources: DEFAULT_EVENT_SOURCES,
//     settings: DEFAULT_SETTINGS,
//   };

//   return (
//     <div style={{ position: "relative", width: "100%", height: "100%" }}>
//       <ArcGISMap {...effectiveMapData} />

//       {loading && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 0,
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             background: "rgba(255,255,255,0.8)",
//             zIndex: 10,
//             fontSize: 18,
//             color: "#666",
//           }}
//         >
//           Loading map data...
//         </div>
//       )}

//       {error && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 16,
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             background: "#ffebee",
//             borderRadius: 4,
//             zIndex: 11,
//             fontSize: 18,
//             color: "#d32f2f",
//           }}
//         >
//           {error}
//         </div>
//       )}

//       {!loading && !error && !mapId && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 0,
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             zIndex: 9,
//             fontSize: 18,
//             color: "#666",
//           }}
//         >
//           No map selected
//         </div>
//       )}
//     </div>
//   );
// }
// "use client";

// import dynamic from "next/dynamic";
// import { useMapId } from "@/app/context/MapContext";
// import { useState, useEffect } from "react";
// import { settingsRef } from "../components/map/arcgisRefs";

// /* ─────────────────────────────────────────
//  * Types
//  * ───────────────────────────────────── */

// interface SpatialReference {
//   wkid: number;
//   latestWkid: number;
// }

// /**
//  * Backward-compatible name.
//  * `polygons` now contains polygon, polyline, and point drawings.
//  */
// interface Polygon {
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
// }

// interface Label {
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

// interface EventPoint {
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
//   format?: {
//     digitSeparator?: boolean;
//     places?: number;
//   };
// }

// interface FeatureLayerConfig {
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

// interface ExportBody {
//   userEmail: string;
//   polygons: Polygon[]; // includes polygons + polylines + points
//   labels: Label[];
//   events: EventPoint[];
//   /** list of external event API endpoints */
//   eventSources: string[];

//   settings: {
//     zoom: number;
//     center: [number, number];
//     constraints: {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     } | null;
//     featureLayers: FeatureLayerConfig[] | null;
//     mapTile: string;
//     baseMap: string;
//     apiSources: string[];
//   };
// }

// /* ─────────────────────────────────────────
//  * Defaults
//  * ───────────────────────────────────── */

// const DEFAULT_CENTER: ExportBody["settings"]["center"] = [
//   -120.422045, 37.368169,
// ];
// const DEFAULT_ZOOM = 15;
// const NO_CONSTRAINTS: ExportBody["settings"]["constraints"] = null;
// const DEFAULT_TILELAYER =
//   "https://tiles.flavioherrera.com/v12/{level}/{col}/{row}.png";
// const DEFAULT_BASEMAP = "arcgis/nova";
// const DEFAULT_APISOURCES: string[] = [];

// const DEFAULT_SETTINGS: ExportBody["settings"] = {
//   zoom: DEFAULT_ZOOM,
//   center: DEFAULT_CENTER,
//   constraints: NO_CONSTRAINTS,
//   featureLayers: null,
//   mapTile: DEFAULT_TILELAYER,
//   baseMap: DEFAULT_BASEMAP,
//   apiSources: DEFAULT_APISOURCES,
// };

// /** fallback external event endpoints */
// const DEFAULT_EVENT_SOURCES: string[] = [
//   //"https://uc-merced-campus-event-api-backend.onrender.com/get/events",
//   //"https://api.ucmercedhub.com/crimelogs",
//   //"https://uc-merced-campus-event-api-backend.onrender.com/presence_events",
//   //"http://127.0.0.1:8050/presence_events",
// ];

// const ArcGISMap = dynamic(() => import("./ArcGISMap"), { ssr: false });

// /* ─────────────────────────────────────────
//  * Guards
//  * ───────────────────────────────────── */

// function isSpatialReference(value: any): value is SpatialReference {
//   return (
//     value &&
//     typeof value === "object" &&
//     typeof value.wkid === "number" &&
//     typeof value.latestWkid === "number"
//   );
// }

// function isPolygonDrawing(value: any): boolean {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.geometry?.type === "polygon" &&
//     Array.isArray(value.geometry?.rings) &&
//     isSpatialReference(value.geometry?.spatialReference) &&
//     typeof value.symbol === "object" &&
//     value.symbol?.type === "simple-fill"
//   );
// }

// function isPolylineDrawing(value: any): boolean {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.geometry?.type === "polyline" &&
//     Array.isArray(value.geometry?.paths) &&
//     isSpatialReference(value.geometry?.spatialReference) &&
//     typeof value.symbol === "object" &&
//     value.symbol?.type === "simple-line"
//   );
// }

// function isPointDrawing(value: any): boolean {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.geometry?.type === "point" &&
//     typeof value.geometry?.x === "number" &&
//     typeof value.geometry?.y === "number" &&
//     isSpatialReference(value.geometry?.spatialReference) &&
//     typeof value.symbol === "object" &&
//     value.symbol?.type === "simple-marker" &&
//     Array.isArray(value.symbol?.color) &&
//     typeof value.symbol?.size === "number" &&
//     value.symbol?.outline &&
//     Array.isArray(value.symbol?.outline?.color) &&
//     typeof value.symbol?.outline?.width === "number"
//   );
// }

// function isDrawing(value: any): value is Polygon {
//   return (
//     isPolygonDrawing(value) || isPolylineDrawing(value) || isPointDrawing(value)
//   );
// }

// function isLabel(value: any): value is Label {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.attributes &&
//     typeof value.attributes.parentId === "string" &&
//     value.geometry &&
//     typeof value.geometry.x === "number" &&
//     typeof value.geometry.y === "number" &&
//     isSpatialReference(value.geometry.spatialReference)
//   );
// }

// function isEventPoint(value: any): value is EventPoint {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.attributes &&
//     typeof value.attributes.id === "string" &&
//     typeof value.attributes.event_name === "string" &&
//     value.geometry?.type === "point" &&
//     typeof value.geometry?.x === "number" &&
//     typeof value.geometry?.y === "number" &&
//     isSpatialReference(value.geometry?.spatialReference)
//   );
// }

// function isHttpUrl(value: string): boolean {
//   try {
//     const u = new URL(value);
//     return u.protocol === "http:" || u.protocol === "https:";
//   } catch {
//     return false;
//   }
// }

// /* ─────────────────────────────────────────
//  * Component
//  * ───────────────────────────────────── */

// export default function ArcGISWrapper() {
//   const mapId = useMapId();
//   const [mapData, setMapData] = useState<ExportBody | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     if (!mapId) {
//       setMapData(null);
//       setError(null);
//       setLoading(false);
//       return;
//     }

//     setError(null);
//     setLoading(true);

//     fetch(`/api/maps/${mapId}`)
//       .then((res) => {
//         if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
//         return res.json() as Promise<
//           Partial<ExportBody> & { eventSources?: string[]; userEmail?: string }
//         >;
//       })
//       .then((data) => {
//         const userEmail =
//           typeof data.userEmail === "string" ? data.userEmail : "";

//         const polygons = Array.isArray(data.polygons)
//           ? data.polygons.filter(isDrawing)
//           : [];

//         const labels = Array.isArray(data.labels)
//           ? data.labels.filter(isLabel)
//           : [];

//         const events = Array.isArray((data as any).events)
//           ? ((data as any).events as any[]).filter(isEventPoint)
//           : [];

//         console.log(data);

//         // event sources: from settings.apiSources if present, else fallback
//         const eventSources =
//           Array.isArray((data as any)?.settings?.apiSources) &&
//           (data as any).settings.apiSources.length > 0 &&
//           (data as any).settings.apiSources.every(
//             (u: any) => typeof u === "string",
//           )
//             ? ((data as any).settings.apiSources as string[])
//             : DEFAULT_EVENT_SOURCES;

//         const rawS: Partial<ExportBody["settings"]> = data.settings ?? {};

//         const center =
//           Array.isArray(rawS.center) &&
//           rawS.center.length === 2 &&
//           typeof rawS.center[0] === "number" &&
//           typeof rawS.center[1] === "number"
//             ? (rawS.center as [number, number])
//             : DEFAULT_CENTER;

//         const zoom =
//           typeof rawS.zoom === "number" && rawS.zoom >= 1 && rawS.zoom <= 20
//             ? rawS.zoom
//             : DEFAULT_ZOOM;

//         const constraints =
//           rawS.constraints &&
//           typeof rawS.constraints === "object" &&
//           typeof rawS.constraints.xmin === "number" &&
//           typeof rawS.constraints.ymin === "number" &&
//           typeof rawS.constraints.xmax === "number" &&
//           typeof rawS.constraints.ymax === "number"
//             ? rawS.constraints
//             : NO_CONSTRAINTS;

//         const mapTile =
//           typeof rawS.mapTile === "string" && rawS.mapTile.trim().length > 0
//             ? rawS.mapTile
//             : DEFAULT_TILELAYER;

//         const baseMap =
//           typeof rawS.baseMap === "string" && rawS.baseMap.trim().length > 0
//             ? rawS.baseMap
//             : DEFAULT_BASEMAP;

//         const rawApiSources = Array.isArray(rawS.apiSources)
//           ? rawS.apiSources
//               .filter((v): v is string => typeof v === "string")
//               .map((s) => s.trim())
//               .filter((s) => s.length > 0 && isHttpUrl(s))
//           : DEFAULT_APISOURCES;

//         const apiSources =
//           rawApiSources.length > 0 ? rawApiSources : DEFAULT_APISOURCES;

//         const settings: ExportBody["settings"] = {
//           zoom,
//           center,
//           constraints,
//           featureLayers: rawS.featureLayers ?? null,
//           mapTile,
//           baseMap,
//           apiSources,
//         };

//         // update global settings ref for other modules
//         try {
//           settingsRef.current.center = {
//             spatialReference: { wkid: 4326, latestWkid: 4326 },
//             x: settings.center[0],
//             y: settings.center[1],
//           };
//           settingsRef.current.zoom = settings.zoom;
//           settingsRef.current.featureLayers = settings.featureLayers ?? null;
//           settingsRef.current.constraints = settings.constraints;
//           settingsRef.current.mapTile = settings.mapTile;
//           settingsRef.current.baseMap = settings.baseMap;
//           settingsRef.current.apiSources = settings.apiSources;
//         } catch {
//           // ignore
//         }

//         setMapData({
//           userEmail,
//           polygons,
//           labels,
//           events,
//           eventSources,
//           settings,
//         });
//       })
//       .catch((err) => {
//         console.error(err);
//         setError(`Failed to load map data: ${err.message}`);
//       })
//       .finally(() => setLoading(false));
//   }, [mapId]);

//   const effectiveMapData: ExportBody = mapData ?? {
//     userEmail: "",
//     polygons: [],
//     labels: [],
//     events: [],
//     eventSources: DEFAULT_EVENT_SOURCES,
//     settings: DEFAULT_SETTINGS,
//   };

//   return (
//     <div style={{ position: "relative", width: "100%", height: "100%" }}>
//       <ArcGISMap {...effectiveMapData} />

//       {loading && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 0,
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             background: "rgba(255,255,255,0.8)",
//             zIndex: 10,
//             fontSize: 18,
//             color: "#666",
//           }}
//         >
//           Loading map data...
//         </div>
//       )}

//       {error && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 16,
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             background: "#ffebee",
//             borderRadius: 4,
//             zIndex: 11,
//             fontSize: 18,
//             color: "#d32f2f",
//           }}
//         >
//           {error}
//         </div>
//       )}

//       {!loading && !error && !mapId && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 0,
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             zIndex: 9,
//             fontSize: 18,
//             color: "#666",
//           }}
//         >
//           No map selected
//         </div>
//       )}
//     </div>
//   );
// }

// "use client";

// import dynamic from "next/dynamic";
// import { useMapId } from "@/app/context/MapContext";
// import { useState, useEffect } from "react";
// import { settingsRef } from "../components/map/arcgisRefs";

// /* ─────────────────────────────────────────
//  * Types
//  * ───────────────────────────────────── */

// interface SpatialReference {
//   wkid: number;
//   latestWkid: number;
// }

// /**
//  * Backward-compatible name.
//  * `polygons` now contains BOTH polygon and polyline drawings.
//  */
// interface Polygon {
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
// }

// interface Label {
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

// interface EventPoint {
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
//   format?: {
//     digitSeparator?: boolean;
//     places?: number;
//   };
// }

// interface FeatureLayerConfig {
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

// interface ExportBody {
//   userEmail: string;
//   polygons: Polygon[]; // includes polygons + polylines
//   labels: Label[];
//   events: EventPoint[];
//   /** list of external event API endpoints */
//   eventSources: string[];

//   settings: {
//     zoom: number;
//     center: [number, number];
//     constraints: {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     } | null;
//     featureLayers: FeatureLayerConfig[] | null;
//     mapTile: string;
//     baseMap: string;
//     apiSources: string[];
//   };
// }

// /* ─────────────────────────────────────────
//  * Defaults
//  * ───────────────────────────────────── */

// const DEFAULT_CENTER: ExportBody["settings"]["center"] = [
//   -120.422045, 37.368169,
// ];
// const DEFAULT_ZOOM = 15;
// const NO_CONSTRAINTS: ExportBody["settings"]["constraints"] = null;
// const DEFAULT_TILELAYER =
//   "https://tiles.flavioherrera.com/v12/{level}/{col}/{row}.png";
// const DEFAULT_BASEMAP = "arcgis/nova";
// const DEFAULT_APISOURCES: string[] = [];

// const DEFAULT_SETTINGS: ExportBody["settings"] = {
//   zoom: DEFAULT_ZOOM,
//   center: DEFAULT_CENTER,
//   constraints: NO_CONSTRAINTS,
//   featureLayers: null,
//   mapTile: DEFAULT_TILELAYER,
//   baseMap: DEFAULT_BASEMAP,
//   apiSources: DEFAULT_APISOURCES,
// };

// /** fallback external event endpoints */
// const DEFAULT_EVENT_SOURCES: string[] = [
//   //"https://uc-merced-campus-event-api-backend.onrender.com/get/events",
//   //"https://api.ucmercedhub.com/crimelogs",
//   //"https://uc-merced-campus-event-api-backend.onrender.com/presence_events",
//   //"http://127.0.0.1:8050/presence_events",
// ];

// const ArcGISMap = dynamic(() => import("./ArcGISMap"), { ssr: false });

// /* ─────────────────────────────────────────
//  * Guards
//  * ───────────────────────────────────── */

// function isSpatialReference(value: any): value is SpatialReference {
//   return (
//     value &&
//     typeof value === "object" &&
//     typeof value.wkid === "number" &&
//     typeof value.latestWkid === "number"
//   );
// }

// function isPolygonDrawing(value: any): boolean {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.geometry?.type === "polygon" &&
//     Array.isArray(value.geometry?.rings) &&
//     value.geometry?.spatialReference &&
//     typeof value.symbol === "object"
//   );
// }

// function isPolylineDrawing(value: any): boolean {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.geometry?.type === "polyline" &&
//     Array.isArray(value.geometry?.paths) &&
//     value.geometry?.spatialReference &&
//     typeof value.symbol === "object"
//   );
// }

// function isDrawing(value: any): value is Polygon {
//   return isPolygonDrawing(value) || isPolylineDrawing(value);
// }

// function isLabel(value: any): value is Label {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.attributes &&
//     typeof value.attributes.parentId === "string" &&
//     value.geometry &&
//     typeof value.geometry.x === "number" &&
//     typeof value.geometry.y === "number"
//   );
// }

// function isEventPoint(value: any): value is EventPoint {
//   return (
//     value &&
//     typeof value === "object" &&
//     value.attributes &&
//     typeof value.attributes.id === "string" &&
//     typeof value.attributes.event_name === "string" &&
//     value.geometry?.type === "point" &&
//     typeof value.geometry?.x === "number" &&
//     typeof value.geometry?.y === "number"
//   );
// }

// function isHttpUrl(value: string): boolean {
//   try {
//     const u = new URL(value);
//     return u.protocol === "http:" || u.protocol === "https:";
//   } catch {
//     return false;
//   }
// }

// /* ─────────────────────────────────────────
//  * Component
//  * ───────────────────────────────────── */

// export default function ArcGISWrapper() {
//   const mapId = useMapId();
//   const [mapData, setMapData] = useState<ExportBody | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     if (!mapId) {
//       setMapData(null);
//       setError(null);
//       setLoading(false);
//       return;
//     }

//     setError(null);
//     setLoading(true);

//     fetch(`/api/maps/${mapId}`)
//       .then((res) => {
//         if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
//         return res.json() as Promise<
//           Partial<ExportBody> & { eventSources?: string[]; userEmail?: string }
//         >;
//       })
//       .then((data) => {
//         const userEmail =
//           typeof data.userEmail === "string" ? data.userEmail : "";

//         const polygons = Array.isArray(data.polygons)
//           ? data.polygons.filter(isDrawing)
//           : [];

//         const labels = Array.isArray(data.labels)
//           ? data.labels.filter(isLabel)
//           : [];

//         const events = Array.isArray((data as any).events)
//           ? ((data as any).events as any[]).filter(isEventPoint)
//           : [];

//         console.log(data);

//         // event sources: from settings.apiSources if present, else fallback
//         const eventSources =
//           Array.isArray((data as any)?.settings?.apiSources) &&
//           (data as any).settings.apiSources.length > 0 &&
//           (data as any).settings.apiSources.every(
//             (u: any) => typeof u === "string",
//           )
//             ? ((data as any).settings.apiSources as string[])
//             : DEFAULT_EVENT_SOURCES;

//         const rawS: Partial<ExportBody["settings"]> = data.settings ?? {};

//         const center =
//           Array.isArray(rawS.center) &&
//           rawS.center.length === 2 &&
//           typeof rawS.center[0] === "number" &&
//           typeof rawS.center[1] === "number"
//             ? (rawS.center as [number, number])
//             : DEFAULT_CENTER;

//         const zoom =
//           typeof rawS.zoom === "number" && rawS.zoom >= 1 && rawS.zoom <= 20
//             ? rawS.zoom
//             : DEFAULT_ZOOM;

//         const constraints =
//           rawS.constraints &&
//           typeof rawS.constraints === "object" &&
//           typeof rawS.constraints.xmin === "number" &&
//           typeof rawS.constraints.ymin === "number" &&
//           typeof rawS.constraints.xmax === "number" &&
//           typeof rawS.constraints.ymax === "number"
//             ? rawS.constraints
//             : NO_CONSTRAINTS;

//         const mapTile =
//           typeof rawS.mapTile === "string" && rawS.mapTile.trim().length > 0
//             ? rawS.mapTile
//             : DEFAULT_TILELAYER;

//         const baseMap =
//           typeof rawS.baseMap === "string" && rawS.baseMap.trim().length > 0
//             ? rawS.baseMap
//             : DEFAULT_BASEMAP;

//         const rawApiSources = Array.isArray(rawS.apiSources)
//           ? rawS.apiSources
//               .filter((v): v is string => typeof v === "string")
//               .map((s) => s.trim())
//               .filter((s) => s.length > 0 && isHttpUrl(s))
//           : DEFAULT_APISOURCES;

//         const apiSources =
//           rawApiSources.length > 0 ? rawApiSources : DEFAULT_APISOURCES;

//         const settings: ExportBody["settings"] = {
//           zoom,
//           center,
//           constraints,
//           featureLayers: rawS.featureLayers ?? null,
//           mapTile,
//           baseMap,
//           apiSources,
//         };

//         // update global settings ref for other modules
//         try {
//           settingsRef.current.center = {
//             spatialReference: { wkid: 4326, latestWkid: 4326 },
//             x: settings.center[0],
//             y: settings.center[1],
//           };
//           settingsRef.current.zoom = settings.zoom;
//           settingsRef.current.featureLayers = settings.featureLayers ?? null;
//           settingsRef.current.constraints = settings.constraints;
//           settingsRef.current.mapTile = settings.mapTile;
//           settingsRef.current.baseMap = settings.baseMap;
//           settingsRef.current.apiSources = settings.apiSources;
//         } catch {
//           // ignore
//         }

//         setMapData({
//           userEmail,
//           polygons,
//           labels,
//           events,
//           eventSources,
//           settings,
//         });
//       })
//       .catch((err) => {
//         console.error(err);
//         setError(`Failed to load map data: ${err.message}`);
//       })
//       .finally(() => setLoading(false));
//   }, [mapId]);

//   const effectiveMapData: ExportBody = mapData ?? {
//     userEmail: "",
//     polygons: [],
//     labels: [],
//     events: [],
//     eventSources: DEFAULT_EVENT_SOURCES,
//     settings: DEFAULT_SETTINGS,
//   };

//   return (
//     <div style={{ position: "relative", width: "100%", height: "100%" }}>
//       <ArcGISMap {...effectiveMapData} />

//       {loading && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 0,
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             background: "rgba(255,255,255,0.8)",
//             zIndex: 10,
//             fontSize: 18,
//             color: "#666",
//           }}
//         >
//           Loading map data...
//         </div>
//       )}

//       {error && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 16,
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             background: "#ffebee",
//             borderRadius: 4,
//             zIndex: 11,
//             fontSize: 18,
//             color: "#d32f2f",
//           }}
//         >
//           {error}
//         </div>
//       )}

//       {!loading && !error && !mapId && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 0,
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             zIndex: 9,
//             fontSize: 18,
//             color: "#666",
//           }}
//         >
//           No map selected
//         </div>
//       )}
//     </div>
//   );
// }
// "use client";

// import dynamic from "next/dynamic";
// import { useMapId } from "@/app/context/MapContext";
// import { useState, useEffect } from "react";
// import { settingsRef } from "../components/map/arcgisRefs";

// /* ─────────────────────────────────────────
//  * Types
//  * ───────────────────────────────────── */

// interface SpatialReference {
//   wkid: number;
//   latestWkid: number;
// }

// interface Polygon {
//   attributes: Record<string, any>;
//   geometry: {
//     type: string;
//     rings: number[][][];
//     spatialReference: SpatialReference;
//   };
//   symbol: {
//     type: string;
//     color: number[]; // [r,g,b,a]
//     outline: { color: number[]; width: number };
//   };
// }

// interface Label {
//   attributes: {
//     parentId: string;
//     showAtZoom: number | null;
//     hideAtZoom: number | null;
//     fontSize: number;
//     color: number[]; // [r,g,b,a]
//     haloColor: number[]; // [r,g,b,a]
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

// interface EventPoint {
//   attributes: {
//     id: string;
//     event_name: string;
//     description?: string | null;
//     date?: string | null;
//     startAt?: string | null;
//     endAt?: string | null;
//     locationTag?: string | null;
//     names?: string[] | null;
//     original?: any | null;
//     fromUser: boolean;
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
//   format?: {
//     digitSeparator?: boolean;
//     places?: number;
//   };
// }

// interface FeatureLayerConfig {
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

// interface ExportBody {
//   userEmail: string;
//   polygons: Polygon[];
//   labels: Label[];
//   events: EventPoint[];
//   /** list of external event API endpoints */
//   eventSources: string[];

//   settings: {
//     zoom: number;
//     center: [number, number];
//     constraints: {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     } | null;
//     featureLayers: FeatureLayerConfig[] | null; // Array of feature layer configs
//     mapTile: string;
//     baseMap: string;
//     apiSources: string[];
//   };
// }

// /* ─────────────────────────────────────────
//  * Defaults
//  * ───────────────────────────────────── */

// const DEFAULT_CENTER: ExportBody["settings"]["center"] = [
//   -120.422045, 37.368169,
// ];
// const DEFAULT_ZOOM = 15;
// const NO_CONSTRAINTS: ExportBody["settings"]["constraints"] = null;
// const DEFAULT_TILELAYER =
//   "https://tiles.flavioherrera.com/v12/{level}/{col}/{row}.png";
// const DEFAULT_BASEMAP = "arcgis/nova";
// const DEFAULT_APISOURCES: string[] = [];
// const DEFAULT_SETTINGS: ExportBody["settings"] = {
//   zoom: DEFAULT_ZOOM,
//   center: DEFAULT_CENTER,
//   constraints: NO_CONSTRAINTS,
//   featureLayers: null,
//   mapTile: DEFAULT_TILELAYER,
//   baseMap: DEFAULT_BASEMAP,
//   apiSources: DEFAULT_APISOURCES,
// };

// /** fallback external event endpoints */
// const DEFAULT_EVENT_SOURCES: string[] = [
//   //"https://uc-merced-campus-event-api-backend.onrender.com/get/events",
//   // "https://api.ucmercedhub.com/crimelogs",
//   // "https://uc-merced-campus-event-api-backend.onrender.com/presence_events",
//   // "http://127.0.0.1:8050/presence_events",
// ];

// // "https://api.ucmercedhub.com/crimelogs",
// //   "https://uc-merced-campus-event-api-backend.onrender.com/presence_events"

// const ArcGISMap = dynamic(() => import("./ArcGISMap"), { ssr: false });

// /* ─────────────────────────────────────────
//  * Component
//  * ───────────────────────────────────── */

// export default function ArcGISWrapper() {
//   const mapId = useMapId();
//   const [mapData, setMapData] = useState<ExportBody | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     if (!mapId) {
//       setMapData(null);
//       setError(null);
//       setLoading(false);
//       return;
//     }

//     setError(null);
//     setLoading(true);

//     fetch(`/api/maps/${mapId}`)
//       .then((res) => {
//         if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
//         return res.json() as Promise<
//           Partial<ExportBody> & { eventSources?: string[]; userEmail?: string }
//         >;
//       })
//       .then((data) => {
//         const userEmail = (data as any).userEmail ?? "";
//         const polygons = Array.isArray(data.polygons) ? data.polygons : [];
//         const labels = Array.isArray(data.labels) ? data.labels : [];
//         const events = Array.isArray((data as any).events)
//           ? ((data as any).events as EventPoint[])
//           : [];
//         console.log(data);
//         // event sources: from API if present, else fallback
//         const eventSources =
//           Array.isArray((data as any).settings.apiSources) &&
//           (data as any).settings.apiSources!.length > 0 &&
//           (data as any).settings.apiSources!.every(
//             (u: any) => typeof u === "string"
//           )
//             ? ((data as any).settings.apiSources as string[])
//             : DEFAULT_EVENT_SOURCES;

//         const rawS: Partial<ExportBody["settings"]> = data.settings ?? {};
//         const center =
//           Array.isArray(rawS.center) &&
//           rawS.center.length === 2 &&
//           typeof rawS.center[0] === "number" &&
//           typeof rawS.center[1] === "number"
//             ? (rawS.center as [number, number])
//             : DEFAULT_CENTER;

//         const zoom =
//           typeof rawS.zoom === "number" && rawS.zoom >= 1 && rawS.zoom <= 20
//             ? rawS.zoom
//             : DEFAULT_ZOOM;

//         const constraints =
//           rawS.constraints &&
//           typeof rawS.constraints === "object" &&
//           typeof (rawS.constraints as any).xmin === "number"
//             ? (rawS.constraints as any)
//             : NO_CONSTRAINTS;

//         const mapTile =
//           typeof rawS.mapTile === "string" && rawS.mapTile != null
//             ? rawS.mapTile
//             : DEFAULT_TILELAYER;

//         const baseMap =
//           typeof rawS.baseMap === "string" && rawS.baseMap != null
//             ? rawS.baseMap
//             : DEFAULT_BASEMAP;

//         function isHttpUrl(value: string): boolean {
//           try {
//             const u = new URL(value);
//             return u.protocol === "http:" || u.protocol === "https:";
//           } catch {
//             return false;
//           }
//         }

//         const raw_apiSources = Array.isArray(rawS.apiSources)
//           ? rawS.apiSources
//               .filter((v): v is string => typeof v === "string")
//               .map((s) => s.trim())
//               .filter((s) => s.length > 0 && isHttpUrl(s))
//           : DEFAULT_APISOURCES;

//         const apiSources =
//           raw_apiSources.length > 0 ? raw_apiSources : DEFAULT_APISOURCES;

//         const settings: ExportBody["settings"] = {
//           zoom,
//           center,
//           constraints,
//           featureLayers: rawS.featureLayers ?? null,
//           mapTile,
//           baseMap,
//           apiSources,
//         };

//         // update global settings ref for other modules
//         try {
//           settingsRef.current.center = {
//             spatialReference: { wkid: 4326, latestWkid: 4326 },
//             x: settings.center[0],
//             y: settings.center[1],
//           };
//           settingsRef.current.zoom = settings.zoom;
//           settingsRef.current.featureLayers = settings.featureLayers ?? null;
//           settingsRef.current.constraints = settings.constraints;
//           settingsRef.current.mapTile = settings.mapTile;
//           settingsRef.current.baseMap = settings.baseMap;
//           settingsRef.current.apiSources = settings.apiSources;
//         } catch {
//           // ignore
//         }

//         setMapData({
//           userEmail,
//           polygons,
//           labels,
//           events,
//           eventSources,
//           settings,
//         });
//       })
//       .catch((err) => {
//         console.error(err);
//         setError(`Failed to load map data: ${err.message}`);
//       })
//       .finally(() => setLoading(false));
//   }, [mapId]);

//   // What ArcGISMap sees, even while data is loading
//   const effectiveMapData: ExportBody = mapData ?? {
//     userEmail: "",
//     polygons: [],
//     labels: [],
//     events: [],
//     eventSources: DEFAULT_EVENT_SOURCES,
//     settings: DEFAULT_SETTINGS,
//   };

//   return (
//     <div style={{ position: "relative", width: "100%", height: "100%" }}>
//       {/* The map always mounts so JS + tiles can load ASAP */}
//       <ArcGISMap {...effectiveMapData} />

//       {/* Overlays for UX / feedback */}
//       {loading && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 0,
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             background: "rgba(255,255,255,0.8)",
//             zIndex: 10,
//             fontSize: 18,
//             color: "#666",
//           }}
//         >
//           Loading map data...
//         </div>
//       )}

//       {error && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 16,
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             background: "#ffebee",
//             borderRadius: 4,
//             zIndex: 11,
//             fontSize: 18,
//             color: "#d32f2f",
//           }}
//         >
//           {error}
//         </div>
//       )}

//       {!loading && !error && !mapId && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 0,
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             zIndex: 9,
//             fontSize: 18,
//             color: "#666",
//           }}
//         >
//           No map selected
//         </div>
//       )}
//     </div>
//   );
// }
