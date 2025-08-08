// "use client";

// import { useState, useEffect } from "react";
// import {
//   labelsLayerRef,
//   finalizedLayerRef,
//   MapViewRef,
//   settingsRef,
//   settingsEvents,
// } from "./arcgisRefs";
// import { getPolygonCentroid } from "./centroid";
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

//   const R = 6378137; // Earth's radius in meters
//   const lon = (xFloat / R) * (180 / Math.PI);
//   const lat =
//     (2 * Math.atan(Math.exp(yFloat / R)) - Math.PI / 2) * (180 / Math.PI);
//   return [lon, lat];
// }

// function lonLatToMercator(lat: number, lon: number): [number, number] {
//   console.log(lat, lon);
//   const R = 6378137; // Earth's radius in meters
//   const x = R * lon * (Math.PI / 180);
//   const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2));
//   console.log(x, y);
//   return [x, y];
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
//   const [constraints, setConstraints] = useState<Constraints>({
//     xmin: "",
//     ymin: "",
//     xmax: "",
//     ymax: "",
//   });

//   const view = MapViewRef.current!;

//   // ─── Helper: wrap lon/lat into the shape settingsRef expects ─────────
//   function setMapCenterLonLat(lon: number, lat: number) {
//     settingsRef.current.center = {
//       spatialReference: { wkid: 4326, latestWkid: 4326 },
//       x: lon,
//       y: lat,
//     };
//     settingsEvents.dispatchEvent(new Event("change"));
//   }

//   // ─── Snapshot current view when opening the settings panel ──────────
//   const toggleSettings = () => {
//     if (!openSettings && view) {
//       // center + zoom
//       const c = view.center as { x: number; y: number };
//       // alert(c.x + ", " + c.y);
//       setCenter({ x: String(c.x), y: String(c.y) });
//       setZoom(view.zoom);
//       // existing or current extent
//       const currentExtent = view.extent;
//       const geom = view.constraints.geometry as Extent | null;
//       setConstraints({
//         // xmin: String(geom?.xmin ?? currentExtent.xmin),
//         // ymin: String(geom?.ymin ?? currentExtent.ymin),
//         // xmax: String(geom?.xmax ?? currentExtent.xmax),
//         // ymax: String(geom?.ymax ?? currentExtent.ymax),
//         xmin: String(currentExtent.xmin),
//         ymin: String(currentExtent.ymin),
//         xmax: String(currentExtent.xmax),
//         ymax: String(currentExtent.ymax),
//       });
//     }
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

//     // 1) update the live MapView
//     // if (center.x && center.y) {
//     //   view.center = [+center.x, +center.y];
//     // }
//     // view.zoom = zoom;

//     if (xmin && ymin && xmax && ymax) {
//       view.constraints.geometry = new Extent({
//         xmin: +xmin,
//         ymin: +ymin,
//         xmax: +xmax,
//         ymax: +ymax,
//         spatialReference: view.spatialReference,
//       });
//     } else {
//       view.constraints.geometry = null;
//     }

//     // 2) persist into settingsRef
//     settingsRef.current.zoom = zoom;

//     setMapCenterLonLat(+center.x, +center.y);
//     settingsRef.current.constraints =
//       xmin && ymin && xmax && ymax
//         ? { xmin: +xmin, ymin: +ymin, xmax: +xmax, ymax: +ymax }
//         : null;

//     // 3) save to server
//     if (userEmail) {
//       const s = settingsRef.current;
//       // alert(s.zoom);
//       // mercatorToLonLat((s.center.x).toString(), (s.center.y).toString())
//       saveMapToServer(mapId, userEmail, {
//         zoom: s.zoom,
//         // center: mercatorToLonLat(
//         //   s.center.x.toString(),
//         //   s.center.y.toString()
//         // ) as [number, number],
//         center: [s.center.x, s.center.y] as [number, number],
//         constraints: s.constraints,
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
//         const g = items.find((g: any) => g.attributes.id === editingId);
//         if (g) {
//           setEditName(g.attributes.name);
//           const { r, g: grn, b, a } = g.symbol.color;
//           setEditColor(
//             `#${[r, grn, b]
//               .map((v) => v.toString(16).padStart(2, "0"))
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
//       .then(() => view.popup.open({ features: [graphic], location: target }));
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

