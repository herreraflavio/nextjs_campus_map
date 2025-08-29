// "use client";

// import dynamic from "next/dynamic";
// import { useMapId } from "@/app/context/MapContext";
// import { useState, useEffect } from "react";
// import { settingsRef } from "../components/map/arcgisRefs";

// // —————————————————————————————————————————————————
// //  Types
// // —————————————————————————————————————————————————
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
//     outline: {
//       color: number[]; // [r,g,b,a]
//       width: number;
//     };
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

// interface ExportBody {
//   userEmail: string;
//   polygons: Polygon[];
//   labels: Label[];
//   settings: {
//     zoom: number;
//     center: [x: number, y: number];
//     constraints: {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     } | null;
//   };
// }

// // —————————————————————————————————————————————————
// //  Defaults
// // —————————————————————————————————————————————————
// const DEFAULT_CENTER: ExportBody["settings"]["center"] = [
//   -120.422045, 37.368169,
// ];

// const NO_CONSTRAINTS: ExportBody["settings"]["constraints"] = null;

// // —————————————————————————————————————————————————
// //  Dynamic import of the heavy map component
// // —————————————————————————————————————————————————
// const ArcGISMap = dynamic(() => import("./ArcGISMap"), { ssr: false });

// // —————————————————————————————————————————————————
// //  ArcGISWrapper Component
// // —————————————————————————————————————————————————
// export default function ArcGISWrapper() {
//   const mapId = useMapId();
//   const [mapData, setMapData] = useState<ExportBody | null>(null);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     if (!mapId) return;

//     setMapData(null);
//     setError(null);

//     fetch(`/api/maps/${mapId}`)
//       .then((res) => {
//         if (!res.ok) throw new Error(`HTTP ${res.status}`);
//         return res.json() as Promise<Partial<ExportBody>>;
//       })
//       .then((data) => {
//         // Required or fallback
//         const userEmail = data.userEmail ?? "";
//         const polygons = data.polygons ?? [];
//         const labels = data.labels ?? [];

//         // ① Tell TS that rawS is a Partial<settings>
//         const rawS: Partial<ExportBody["settings"]> = data.settings ?? {};

//         // ② Now rawS.zoom / rawS.center / rawS.constraints are all possibly undefined
//         const settings: ExportBody["settings"] = {
//           zoom: rawS.zoom ?? 15,
//           center: rawS.center ?? DEFAULT_CENTER,
//           constraints: rawS.constraints ?? NO_CONSTRAINTS,
//         };

//         settingsRef.current.center = {
//           spatialReference: { wkid: 4326, latestWkid: 4326 },
//           x: settings.center[0],
//           y: settings.center[1],
//         };
//         settingsRef.current.zoom = settings.zoom;
//         settingsRef.current.constraints = settings.constraints;

//         setMapData({ userEmail, polygons, labels, settings });
//       })
//       .catch((err) => {
//         console.error("Error loading map data:", err);
//         setError("Failed to load map data.");
//       });
//   }, [mapId]);

//   if (error) return <div className="error">{error}</div>;
//   if (!mapData) return <div className="loading"></div>;

//   return <ArcGISMap {...mapData} />;
// }

"use client";

