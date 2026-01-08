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
// } from "@mui/material";
// import MapControls, { Constraints } from "./MapControls";

// function mercatorToLonLat(x: string, y: string): [number, number] {
//   const xFloat = parseFloat(x);
//   const yFloat = parseFloat(y);
//   const R = 6378137;
//   const lon = (xFloat / R) * (180 / Math.PI);
//   const lat =
//     (2 * Math.atan(Math.exp(yFloat / R)) - Math.PI / 2) * (180 / Math.PI);
//   return [lon, lat];
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
//   id: string; // ✅ stable id
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
//   // Safe UUID generator (browser + Node)
//   if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
//     return crypto.randomUUID();
//   }
//   return `layer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
// }

// /** Ensure each layer has an id and a concrete index; keep sorted. */
// function normalizeLayers(
//   layers: Partial<FeatureLayerConfig>[]
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
//   const [center, setCenter] = useState({ x: "", y: "" });
//   const [zoom, setZoom] = useState(10);

//   // Layers config (each layer has a stable `id`)
//   const [layers, setLayers] = useState<FeatureLayerConfig[]>([]);
//   const [mapTile, setMapTile] = useState<string | null>(null);
//   // Per-layer popup field editor input, keyed by layer.id
//   const [fieldNameById, setFieldNameById] = useState<Record<string, string>>(
//     {}
//   );

//   const [constraints, setConstraints] = useState<Constraints>({
//     xmin: "",
//     ymin: "",
//     xmax: "",
//     ymax: "",
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

//   // ─── Snapshot current view when opening the settings panel ──────────
//   const toggleSettings = () => {
//     if (!openSettings && view) {
//       const c = view.center as { x: number; y: number };
//       setCenter({ x: String(c.x), y: String(c.y) });
//       setZoom(view.zoom);
//       const currentExtent = view.extent;
//       setConstraints({
//         xmin: String(currentExtent.xmin),
//         ymin: String(currentExtent.ymin),
//         xmax: String(currentExtent.xmax),
//         ymax: String(currentExtent.ymax),
//       });
//     }

//     // Pull latest, normalize (ids & indices), and sort
//     const featureLayers = normalizeLayers(
//       (settingsRef.current.featureLayers ?? []) as Partial<FeatureLayerConfig>[]
//     );
//     setLayers(featureLayers);
//     setMapTile(settingsRef.current.mapTile);
//     setOpenSettings((o) => !o);
//   };

//   // ─── Handlers for MapControls inputs ────────────────────────────────
//   const handleCenterChange = (field: "x" | "y", value: string) =>
//     setCenter((prev) => ({ ...prev, [field]: value }));
//   const handleZoomChange = (value: number) => setZoom(value);
//   const handleConstraintChange = (field: keyof Constraints, value: string) =>
//     setConstraints((prev) => ({ ...prev, [field]: value }));

//   // ─── Apply to live view, persist in refs, and save to server ─────────
//   const applySettings = () => {
//     const { xmin, ymin, xmax, ymax } = constraints;

//     // Update constraints on the live MapView
//     if (xmin && ymin && xmax && ymax) {
//       view.constraints.geometry = new Extent({
//         xmin: +xmin,
//         ymin: +ymin,
//         xmax: +xmax,
//         ymax: +ymax,
//         spatialReference: view.spatialReference,
//       });
//     } else {
//       // @ts-ignore clear at runtime
//       view.constraints.geometry = null;
//     }

//     // Persist into settingsRef (store center in view SR)
//     settingsRef.current.zoom = zoom;
//     setMapCenterInViewSR(+center.x, +center.y);
//     settingsRef.current.constraints =
//       xmin && ymin && xmax && ymax
//         ? { xmin: +xmin, ymin: +ymin, xmax: +xmax, ymax: +ymax }
//         : (null as any);

