// "use client";
// import { useState, useEffect } from "react";
// import { labelsLayerRef, finalizedLayerRef, MapViewRef } from "./arcgisRefs";
// import Point from "@arcgis/core/geometry/Point";
// import { getPolygonCentroid } from "./centroid";
// import { rebuildBuckets } from "./bucketManager";

// export default function Sidebar() {
//   const [polygonList, setPolygonList] = useState<any[]>([]);
//   const [editingId, setEditingId] = useState<string | null>(null);
//   const [editName, setEditName] = useState("");
//   const [editColor, setEditColor] = useState("#ffffff");
//   const [editAlpha, setEditAlpha] = useState(0.6);
//   const [editHTML, setEditHTML] = useState("");
//   const [editFontSize, setEditFontSize] = useState(12); // NEW
//   const [editHideAtZoomLevel, setHideAtZoomLevel] = useState(18); // NEW
//   const [editShowAtZoomLevel, setShowAtZoomLevel] = useState(15); // NEW

//   const view = MapViewRef.current;

//   useEffect(() => {
//     const handler = () => {
//       const items = finalizedLayerRef.current?.graphics?.items ?? [];
//       const sorted = items
//         .slice()
//         .sort((a: any, b: any) => a.attributes.order - b.attributes.order);
//       setPolygonList(sorted);

//       if (editingId) {
//         const g = items.find((g: any) => g.attributes.id === editingId);
//         if (g) {
//           setEditName(g.attributes.name);

//           // color & alpha
//           const { r, g: green, b, a } = g.symbol.color;
//           const hex = `#${[r, green, b]
//             .map((v) => v.toString(16).padStart(2, "0"))
//             .join("")}`;
//           setEditColor(hex);
//           setEditAlpha(typeof a === "number" ? a : 0.6);

//           // popup HTML
//           setEditHTML(g.popupTemplate.content);

//           // **NEW**: fetch existing label font size
//           const label = labelsLayerRef.current?.graphics.items.find(
//             (l: any) => l.attributes.parentId === editingId
//           );
//           if (label) {
//             const size = (label.symbol as any).font.size;
//             setEditFontSize(typeof size === "number" ? size : 12);
//           }
//         }
//       }
//     };

//     finalizedLayerRef.events.addEventListener("change", handler);
//     handler();
//     return () =>
//       finalizedLayerRef.events.removeEventListener("change", handler);
//   }, [editingId]);

//   const goTo = (graphic: any) => {
//     const view = MapViewRef.current!;
//     const target = graphic.geometry.extent?.center || graphic.geometry;
//     view
//       .goTo({ target, zoom: 18 })
//       .then(() => view.popup.open({ features: [graphic], location: target }));
//   };

//   const startEditing = (graphic: any) => {
//     setEditingId(graphic.attributes.id);
//   };

//   const applyEdits = () => {
//     if (!editingId) return;
//     const layer = finalizedLayerRef.current!;
//     const g = layer.graphics.find((gr: any) => gr.attributes.id === editingId);
//     if (!g) return;

//     // 1) update name, popup HTML, symbol color/alpha
//     g.attributes.name = editName;
//     g.popupTemplate.content = editHTML;

//     const hex = editColor.slice(1);
//     const r = parseInt(hex.substr(0, 2), 16);
//     const g2 = parseInt(hex.substr(2, 2), 16);
//     const b = parseInt(hex.substr(4, 2), 16);

//     const newSym = (g.symbol as any).clone();
//     newSym.color = [r, g2, b, parseFloat(editAlpha.toFixed(2))];
//     g.symbol = newSym;

//     // 2) update label text, font size, reposition
//     const labelsLayer = labelsLayerRef.current!;
//     const label = labelsLayer.graphics.find(
//       (l: any) => l.attributes.parentId === editingId
//     );
//     if (label) {
//       label.attributes = {
//         ...label.attributes,
//         name: editName,
//         showAtZoom: editShowAtZoomLevel,
//         hideAtZoom: editHideAtZoomLevel,
//       };
//       // text
//       (label.symbol as any).text = editName;
//       // **NEW** font size
//       (label.symbol as any).font.size = editFontSize;