import dynamic from "next/dynamic";
import { useMapId } from "@/app/context/MapContext";
import { useState, useEffect } from "react";
import { settingsRef } from "../components/map/arcgisRefs";

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
  featureLayers: FeatureLayerConfig[]; // Array of feature layer configs
  settings: {
    zoom: number;
    center: [number, number];
    constraints: {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    } | null;
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

// Default feature layer configuration (currently hardcoded, will come from API later)
const DEFAULT_FEATURE_LAYERS: FeatureLayerConfig[] = [
  {
    url: "https://services6.arcgis.com/rX5atNlsxFq7LIpv/arcgis/rest/services/County_of_Merced_Jurisdictional_Zoning_Designations/FeatureServer",
    outFields: ["*"],
    popupEnabled: true,
    popupTemplate: {
      title: "{ZONENAME}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            {
              fieldName: "hall",
              label: "Hall Name",
              visible: true,
            },
            {
              fieldName: "beds",
              label: "Number of Beds",
              visible: true,
              format: {
                digitSeparator: true,
                places: 0,
              },
            },
          ],
        },
      ],
    },
  },
  {
    url: "https://services2.arcgis.com/wx8u046p68e0iGuj/arcgis/rest/services/housing_hall_for_arcgis_XYTableToPoint/FeatureServer",
    outFields: ["*"],
    popupEnabled: true,
    popupTemplate: {
      title: "{hall}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            {
              fieldName: "hall",
              label: "Hall Name",
              visible: true,
            },
            {
              fieldName: "beds",
              label: "Number of Beds",
              visible: true,
              format: {
                digitSeparator: true,
                places: 0,
              },
            },
            {
              fieldName: "incidents",
              label: "Total Incidents",
              visible: true,
              format: {
                digitSeparator: true,
                places: 0,
              },
            },
            {
              fieldName: "seriousness_sum",
              label: "Seriousness Sum",
              visible: true,
              format: {
                digitSeparator: true,
                places: 1,
              },
            },
            {
              fieldName: "exposure_bedyears",
              label: "Exposure (Bed-Years)",
              visible: true,
              format: {
                digitSeparator: true,
                places: 1,
              },
            },
            {
              fieldName: "rate_per_1k_bedyears",
              label: "Rate per 1,000 Bed-Years",
              visible: true,
              format: {
                digitSeparator: true,
                places: 2,
              },
            },
            {
              fieldName: "eb_rate_per_1k_bedyears",
              label: "EB Rate per 1,000 Bed-Years",
              visible: true,
              format: {
                digitSeparator: true,
                places: 2,
              },
            },
            {
              fieldName: "cri",
              label: "CRI",
              visible: true,
              format: {
                digitSeparator: true,
                places: 3,
              },
            },
            {
              fieldName: "cri_w",
              label: "CRI (Weighted)",
              visible: true,
              format: {
                digitSeparator: true,
                places: 3,
              },
            },
            {
              fieldName: "idx_0_100",
              label: "Index (0-100)",
              visible: true,
              format: {
                digitSeparator: true,
                places: 1,
              },
            },
            {
              fieldName: "idx_w_0_100",
              label: "Index Weighted (0-100)",
              visible: true,
              format: {
                digitSeparator: true,
                places: 1,
              },
            },
            {
              fieldName: "lon",
              label: "Longitude",
              visible: true,
              format: {
                places: 6,
              },
            },
            {
              fieldName: "lat",
              label: "Latitude",
              visible: true,
              format: {
                places: 6,
              },
            },
          ],
        },
      ],
    },
  },
];

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
    console.log("🔄 ArcGISWrapper useEffect triggered", { mapId });

    if (!mapId) {
      console.log("❌ No mapId provided, skipping data fetch");
      return;
    }

    setMapData(null);
    setError(null);
    setLoading(true);

    const fetchStartTime = performance.now();
    console.log("🚀 Starting map data fetch for mapId:", mapId);

    fetch(`/api/maps/${mapId}`)
      .then((res) => {
        const fetchTime = performance.now() - fetchStartTime;
        console.log(`📡 Fetch response received (${fetchTime.toFixed(2)}ms)`, {
          status: res.status,
          statusText: res.statusText,
          ok: res.ok,
          headers: {
            "content-type": res.headers.get("content-type"),
            "content-length": res.headers.get("content-length"),
          },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        return res.json() as Promise<Partial<ExportBody>>;
      })
      .then((data) => {
        console.log("📊 Raw API data received:", {
          hasUserEmail: !!data.userEmail,
          polygonCount: data.polygons?.length || 0,
          labelCount: data.labels?.length || 0,
          featureLayerCount: data.featureLayers?.length || 0,
          hasSettings: !!data.settings,
          settingsKeys: data.settings ? Object.keys(data.settings) : [],
        });

        // Validate and normalize data
        const userEmail = data.userEmail ?? "";
        const polygons = Array.isArray(data.polygons) ? data.polygons : [];
        const labels = Array.isArray(data.labels) ? data.labels : [];

        // Use feature layers from API response, or fall back to default
        const featureLayers =
          Array.isArray(data.featureLayers) && data.featureLayers.length > 0
            ? data.featureLayers
            : DEFAULT_FEATURE_LAYERS;

        console.log("🔍 Data validation:", {
          userEmail: userEmail || "empty",
          polygonCount: polygons.length,
          labelCount: labels.length,
          featureLayerCount: featureLayers.length,
        });

        // Validate polygon structure
        polygons.forEach((polygon, index) => {
          try {
            if (
              !polygon.geometry ||
              !polygon.geometry.rings ||
              !Array.isArray(polygon.geometry.rings)
            ) {
              console.warn(
                `⚠️ Invalid polygon geometry at index ${index}:`,
                polygon
              );
            }
            if (!polygon.attributes) {
              console.warn(
                `⚠️ Missing attributes for polygon at index ${index}`
              );
            }
            if (!polygon.symbol) {
              console.warn(`⚠️ Missing symbol for polygon at index ${index}`);
            }
          } catch (e) {
            console.error(
              `❌ Error validating polygon at index ${index}:`,
              e,
              polygon
            );
          }
        });

        // Validate label structure
        labels.forEach((label, index) => {
          try {
            if (
              !label.geometry ||
              typeof label.geometry.x !== "number" ||
              typeof label.geometry.y !== "number"
            ) {
              console.warn(
                `⚠️ Invalid label geometry at index ${index}:`,
                label
              );
            }
            if (!label.attributes || !label.attributes.text) {
              console.warn(
                `⚠️ Missing attributes/text for label at index ${index}`
              );
            }
          } catch (e) {
            console.error(
              `❌ Error validating label at index ${index}:`,
              e,
              label
            );
          }
        });

        // Validate feature layer structure
        featureLayers.forEach((layer, index) => {
          if (!layer.url) {
            console.warn(`⚠️ Missing URL for feature layer at index ${index}`);
          }
          console.log(`✅ Feature layer ${index} validated:`, {
            url: layer.url,
            hasPopupTemplate: !!layer.popupTemplate,
            fieldCount:
              layer.popupTemplate?.content?.[0]?.fieldInfos?.length || 0,
          });
        });

        // Process settings with validation
        const rawS: Partial<ExportBody["settings"]> = data.settings ?? {};

        let processedZoom = DEFAULT_ZOOM;
        if (
          typeof rawS.zoom === "number" &&
          rawS.zoom >= 1 &&
          rawS.zoom <= 20
        ) {
          processedZoom = rawS.zoom;
        } else if (rawS.zoom !== undefined) {
          console.warn(
            `⚠️ Invalid zoom value: ${rawS.zoom}, using default: ${DEFAULT_ZOOM}`
          );
        }

        let processedCenter = DEFAULT_CENTER;
        if (
          Array.isArray(rawS.center) &&
          rawS.center.length === 2 &&
          typeof rawS.center[0] === "number" &&
          typeof rawS.center[1] === "number"
        ) {
          processedCenter = [rawS.center[0], rawS.center[1]];
        } else if (rawS.center !== undefined) {
          console.warn(
            `⚠️ Invalid center value:`,
            rawS.center,
            `using default:`,
            DEFAULT_CENTER
          );
        }

        let processedConstraints = NO_CONSTRAINTS;
        if (rawS.constraints && typeof rawS.constraints === "object") {
          const c = rawS.constraints;
          if (
            typeof c.xmin === "number" &&
            typeof c.ymin === "number" &&
            typeof c.xmax === "number" &&
            typeof c.ymax === "number"
          ) {
            processedConstraints = c;
          } else {
            console.warn(`⚠️ Invalid constraints structure:`, c, `using null`);
          }
        }

        const settings: ExportBody["settings"] = {
          zoom: processedZoom,
          center: processedCenter,
          constraints: processedConstraints,
        };

        console.log("⚙️ Processed settings:", settings);

        // Update settingsRef for external components
        try {
          settingsRef.current.center = {
            spatialReference: { wkid: 4326, latestWkid: 4326 },
            x: settings.center[0],
            y: settings.center[1],
          };
          settingsRef.current.zoom = settings.zoom;
          settingsRef.current.constraints = settings.constraints;
          console.log("✅ settingsRef updated successfully");
        } catch (e) {
          console.error("❌ Error updating settingsRef:", e);
        }

        const finalMapData: ExportBody = {
          userEmail,
          polygons,
          labels,
          featureLayers,
          settings,
        };

        console.log("🎯 Final processed map data:", {
          userEmail: finalMapData.userEmail,
          polygonCount: finalMapData.polygons.length,
          labelCount: finalMapData.labels.length,
          featureLayerCount: finalMapData.featureLayers.length,
          settings: finalMapData.settings,
        });

        setMapData(finalMapData);
        setLoading(false);

        const totalTime = performance.now() - fetchStartTime;
        console.log(
          `✅ Map data processing completed (${totalTime.toFixed(2)}ms total)`
        );
      })
      .catch((err) => {
        const totalTime = performance.now() - fetchStartTime;
        console.error(
          `❌ Error loading map data (${totalTime.toFixed(2)}ms):`,
          {
            error: err,
            message: err.message,
            stack: err.stack,
            mapId,
          }
        );

        setError(`Failed to load map data: ${err.message}`);
        setLoading(false);
      });
  }, [mapId]);

  // Loading state
  if (loading) {
    console.log("⏳ Rendering loading state");
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

  // Error state
  if (error) {
    console.log("❌ Rendering error state:", error);
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

  // No data state
  if (!mapData) {
    console.log("⚠️ Rendering no data state");
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

  console.log("🗺️ Rendering ArcGISMap component with data");
  return <ArcGISMap {...mapData} />;
}
