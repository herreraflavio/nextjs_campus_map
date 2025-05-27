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

  /** random [r,g,b,a] with 0.4 – 0.8 alpha */
  const makeRandomColor = (): number[] => {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    const a = 0.4 + Math.random() * 0.4; // 0.4-0.8
    return [r, g, b, parseFloat(a.toFixed(2))];
  };

  const toggleSketch = () => {
    const view = MapViewRef.current;
    const editLayer = editingLayerRef.current;
    const finalLayer = finalizedLayerRef.current;
    const Graphic = GraphicRef.current;
    if (!view || !editLayer || !finalLayer || !Graphic) return;

    /* ────────── ENTER EDIT MODE ────────── */
    if (!active) {
      /* move frozen → editing layer */
      finalLayer.graphics.items.forEach((g: any) =>
        editLayer.add(
          new Graphic({
            geometry: g.geometry,
            symbol: g.symbol,
            attributes: { ...g.attributes },
            popupTemplate: g.popupTemplate,
          })
        )
      );
      finalLayer.removeAll();

      /* AMD-load Sketch (same build as map) */
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

        /* give new polygons an ID, RGBA & popup */
        // sketch.on("create", (evt: any) => {
        //   if (evt.state !== "complete") return;

        //   const g = evt.graphic;
        //   const rgba = makeRandomColor();

        //   g.attributes = {
        //     id: crypto.randomUUID(),
        //     name: "New Polygon",
        //     description: `Drawn at ${new Date().toLocaleTimeString()}`,
        //     color: rgba, // persist
        //   };

        //   g.symbol = {
        //     type: "simple-fill",
        //     color: rgba,
        //     outline: { color: [0, 0, 0, 1], width: 1 },
        //   };

        //   g.popupTemplate = {
        //     title: "{name}",
        //     content: /* html */ `
        //       <p><b>Description:</b> {description}</p>
        //       <p><i>Coordinates:</i><br/>${JSON.stringify(
        //         g.geometry.rings
        //       )}</p>`,
        //   };
        // });

        sketch.on("create", (evt: any) => {
          if (evt.state !== "complete") return;

          const g = evt.graphic;

          // Try to preserve any existing color
          let rgba: number[] | undefined;

          if (typeof g.symbol?.color?.toRgba === "function") {
            rgba = g.symbol.color.toRgba();
          } else if (Array.isArray(g.attributes?.color)) {
            rgba = g.attributes.color;
          } else {
            rgba = makeRandomColor(); // fallback
          }

          g.attributes = {
            ...g.attributes,
            id: crypto.randomUUID(),
            name: g.attributes?.name ?? "New Polygon",
            description:
              g.attributes?.description ??
              `Drawn at ${new Date().toLocaleTimeString()}`,
            color: rgba,
          };

          g.symbol = {
            type: "simple-fill",
            color: rgba,
            outline: g.symbol?.outline ?? { color: [0, 0, 0, 1], width: 1 },
          };

          g.popupTemplate = {
            title: "{name}",
            content: /* html */ `
      <p><b>Description:</b> {description}</p>
      <p><i>Coordinates:</i><br/>${JSON.stringify(g.geometry.rings)}</p>`,
          };
        });

        view.ui.add(sketch, "top-right");
        sketchRef.current = sketch;
        setActive(true);
      });

      return;
    }

    /* ────────── EXIT EDIT MODE ────────── */
    editLayer.graphics.items.forEach((g: any, idx: number) => {
      const order = g.attributes.order ?? idx;

      /** get full RGBA, preserving α */
      const fillColor: number[] =
        typeof g.symbol?.color?.toRgba === "function"
          ? g.symbol.color.toRgba()
          : Array.isArray(g.attributes.color)
          ? g.attributes.color
          : makeRandomColor();

      const name = g.attributes.name ?? `Polygon ${order + 1}`;

      finalLayer.add(
        new Graphic({
          geometry: g.geometry,
          symbol: {
            type: "simple-fill",
            color: fillColor,
            outline: g.symbol?.outline ?? { color: [0, 0, 0, 1], width: 1 },
          },
          attributes: {
            ...g.attributes,
            id: g.attributes.id,
            order,
            name,
            color: fillColor, // keep RGBA
          },
          popupTemplate: g.popupTemplate,
        })
      );
    });

    editLayer.removeAll();
    finalizedLayerRef.events?.dispatchEvent(new Event("change"));

    /* tear down sketch */
    if (sketchRef.current) {
      sketchRef.current.cancel();
      sketchRef.current.destroy();
      view.ui.remove(sketchRef.current);
      sketchRef.current = null;
    }
    setActive(false);
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
