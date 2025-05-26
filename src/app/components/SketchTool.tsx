"use client";

import { useRef, useState } from "react";
import {
  editingLayerRef,
  finalizedLayerRef,
  MapViewRef,
  GraphicRef,
} from "./map/arcgisRefs";

export default function ToggleSketchTool() {
  const sketchRef = useRef<any>(null);
  const [active, setActive] = useState(false);

  const toggleSketch = () => {
    const view = MapViewRef.current;
    const editLayer = editingLayerRef.current;
    const finalLayer = finalizedLayerRef.current;
    const Graphic = GraphicRef.current;
    if (!view || !editLayer || !finalLayer || !Graphic) return;

    if (!active) {
      // ── Move existing frozen into editing so they become editable ──
      finalLayer.graphics.items.forEach((g: any) => {
        const clone = new Graphic({
          geometry: g.geometry,
          symbol: g.symbol,
          attributes: g.attributes,
          popupTemplate: g.popupTemplate,
        });
        editLayer.add(clone);
      });
      finalLayer.removeAll();

      // ── Instantiate Sketch for creation & update on editingLayer ──
      (window as any).require(["esri/widgets/Sketch"], (Sketch: any) => {
        const sketch = new Sketch({
          view,
          layer: editLayer,
          availableCreateTools: ["polygon"],
          creationMode: "update",
          snappingOptions: {
            enabled: true,
            selfEnabled: true,
            featureEnabled: true,
            distance: 10,
          },
        });

        // On complete, leave the polygon where it is (we'll freeze on Stop)
        // On complete, give new polygons a default popup
        sketch.on("create", (evt: any) => {
          if (evt.state === "complete") {
            const g = evt.graphic;
            // default attributes
            g.attributes = {
              name: "User Polygon",
              description: "Drawn at " + new Date().toLocaleTimeString(),
            };
            // default popup template
            g.popupTemplate = {
              title: "{name}",
              content: `
           <p><b>Description:</b> {description}</p>
           <p><i>Coordinates:</i><br/>${JSON.stringify(g.geometry.rings)}</p>
         `,
            };
          }
        });

        view.ui.add(sketch, "top-right");
        sketchRef.current = sketch;
        setActive(true);
      });
    } else {
      // ── Freeze: move all edited graphics into finalizedLayer ──
      editLayer.graphics.items.forEach((g: any) => {
        const frozen = new Graphic({
          geometry: g.geometry,
          symbol: g.symbol,
          attributes: g.attributes,
          popupTemplate: g.popupTemplate,
        });
        finalLayer.add(frozen);
      });
      editLayer.removeAll();

      // ── Remove and cancel the Sketch widget ──
      sketchRef.current?.cancel();
      view.ui.remove(sketchRef.current);
      sketchRef.current = null;
      setActive(false);
    }
  };

  return (
    <button
      onClick={toggleSketch}
      style={{
        top: 10,
        left: 10,
        zIndex: 999,
        padding: "8px 12px",
        backgroundColor: active ? "#e63946" : "#2a9d8f",
        color: "#fff",
        border: "none",
        borderRadius: 4,
        cursor: "pointer",
      }}
    >
      {active ? "Stop Drawing" : "Start Drawing"}
    </button>
  );
}
