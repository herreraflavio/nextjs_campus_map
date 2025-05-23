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
            "esri/layers/MediaLayer",
            "esri/layers/support/ImageElement",
            "esri/layers/support/ExtentAndRotationGeoreference",
            "esri/geometry/Extent",
          ],
          (
            Map: any,
            MapView: any,
            Graphic: any,
            GraphicsLayer: any,
            MediaLayer: any,
            ImageElement: any,
            ExtentAndRotationGeoreference: any,
            Extent: any
          ) => {
            const map = new Map({ basemap: "streets-navigation-vector" });
            const view = new MapView({
              container: mapDiv.current,
              map,
              center: [-120.422045, 37.365169],
              zoom: 16,
            });

            // 1) Create an editing layer (for Sketch)
            const editingLayer = new GraphicsLayer({ id: "editing" });
            // 2) Create a finalized layer (static graphics)
            const finalizedLayer = new GraphicsLayer({ id: "finalized" });

            const imgLowRes = new ImageElement({
              image: "https://campusmap.flavioherrera.com/testing/map4.png",
              georeference: new ExtentAndRotationGeoreference({
                extent: new Extent({
                  xmin: -13406409.47,
                  ymin: 4488936.09,
                  xmax: -13404924.08,
                  ymax: 4490876.39,
                  spatialReference: { wkid: 102100 },
                }),
                rotation: 90,
              }),
            });

            // 4. Add it to a MediaLayer
            const mediaLayer = new MediaLayer({
              source: [imgLowRes],
            });

            map.addMany([finalizedLayer, editingLayer, mediaLayer]);

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
