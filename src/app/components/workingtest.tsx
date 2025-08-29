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
import { rebuildBuckets, labelBuckets } from "./map/bucketManager";

interface SpatialReference {
  wkid: number;
  latestWkid: number;
}
interface PolygonDTO {
  attributes: Record<string, any>;
  geometry: {
    type: string;
    rings: number[][][];
    spatialReference: SpatialReference;
  };
  symbol: {
    type: string;
    color: number[]; // [r,g,b,a]
    outline: { color: number[]; width: number };
  };
}
interface LabelDTO {
  attributes: {
    parentId: string;
    showAtZoom: number | null;
    hideAtZoom: number | null;
    fontSize: number;
    color: number[];
    haloColor: number[];
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
  polygons: PolygonDTO[];
  labels: LabelDTO[];
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

export default function ArcGISMap(mapData: ExportBody) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapId = useMapId();

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
          "esri/geometry/Polygon",
          "esri/geometry/support/webMercatorUtils",
          "esri/geometry/geometryEngine",
          "esri/layers/FeatureLayer",
        ],
        (
          EsriMap: any, // ⬅️ renamed (no clash with JS Map)
          MapView: any,
          Graphic: any,
          GraphicsLayer: any,
          MediaLayer: any,
          ImageElement: any,
          ExtentAndRotationGeoreference: any,
          Extent: any,
          Point: typeof __esri.Point,
          Polygon: typeof __esri.Polygon, // ⬅️ need real Polygon ctor
          webMercatorUtils: any,
          geometryEngine: any,
          FeatureLayer: any
        ) => {
          /* ─────────── Helpers ─────────── */
          const isLonLat = (x: number, y: number) =>
            Math.abs(x) <= 180 && Math.abs(y) <= 90;

          const toViewSR = (geom: __esri.Geometry | any): __esri.Geometry => {
            const wkid = geom?.spatialReference?.wkid;
            if (wkid === 3857 || wkid === 102100) return geom;
            if (wkid === 4326)
              return webMercatorUtils.geographicToWebMercator(geom);
            // If it's a point-ish object and looks like lon/lat, convert
            if (
              geom?.x !== undefined &&
              geom?.y !== undefined &&
              isLonLat(geom.x, geom.y)
            ) {
              return webMercatorUtils.geographicToWebMercator(
                new Point({
                  x: geom.x,
                  y: geom.y,
                  spatialReference: { wkid: 4326 },
                })
              );
            }
            return geom;
          };

          const computeLabelPoint = (poly: __esri.Polygon): __esri.Point => {
            try {
              const p = geometryEngine.labelPoints(poly);
              if (p)
                return new Point({
                  x: p.x,
                  y: p.y,
                  spatialReference: { wkid: 3857 },
                });
            } catch {}
            const c1 = (poly as any).centroid;
            if (c1)
              return new Point({
                x: c1.x,
                y: c1.y,
                spatialReference: { wkid: 3857 },
              });
            if (poly.extent?.center)
              return new Point({
                x: poly.extent.center.x,
                y: poly.extent.center.y,
                spatialReference: { wkid: 3857 },
              });
            // bbox fallback
            const ring = poly.rings?.[0] ?? [];
            let minX = Infinity,
              maxX = -Infinity,
              minY = Infinity,
              maxY = -Infinity;
            for (const [x, y] of ring) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
            return new Point({
              x: (minX + maxX) / 2,
              y: (minY + maxY) / 2,
              spatialReference: { wkid: 3857 },
            });
          };

          const createTextSymbol = (attrs: any) => ({
            type: "text",
            text: attrs.text,
            color: attrs.color ?? [0, 0, 0, 1],
            haloColor: attrs.haloColor ?? [255, 255, 255, 1],
            haloSize: attrs.haloSize ?? 2,
            font: {
              size: attrs.fontSize ?? 12,
              family: "sans-serif",
              weight: "bold",
            },
          });

          var featureLayer = new FeatureLayer({
            url: "https://services2.arcgis.com/wx8u046p68e0iGuj/arcgis/rest/services/housing_hall_for_arcgis_XYTableToPoint/FeatureServer",
            outFields: ["*"], // ensure fields are available to the popup
            popupEnabled: true, // allow popups
          });

          /* ─────────── Map & View ─────────── */
          const map = new EsriMap({
            basemap: "satellite",
            layers: [featureLayer],
          });

          // Normalize center to 3857
          const [cx, cy] = mapData.settings.center;
          const centerPoint = isLonLat(cx, cy)
            ? webMercatorUtils.geographicToWebMercator(
                new Point({ x: cx, y: cy, spatialReference: { wkid: 4326 } })
              )
            : new Point({ x: cx, y: cy, spatialReference: { wkid: 3857 } });

          const view = new MapView({
            container: mapDiv.current,
            map,
            spatialReference: { wkid: 3857 },
            center: centerPoint,
            zoom: mapData.settings.zoom,
            constraints: mapData.settings.constraints
              ? {
                  geometry: new Extent({
                    xmin: mapData.settings.constraints.xmin,
                    ymin: mapData.settings.constraints.ymin,
                    xmax: mapData.settings.constraints.xmax,
                    ymax: mapData.settings.constraints.ymax,
                    spatialReference: { wkid: 3857 },
                  }),
                }
              : undefined,
          });

          /* ─────────── Layers ─────────── */
          const editingLayer = new GraphicsLayer({ id: "editing" });
          const finalizedLayer = new GraphicsLayer({ id: "finalized" });
          const labelsLayer = new GraphicsLayer({ id: "labels" });

          // (optional) background image already in 102100/3857 family
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

          map.addMany([
            mediaLayer,
            finalizedLayer,
            editingLayer,
            featureLayer,
            labelsLayer,
          ]);

          /* ─────────── Label visibility buckets ─────────── */
          const applyLabelVisibility = (zoom: number) => {
            labelBuckets.forEach((bucket) => {
              const show = zoom >= bucket.minZoom && zoom <= bucket.maxZoom;
              bucket.labels.forEach((lbl) => (lbl.visible = show));
            });
          };

          /* ─────────── Build labels from polygons ─────────── */
          const rebuildAllLabelsFromPolygons = (
            savedLabelMap: globalThis.Map<string, LabelDTO>
          ) => {
            labelsLayer.removeAll();

            finalizedLayer.graphics.items.forEach((polyG: any) => {
              if (polyG.geometry?.type !== "polygon") return;

              // ensure polygon is real geometry & in view SR
              const poly3857 = toViewSR(polyG.geometry) as __esri.Polygon;

              const pt = computeLabelPoint(poly3857);
              const saved = savedLabelMap.get(polyG.attributes?.id);
              const attrs = {
                parentId: polyG.attributes?.id,
                text:
                  saved?.attributes.text ?? polyG.attributes?.name ?? "Polygon",
                showAtZoom: saved?.attributes.showAtZoom ?? null,
                hideAtZoom: saved?.attributes.hideAtZoom ?? null,
                fontSize: saved?.attributes.fontSize ?? 12,
                color: saved?.attributes.color ?? [0, 0, 0, 1],
                haloColor: saved?.attributes.haloColor ?? [255, 255, 255, 1],
                haloSize: saved?.attributes.haloSize ?? 2,
              };

              const labelGraphic = new Graphic({
                geometry: pt,
                symbol: createTextSymbol(attrs),
                attributes: attrs,
              });
              labelsLayer.add(labelGraphic);
            });

            rebuildBuckets(labelsLayer);
            applyLabelVisibility(view.zoom);
          };

          /* ─────────── Initial data load ─────────── */
          fetch(`/api/maps/${mapId}`)
            .then((res) => res.json())
            .then((data: { polygons: PolygonDTO[]; labels: LabelDTO[] }) => {
              // 1) Add polygons as real geometries (from JSON), project if needed
              data.polygons.forEach((p) => {
                const polyJSON = p.geometry; // DTO
                const polyGeom = Polygon.fromJSON(polyJSON); // ⬅️ real __esri.Polygon
                const projectedGeom = toViewSR(polyGeom) as __esri.Polygon;

                const polyGraphic = new Graphic({
                  geometry: projectedGeom,
                  symbol: p.symbol,
                  attributes: p.attributes,
                  popupTemplate: {
                    title: p.attributes.name,
                    content: p.attributes.description,
                  },
                });
                finalizedLayer.add(polyGraphic);
              });

              // 2) Keep only label ATTRS (position is recomputed)
              const savedLabelMap = new globalThis.Map<string, LabelDTO>(); // ⬅️ no clash
              (data.labels || []).forEach((l) => {
                if (l?.attributes?.parentId)
                  savedLabelMap.set(l.attributes.parentId, l);
              });

              // 3) Compute label positions from polygons in view SR
              rebuildAllLabelsFromPolygons(savedLabelMap);

              view.when(() => applyLabelVisibility(view.zoom));
              finalizedLayerRef.events.dispatchEvent(new Event("change"));
            })
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

          /* ─────────── Recompute label positions when polygons change ─────────── */
          finalizedLayer.graphics.on("change", () => {
            const savedLabelMap = new globalThis.Map<string, LabelDTO>();
            labelsLayer.graphics.items.forEach((lbl: any) => {
              const att = lbl.attributes;
              if (att?.parentId) {
                savedLabelMap.set(att.parentId, {
                  attributes: att,
                  geometry: {
                    type: "point",
                    x: lbl.geometry.x,
                    y: lbl.geometry.y,
                    spatialReference: { wkid: 3857, latestWkid: 3857 },
                  },
                } as any);
              }
            });
            rebuildAllLabelsFromPolygons(savedLabelMap);
          });

          /* ─────────── Expose refs ─────────── */
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