//     // ✅ sort layers by their per-layer index before saving
//     const layersSorted = normalizeLayers(layers);
//     settingsRef.current.featureLayers = layersSorted;
//     settingsRef.current.mapTile = mapTile;

//     // Save to server
//     if (userEmail) {
//       const s = settingsRef.current;
//       saveMapToServer(mapId, userEmail, {
//         zoom: s.zoom,
//         center: [s.center.x, s.center.y] as [number, number],
//         constraints: s.constraints,
//         featureLayers: layersSorted, // persisted with id + index
//         mapTile: mapTile,
//       });
//     }

//     setOpenSettings(false);
//   };

//   useEffect(() => {
//     const handler = () => {
//       const items = finalizedLayerRef.current?.graphics?.items ?? [];
//       setPolygonList(
//         items
//           .slice()
//           .sort((a: any, b: any) => a.attributes.order - b.attributes.order)
//       );

//       if (editingId) {
//         const g = items.find((gr: any) => gr.attributes.id === editingId);
//         if (g) {
//           setEditName(g.attributes.name);
//           const { r, g: grn, b, a } = g.symbol.color;
//           setEditColor(
//             `#${[r, grn, b]
//               .map((v: number) => v.toString(16).padStart(2, "0"))
//               .join("")}`
//           );
//           setEditAlpha(typeof a === "number" ? a : 0.6);
//           setEditHTML(g.popupTemplate.content);

//           const label = labelsLayerRef.current?.graphics.items.find(
//             (l: any) => l.attributes.parentId === editingId
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

//   // ─── goTo & editing helpers ─────────────────────────────────────────
//   const goTo = (graphic: any) => {
//     const target = graphic.geometry.extent?.center || graphic.geometry;
//     view
//       .goTo({ target, zoom: 18 })
//       .then(() =>
//         view.popup.open({ features: [graphic], location_at: target })
//       );
//   };
//   const startEditing = (graphic: any) => setEditingId(graphic.attributes.id);

//   const applyEdits = () => {
//     if (!editingId) return;
//     const layer = finalizedLayerRef.current!;
//     const g = layer.graphics.find((gr: any) => gr.attributes.id === editingId);
//     if (!g) return;

//     // update polygon
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

//     // update label — compute interior point in view SR
//     const labelsLayer = labelsLayerRef.current!;
//     const label = labelsLayer.graphics.find(
//       (l: any) => l.attributes.parentId === editingId
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
//             pt = geometryEngine.labelPoints(g.geometry); // same SR as polygon/view
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
//         }
//       );
//     }

//     // ── Persist: use canonical settingsRef snapshot, not UI `layers` state ──
//     const s = settingsRef.current;
//     const featureLayersSnapshot = normalizeLayers(
//       (s.featureLayers ?? []) as Partial<FeatureLayerConfig>[]
//     );
//     // Keep ref consistent (optional)
//     s.featureLayers = featureLayersSnapshot;

//     if (userEmail) {
//       saveMapToServer(mapId, userEmail, {
//         zoom: s.zoom,
//         center: [s.center.x, s.center.y] as [number, number],
//         constraints: s.constraints,
//         featureLayers: featureLayersSnapshot,
//         mapTile: s.mapTile,
//       });
//     }

//     // For debugging as true snapshot (not by-reference):
//     // console.log("featureLayers at save (snapshot):", JSON.parse(JSON.stringify(featureLayersSnapshot)));

//     finalizedLayerRef.events.dispatchEvent(new Event("change"));
//     setEditingId(null);
//   };

//   const cancelEdits = () => setEditingId(null);

//   // ─── Sync polygon list when layers change ───────────────────────────
//   useEffect(() => {
//     const handler = () => {
//       const items = finalizedLayerRef.current?.graphics?.items ?? [];
//       setPolygonList(
//         items
//           .slice()
//           .sort((a: any, b: any) => a.attributes.order - b.attributes.order)
//       );
//     };
//     finalizedLayerRef.events.addEventListener("change", handler);
//     handler();
//     return () =>
//       finalizedLayerRef.events.removeEventListener("change", handler);
//   }, [editingId]);

