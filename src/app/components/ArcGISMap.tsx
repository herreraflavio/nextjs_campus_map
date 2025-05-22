"use client";
import { useEffect, useRef } from "react";
import {
  editingLayerRef,
  finalizedLayerRef,
  MapViewRef,
  GraphicRef,
} from "./map/arcgisRefs";

export default function ArcGISMap() {
  const mapDiv = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const intv = setInterval(() => {
      if ((window as any).require) {
        clearInterval(intv);

        (window as any).require(
          [
            "esri/Map",
            "esri/views/MapView",
            "esri/Graphic",
            "esri/layers/GraphicsLayer",
          ],
          (Map: any, MapView: any, Graphic: any, GraphicsLayer: any) => {
            const map = new Map({ basemap: "streets-navigation-vector" });
            const view = new MapView({
              container: mapDiv.current,
              map,
              center: [-120.3, 37.3],
              zoom: 14,
            });

            // 1) Create an editing layer (for Sketch)
            const editingLayer = new GraphicsLayer({ id: "editing" });
            // 2) Create a finalized layer (static graphics)
            const finalizedLayer = new GraphicsLayer({ id: "finalized" });
            map.addMany([finalizedLayer, editingLayer]);

            // store refs
            editingLayerRef.current = editingLayer;
            finalizedLayerRef.current = finalizedLayer;
            GraphicRef.current = Graphic;
            MapViewRef.current = view;
          }
        );
      }
    }, 100);

    return () => clearInterval(intv);
  }, []);

  return <div ref={mapDiv} style={{ width: "100%", height: "100vh" }} />;
}