//     // update label
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

//       const [cx, cy] = getPolygonCentroid(g.geometry.rings[0]);
//       (window as any).require(["esri/geometry/Point"], (P: any) => {
//         label.geometry = new P({
//           x: cx,
//           y: cy,
//           spatialReference: view.spatialReference,
//         });
//       });

//       rebuildBuckets(labelsLayer);
//     }

//     if (userEmail) {
//       const s = settingsRef.current;

//       console.log(s.center);
//       saveMapToServer(mapId, userEmail, {
//         zoom: s.zoom,
//         center: [s.center.x, s.center.y] as [number, number],
//         // center: [s.center.x, s.center.y] as [number, number],
//         constraints: s.constraints,
//       });
//     }
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
//       const s = settingsRef.current;
//       console.log(s);
//       setCenter({ x: String(s.center.x), y: String(s.center.y) });
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
//             zIndex: 9999,
//             bgcolor: "background.paper",
//             border: 1,
//             p: 1,
//             width: 300,
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
//             {/* here */}
//             <MapControls
//               centerX={center.x}
//               centerY={center.y}
//               cordinates={mercatorToLonLat(center.x, center.y)}
//               onCenterChange={handleCenterChange}
//               zoom={zoom}
//               onZoomChange={handleZoomChange}
//               constraints={constraints}
//               onConstraintChange={handleConstraintChange}
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
// ❌ no more centroid import here
import { rebuildBuckets } from "./bucketManager";
import Extent from "@arcgis/core/geometry/Extent";
import { useSession } from "next-auth/react";
import { useMapId } from "@/app/context/MapContext";
import { saveMapToServer } from "@/app/helper/saveMap";
import SettingsIcon from "@mui/icons-material/Settings";
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
    settingsRef.current.center = { spatialReference: sr, x, y };
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
    setOpenSettings((o) => !o);
  };

  // ─── Handlers for MapControls inputs ────────────────────────────────
  const handleCenterChange = (field: "x" | "y", value: string) =>
    setCenter((prev) => ({ ...prev, [field]: value }));
  const handleZoomChange = (value: number) => setZoom(value);
  const handleConstraintChange = (field: keyof Constraints, value: string) =>
    setConstraints((prev) => ({ ...prev, [field]: value }));

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
      view.constraints.geometry = null;
    }

    // Persist into settingsRef (store center in view SR)
    settingsRef.current.zoom = zoom;
    setMapCenterInViewSR(+center.x, +center.y);
    settingsRef.current.constraints =
      xmin && ymin && xmax && ymax
        ? { xmin: +xmin, ymin: +ymin, xmax: +xmax, ymax: +ymax }
        : null;

    // Save to server
    if (userEmail) {
      const s = settingsRef.current;
      saveMapToServer(mapId, userEmail, {
        zoom: s.zoom,
        center: [s.center.x, s.center.y] as [number, number],
        constraints: s.constraints,
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
        const g = items.find((g: any) => g.attributes.id === editingId);
        if (g) {
          setEditName(g.attributes.name);
          const { r, g: grn, b, a } = g.symbol.color;
          setEditColor(
            `#${[r, grn, b]
              .map((v) => v.toString(16).padStart(2, "0"))
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
      .then(() => view.popup.open({ features: [graphic], location: target }));
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

    if (userEmail) {
      const s = settingsRef.current;
      saveMapToServer(mapId, userEmail, {
        zoom: s.zoom,
        center: [s.center.x, s.center.y] as [number, number],
        constraints: s.constraints,
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
      const s = settingsRef.current;
      setCenter({ x: String(s.center.x), y: String(s.center.y) });
      setZoom(s.zoom);
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
            zIndex: 9999,
            bgcolor: "background.paper",
            border: 1,
            p: 1,
            width: 300,
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
            />
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
