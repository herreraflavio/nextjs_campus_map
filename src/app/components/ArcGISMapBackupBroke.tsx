"use client";

import { useEffect, useRef } from "react";
import {
  editingLayerRef,
  finalizedLayerRef,
  MapViewRef,
  GraphicRef,
  setFinalizedLayer,
  setLabelsLayer,
  settingsRef,
  settingsEvents,
} from "./map/arcgisRefs";
import "./ArcGISMap.css";

import { getPolygonCentroid } from "./map/centroid";
import { rebuildBuckets, labelBuckets } from "./map/bucketManager";

interface SpatialReference {
  wkid: number;
  latestWkid: number;
}

interface Polygon {
  attributes: Record<string, any>;
  geometry: {
    type: string;
    rings: number[][][];
    spatialReference: SpatialReference;
  };
  symbol: {
    type: string;
    color: number[]; // [r,g,b,a]
    outline: {
      color: number[]; // [r,g,b,a]
      width: number;
    };
  };
}

interface Label {
  attributes: {
    parentId: string;
    showAtZoom: number | null;
    hideAtZoom: number | null;
    fontSize: number;
    color: number[]; // [r,g,b,a]
    haloColor: number[]; // [r,g,b,a]
    haloSize: number;
    text: string;
  };
  geometry: {
    type: string;
    x: number;
    y: number;
    spatialReference: SpatialReference;
  };
}

interface ExportBody {
  userEmail: string;
  polygons: Polygon[];
  labels: Label[];
  settings: {
    zoom: number;
    center: {
      spatialReference: SpatialReference;
      x: number;
      y: number;
    };
    constraints: {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    } | null;
  };
}

export default function ArcGISMap({
  userEmail,
  polygons,
  labels,
  settings,
}: ExportBody) {
  const mapDiv = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const intv = setInterval(() => {
      if (!(window as any).require) return;
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
          Point: typeof __esri.Point
        ) => {
          /* ─── Map & View ─── */
          const map = new Map({ basemap: "satellite" });
          // const view = new MapView({
          //   container: mapDiv.current,
          //   map,
          //   center: settings.center,
          //   zoom: settings.zoom,
          //   constraints: settings.constraints
          //     ? { geometry: new Extent({ ...settings.constraints, spatialReference: view.spatialReference }) }
          //     : undefined,
          // });
          const view = new MapView({
            container: mapDiv.current,
            map,
            center: settings.center,
            zoom: settings.zoom,
          });

          // Set constraints after view is created
          if (settings.constraints) {
            view.constraints = {
              geometry: new Extent({
                ...settings.constraints,
                spatialReference: view.spatialReference,
              }),
            };
          }

          /* ─── Layers ─── */
          const editingLayer = new GraphicsLayer({ id: "editing" });
          const finalizedLayer = new GraphicsLayer({ id: "finalized" });
          const labelsLayer = new GraphicsLayer({ id: "labels" });

          // Background image
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
          const mediaLayer = new MediaLayer({ source: [imgLowRes] });

          map.addMany([mediaLayer, finalizedLayer, editingLayer, labelsLayer]);

          view.when(() => {
            // 1. apply view settings
            view.center = settings.center;
            view.zoom = settings.zoom;
            if (settings.constraints) {
              view.constraints.geometry = new Extent({
                ...settings.constraints,
                spatialReference: view.spatialReference,
              });
            }

            // 2. stash current settings
            settingsRef.current = settings;
            settingsEvents.dispatchEvent(new Event("change"));

            // 3. draw polygons
            polygons.forEach((p) => {
              finalizedLayer.add(
                new Graphic({
                  geometry: p.geometry,
                  symbol: p.symbol,
                  attributes: p.attributes,
                  popupTemplate: {
                    title: p.attributes.name,
                    content: p.attributes.description,
                  },
                })
              );
            });

            // 4. draw labels
            labels.forEach((l) => {
              labelsLayer.add(
                new Graphic({
                  geometry: {
                    type: "point",
                    x: l.geometry.x,
                    y: l.geometry.y,
                    spatialReference: view.spatialReference,
                  },
                  symbol: {
                    type: "text",
                    text: l.attributes.text,
                    color: l.attributes.color,
                    haloColor: l.attributes.haloColor,
                    haloSize: l.attributes.haloSize,
                    font: {
                      size: l.attributes.fontSize,
                      family: "sans-serif",
                      weight: "bold",
                    },
                  },
                  attributes: {
                    parentId: l.attributes.parentId,
                    showAtZoom: l.attributes.showAtZoom,
                    hideAtZoom: l.attributes.hideAtZoom,
                  },
                })
              );
            });

            // 5. bucketize & visibility
            rebuildBuckets(labelsLayer);
            view.watch("zoom", (z: number) => {
              labelBuckets.forEach((b) =>
                b.labels.forEach(
                  (lbl) => (lbl.visible = z >= b.minZoom && z <= b.maxZoom)
                )
              );
            });
          });

          // expose refs
          editingLayerRef.current = editingLayer;
          setFinalizedLayer(finalizedLayer);
          setLabelsLayer(labelsLayer);
          GraphicRef.current = Graphic;
          MapViewRef.current = view;
        }
      );
    }, 100);

    return () => clearInterval(intv);
  }, [polygons, labels, settings]);

  return (
    <div className="map-wrapper">
      <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
