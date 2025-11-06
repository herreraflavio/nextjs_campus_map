"use client";

import dynamic from "next/dynamic";
import { useMapId } from "@/app/context/MapContext";
import { useState, useEffect } from "react";
import { settingsRef } from "../components/map/arcgisRefs";
// import AddEvent from "./map/MapControls/addEvent";

/* ─────────────────────────────────────────
 * Types
 * ───────────────────────────────────── */

interface SpatialReference {
  wkid: number;
  latestWkid: number;
}

interface Polygon {
  attributes: Record<string, any>;
  geometry: {
    type: string;
    rings: number[][][];
    spatialReference: SpatialReference;
  };
  symbol: {
    type: string;
    color: number[]; // [r,g,b,a]
    outline: { color: number[]; width: number };
  };
}

interface Label {
  attributes: {
    parentId: string;
    showAtZoom: number | null;
    hideAtZoom: number | null;
    fontSize: number;
    color: number[]; // [r,g,b,a]
    haloColor: number[]; // [r,g,b,a]
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

interface EventPoint {
  attributes: {
    id: string;
    event_name: string;
    description?: string | null;
    date?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    locationTag?: string | null;
    names?: string[] | null;
    original?: any | null;
    fromUser: boolean;
  };
  geometry: {
    type: "point";
    x: number;
    y: number;
    spatialReference: SpatialReference;
  };
}

interface FieldInfo {
  fieldName: string;
  label: string;
  visible: boolean;
  format?: {
    digitSeparator?: boolean;
    places?: number;
  };
}

interface FeatureLayerConfig {
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

interface ExportBody {
  userEmail: string;
  polygons: Polygon[];
  labels: Label[];
  events: EventPoint[];
  /** NEW: list of external event API endpoints */
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
    featureLayers: FeatureLayerConfig[] | null; // Array of feature layer configs
  };
}

/* ─────────────────────────────────────────
 * Defaults
 * ───────────────────────────────────── */

const DEFAULT_CENTER: ExportBody["settings"]["center"] = [
  -120.422045, 37.368169,
];
const DEFAULT_ZOOM = 15;
const NO_CONSTRAINTS: ExportBody["settings"]["constraints"] = null;

/** NEW: fallback external event endpoints */
// const DEFAULT_EVENT_SOURCES: string[] = ["http://localhost:6050/events"];
const DEFAULT_EVENT_SOURCES: string[] = [
  "https://uc-merced-campus-event-api-backend.onrender.com/get/events",
  // "http://127.0.0.1:8050/get/events",
];
// const DEFAULT_EVENT_SOURCES: string[] = [];

const ArcGISMap = dynamic(() => import("./ArcGISMap"), { ssr: false });

/* ─────────────────────────────────────────
 * Component
 * ───────────────────────────────────── */

export default function ArcGISWrapper() {
  const mapId = useMapId();
  const [mapData, setMapData] = useState<ExportBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mapId) return;

    setMapData(null);
    setError(null);
    setLoading(true);

    fetch(`/api/maps/${mapId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json() as Promise<
          Partial<ExportBody> & { eventSources?: string[] }
        >;
      })
      .then((data) => {
        const userEmail = (data as any).userEmail ?? "";
        const polygons = Array.isArray(data.polygons) ? data.polygons : [];
        const labels = Array.isArray(data.labels) ? data.labels : [];
        const events = Array.isArray((data as any).events)
          ? ((data as any).events as EventPoint[])
          : [];

        // event sources: from API if present, else fallback
        const eventSources =
          Array.isArray((data as any).eventSources) &&
          (data as any).eventSources!.length > 0 &&
          (data as any).eventSources!.every((u: any) => typeof u === "string")
            ? ((data as any).eventSources as string[])
            : DEFAULT_EVENT_SOURCES;

        const rawS: Partial<ExportBody["settings"]> = data.settings ?? {};
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
          typeof (rawS.constraints as any).xmin === "number"
            ? (rawS.constraints as any)
            : NO_CONSTRAINTS;

        const settings: ExportBody["settings"] = {
          zoom,
          center,
          constraints,
          featureLayers: rawS.featureLayers ?? null,
        };

        // update global (other modules use it)
        try {
          settingsRef.current.center = {
            spatialReference: { wkid: 4326, latestWkid: 4326 },
            x: settings.center[0],
            y: settings.center[1],
          };
          settingsRef.current.zoom = settings.zoom;
          settingsRef.current.featureLayers = settings.featureLayers ?? null;
          settingsRef.current.constraints = settings.constraints;
        } catch {}

        setMapData({
          userEmail,
          polygons,
          labels,
          events,
          eventSources,
          settings,
        });
        setLoading(false);
      })
      .catch((err) => {
        setError(`Failed to load map data: ${err.message}`);
        setLoading(false);
      });
  }, [mapId]);

  if (loading) {
    return (
      <div
        className="loading"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          fontSize: "18px",
          color: "#666",
        }}
      >
        Loading map data...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="error"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          fontSize: "18px",
          color: "#d32f2f",
          backgroundColor: "#ffebee",
          padding: "20px",
          borderRadius: "4px",
          margin: "20px",
        }}
      >
        {error}
      </div>
    );
  }

  if (!mapData) {
    return (
      <div
        className="no-data"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          fontSize: "18px",
          color: "#666",
        }}
      >
        No map data available
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%" }}>
      {/* <div style={{ position: "relative" }}>
        <AddEvent />
      </div> */}
      <ArcGISMap {...mapData} />
    </div>
  );
}
