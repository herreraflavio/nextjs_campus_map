"use client";

import { useState, useEffect } from "react";
import {
  labelsLayerRef,
  finalizedLayerRef,
  MapViewRef,
  settingsRef,
  settingsEvents,
} from "./arcgisRefs";
import { getPolygonCentroid } from "./centroid";
import Point from "@arcgis/core/geometry/Point";
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
  const { data: session, status } = useSession();
  const userEmail = session?.user?.email;
  const mapId = useMapId();

  // Map Settings state
  const [openSettings, setOpenSettings] = useState(false);
  // Map center
  const [center, setCenter] = useState({ x: "", y: "" });
  // Zoom level
  const [zoom, setZoom] = useState(10);
  // Extent constraints
  const [constraints, setConstraints] = useState<Constraints>({
    xmin: "",
    ymin: "",
    xmax: "",
    ymax: "",
  });

  const view = MapViewRef.current;

  // when user toggles settings open, snapshot current view
  const toggleSettings = () => {
    if (!openSettings && view) {
      // snapshot center
      const c = view.center as { x: number; y: number };
      setCenter({ x: String(c.x), y: String(c.y) });
      // snapshot zoom
      setZoom(view.zoom);
      // snapshot constraints (if any)
      const geom = view.constraints.geometry as Extent | null;
      if (geom) {
        setConstraints({
          xmin: String(geom.xmin),
          ymin: String(geom.ymin),
          xmax: String(geom.xmax),
          ymax: String(geom.ymax),
        });
      } else {
        setConstraints({ xmin: "", ymin: "", xmax: "", ymax: "" });
      }
    }
    setOpenSettings((o) => !o);
  };

  const handleCenterChange = (field: "x" | "y", value: string) =>
    setCenter((prev) => ({ ...prev, [field]: value }));

  const handleZoomChange = (value: number) => setZoom(value);

  const handleConstraintChange = (field: keyof Constraints, value: string) =>
    setConstraints((prev) => ({ ...prev, [field]: value }));

  // const applySettings = () => {
  //   // apply center
  //   if (center.x !== "" && center.y !== "") {
  //     view.center = [Number(center.x), Number(center.y)];
  //   }
  //   // apply zoom
  //   view.zoom = zoom;
  //   // apply constraints only if all four are set
  //   const { xmin, ymin, xmax, ymax } = constraints;
  //   if (xmin && ymin && xmax && ymax) {
  //     view.constraints.geometry = new Extent({
  //       xmin: Number(xmin),
  //       ymin: Number(ymin),
  //       xmax: Number(xmax),
  //       ymax: Number(ymax),
  //       spatialReference: view.spatialReference,
  //     });
  //   }
  //   setOpenSettings(false);
  // };
  const applySettings = () => {
    /* ───── 1. apply to the live view ───── */
    if (center.x && center.y) view.center = [+center.x, +center.y];
    view.zoom = zoom;

    const { xmin, ymin, xmax, ymax } = constraints;
    if (xmin && ymin && xmax && ymax) {
      view.constraints.geometry = new Extent({
        xmin: +xmin,
        ymin: +ymin,
        xmax: +xmax,
        ymax: +ymax,
        spatialReference: view.spatialReference,
      });
    }

    /* ───── 2. persist in our refs and broadcast ───── */
    settingsRef.current = {
      zoom,
      center: [+center.x, +center.y] as [number, number],
      constraints:
        xmin && ymin && xmax && ymax
          ? { xmin: +xmin, ymin: +ymin, xmax: +xmax, ymax: +ymax }
          : null,
    };
    settingsEvents.dispatchEvent(new Event("change"));

    /* ───── 3. save to server together with polygons/labels ───── */
    if (userEmail) {
      saveMapToServer(mapId, userEmail, settingsRef.current);
    }

    setOpenSettings(false);
  };

  // console.log("mapId: " + mapId + "owner: " + userEmail);

  // alert(useMapId());

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

  useEffect(() => {
    const sync = () => {
      const s = settingsRef.current;
      setCenter({ x: String(s.center[0]), y: String(s.center[1]) });
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

    g.attributes.description = editHTML;
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
    if (userEmail) {
      saveMapToServer(mapId, userEmail, settingsRef.current);
    }

    finalizedLayerRef.events.dispatchEvent(new Event("change"));
    setEditingId(null);
  };

  const cancelEdits = () => setEditingId(null);

  return (
    <Box
      sx={{
        height: "100%", // fill the height of the parent flex item
        overflowY: "auto", // enable vertical scrolling

        p: 2, // optional padding
      }}
    >
      {/* <div
        style={{
          position: "absolute",
          left: "260px",
          zIndex: "9999",
          backgroundColor: "white",
          padding: "5px",
          border: "solid",
          bottom: "25px",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
          }}
        >
          <div>╔═</div>
          <h3 style={{ margin: "0px 5px 0 5px" }}> Map Settings </h3>
          <div>═╗</div>
        </div>

        <Box width="100%">
          <MapControls
            centerX={center.x}
            centerY={center.y}
            onCenterChange={handleCenterChange}
            zoom={zoom}
            onZoomChange={handleZoomChange}
            constraints={constraints}
            onConstraintChange={handleConstraintChange}
          />
        </Box>
      </div> */}
      {/* Gear icon */}
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

      {/* Settings panel */}
      {openSettings && (
        <Box
          sx={{
            position: "absolute",
            bottom: 25,
            left: 260 + 60,
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
            <Typography variant="h6" component="div" sx={{ m: 0 }}>
              Map Settings
            </Typography>
            <div>═╗</div>
          </Box>

          <Box width="100%" mt={1}>
            <MapControls
              centerX={center.x}
              centerY={center.y}
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
      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "space-between",
        }}
      >
        <div>╔═</div>
        <h3 style={{ margin: "0px 5px 0 5px" }}> Polygons </h3>
        <div>═╗</div>
      </div>
      <ul style={{ paddingLeft: "20px" }}>
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
    </Box>
  );
}