//       // after you update text, font, reposition…
//       label.attributes.showAtZoom = editShowAtZoomLevel;
//       label.attributes.hideAtZoom = editHideAtZoomLevel;

//       console.log(label.attributes.showAtZoom);
//       console.log(label.attributes.hideAtZoom);

//       // reposition
//       const [cx, cy] = getPolygonCentroid(g.geometry.rings[0]);

//       (window as any).require(
//         ["esri/geometry/Point"],
//         (AmdPoint: typeof __esri.Point) => {
//           label.geometry = new AmdPoint({
//             x: cx,
//             y: cy,
//             spatialReference: view.spatialReference,
//           });
//         }
//       );
//       // tell the graphics collection "hey, you changed"
//       // (labelsLayer.graphics as any).emit("change");
//       if (labelsLayerRef.current) {
//         rebuildBuckets(labelsLayerRef.current);
//       }
//     }

//     // 3) notify and reset
//     finalizedLayerRef.events.dispatchEvent(new Event("change"));
//     setEditingId(null);
//   };

//   const cancelEdits = () => {
//     setEditingId(null);
//   };

//   return (
//     <div>
//       <h2
//         style={{ marginBottom: "0px", marginLeft: "20px", marginTop: "20px" }}
//       >
//         Polygons:
//       </h2>
//       <ul>
//         {polygonList.map((poly) => (
//           <li key={poly.attributes.id}>
//             {poly.attributes.name}{" "}
//             <button onClick={() => goTo(poly)}>Go to</button>{" "}
//             <button onClick={() => startEditing(poly)}>Edit</button>
//           </li>
//         ))}
//       </ul>

//       {editingId && (
//         <div
//           style={{
//             position: "absolute",
//             top: "90px",
//             right: 25,
//             zIndex: 999,
//             background: "white",
//             padding: 12,
//             boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
//             borderRadius: 4,
//             width: 260,
//           }}
//         >
//           <h3>Edit Polygon</h3>

//           <label>
//             Name:
//             <input
//               type="text"
//               value={editName}
//               onChange={(e) => setEditName(e.target.value)}
//               style={{ width: "100%", marginBottom: 8 }}
//             />
//           </label>

//           <label>
//             Fill Color:
//             <input
//               type="color"
//               value={editColor}
//               onChange={(e) => setEditColor(e.target.value)}
//               style={{ width: "100%", marginBottom: 8 }}
//             />
//           </label>

//           <label>
//             Opacity:
//             <input
//               type="range"
//               min={0}
//               max={1}
//               step={0.01}
//               value={editAlpha}
//               onChange={(e) => setEditAlpha(+e.target.value)}
//               style={{ width: "100%", marginBottom: 4 }}
//             />
//             <div style={{ fontSize: 12, textAlign: "right" }}>
//               {editAlpha.toFixed(2)}
//             </div>
//           </label>

//           <label>
//             Font Size:
//             <input
//               type="number"
//               min={6}
//               max={48}
//               value={editFontSize}
//               onChange={(e) => setEditFontSize(+e.target.value)}
//               style={{ width: "100%", marginBottom: 8 }}
//             />
//           </label>

//           <label>
//             Hide at zoomlevel:
//             <input
//               type="number"
//               min={14}
//               max={24}
//               value={editHideAtZoomLevel}
//               onChange={(e) => setHideAtZoomLevel(+e.target.value)}
//               style={{ width: "100%", marginBottom: 8 }}
//             />
//           </label>

//           <label>
//             Show at zoomlevel:
//             <input
//               type="number"
//               min={14}
//               max={24}
//               value={editShowAtZoomLevel}
//               onChange={(e) => setShowAtZoomLevel(+e.target.value)}
//               style={{ width: "100%", marginBottom: 8 }}
//             />
//           </label>

