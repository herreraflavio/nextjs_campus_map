"use client";

import { useEffect, useState } from "react";
import Extent from "@arcgis/core/geometry/Extent";
import { useSession } from "next-auth/react";
import { useMapId } from "@/app/context/MapContext";
import { saveMapToServer } from "@/app/helper/saveMap";
import SettingsIcon from "@mui/icons-material/Settings";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import {
  Box,
  Button,
  Divider,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";

import MapControls, { Constraints } from "../MapControls";
import {
  MapViewRef,
  settingsEvents,
  settingsRef,
} from "../arcgisRefs";
import type {
  FeatureLayerConfig as SharedFeatureLayerConfig,
} from "@/app/types/myTypes";

export interface FeatureLayerConfig extends SharedFeatureLayerConfig {
  id: string;
}

const DEFAULT_APISOURCES: string[] = [];
const R = 6378137;

function genId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `layer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeLayers(
  layers: Partial<FeatureLayerConfig>[],
): FeatureLayerConfig[] {
  return [...(layers ?? [])]
    .map((layer, index) => ({
      id: (layer as FeatureLayerConfig).id ?? genId(),
      url: String(layer.url ?? ""),
      index: typeof layer.index === "number" ? layer.index : index,
      outFields: (layer.outFields as string[]) ?? ["*"],
      popupEnabled: !!layer.popupEnabled,
      popupTemplate: layer.popupTemplate as FeatureLayerConfig["popupTemplate"],
    }))
    .sort((a, b) => a.index - b.index);
}

function coerceStringArray(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function mercatorToLonLat(
  x: string | number,
  y: string | number,
): [number, number] {
  const xFloat = typeof x === "string" ? parseFloat(x) : x;
  const yFloat = typeof y === "string" ? parseFloat(y) : y;
  const lon = (xFloat / R) * (180 / Math.PI);
  const lat =
    (2 * Math.atan(Math.exp(yFloat / R)) - Math.PI / 2) * (180 / Math.PI);
  return [lon, lat];
}

function lonLatToMercator(
  lon: string | number,
  lat: string | number,
): [number, number] {
  const lonFloat = typeof lon === "string" ? parseFloat(lon) : lon;
  const latFloat = typeof lat === "string" ? parseFloat(lat) : lat;
  const x = lonFloat * (Math.PI / 180) * R;
  const latRad = latFloat * (Math.PI / 180);
  const y = R * Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  return [x, y];
}

export default function MapSettingsPanel() {
  const [openSettings, setOpenSettings] = useState(false);
  const [center, setCenter] = useState({ x: "", y: "" });
  const [zoom, setZoom] = useState(10);
  const [layers, setLayers] = useState<FeatureLayerConfig[]>([]);
  const [mapTile, setMapTile] = useState<string | null>(null);
  const [baseMap, setBaseMap] = useState<string | null>(null);
  const [apiSources, setApiSources] = useState<string[]>(DEFAULT_APISOURCES);
  const [fieldNameById, setFieldNameById] = useState<Record<string, string>>(
    {},
  );
  const [constraints, setConstraints] = useState<Constraints>({
    xmin: "",
    ymin: "",
    xmax: "",
    ymax: "",
  });

  const { data: session } = useSession();
  const userEmail = session?.user?.email;
  const mapId = useMapId();

  function setMapCenterInViewSR(x: number, y: number) {
    const sr = MapViewRef.current?.spatialReference ?? {
      wkid: 3857,
      latestWkid: 3857,
    };
    settingsRef.current.center = { spatialReference: sr, x, y } as any;
    settingsEvents.dispatchEvent(new Event("change"));
  }

  const handleCapture = (type: "center" | "zoom" | "constraints") => {
    const view = MapViewRef.current;
    if (!view) return;

    if (type === "center") {
      const { x, y } = view.center;
      const [lon, lat] = mercatorToLonLat(x, y);
      setCenter({ x: lon.toFixed(6), y: lat.toFixed(6) });
    }

    if (type === "zoom") {
      setZoom(view.zoom);
    }

    if (type === "constraints") {
      const ext = view.extent;
      if (!ext) return;

      const [minLon, minLat] = mercatorToLonLat(ext.xmin, ext.ymin);
      const [maxLon, maxLat] = mercatorToLonLat(ext.xmax, ext.ymax);

      setConstraints({
        xmin: minLon.toFixed(6),
        ymin: minLat.toFixed(6),
        xmax: maxLon.toFixed(6),
        ymax: maxLat.toFixed(6),
      });
    }
  };

  const toggleSettings = () => {
    const view = MapViewRef.current;

    if (!openSettings && view) {
      const c = settingsRef.current.center as { x: number; y: number };
      const [lon, lat] = mercatorToLonLat(c.x, c.y);
      setCenter({ x: String(lon), y: String(lat) });
      setZoom(settingsRef.current.zoom);

      const cons = settingsRef.current.constraints;
      if (cons) {
        const [minLon, minLat] = mercatorToLonLat(cons.xmin, cons.ymin);
        const [maxLon, maxLat] = mercatorToLonLat(cons.xmax, cons.ymax);
        setConstraints({
          xmin: String(minLon),
          ymin: String(minLat),
          xmax: String(maxLon),
          ymax: String(maxLat),
        });
      } else {
        setConstraints({ xmin: "", ymin: "", xmax: "", ymax: "" });
      }

      const featureLayers = normalizeLayers(
        (settingsRef.current.featureLayers ??
          []) as Partial<FeatureLayerConfig>[],
      );
      setLayers(featureLayers);
      setMapTile(settingsRef.current.mapTile);
      setBaseMap(settingsRef.current.baseMap);

      const fromRef = coerceStringArray((settingsRef.current as any).apiSources);
      setApiSources(fromRef.length > 0 ? fromRef : DEFAULT_APISOURCES);
    }

    setOpenSettings((isOpen) => !isOpen);
  };

  const applySettings = () => {
    const view = MapViewRef.current;
    if (!view) return;

    const { xmin, ymin, xmax, ymax } = constraints;

    let finalExtent = null;
    if (xmin && ymin && xmax && ymax) {
      const [mercMinX, mercMinY] = lonLatToMercator(xmin, ymin);
      const [mercMaxX, mercMaxY] = lonLatToMercator(xmax, ymax);

      finalExtent = new Extent({
        xmin: mercMinX,
        ymin: mercMinY,
        xmax: mercMaxX,
        ymax: mercMaxY,
        spatialReference: view.spatialReference,
      });

      view.constraints.geometry = finalExtent;
    } else {
      view.constraints.geometry = null as any;
    }

    settingsRef.current.zoom = zoom;

    const [mercX, mercY] = lonLatToMercator(center.x, center.y);
    setMapCenterInViewSR(mercX, mercY);

    settingsRef.current.constraints = finalExtent
      ? {
          xmin: finalExtent.xmin,
          ymin: finalExtent.ymin,
          xmax: finalExtent.xmax,
          ymax: finalExtent.ymax,
        }
      : (null as any);

    const layersSorted = normalizeLayers(layers);
    settingsRef.current.featureLayers = layersSorted;
    settingsRef.current.mapTile = mapTile;
    settingsRef.current.baseMap = baseMap;

    const cleaned = apiSources.map((s) => s.trim()).filter(Boolean);
    const withFallback = cleaned.length > 0 ? cleaned : DEFAULT_APISOURCES;
    const deduped = Array.from(new Set(withFallback));
    (settingsRef.current as any).apiSources = deduped;

    if (userEmail) {
      const s = settingsRef.current as any;
      saveMapToServer(mapId, userEmail, {
        zoom: s.zoom,
        center: [s.center.x, s.center.y] as [number, number],
        constraints: s.constraints,
        featureLayers: layersSorted,
        mapTile,
        baseMap,
        apiSources: deduped,
      });
    }

    setOpenSettings(false);
  };

  useEffect(() => {
    const sync = () => {
      const s = settingsRef.current as any;

      const [lon, lat] = mercatorToLonLat(s.center.x, s.center.y);
      setCenter({ x: String(lon), y: String(lat) });
      setLayers(
        normalizeLayers((s.featureLayers ?? []) as Partial<FeatureLayerConfig>[]),
      );
      setMapTile(s.mapTile);
      setBaseMap(s.baseMap);
      setZoom(s.zoom);

      const fromRef = coerceStringArray(s.apiSources);
      setApiSources(fromRef.length > 0 ? fromRef : DEFAULT_APISOURCES);

      if (s.constraints) {
        const [minLon, minLat] = mercatorToLonLat(
          s.constraints.xmin,
          s.constraints.ymin,
        );
        const [maxLon, maxLat] = mercatorToLonLat(
          s.constraints.xmax,
          s.constraints.ymax,
        );
        setConstraints({
          xmin: String(minLon),
          ymin: String(minLat),
          xmax: String(maxLon),
          ymax: String(maxLat),
        });
      }
    };

    settingsEvents.addEventListener("change", sync);
    sync();

    return () => settingsEvents.removeEventListener("change", sync);
  }, []);

  return (
    <>
      <IconButton
        onClick={toggleSettings}
        sx={{
          position: "absolute",
          bottom: 25,
          left: 260,
          width: 50,
          height: 50,
          bgcolor: "background.paper",
          border: 1,
          zIndex: 9999,
        }}
      >
        <SettingsIcon fontSize="large" />
      </IconButton>

      {openSettings && (
        <Box
          sx={{
            position: "absolute",
            bottom: 25,
            left: 320,
            zIndex: 99,
            bgcolor: "background.paper",
            border: 1,
            p: 1,
            width: 300,
            height: 500,
            overflow: "scroll",
          }}
        >
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <div>╔═</div>
            <Typography variant="h6">Map Settings</Typography>
            <div>═╗</div>
          </Box>

          <Box mt={1}>
            <MapControls
              centerX={center.x}
              centerY={center.y}
              onCenterChange={(field, value) =>
                setCenter((prev) => ({ ...prev, [field]: value }))
              }
              zoom={zoom}
              onZoomChange={setZoom}
              constraints={constraints}
              onConstraintChange={(field, value) =>
                setConstraints((prev) => ({ ...prev, [field]: value }))
              }
              layers={layers}
              setLayers={setLayers}
              fieldNameById={fieldNameById}
              setFieldNameById={setFieldNameById}
              mapTile={mapTile}
              setMapTile={setMapTile}
              baseMap={baseMap}
              setBaseMap={setBaseMap}
              onCapture={handleCapture}
            />

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              API Sources
            </Typography>
            <Box sx={{ mt: 1 }}>
              {apiSources.map((url, idx) => (
                <Box
                  key={`${idx}-${url}`}
                  sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}
                >
                  <TextField
                    label={`API Source ${idx + 1}`}
                    value={url}
                    onChange={(e) =>
                      setApiSources((prev) =>
                        prev.map((value, i) =>
                          i === idx ? e.target.value : value,
                        ),
                      )
                    }
                    size="small"
                    fullWidth
                  />
                  <IconButton
                    onClick={() =>
                      setApiSources((prev) =>
                        prev.filter((_, i) => i !== idx),
                      )
                    }
                    size="small"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setApiSources((prev) => [...prev, ""])}
                  startIcon={<AddIcon />}
                >
                  Add
                </Button>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setApiSources(DEFAULT_APISOURCES)}
                  startIcon={<RestartAltIcon />}
                >
                  Reset defaults
                </Button>
              </Box>
            </Box>
          </Box>

          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Button onClick={toggleSettings}>Cancel</Button>
            <Button variant="contained" onClick={applySettings} sx={{ ml: 1 }}>
              Apply All Edits
            </Button>
          </Box>
        </Box>
      )}
    </>
  );
}
