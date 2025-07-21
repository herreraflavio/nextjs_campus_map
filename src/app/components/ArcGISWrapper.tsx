"use client";
import dynamic from "next/dynamic";

const ArcGISMap = dynamic(() => import("./ArcGISMap"), {
  ssr: false,
});

export default function ArcGISWrapper() {
  return <ArcGISMap />;
}
// "use client";

// import { useState, useEffect } from "react";
// import dynamic from "next/dynamic";
// import { useMapId } from "@/app/context/MapContext";

// // Define the shape of your data for type safety
// type MapSettings = {
//   zoom?: number;
//   center?: [number, number];
//   constraints?: {
//     xmin: number;
//     ymin: number;
//     xmax: number;
//     ymax: number;
//   } | null;
// };

// type InitialData = {
//   settings: MapSettings;
//   polygons: any[];
//   labels: any[];
// };

// // Dynamically import the map component without server-side rendering
// const ArcGISMap = dynamic(() => import("./ArcGISMap"), {
//   ssr: false,
//   loading: () => (
//     <div style={{ textAlign: "center", paddingTop: "50px" }}>
//       Loading Map...
//     </div>
//   ),
// });

// export default function ArcGISWrapper() {
//   const mapId = useMapId();
//   const [initialData, setInitialData] = useState<InitialData | null>(null);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     if (!mapId) {
//       setIsLoading(false);
//       setError("Map ID is not available.");
//       return;
//     }

//     const fetchData = async () => {
//       try {
//         const res = await fetch(`/api/maps/${mapId}`);
//         if (!res.ok) {
//           throw new Error(`Failed to fetch map settings (${res.status})`);
//         }
//         const data = await res.json();

//         // --- Process and normalize settings here ---
//         const settings: MapSettings = {};
//         if (Array.isArray(data.settings)) {
//           for (const s of data.settings) {
//             // Use a type assertion to allow dynamic key assignment
//             (settings as any)[s.key] = s.value;
//           }
//         } else if (data.settings && typeof data.settings === "object") {
//           Object.assign(settings, data.settings);
//         }

//         setInitialData({
//           settings,
//           polygons: data.polygons || [],
//           labels: data.labels || [],
//         });
//       } catch (err: any) {
//         console.error("Error loading initial map data:", err);
//         setError(err.message);
//       } finally {
//         setIsLoading(false);
//       }
//     };

//     fetchData();
//   }, [mapId]);

//   if (isLoading) {
//     return (
//       <div style={{ textAlign: "center", paddingTop: "50px" }}>
//         Loading Initial Map Settings...
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div style={{ color: "red", textAlign: "center", paddingTop: "50px" }}>
//         Error: {error}
//       </div>
//     );
//   }

//   // Render the map only when data is successfully loaded
//   return initialData ? <ArcGISMap initialData={initialData} /> : null;
// }
