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

/* ─────────────────────────────────────────
 * Types
 * ───────────────────────────────────── */

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

interface FieldInfo {
  fieldName: string;
  label: string;
  visible: boolean;
  format?: {
    digitSeparator?: boolean;
    places?: number;
  };
}

interface FeatureLayerConfig {
  url: string;
  outFields: string[];
  popupEnabled: boolean;
  popupTemplate?: {
    title: string;
    content: Array<{
      type: string;
      fieldInfos?: FieldInfo[];
    }>;
  };
}

interface ExportBody {
  userEmail: string;
  polygons: PolygonDTO[];
  labels: LabelDTO[];
  featureLayers: FeatureLayerConfig[];
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

/* ─────────────────────────────────────────
 * Component
 * ───────────────────────────────────── */

export default function ArcGISMap(mapData: ExportBody) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapId = useMapId();

  useEffect(() => {
    console.log("ArcGISMap useEffect triggered", {
      mapId,
      hasMapData: !!mapData,
      polygonCount: mapData?.polygons?.length || 0,
      labelCount: mapData?.labels?.length || 0,
      featureLayerCount: mapData?.featureLayers?.length || 0,
    });

    let intervalCleared = false;
    const intv = setInterval(() => {
      if (!(window as any).require) {
        if (!intervalCleared) {
          console.log("Waiting for ArcGIS API to load...");
        }
        return;
      }

      clearInterval(intv);
      intervalCleared = true;
      console.log("ArcGIS API available, initializing map");

      try {
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
            EsriMap: any,
            MapView: any,
            Graphic: any,
            GraphicsLayer: any,
            MediaLayer: any,
            ImageElement: any,
            ExtentAndRotationGeoreference: any,
            Extent: any,
            Point: typeof __esri.Point,
            Polygon: typeof __esri.Polygon,
            webMercatorUtils: any,
            geometryEngine: any,
            FeatureLayer: any
          ) => {
            console.log("All ArcGIS modules loaded successfully");

            try {
              /* ─────────── Helpers ─────────── */
              const isLonLat = (x: number, y: number) =>
                Math.abs(x) <= 180 && Math.abs(y) <= 90;

              const toViewSR = (
                geom: __esri.Geometry | any
              ): __esri.Geometry => {
                try {
                  const wkid = geom?.spatialReference?.wkid;
                  console.log("Converting geometry to view SR", {
                    wkid,
                    geomType: geom?.type,
                  });

                  if (wkid === 3857 || wkid === 102100) return geom;
                  if (wkid === 4326)
                    return webMercatorUtils.geographicToWebMercator(geom);
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
                } catch (error) {
                  console.error("Error in toViewSR:", error, { geom });
                  return geom;
                }
              };

              const computeLabelPoint = (
                poly: __esri.Polygon
              ): __esri.Point => {
                try {
                  console.log("Computing label point for polygon");
                  const p = geometryEngine.labelPoints(poly);
                  if (p) {
                    console.log("Using labelPoints result:", {
                      x: p.x,
                      y: p.y,
                    });
                    return new Point({
                      x: p.x,
                      y: p.y,
                      spatialReference: { wkid: 3857 },
                    });
                  }
                } catch (error) {
                  console.warn("labelPoints failed, trying centroid:", error);
                }

                try {
                  const c1 = (poly as any).centroid;
                  if (c1) {
                    console.log("Using centroid:", { x: c1.x, y: c1.y });
                    return new Point({
                      x: c1.x,
                      y: c1.y,
                      spatialReference: { wkid: 3857 },
                    });
                  }
                } catch (error) {
                  console.warn("Centroid failed, trying extent center:", error);
                }

                try {
                  if (poly.extent?.center) {
                    console.log("Using extent center:", {
                      x: poly.extent.center.x,
                      y: poly.extent.center.y,
                    });
                    return new Point({
                      x: poly.extent.center.x,
                      y: poly.extent.center.y,
                      spatialReference: { wkid: 3857 },
                    });
                  }
                } catch (error) {
                  console.warn(
                    "Extent center failed, calculating manual center:",
                    error
                  );
                }

                // Fallback: manual bbox calculation
                try {
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
                  const centerX = (minX + maxX) / 2;
                  const centerY = (minY + maxY) / 2;
                  console.log("Using manual bbox center:", {
                    x: centerX,
                    y: centerY,
                  });
                  return new Point({
                    x: centerX,
                    y: centerY,
                    spatialReference: { wkid: 3857 },
                  });
                } catch (error) {
                  console.error("All label point calculations failed:", error);
                  throw error;
                }
              };

              const createTextSymbol = (attrs: any) => {
                try {
                  const symbol = {
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
                  };
                  console.log("Created text symbol:", symbol);
                  return symbol;
                } catch (error) {
                  console.error("Error creating text symbol:", error, {
                    attrs,
                  });
                  throw error;
                }
              };

              /* ─────────── Create Feature Layers Dynamically ─────────── */
              const createFeatureLayers = () => {
                const layers: any[] = [];

                if (
                  !mapData.featureLayers ||
                  mapData.featureLayers.length === 0
                ) {
                  console.log("No feature layers configured");
                  return layers;
                }

                console.log(
                  `Creating ${mapData.featureLayers.length} feature layers...`
                );

                mapData.featureLayers.forEach((config, index) => {
                  try {
                    console.log(`Creating feature layer ${index}:`, {
                      url: config.url,
                      outFields: config.outFields,
                      popupEnabled: config.popupEnabled,
                      hasPopupTemplate: !!config.popupTemplate,
                    });

                    const featureLayer = new FeatureLayer({
                      url: config.url,
                      outFields: config.outFields || ["*"],
                      popupEnabled: config.popupEnabled !== false,
                      popupTemplate: config.popupTemplate || undefined,
                    });

                    layers.push(featureLayer);
                    console.log(`Feature layer ${index} created successfully`);
                  } catch (error) {
                    console.error(
                      `Error creating feature layer ${index}:`,
                      error,
                      config
                    );
                  }
                });

                return layers;
              };

              /* ─────────── Map & View ─────────── */
              console.log("Creating map and view...");
              const map = new EsriMap({
                basemap: "satellite",
              });

              // Normalize center to 3857
              const [cx, cy] = mapData.settings.center;
              console.log("Processing center coordinates:", { cx, cy });

              let centerPoint;
              try {
                centerPoint = isLonLat(cx, cy)
                  ? webMercatorUtils.geographicToWebMercator(
                      new Point({
                        x: cx,
                        y: cy,
                        spatialReference: { wkid: 4326 },
                      })
                    )
                  : new Point({
                      x: cx,
                      y: cy,
                      spatialReference: { wkid: 3857 },
                    });
                console.log("Center point created:", {
                  x: centerPoint.x,
                  y: centerPoint.y,
                });
              } catch (error) {
                console.error("Error creating center point:", error);
                centerPoint = new Point({
                  x: -13405666.775,
                  y: 4489906.24,
                  spatialReference: { wkid: 3857 },
                });
              }

              let viewConstraints;
              if (mapData.settings.constraints) {
                try {
                  viewConstraints = {
                    geometry: new Extent({
                      xmin: mapData.settings.constraints.xmin,
                      ymin: mapData.settings.constraints.ymin,
                      xmax: mapData.settings.constraints.xmax,
                      ymax: mapData.settings.constraints.ymax,
                      spatialReference: { wkid: 3857 },
                    }),
                  };
                  console.log("View constraints created:", viewConstraints);
                } catch (error) {
                  console.error(
                    "Error creating view constraints:",
                    error,
                    mapData.settings.constraints
                  );
                  viewConstraints = undefined;
                }
              }

              const view = new MapView({
                container: mapDiv.current,
                map,
                spatialReference: { wkid: 3857 },
                center: centerPoint,
                zoom: mapData.settings.zoom,
                constraints: viewConstraints,
              });

              console.log("MapView created with settings:", {
                zoom: mapData.settings.zoom,
                center: { x: centerPoint.x, y: centerPoint.y },
                hasConstraints: !!viewConstraints,
              });

              /* ─────────── Layers ─────────── */
              console.log("Creating layers...");
              const editingLayer = new GraphicsLayer({ id: "editing" });
              const finalizedLayer = new GraphicsLayer({ id: "finalized" });
              const labelsLayer = new GraphicsLayer({ id: "labels" });

              // Create feature layers from configuration
              const featureLayers = createFeatureLayers();

              console.log(
                `Graphics layers created, ${featureLayers.length} feature layers created`
              );

              // Background image
              try {
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
                console.log("Media layer created successfully");

                // Add layers in correct order (bottom to top)
                const allLayers = [
                  mediaLayer,
                  finalizedLayer,
                  editingLayer,
                  ...featureLayers, // Add all feature layers
                  labelsLayer,
                ];
                map.addMany(allLayers);
                console.log(`All ${allLayers.length} layers added to map`);
              } catch (error) {
                console.error("Error creating media layer:", error);
                // Add layers without media layer
                const allLayers = [
                  finalizedLayer,
                  editingLayer,
                  ...featureLayers,
                  labelsLayer,
                ];
                map.addMany(allLayers);
                console.log(
                  `Layers added to map (without media layer): ${allLayers.length} total`
                );
              }

              /* ─────────── Debug and Event Handling ─────────── */
              view
                .when(() => {
                  console.log("MapView ready");

                  // Monitor each feature layer's loading
                  featureLayers.forEach((featureLayer, index) => {
                    featureLayer
                      .when(() => {
                        console.log(
                          `FeatureLayer ${index} loaded successfully`
                        );
                        console.log(
                          `Layer ${index} fields:`,
                          featureLayer.fields?.map((f: any) => ({
                            name: f.name,
                            type: f.type,
                          }))
                        );
                        console.log(
                          `Layer ${index} feature count:`,
                          featureLayer.source?.length ||
                            "unknown (service layer)"
                        );
                      })
                      .catch((error: any) => {
                        console.error(
                          `Error loading FeatureLayer ${index}:`,
                          error
                        );
                      });
                  });

                  // Monitor popup events
                  view.popup.watch("visible", (visible: any) => {
                    if (visible) {
                      console.log("Popup opened for:", view.popup.title);
                      console.log(
                        "Popup features:",
                        view.popup.features?.length || 0
                      );
                    } else {
                      console.log("Popup closed");
                    }
                  });

                  // Monitor view changes
                  view.watch("zoom", (newZoom: number) => {
                    console.log("Zoom changed to:", newZoom);
                    applyLabelVisibility(newZoom);
                  });

                  view.watch("center", (newCenter: any) => {
                    console.log("Center changed to:", {
                      x: newCenter.x,
                      y: newCenter.y,
                    });
                  });
                })
                .catch((error: any) => {
                  console.error("Error initializing MapView:", error);
                });

              /* ─────────── Label visibility with custom zoom support ─────────── */
              const applyLabelVisibility = (zoom: number) => {
                try {
                  console.log(`Applying label visibility for zoom: ${zoom}`);

                  // Track labels with custom settings for debugging
                  let customLabelCount = 0;
                  let bucketLabelCount = 0;

                  labelsLayer.graphics.items.forEach((labelGraphic: any) => {
                    const attrs = labelGraphic.attributes;
                    if (!attrs) return;

                    // Check if this label has custom zoom settings
                    const hasCustomZoom =
                      (attrs.showAtZoom !== null &&
                        attrs.showAtZoom !== undefined) ||
                      (attrs.hideAtZoom !== null &&
                        attrs.hideAtZoom !== undefined);

                    if (hasCustomZoom) {
                      customLabelCount++;
                      // Use custom zoom settings
                      let shouldShow = true;

                      // Check minimum zoom (showAtZoom)
                      if (
                        attrs.showAtZoom !== null &&
                        attrs.showAtZoom !== undefined
                      ) {
                        if (zoom < attrs.showAtZoom) {
                          shouldShow = false;
                        }
                      }

                      // Check maximum zoom (hideAtZoom)
                      if (
                        attrs.hideAtZoom !== null &&
                        attrs.hideAtZoom !== undefined
                      ) {
                        if (zoom > attrs.hideAtZoom) {
                          shouldShow = false;
                        }
                      }

                      labelGraphic.visible = shouldShow;
                      console.log(
                        `Custom label "${attrs.text}": zoom=${zoom}, showAt=${attrs.showAtZoom}, hideAt=${attrs.hideAtZoom}, visible=${shouldShow}`
                      );
                    } else {
                      bucketLabelCount++;
                      // Use bucket system for labels without custom settings
                      let foundInBucket = false;
                      labelBuckets.forEach((bucket) => {
                        if (bucket.labels.includes(labelGraphic)) {
                          const show =
                            zoom >= bucket.minZoom && zoom <= bucket.maxZoom;
                          labelGraphic.visible = show;
                          foundInBucket = true;
                        }
                      });

                      // If not in any bucket, make visible by default
                      if (!foundInBucket) {
                        labelGraphic.visible = true;
                      }
                    }
                  });

                  console.log(
                    `Visibility applied: ${customLabelCount} custom labels, ${bucketLabelCount} bucket labels`
                  );
                } catch (error) {
                  console.error("Error applying label visibility:", error);
                }
              };

              /* ─────────── Build labels from polygons ─────────── */
              const rebuildAllLabelsFromPolygons = (
                savedLabelMap: globalThis.Map<string, LabelDTO>
              ) => {
                try {
                  console.log(
                    "Rebuilding labels from polygons, saved labels:",
                    savedLabelMap.size
                  );
                  labelsLayer.removeAll();

                  let labelsCreated = 0;
                  let customZoomLabels = 0;

                  finalizedLayer.graphics.items.forEach(
                    (polyG: any, index: any) => {
                      try {
                        if (polyG.geometry?.type !== "polygon") {
                          console.log(
                            `Skipping non-polygon graphic at index ${index}:`,
                            polyG.geometry?.type
                          );
                          return;
                        }

                        const poly3857 = toViewSR(
                          polyG.geometry
                        ) as __esri.Polygon;
                        const pt = computeLabelPoint(poly3857);
                        const saved = savedLabelMap.get(polyG.attributes?.id);

                        const attrs = {
                          parentId: polyG.attributes?.id,
                          text:
                            saved?.attributes.text ??
                            polyG.attributes?.name ??
                            "Polygon",
                          showAtZoom: saved?.attributes.showAtZoom ?? null,
                          hideAtZoom: saved?.attributes.hideAtZoom ?? null,
                          fontSize: saved?.attributes.fontSize ?? 12,
                          color: saved?.attributes.color ?? [0, 0, 0, 1],
                          haloColor: saved?.attributes.haloColor ?? [
                            255, 255, 255, 1,
                          ],
                          haloSize: saved?.attributes.haloSize ?? 2,
                        };

                        const labelGraphic = new Graphic({
                          geometry: pt,
                          symbol: createTextSymbol(attrs),
                          attributes: attrs,
                        });

                        // Check if this has custom zoom settings and set initial visibility
                        if (
                          attrs.showAtZoom !== null ||
                          attrs.hideAtZoom !== null
                        ) {
                          customZoomLabels++;
                          const currentZoom = view.zoom;
                          let shouldShow = true;

                          if (
                            attrs.showAtZoom !== null &&
                            currentZoom < attrs.showAtZoom
                          ) {
                            shouldShow = false;
                          }
                          if (
                            attrs.hideAtZoom !== null &&
                            currentZoom > attrs.hideAtZoom
                          ) {
                            shouldShow = false;
                          }

                          labelGraphic.visible = shouldShow;
                          console.log(
                            `Custom zoom label created: "${attrs.text}", showAt=${attrs.showAtZoom}, hideAt=${attrs.hideAtZoom}, initialVisible=${shouldShow} at zoom ${currentZoom}`
                          );
                        }

                        labelsLayer.add(labelGraphic);
                        labelsCreated++;

                        console.log(
                          `Created label ${labelsCreated} for polygon ${polyG.attributes?.id}:`,
                          attrs.text
                        );
                      } catch (error) {
                        console.error(
                          `Error creating label for polygon at index ${index}:`,
                          error,
                          polyG
                        );
                      }
                    }
                  );

                  console.log(
                    `Total labels created: ${labelsCreated}, with custom zoom: ${customZoomLabels}`
                  );

                  // Rebuild buckets only for labels without custom zoom settings
                  rebuildBuckets(labelsLayer);
                  applyLabelVisibility(view.zoom);
                } catch (error) {
                  console.error(
                    "Error rebuilding labels from polygons:",
                    error
                  );
                }
              };

              /* ─────────── Initial data load ─────────── */
              console.log(
                "Starting initial polygon and label data load for mapId:",
                mapId
              );

              if (!mapId) {
                console.warn("No mapId available for data fetch");
                return;
              }

              fetch(`/api/maps/${mapId}`)
                .then((res) => {
                  console.log(
                    "Polygon/label fetch response:",
                    res.status,
                    res.statusText
                  );
                  if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                  }
                  return res.json();
                })
                .then(
                  (data: { polygons: PolygonDTO[]; labels: LabelDTO[] }) => {
                    console.log("Polygon/label data received:", {
                      polygons: data.polygons?.length || 0,
                      labels: data.labels?.length || 0,
                    });

                    // Load polygons
                    let polygonsLoaded = 0;
                    let polygonErrors = 0;

                    (data.polygons || []).forEach((p, index) => {
                      try {
                        console.log(
                          `Processing polygon ${index + 1}/${
                            data.polygons.length
                          }:`,
                          {
                            hasGeometry: !!p.geometry,
                            hasAttributes: !!p.attributes,
                            hasSymbol: !!p.symbol,
                            attributeKeys: p.attributes
                              ? Object.keys(p.attributes)
                              : [],
                          }
                        );

                        const polyJSON = p.geometry;
                        const polyGeom = Polygon.fromJSON(polyJSON);
                        const projectedGeom = toViewSR(
                          polyGeom
                        ) as __esri.Polygon;

                        const polyGraphic = new Graphic({
                          geometry: projectedGeom,
                          symbol: p.symbol,
                          attributes: p.attributes,
                          popupTemplate: {
                            title: p.attributes?.name || `Polygon ${index + 1}`,
                            content:
                              p.attributes?.description ||
                              "No description available",
                          },
                        });

                        finalizedLayer.add(polyGraphic);
                        polygonsLoaded++;
                        console.log(
                          `Successfully added polygon ${index + 1}:`,
                          p.attributes?.name
                        );
                      } catch (error) {
                        polygonErrors++;
                        console.error(
                          `Error processing polygon ${index + 1}:`,
                          error,
                          p
                        );
                      }
                    });

                    console.log(
                      `Polygon loading completed: ${polygonsLoaded} loaded, ${polygonErrors} errors`
                    );

                    // Process saved labels - log custom zoom settings
                    const savedLabelMap = new globalThis.Map<
                      string,
                      LabelDTO
                    >();
                    let labelsProcessed = 0;
                    let customZoomCount = 0;

                    (data.labels || []).forEach((l, index) => {
                      try {
                        if (l?.attributes?.parentId) {
                          savedLabelMap.set(l.attributes.parentId, l);
                          labelsProcessed++;

                          // Check if has custom zoom settings
                          if (
                            l.attributes.showAtZoom !== null ||
                            l.attributes.hideAtZoom !== null
                          ) {
                            customZoomCount++;
                            console.log(
                              `Saved label with custom zoom: "${l.attributes.text}", showAt=${l.attributes.showAtZoom}, hideAt=${l.attributes.hideAtZoom}`
                            );
                          }

                          console.log(
                            `Processed saved label ${index + 1} for parent ${
                              l.attributes.parentId
                            }:`,
                            l.attributes.text
                          );
                        } else {
                          console.warn(
                            `Label ${index + 1} missing parentId:`,
                            l
                          );
                        }
                      } catch (error) {
                        console.error(
                          `Error processing label ${index + 1}:`,
                          error,
                          l
                        );
                      }
                    });

                    console.log(
                      `Saved labels processed: ${labelsProcessed}, with custom zoom: ${customZoomCount}`
                    );

                    rebuildAllLabelsFromPolygons(savedLabelMap);

                    view.when(() => {
                      applyLabelVisibility(view.zoom);
                      console.log("Initial label visibility applied");
                    });

                    if (finalizedLayerRef.events) {
                      finalizedLayerRef.events.dispatchEvent(
                        new Event("change")
                      );
                      console.log("Finalized layer change event dispatched");
                    }
                  }
                )
                .catch((err) => {
                  console.error("Error loading polygons/labels:", err);
                });

              /* ─────────── Event Listeners ─────────── */
              console.log("Setting up event listeners...");

              // Rebuild buckets & visibility on label edits
              labelsLayer.graphics.on("change", (event: any) => {
                console.log("Labels layer graphics changed:", {
                  added: event.added?.length || 0,
                  removed: event.removed?.length || 0,
                  moved: event.moved?.length || 0,
                });
                rebuildBuckets(labelsLayer);
                applyLabelVisibility(view.zoom);
              });

              // Recompute label positions when polygons change
              finalizedLayer.graphics.on("change", (event: any) => {
                console.log("Finalized layer graphics changed:", {
                  added: event.added?.length || 0,
                  removed: event.removed?.length || 0,
                  moved: event.moved?.length || 0,
                });

                try {
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
                } catch (error) {
                  console.error(
                    "Error handling finalized layer change:",
                    error
                  );
                }
              });

              /* ─────────── Expose refs ─────────── */
              console.log("Exposing component refs...");
              try {
                editingLayerRef.current = editingLayer;
                setFinalizedLayer(finalizedLayer);
                setLabelsLayer(labelsLayer);
                GraphicRef.current = Graphic;
                MapViewRef.current = view;
                console.log("All refs exposed successfully");
              } catch (error) {
                console.error("Error exposing refs:", error);
              }
            } catch (error) {
              console.error("Error in ArcGIS module callback:", error);
            }
          }
        );
      } catch (error) {
        console.error("Error calling require:", error);
      }
    }, 100);

    return () => {
      console.log("ArcGISMap cleanup");
      clearInterval(intv);
    };
  }, [mapId, mapData]);

  console.log("Rendering ArcGISMap div");
  return <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />;
}