//   // ─── Sync UI form when settingsRef changes externally ───────────────
//   useEffect(() => {
//     const sync = () => {
//       const s = settingsRef.current as any;
//       setCenter({ x: String(s.center.x), y: String(s.center.y) });

//       // Normalize and sort whenever we pull them in
//       const featureLayers = normalizeLayers(
//         (s.featureLayers ?? []) as Partial<FeatureLayerConfig>[]
//       );
//       setLayers(featureLayers);
//       setMapTile(settingsRef.current.mapTile);
//       setZoom(s.zoom);
//       if (s.constraints) {
//         setConstraints({
//           xmin: String(s.constraints.xmin),
//           ymin: String(s.constraints.ymin),
//           xmax: String(s.constraints.xmax),
//           ymax: String(s.constraints.ymax),
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
//               cordinates={mercatorToLonLat(center.x, center.y)}
//               onCenterChange={handleCenterChange}
//               zoom={zoom}
//               onZoomChange={handleZoomChange}
//               constraints={constraints}
//               onConstraintChange={handleConstraintChange}
//               layers={layers}
//               setLayers={setLayers}
//               fieldNameById={fieldNameById} // ✅ by id
//               setFieldNameById={setFieldNameById} // ✅ by id
//               mapTile={mapTile}
//               setMapTile={setMapTile}
//             />
//           </Box>
//           <Box display="flex" justifyContent="flex-end" mt={2}>
//             <Button onClick={toggleSettings}>Cancel</Button>
//             <Button variant="contained" onClick={applySettings} sx={{ ml: 1 }}>
//               Apply All Edits
//             </Button>
//           </Box>
//         </Box>
//       )}

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
import SettingsIcon from "@mui/icons-material/Settings";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
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
} from "@mui/material";
import MapControls, { Constraints } from "./MapControls";

