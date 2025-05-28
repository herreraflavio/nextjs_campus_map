"use client";
import { useState, useEffect } from "react";
import { labelsLayerRef, finalizedLayerRef, MapViewRef } from "./arcgisRefs";
import Point from "@arcgis/core/geometry/Point";
import { getPolygonCentroid } from "./centroid";
import { rebuildBuckets } from "./bucketManager";

export default function Sidebar() {
  const [polygonList, setPolygonList] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#ffffff");
  const [editAlpha, setEditAlpha] = useState(0.6);
  const [editHTML, setEditHTML] = useState("");
  const [editFontSize, setEditFontSize] = useState(12); // NEW
  const [editHideAtZoomLevel, setHideAtZoomLevel] = useState(18); // NEW
  const [editShowAtZoomLevel, setShowAtZoomLevel] = useState(15); // NEW

  const view = MapViewRef.current;

  useEffect(() => {
    const handler = () => {
      const items = finalizedLayerRef.current?.graphics?.items ?? [];
      const sorted = items
        .slice()
        .sort((a: any, b: any) => a.attributes.order - b.attributes.order);
      setPolygonList(sorted);

      if (editingId) {
        const g = items.find((g: any) => g.attributes.id === editingId);
        if (g) {
          setEditName(g.attributes.name);

          // color & alpha
          const { r, g: green, b, a } = g.symbol.color;
          const hex = `#${[r, green, b]
            .map((v) => v.toString(16).padStart(2, "0"))
            .join("")}`;
          setEditColor(hex);
          setEditAlpha(typeof a === "number" ? a : 0.6);

          // popup HTML
          setEditHTML(g.popupTemplate.content);

          // **NEW**: fetch existing label font size
          const label = labelsLayerRef.current?.graphics.items.find(
            (l: any) => l.attributes.parentId === editingId
          );
          if (label) {
            const size = (label.symbol as any).font.size;
            setEditFontSize(typeof size === "number" ? size : 12);
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
    const view = MapViewRef.current!;
    const target = graphic.geometry.extent?.center || graphic.geometry;
    view
      .goTo({ target, zoom: 18 })
      .then(() => view.popup.open({ features: [graphic], location: target }));
  };

  const startEditing = (graphic: any) => {
    setEditingId(graphic.attributes.id);
  };

  const applyEdits = () => {
    if (!editingId) return;
    const layer = finalizedLayerRef.current!;
    const g = layer.graphics.find((gr: any) => gr.attributes.id === editingId);
    if (!g) return;

    // 1) update name, popup HTML, symbol color/alpha
    g.attributes.name = editName;
    g.popupTemplate.content = editHTML;

    const hex = editColor.slice(1);
    const r = parseInt(hex.substr(0, 2), 16);
    const g2 = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const newSym = (g.symbol as any).clone();
    newSym.color = [r, g2, b, parseFloat(editAlpha.toFixed(2))];
    g.symbol = newSym;

    // 2) update label text, font size, reposition
    const labelsLayer = labelsLayerRef.current!;
    const label = labelsLayer.graphics.find(
      (l: any) => l.attributes.parentId === editingId
    );
    if (label) {
      label.attributes = {
        ...label.attributes,
        name: editName,
        showAtZoom: editShowAtZoomLevel,
        hideAtZoom: editHideAtZoomLevel,
      };
      // text
      (label.symbol as any).text = editName;
      // **NEW** font size
      (label.symbol as any).font.size = editFontSize;

      // after you update text, font, reposition…
      label.attributes.showAtZoom = editShowAtZoomLevel;
      label.attributes.hideAtZoom = editHideAtZoomLevel;

      console.log(label.attributes.showAtZoom);
      console.log(label.attributes.hideAtZoom);

      // reposition
      const [cx, cy] = getPolygonCentroid(g.geometry.rings[0]);

      (window as any).require(
        ["esri/geometry/Point"],
        (AmdPoint: typeof __esri.Point) => {
          label.geometry = new AmdPoint({
            x: cx,
            y: cy,
            spatialReference: view.spatialReference,
          });
        }
      );
      // tell the graphics collection "hey, you changed"
      // (labelsLayer.graphics as any).emit("change");
      if (labelsLayerRef.current) {
        rebuildBuckets(labelsLayerRef.current);
      }
    }

    // 3) notify and reset
    finalizedLayerRef.events.dispatchEvent(new Event("change"));
    setEditingId(null);
  };

  const cancelEdits = () => {
    setEditingId(null);
  };

  return (
    <div>
      <h2>Polygons:</h2>
      <ul>
        {polygonList.map((poly) => (
          <li key={poly.attributes.id}>
            {poly.attributes.name}{" "}
            <button onClick={() => goTo(poly)}>Go to</button>{" "}
            <button onClick={() => startEditing(poly)}>Edit</button>
          </li>
        ))}
      </ul>

      {editingId && (
        <div
          style={{
            position: "absolute",
            top: 25,
            right: 25,
            zIndex: 999,
            background: "black",
            padding: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            borderRadius: 4,
            width: 260,
          }}
        >
          <h3>Edit Polygon</h3>

          <label>
            Name:
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={{ width: "100%", marginBottom: 8 }}
            />
          </label>

          <label>
            Fill Color:
            <input
              type="color"
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              style={{ width: "100%", marginBottom: 8 }}
            />
          </label>

          <label>
            Opacity:
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={editAlpha}
              onChange={(e) => setEditAlpha(+e.target.value)}
              style={{ width: "100%", marginBottom: 4 }}
            />
            <div style={{ fontSize: 12, textAlign: "right" }}>
              {editAlpha.toFixed(2)}
            </div>
          </label>

          <label>
            Font Size:
            <input
              type="number"
              min={6}
              max={48}
              value={editFontSize}
              onChange={(e) => setEditFontSize(+e.target.value)}
              style={{ width: "100%", marginBottom: 8 }}
            />
          </label>

          <label>
            Hide at zoomlevel:
            <input
              type="number"
              min={14}
              max={24}
              value={editHideAtZoomLevel}
              onChange={(e) => setHideAtZoomLevel(+e.target.value)}
              style={{ width: "100%", marginBottom: 8 }}
            />
          </label>

          <label>
            Show at zoomlevel:
            <input
              type="number"
              min={14}
              max={24}
              value={editShowAtZoomLevel}
              onChange={(e) => setShowAtZoomLevel(+e.target.value)}
              style={{ width: "100%", marginBottom: 8 }}
            />
          </label>

          <label>
            Popup HTML:
            <textarea
              value={editHTML}
              onChange={(e) => setEditHTML(e.target.value)}
              style={{ width: "100%", height: 160 }}
            />
          </label>

          <div style={{ textAlign: "right", marginTop: 8 }}>
            <button onClick={cancelEdits} style={{ marginRight: 8 }}>
              Cancel
            </button>
            <button onClick={applyEdits}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}
