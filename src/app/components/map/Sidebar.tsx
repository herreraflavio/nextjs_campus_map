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