function mercatorToLonLat(x: string, y: string): [number, number] {
  const xFloat = parseFloat(x);
  const yFloat = parseFloat(y);
  const R = 6378137;
  const lon = (xFloat / R) * (180 / Math.PI);
  const lat =
    (2 * Math.atan(Math.exp(yFloat / R)) - Math.PI / 2) * (180 / Math.PI);
  return [lon, lat];
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

export interface FeatureLayerConfig {
  id: string; // ✅ stable id
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

function genId() {
  // Safe UUID generator (browser + Node)
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `layer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Ensure each layer has an id and a concrete index; keep sorted. */
function normalizeLayers(
  layers: Partial<FeatureLayerConfig>[]
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

// ✅ Default API sources for new/older maps (and as fallback if user clears inputs)
const DEFAULT_APISOURCES: string[] = [
  // "https://api.ucmercedhub.com/crimelogs",
  // "https://uc-merced-campus-event-api-backend.onrender.com/presence_events",
];

function coerceStringArray(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default function Sidebar() {
  // ─── Polygon‐editing state ───────────────────────────────────────────
  const [polygonList, setPolygonList] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#ffffff");
  const [editAlpha, setEditAlpha] = useState(0.6);
  const [editHTML, setEditHTML] = useState("");
  const [editFontSize, setEditFontSize] = useState(12);
  const [minZoomEnabled, setMinZoomEnabled] = useState(false);
  const [maxZoomEnabled, setMaxZoomEnabled] = useState(false);
  const [minZoomLevel, setMinZoomLevel] = useState<string>("14");
  const [maxZoomLevel, setMaxZoomLevel] = useState<string>("18");

  // ─── Auth & map context ─────────────────────────────────────────────
  const { data: session } = useSession();
  const userEmail = session?.user?.email;
  const mapId = useMapId();

  // ─── Map Settings UI state ──────────────────────────────────────────
  const [openSettings, setOpenSettings] = useState(false);
  const [center, setCenter] = useState({ x: "", y: "" });
  const [zoom, setZoom] = useState(10);

  // Layers config (each layer has a stable `id`)
  const [layers, setLayers] = useState<FeatureLayerConfig[]>([]);
  const [mapTile, setMapTile] = useState<string | null>(null);

  // ✅ NEW: API sources array state
  const [apiSources, setApiSources] = useState<string[]>(DEFAULT_APISOURCES);

  // Per-layer popup field editor input, keyed by layer.id
  const [fieldNameById, setFieldNameById] = useState<Record<string, string>>(
    {}
  );

  const [constraints, setConstraints] = useState<Constraints>({
    xmin: "",
    ymin: "",
    xmax: "",
    ymax: "",
  });

  const view = MapViewRef.current!;

  // ─── Helper: store center in the MapView SR (Web Mercator) ──────────
  function setMapCenterInViewSR(x: number, y: number) {
    const sr = MapViewRef.current?.spatialReference ?? {
      wkid: 3857,
      latestWkid: 3857,
    };
    settingsRef.current.center = { spatialReference: sr, x, y } as any;
    settingsEvents.dispatchEvent(new Event("change"));
  }

  // ─── Snapshot current view when opening the settings panel ──────────
  const toggleSettings = () => {
    if (!openSettings && view) {
      const c = view.center as { x: number; y: number };
      setCenter({ x: String(c.x), y: String(c.y) });
      setZoom(view.zoom);
      const currentExtent = view.extent;
      setConstraints({
        xmin: String(currentExtent.xmin),
        ymin: String(currentExtent.ymin),
        xmax: String(currentExtent.xmax),
        ymax: String(currentExtent.ymax),
      });
    }

    // Pull latest, normalize (ids & indices), and sort
    const featureLayers = normalizeLayers(
      (settingsRef.current.featureLayers ?? []) as Partial<FeatureLayerConfig>[]
    );
    setLayers(featureLayers);

    setMapTile(settingsRef.current.mapTile);

    // ✅ pull apiSources; fallback to defaults if missing/invalid
    const sAny = settingsRef.current as any;
    const fromRef = coerceStringArray(sAny.apiSources);
    setApiSources(fromRef.length > 0 ? fromRef : DEFAULT_APISOURCES);

    setOpenSettings((o) => !o);
  };

  // ─── Handlers for MapControls inputs ────────────────────────────────
  const handleCenterChange = (field: "x" | "y", value: string) =>
    setCenter((prev) => ({ ...prev, [field]: value }));
  const handleZoomChange = (value: number) => setZoom(value);
  const handleConstraintChange = (field: keyof Constraints, value: string) =>
    setConstraints((prev) => ({ ...prev, [field]: value }));

  // ✅ apiSources UI helpers
  const updateApiSource = (index: number, value: string) => {
    setApiSources((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const addApiSource = () => {
    setApiSources((prev) => [...prev, ""]);
  };

  const removeApiSource = (index: number) => {
    setApiSources((prev) => prev.filter((_, i) => i !== index));
  };

  const resetApiSources = () => {
    setApiSources(DEFAULT_APISOURCES);
  };

  // ─── Apply to live view, persist in refs, and save to server ─────────
  const applySettings = () => {
    const { xmin, ymin, xmax, ymax } = constraints;

    // Update constraints on the live MapView
    if (xmin && ymin && xmax && ymax) {
      view.constraints.geometry = new Extent({
        xmin: +xmin,
        ymin: +ymin,
        xmax: +xmax,
        ymax: +ymax,
        spatialReference: view.spatialReference,
      });
    } else {
      // @ts-ignore clear at runtime
      view.constraints.geometry = null;
    }

    // Persist into settingsRef (store center in view SR)
    settingsRef.current.zoom = zoom;
    setMapCenterInViewSR(+center.x, +center.y);
    settingsRef.current.constraints =
      xmin && ymin && xmax && ymax
        ? { xmin: +xmin, ymin: +ymin, xmax: +xmax, ymax: +ymax }
        : (null as any);

    // ✅ sort layers by their per-layer index before saving
    const layersSorted = normalizeLayers(layers);
    settingsRef.current.featureLayers = layersSorted;

    settingsRef.current.mapTile = mapTile;

    // ✅ persist apiSources (trim, drop empties, fallback to defaults, dedupe)
    const cleaned = apiSources.map((s) => s.trim()).filter((s) => s.length > 0);
    const withFallback = cleaned.length > 0 ? cleaned : DEFAULT_APISOURCES;
    const deduped = Array.from(new Set(withFallback));
    (settingsRef.current as any).apiSources = deduped;

    // Save to server
    if (userEmail) {
      const s = settingsRef.current as any;
      saveMapToServer(mapId, userEmail, {
        zoom: s.zoom,
        center: [s.center.x, s.center.y] as [number, number],
        constraints: s.constraints,
        featureLayers: layersSorted, // persisted with id + index
        mapTile: mapTile,
        apiSources: deduped, // ✅ NEW
      });
    }

    setOpenSettings(false);
  };

  useEffect(() => {
    const handler = () => {
      const items = finalizedLayerRef.current?.graphics?.items ?? [];
      setPolygonList(
        items
          .slice()
          .sort((a: any, b: any) => a.attributes.order - b.attributes.order)
      );

      if (editingId) {
        const g = items.find((gr: any) => gr.attributes.id === editingId);
        if (g) {
          setEditName(g.attributes.name);
          const { r, g: grn, b, a } = g.symbol.color;
          setEditColor(
            `#${[r, grn, b]
              .map((v: number) => v.toString(16).padStart(2, "0"))
              .join("")}`
          );
          setEditAlpha(typeof a === "number" ? a : 0.6);
          setEditHTML(g.popupTemplate.content);

          const label = labelsLayerRef.current?.graphics.items.find(
            (l: any) => l.attributes.parentId === editingId
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
          }
        }
      }
    };
    finalizedLayerRef.events.addEventListener("change", handler);
    handler();
    return () =>
      finalizedLayerRef.events.removeEventListener("change", handler);
  }, [editingId]);

  // ─── goTo & editing helpers ─────────────────────────────────────────
  const goTo = (graphic: any) => {
    const target = graphic.geometry.extent?.center || graphic.geometry;
    view
      .goTo({ target, zoom: 18 })
      .then(() =>
        view.popup.open({ features: [graphic], location_at: target })
      );
  };
  const startEditing = (graphic: any) => setEditingId(graphic.attributes.id);

  const applyEdits = () => {
    if (!editingId) return;
    const layer = finalizedLayerRef.current!;
    const g = layer.graphics.find((gr: any) => gr.attributes.id === editingId);
    if (!g) return;

    // update polygon
    g.attributes.name = editName;
    g.popupTemplate.content = editHTML;
    g.attributes.description = editHTML;
    const hex = editColor.slice(1);
    const r = parseInt(hex.substr(0, 2), 16);
    const grn = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const newSym = (g.symbol as any).clone();
    newSym.color = [r, grn, b, +editAlpha.toFixed(2)];
    g.symbol = newSym;

    // update label — compute interior point in view SR
    const labelsLayer = labelsLayerRef.current!;
    const label = labelsLayer.graphics.find(
      (l: any) => l.attributes.parentId === editingId
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
            pt = geometryEngine.labelPoints(g.geometry); // same SR as polygon/view
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
        }
      );
    }

    // ── Persist: use canonical settingsRef snapshot, not UI `layers` state ──
    const s = settingsRef.current as any;
    const featureLayersSnapshot = normalizeLayers(
      (s.featureLayers ?? []) as Partial<FeatureLayerConfig>[]
    );
    // Keep ref consistent (optional)
    s.featureLayers = featureLayersSnapshot;

    // ✅ include apiSources here too, in case your backend overwrites settings
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
        apiSources: apiSourcesSnapshot, // ✅ NEW
      });
    }

    finalizedLayerRef.events.dispatchEvent(new Event("change"));
    setEditingId(null);
  };

  const cancelEdits = () => setEditingId(null);

  // ─── Sync polygon list when layers change ───────────────────────────
  useEffect(() => {
    const handler = () => {
      const items = finalizedLayerRef.current?.graphics?.items ?? [];
      setPolygonList(
        items
          .slice()
          .sort((a: any, b: any) => a.attributes.order - b.attributes.order)
      );
    };
    finalizedLayerRef.events.addEventListener("change", handler);
    handler();
    return () =>
      finalizedLayerRef.events.removeEventListener("change", handler);
  }, [editingId]);

  // ─── Sync UI form when settingsRef changes externally ───────────────
  useEffect(() => {
    const sync = () => {
      const s = settingsRef.current as any;
      setCenter({ x: String(s.center.x), y: String(s.center.y) });

      // Normalize and sort whenever we pull them in
      const featureLayers = normalizeLayers(
        (s.featureLayers ?? []) as Partial<FeatureLayerConfig>[]
      );
      setLayers(featureLayers);

      setMapTile(settingsRef.current.mapTile);
      setZoom(s.zoom);

      // ✅ sync apiSources
      const fromRef = coerceStringArray(s.apiSources);
      setApiSources(fromRef.length > 0 ? fromRef : DEFAULT_APISOURCES);

      if (s.constraints) {
        setConstraints({
          xmin: String(s.constraints.xmin),
          ymin: String(s.constraints.ymin),
          xmax: String(s.constraints.xmax),
          ymax: String(s.constraints.ymax),
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
              cordinates={mercatorToLonLat(center.x, center.y)}
              onCenterChange={handleCenterChange}
              zoom={zoom}
              onZoomChange={handleZoomChange}
              constraints={constraints}
              onConstraintChange={handleConstraintChange}
              layers={layers}
              setLayers={setLayers}
              fieldNameById={fieldNameById} // ✅ by id
              setFieldNameById={setFieldNameById} // ✅ by id
              mapTile={mapTile}
              setMapTile={setMapTile}
            />

            {/* ✅ NEW: API Sources editor (array of URLs) */}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              API Sources
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
              One URL per source. Empty rows are ignored on save.
            </Typography>

            <Box sx={{ mt: 1 }}>
              {apiSources.map((url, idx) => (
                <Box
                  key={`${idx}-${url}`}
                  sx={{
                    display: "flex",
                    gap: 1,
                    alignItems: "center",
                    mt: 1,
                  }}
                >
                  <TextField
                    label={`API Source ${idx + 1}`}
                    value={url}
                    onChange={(e) => updateApiSource(idx, e.target.value)}
                    size="small"
                    fullWidth
                  />
                  <IconButton
                    aria-label={`Remove API source ${idx + 1}`}
                    onClick={() => removeApiSource(idx)}
                    size="small"
                  >
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

      <Box display="flex" justifyContent="space-between" mb={1}>
        <div>╔═</div>
        <Typography component="h3">Polygons</Typography>
        <div>═╗</div>
      </Box>

      <ul style={{ paddingLeft: 20 }}>
        {polygonList.map((poly) => (
          <li key={poly.attributes.id} style={{ margin: "8px 0" }}>
            {poly.attributes.name}
            <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => goTo(poly)}
              >
                Go to
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => startEditing(poly)}
              >
                Edit
              </Button>
            </Box>
          </li>
        ))}
      </ul>

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
            width: 260,
          }}
        >
          <Typography variant="h6">Edit Polygon</Typography>
          <TextField
            label="Name"
            fullWidth
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            size="small"
            margin="dense"
          />
          <InputLabel sx={{ mt: 2 }}>Fill Color</InputLabel>
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
          <Box sx={{ textAlign: "right", mt: 1 }}>
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
