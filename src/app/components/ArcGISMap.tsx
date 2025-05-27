"use client";
import { useEffect, useRef } from "react";
import {
  editingLayerRef,
  MapViewRef,
  finalizedLayerRef,
  GraphicRef,
} from "./map/arcgisRefs";

import { setFinalizedLayer, setLabelsLayer } from "./map/arcgisRefs";

import { getPolygonCentroid } from "./map/centroid";

import Point from "@arcgis/core/geometry/Point";

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
            "esri/geometry/Point",
          ],
          (
            Map: any,
            MapView: any,
            Graphic: any,
            GraphicsLayer: any,
            MediaLayer: any,
            ImageElement: any,
            ExtentAndRotationGeoreference: any,
            Extent: any,
            Point: any
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
            const labelsLayer = new GraphicsLayer({ id: "labels" });

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

            map.addMany([
              mediaLayer,
              finalizedLayer,
              editingLayer,
              labelsLayer,
            ]);

            // store refs
            editingLayerRef.current = editingLayer;
            setFinalizedLayer(finalizedLayer);
            setLabelsLayer(labelsLayer);

            finalizedLayerRef.events.addEventListener("change", () => {
              const polys = finalizedLayer.graphics.items; // all polygons
              const labels = labelsLayer.graphics.items; // all labels
              labels.forEach((label: any) => {
                const pid = label.attributes.parentId;
                const poly = polys.find((p: any) => p.attributes.id === pid);
                if (!poly) return;
                // compute new centroid
                const [cx, cy] = getPolygonCentroid(poly.geometry.rings[0]);
                // reposition label (use real Point class)
                label.geometry = new Point({
                  x: cx,
                  y: cy,
                  spatialReference: poly.geometry.spatialReference,
                });
              });
            });
            GraphicRef.current = Graphic;
            MapViewRef.current = view;
          }
        );
      }
    }, 100);

    return () => clearInterval(intv);
  }, []);

  return <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />;
}
