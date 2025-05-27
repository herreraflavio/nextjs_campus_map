"use client";
import { useState, useEffect } from "react";
import { finalizedLayerRef, MapViewRef } from "./arcgisRefs";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";

export default function Sidebar() {
  const [polygonList, setPolygonList] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#ffffff");
  const [editAlpha, setEditAlpha] = useState(0.6); // NEW

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

          const { r, g: green, b, a } = g.symbol.color;
          const hex = `#${[r, green, b]
            .map((val) => val.toString(16).padStart(2, "0"))
            .join("")}`;
          setEditColor(hex);
          setEditAlpha(typeof a === "number" ? a : 0.6); // NEW
        }
      }
    };

    finalizedLayerRef.events.addEventListener("change", handler);
    handler();
    return () =>
      finalizedLayerRef.events.removeEventListener("change", handler);
  }, [editingId]);

  const goTo = (graphic: any) => {
    const view = MapViewRef.current;
    const target = graphic.geometry.extent?.center || graphic.geometry;
    view
      ?.goTo({ target, zoom: 18 })
      .then(() => view.popup.open({ features: [graphic], location: target }));
  };

  const startEditing = (graphic: any) => {
    setEditingId(graphic.attributes.id);
    setEditName(graphic.attributes.name);

    const { r, g: green, b, a } = graphic.symbol.color;
    const hex = `#${[r, green, b]
      .map((val) => val.toString(16).padStart(2, "0"))
      .join("")}`;
    setEditColor(hex);
    setEditAlpha(typeof a === "number" ? a : 0.6); // NEW
  };

  const applyEdits = () => {
    if (!editingId) return;
    const layer = finalizedLayerRef.current!;
    const g = layer.graphics.find((gr: any) => gr.attributes.id === editingId);
    if (!g) return;

    g.attributes.name = editName;

    const h = editColor.slice(1);
    const r = parseInt(h.substr(0, 2), 16);
    const g2 = parseInt(h.substr(2, 2), 16);
    const b = parseInt(h.substr(4, 2), 16);

    const newSym = (g.symbol as any).clone();
    newSym.color = [r, g2, b, parseFloat(editAlpha.toFixed(2))];

    g.symbol = newSym;
    finalizedLayerRef.events!.dispatchEvent(new Event("change"));
    setEditingId(null);
  };

  const cancelEdits = () => setEditingId(null);

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
            color: "black",
            position: "absolute",
            right: 25,
            top: 25,
            zIndex: 999,
            backgroundColor: "#fff",
            padding: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            borderRadius: 4,
            width: 240,
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
            Alpha:
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={editAlpha}
              onChange={(e) => setEditAlpha(parseFloat(e.target.value))}
              style={{ width: "100%", marginBottom: 8 }}
            />
            <div style={{ fontSize: 12, textAlign: "right" }}>
              Opacity: {editAlpha.toFixed(2)}
            </div>
          </label>
          <div style={{ textAlign: "right" }}>
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