//           <label>
//             Popup HTML:
//             <textarea
//               value={editHTML}
//               onChange={(e) => setEditHTML(e.target.value)}
//               style={{ width: "100%", height: 160 }}
//             />
//           </label>

//           <div style={{ textAlign: "right", marginTop: 8 }}>
//             <button onClick={cancelEdits} style={{ marginRight: 8 }}>
//               Cancel
//             </button>
//             <button onClick={applyEdits}>Save</button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// "use client";

// import { useState, useEffect } from "react";
// import { labelsLayerRef, finalizedLayerRef, MapViewRef } from "./arcgisRefs";
// import Point from "@arcgis/core/geometry/Point";
// import { getPolygonCentroid } from "./centroid";
// import { rebuildBuckets } from "./bucketManager";
// import {
//   TextField,
//   Slider,
//   Typography,
//   Button,
//   InputLabel,
// } from "@mui/material";

// export default function Sidebar() {
//   const [polygonList, setPolygonList] = useState<any[]>([]);
//   const [editingId, setEditingId] = useState<string | null>(null);
//   const [editName, setEditName] = useState("");
//   const [editColor, setEditColor] = useState("#ffffff");
//   const [editAlpha, setEditAlpha] = useState(0.6);
//   const [editHTML, setEditHTML] = useState("");
//   const [editFontSize, setEditFontSize] = useState(12);
//   const [editHideAtZoomLevel, setHideAtZoomLevel] = useState(18);
//   const [editShowAtZoomLevel, setShowAtZoomLevel] = useState(15);

//   const view = MapViewRef.current;

//   useEffect(() => {
//     const handler = () => {
//       const items = finalizedLayerRef.current?.graphics?.items ?? [];
//       const sorted = items
//         .slice()
//         .sort((a: any, b: any) => a.attributes.order - b.attributes.order);
//       setPolygonList(sorted);

//       if (editingId) {
//         const g = items.find((g: any) => g.attributes.id === editingId);
//         if (g) {
//           setEditName(g.attributes.name);

//           const { r, g: green, b, a } = g.symbol.color;
//           const hex = `#${[r, green, b]
//             .map((v) => v.toString(16).padStart(2, "0"))
//             .join("")}`;
//           setEditColor(hex);
//           setEditAlpha(typeof a === "number" ? a : 0.6);
//           setEditHTML(g.popupTemplate.content);

//           const label = labelsLayerRef.current?.graphics.items.find(
//             (l: any) => l.attributes.parentId === editingId
//           );
//           if (label) {
//             const size = (label.symbol as any).font.size;
//             setEditFontSize(typeof size === "number" ? size : 12);
//           }
//         }
//       }
//     };

//     finalizedLayerRef.events.addEventListener("change", handler);
//     handler();
//     return () =>
//       finalizedLayerRef.events.removeEventListener("change", handler);
//   }, [editingId]);

//   const goTo = (graphic: any) => {
//     const target = graphic.geometry.extent?.center || graphic.geometry;
//     view
//       .goTo({ target, zoom: 18 })
//       .then(() => view.popup.open({ features: [graphic], location: target }));
//   };

//   const startEditing = (graphic: any) => {
//     setEditingId(graphic.attributes.id);
//   };

//   const applyEdits = () => {
//     if (!editingId) return;
//     const layer = finalizedLayerRef.current!;
//     const g = layer.graphics.find((gr: any) => gr.attributes.id === editingId);
//     if (!g) return;

//     g.attributes.name = editName;
//     g.popupTemplate.content = editHTML;

//     const hex = editColor.slice(1);
//     const r = parseInt(hex.substr(0, 2), 16);
//     const g2 = parseInt(hex.substr(2, 2), 16);
//     const b = parseInt(hex.substr(4, 2), 16);
//     const newSym = (g.symbol as any).clone();
//     newSym.color = [r, g2, b, parseFloat(editAlpha.toFixed(2))];
//     g.symbol = newSym;

