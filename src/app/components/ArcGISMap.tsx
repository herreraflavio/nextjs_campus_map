"use client";

import { useEffect, useRef } from "react";
import {
  editingLayerRef,
  MapViewRef,
  finalizedLayerRef,
  GraphicRef,
  setFinalizedLayer,
  setLabelsLayer,
} from "./map/arcgisRefs";
import "./ArcGISMap.css";
import { useMapId } from "@/app/context/MapContext";

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
    center: [x: number, y: number];
    constraints: {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    } | null;
  };
}

// helper to convert Web Mercator (EPSG:3857) → lon/lat in degrees (EPSG:4326)
function mercatorToLonLat(x: number, y: number): [number, number] {
  const R = 6378137; // Earth's radius in meters
  const lon = (x / R) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);
  return [lon, lat];
}

export default function ArcGISMap(mapData: ExportBody) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapId = useMapId();

  console.log(mapData);

  useEffect(() => {
    // Wait until the ArcGIS AMD loader is available
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
          /* ─────────── Map & View ─────────── */
          const map = new Map({ basemap: "satellite" });

          console.log(mapData.settings.center);
          let cords = mapData.settings.center;
          console.log(cords[0], cords[1]);

          let centerCoords = mercatorToLonLat(cords[0], cords[1]);
          //let centerCoords = [cords[0], cords[1]];

          console.log(centerCoords);
          const view = new MapView({
            container: mapDiv.current,
            map,
            center: centerCoords,
            zoom: mapData.settings.zoom,
            constraints: {
              geometry: {
                type: "extent",
                xmin: mapData.settings.constraints?.xmin, // Adjust to fit UC Merced's bounding coordinates
                ymin: mapData.settings.constraints?.ymin,
                xmax: mapData.settings.constraints?.xmax,
                ymax: mapData.settings.constraints?.ymax,
                spatialReference: { wkid: 3857 },
              },
            },
          });

          /* ─────────── Layers ─────────── */
          const editingLayer = new GraphicsLayer({ id: "editing" });
          const finalizedLayer = new GraphicsLayer({ id: "finalized" });
          const labelsLayer = new GraphicsLayer({ id: "labels" });

          // (optional) background image
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

          /* ─────────── Helper: Set label visibility ─────────── */
          const applyLabelVisibility = (zoom: number) => {
            labelBuckets.forEach((bucket) => {
              const show = zoom >= bucket.minZoom && zoom <= bucket.maxZoom;
              bucket.labels.forEach((lbl) => (lbl.visible = show));
            });
          };

          /* ─────────── Load polygons & labels ─────────── */
          fetch(`/api/maps/${mapId}`)
            .then((res) => res.json())
            .then(
              (data: { polygons: any[]; labels: any[]; settings: any[] }) => {
                // 1) polygons
                data.polygons.forEach((p) => {
                  const polyGraphic = new Graphic({
                    geometry: p.geometry,
                    symbol: p.symbol,
                    attributes: p.attributes,
                    popupTemplate: {
                      title: p.attributes.name,
                      content: p.attributes.description,
                    },
                  });
                  finalizedLayer.add(polyGraphic);
                });

                // 2) labels
                data.labels.forEach((l: any) => {
                  const labelGraphic = new Graphic({
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
                  });
                  labelsLayer.add(labelGraphic);
                });

                // Build buckets and immediately sync visibility
                rebuildBuckets(labelsLayer);

                // Wait until the first render so view.zoom is correct
                view.when(() => applyLabelVisibility(view.zoom));

                finalizedLayerRef.events.dispatchEvent(new Event("change"));
              }
            )
            .catch((err) =>
              console.error("Error loading polygons/labels:", err)
            );

          /* ─────────── Keep labels in sync while zooming ─────────── */
          view.watch("zoom", (z: number) => applyLabelVisibility(z));

          /* ─────────── Rebuild buckets & visibility on label edits ─────────── */
          labelsLayer.graphics.on("change", () => {
            rebuildBuckets(labelsLayer);
            applyLabelVisibility(view.zoom);
          });

          /* ─────────── Reposition labels when polygons move ─────────── */
          finalizedLayer.graphics.on("change", () => {
            const polys = finalizedLayer.graphics.items;
            const labels = labelsLayer.graphics.items;

            labels.forEach((label: any) => {
              const pid = label.attributes.parentId;
              const poly = polys.find((p: any) => p.attributes.id === pid);
              if (!poly) return;

              const [cx, cy] = getPolygonCentroid(poly.geometry.rings[0]);
              (window as any).require(
                ["esri/geometry/Point"],
                (Point: typeof __esri.Point) => {
                  label.geometry = new Point({
                    x: cx,
                    y: cy,
                    spatialReference: poly.geometry.spatialReference,
                  });
                }
              );
            });
          });

          /* ─────────── Expose refs for other components ─────────── */
          editingLayerRef.current = editingLayer;
          setFinalizedLayer(finalizedLayer);
          setLabelsLayer(labelsLayer);
          GraphicRef.current = Graphic;
          MapViewRef.current = view;
        }
      );
    }, 100);

    return () => clearInterval(intv);
  }, [mapId]);

  return <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />;
}
