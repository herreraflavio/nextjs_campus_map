"use client";

import dynamic from "next/dynamic";
import { useMapId } from "@/app/context/MapContext";
import { useState, useEffect } from "react";
import { settingsRef } from "../components/map/arcgisRefs";

// —————————————————————————————————————————————————
//  Types
// —————————————————————————————————————————————————
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
    outline: {
      color: number[]; // [r,g,b,a]
      width: number;
    };
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

interface ExportBody {
  userEmail: string;
  polygons: Polygon[];
  labels: Label[];
  settings: {
    zoom: number;
    center: [x: number, y: number];
    constraints: {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    } | null;
  };
}

// —————————————————————————————————————————————————
//  Defaults
// —————————————————————————————————————————————————
const DEFAULT_CENTER: ExportBody["settings"]["center"] = [
  -120.422045, 37.368169,
];

const NO_CONSTRAINTS: ExportBody["settings"]["constraints"] = null;

// —————————————————————————————————————————————————
//  Dynamic import of the heavy map component
// —————————————————————————————————————————————————
const ArcGISMap = dynamic(() => import("./ArcGISMap"), { ssr: false });

// —————————————————————————————————————————————————
//  ArcGISWrapper Component
// —————————————————————————————————————————————————
export default function ArcGISWrapper() {
  const mapId = useMapId();
  const [mapData, setMapData] = useState<ExportBody | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapId) return;

    setMapData(null);
    setError(null);

    fetch(`/api/maps/${mapId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Partial<ExportBody>>;
      })
      .then((data) => {
        // Required or fallback
        const userEmail = data.userEmail ?? "";
        const polygons = data.polygons ?? [];
        const labels = data.labels ?? [];

        // ① Tell TS that rawS is a Partial<settings>
        const rawS: Partial<ExportBody["settings"]> = data.settings ?? {};

        // ② Now rawS.zoom / rawS.center / rawS.constraints are all possibly undefined
        const settings: ExportBody["settings"] = {
          zoom: rawS.zoom ?? 15,
          center: rawS.center ?? DEFAULT_CENTER,
          constraints: rawS.constraints ?? NO_CONSTRAINTS,
        };

        settingsRef.current.center = {
          spatialReference: { wkid: 4326, latestWkid: 4326 },
          x: settings.center[0],
          y: settings.center[1],
        };
        settingsRef.current.zoom = settings.zoom;
        settingsRef.current.constraints = settings.constraints;

        setMapData({ userEmail, polygons, labels, settings });
      })
      .catch((err) => {
        console.error("Error loading map data:", err);
        setError("Failed to load map data.");
      });
  }, [mapId]);

  if (error) return <div className="error">{error}</div>;
  if (!mapData) return <div className="loading"></div>;

  return <ArcGISMap {...mapData} />;
}