//     const labelsLayer = labelsLayerRef.current!;
//     const label = labelsLayer.graphics.find(
//       (l: any) => l.attributes.parentId === editingId
//     );
//     if (label) {
//       label.attributes = {
//         ...label.attributes,
//         name: editName,
//         showAtZoom: editShowAtZoomLevel,
//         hideAtZoom: editHideAtZoomLevel,
//       };
//       (label.symbol as any).text = editName;
//       (label.symbol as any).font.size = editFontSize;

//       const [cx, cy] = getPolygonCentroid(g.geometry.rings[0]);
//       (window as any).require(
//         ["esri/geometry/Point"],
//         (AmdPoint: typeof __esri.Point) => {
//           label.geometry = new AmdPoint({
//             x: cx,
//             y: cy,
//             spatialReference: view.spatialReference,
//           });
//         }
//       );

//       if (labelsLayerRef.current) {
//         rebuildBuckets(labelsLayerRef.current);
//       }
//     }

//     finalizedLayerRef.events.dispatchEvent(new Event("change"));
//     setEditingId(null);
//   };

//   const cancelEdits = () => {
//     setEditingId(null);
//   };

//   return (
//     <div>
//       <h2
//         style={{ marginBottom: "0px", marginLeft: "20px", marginTop: "20px" }}
//       >
//         Polygons:
//       </h2>
//       <ul>
//         {polygonList.map((poly) => (
//           <li key={poly.attributes.id} style={{ marginBottom: 8 }}>
//             {poly.attributes.name}
//             <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
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
//             </div>
//           </li>
//         ))}
//       </ul>

//       {editingId && (
//         <div
//           style={{
//             position: "absolute",
//             top: "90px",
//             right: 25,
//             zIndex: 999,
//             background: "white",
//             padding: 12,
//             boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
//             borderRadius: 4,
//             width: 260,
//           }}
//         >
//           <h3>Edit Polygon</h3>

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
//               marginBottom: 8,
//               height: 40,
//               border: "none",
//             }}
//           />

//           <Typography gutterBottom>Opacity: {editAlpha.toFixed(2)}</Typography>
//           <Slider
//             value={editAlpha}
//             min={0}
//             max={1}
//             step={0.01}
//             onChange={(e, val) => setEditAlpha(val as number)}
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

//           <TextField
//             label="Hide at Zoom Level greater than:"
//             type="number"
//             fullWidth
//             inputProps={{ min: 14, max: 24 }}
//             value={editHideAtZoomLevel}
//             onChange={(e) => setHideAtZoomLevel(+e.target.value)}
//             size="small"
//             margin="dense"
//           />

//           <TextField
//             label="Hide at Zoom Level less than:"
//             type="number"
//             fullWidth
//             inputProps={{ min: 14, max: 24 }}
//             value={editShowAtZoomLevel}
//             onChange={(e) => setShowAtZoomLevel(+e.target.value)}
//             size="small"
//             margin="dense"
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

//           <div style={{ textAlign: "right", marginTop: 8 }}>
//             <Button
//               size="small"
//               onClick={cancelEdits}
//               style={{ marginRight: 8 }}
//             >
//               Cancel
//             </Button>
//             <Button size="small" variant="contained" onClick={applyEdits}>
//               Save
//             </Button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

"use client";

import { useState, useEffect } from "react";
import { labelsLayerRef, finalizedLayerRef, MapViewRef } from "./arcgisRefs";
import { getPolygonCentroid } from "./centroid";
import Point from "@arcgis/core/geometry/Point";
import { rebuildBuckets } from "./bucketManager";
import {
  TextField,
  Slider,
  Typography,
  Button,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Box,
} from "@mui/material";

export default function Sidebar() {
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

  const view = MapViewRef.current;

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

    // update polygon attributes
    g.attributes.name = editName;
    g.popupTemplate.content = editHTML;
    const hex = editColor.slice(1);
    const r = parseInt(hex.substr(0, 2), 16);
    const grn = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const newSym = (g.symbol as any).clone();
    newSym.color = [r, grn, b, +editAlpha.toFixed(2)];
    g.symbol = newSym;

    // update label
    const labelsLayer = labelsLayerRef.current!;
    const label = labelsLayer.graphics.find(
      (l: any) => l.attributes.parentId === editingId
    );
    if (label) {
      label.attributes.name = editName;
      if (minZoomEnabled) label.attributes.showAtZoom = +minZoomLevel;
      else delete label.attributes.showAtZoom;
      if (maxZoomEnabled) label.attributes.hideAtZoom = +maxZoomLevel;
      else delete label.attributes.hideAtZoom;

      (label.symbol as any).text = editName;
      (label.symbol as any).font.size = editFontSize;

      const [cx, cy] = getPolygonCentroid(g.geometry.rings[0]);
      (window as any).require(["esri/geometry/Point"], (P: any) => {
        label.geometry = new P({
          x: cx,
          y: cy,
          spatialReference: view.spatialReference,
        });
      });

      rebuildBuckets(labelsLayer);
    }

    finalizedLayerRef.events.dispatchEvent(new Event("change"));
    setEditingId(null);
  };

  const cancelEdits = () => setEditingId(null);

  return (
    <div>
      <h2 style={{ margin: "20px 0 0 20px" }}>Polygons:</h2>
      <ul>
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
        <div
          style={{
            position: "absolute",
            top: 90,
            right: 25,
            zIndex: 999,
            background: "white",
            padding: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            borderRadius: 4,
            width: 260,
          }}
        >
          <h3>Edit Polygon</h3>
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
              marginBottom: 8,
            }}
          />

          <Typography gutterBottom>Opacity: {editAlpha.toFixed(2)}</Typography>
          <Slider
            value={editAlpha}
            min={0}
            max={1}
            step={0.01}
            onChange={(e, val) => setEditAlpha(val as number)}
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
            label="Enable hide from zoom level less than"
          />
          <TextField
            label="Hide below zoom (inclusive)"
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
            label="Enable hide from zoom level more than"
          />
          <TextField
            label="Hide above zoom (exclusive)"
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

          <div style={{ textAlign: "right", marginTop: 8 }}>
            <Button size="small" onClick={cancelEdits} sx={{ mr: 1 }}>
              Cancel
            </Button>
            <Button size="small" variant="contained" onClick={applyEdits}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// "use client";

// import { useState, useEffect } from "react";
// import { labelsLayerRef, finalizedLayerRef, MapViewRef } from "./arcgisRefs";
// import Point from "@arcgis/core/geometry/Point";
// import { getPolygonCentroid } from "./centroid";
// import { rebuildBuckets } from "./bucketManager";
// import {
//   TextField,
//   Slider,
//   Typography,
//   Button,
//   InputLabel,
// } from "@mui/material";

// export default function Sidebar() {
//   const [polygonList, setPolygonList] = useState<any[]>([]);
//   const [editingId, setEditingId] = useState<string | null>(null);
//   const [editName, setEditName] = useState("");
//   const [editColor, setEditColor] = useState("#ffffff");
//   const [editAlpha, setEditAlpha] = useState(0.6);
//   const [editHTML, setEditHTML] = useState("");
//   // now allow empty to omit rule
//   const [minZoomLevel, setMinZoomLevel] = useState<string>(""); // show from this zoom (inclusive)
//   const [maxZoomLevel, setMaxZoomLevel] = useState<string>(""); // hide above this zoom (exclusive)
//   const [editFontSize, setEditFontSize] = useState(12);

//   const view = MapViewRef.current;

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
//           // existing zoom bounds
//           const label = labelsLayerRef.current?.graphics.items.find(
//             (l: any) => l.attributes.parentId === editingId
//           );
//           if (label) {
//             const size = (label.symbol as any).font.size;
//             setEditFontSize(typeof size === "number" ? size : 12);
//             // load existing bounds if any
//             setMinZoomLevel(
//               label.attributes.showAtZoom != null
//                 ? String(label.attributes.showAtZoom)
//                 : ""
//             );
//             setMaxZoomLevel(
//               label.attributes.hideAtZoom != null
//                 ? String(label.attributes.hideAtZoom)
//                 : ""
//             );
//           }
//         }
//       }
//     };
//     finalizedLayerRef.events.addEventListener("change", handler);
//     handler();
//     return () =>
//       finalizedLayerRef.events.removeEventListener("change", handler);
//   }, [editingId]);

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

//     // update name, html, color, alpha
//     g.attributes.name = editName;
//     g.popupTemplate.content = editHTML;
//     const hex = editColor.slice(1);
//     const r = parseInt(hex.substr(0, 2), 16);
//     const grn = parseInt(hex.substr(2, 2), 16);
//     const b = parseInt(hex.substr(4, 2), 16);
//     const newSym = (g.symbol as any).clone();
//     newSym.color = [r, grn, b, +editAlpha.toFixed(2)];
//     g.symbol = newSym;

//     // update label attributes
//     const labelsLayer = labelsLayerRef.current!;
//     const label = labelsLayer.graphics.find(
//       (l: any) => l.attributes.parentId === editingId
//     );
//     if (label) {
//       label.attributes.name = editName;
//       // handle optional bounds
//       if (minZoomLevel === "") delete label.attributes.showAtZoom;
//       else label.attributes.showAtZoom = +minZoomLevel;
//       if (maxZoomLevel === "") delete label.attributes.hideAtZoom;
//       else label.attributes.hideAtZoom = +maxZoomLevel;

//       // update text & font
//       (label.symbol as any).text = editName;
//       (label.symbol as any).font.size = editFontSize;

//       // reposition
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

//     finalizedLayerRef.events.dispatchEvent(new Event("change"));
//     setEditingId(null);
//   };

//   const cancelEdits = () => setEditingId(null);

//   return (
//     <div>
//       <h2 style={{ margin: "20px 0 0 20px" }}>Polygons:</h2>
//       <ul>
//         {polygonList.map((poly) => (
//           <li key={poly.attributes.id} style={{ margin: "8px 0" }}>
//             {poly.attributes.name}
//             <div style={{ display: "flex", gap: "8px", marginTop: 4 }}>
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
//             </div>
//           </li>
//         ))}
//       </ul>

//       {editingId && (
//         <div
//           style={{
//             position: "absolute",
//             top: 90,
//             right: 25,
//             zIndex: 999,
//             background: "white",
//             padding: 12,
//             boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
//             borderRadius: 4,
//             width: 260,
//           }}
//         >
//           <h3>Edit Polygon</h3>
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
//               marginBottom: 8,
//             }}
//           />

//           <Typography gutterBottom>Opacity: {editAlpha.toFixed(2)}</Typography>
//           <Slider
//             value={editAlpha}
//             min={0}
//             max={1}
//             step={0.01}
//             onChange={(e, val) => setEditAlpha(val as number)}
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

//           <TextField
//             label="Show from zoom level (inclusive)"
//             placeholder="e.g. 14"
//             fullWidth
//             value={minZoomLevel}
//             onChange={(e) => setMinZoomLevel(e.target.value)}
//             size="small"
//             margin="dense"
//           />

//           <TextField
//             label="Hide above zoom level (exclusive)"
//             placeholder="e.g. 18"
//             fullWidth
//             value={maxZoomLevel}
//             onChange={(e) => setMaxZoomLevel(e.target.value)}
//             size="small"
//             margin="dense"
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

//           <div style={{ textAlign: "right", marginTop: 8 }}>
//             <Button size="small" onClick={cancelEdits} sx={{ mr: 1 }}>
//               Cancel
//             </Button>
//             <Button size="small" variant="contained" onClick={applyEdits}>
//               Save
//             </Button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
