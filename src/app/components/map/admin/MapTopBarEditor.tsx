"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useMapId } from "@/app/context/MapContext";
import { uploadImage } from "@/app/helper/uploadImage";
import { saveMapToServer } from "@/app/helper/saveMap";
import {
  isHexColor,
  isMapTopBarSettings,
  normalizeMapTopBar,
  type MapTopBarSettings,
} from "@/app/types/mapTopBar";
import { finalizedLayerRef, MapViewRef, settingsRef } from "../arcgisRefs";
import EditorPanel from "./EditorPanel";

export default function MapTopBarEditor({
  settings,
  onClose,
  onSaved,
}: {
  settings: MapTopBarSettings;
  onClose: () => void;
  onSaved: (settings: MapTopBarSettings) => void;
}) {
  const [draft, setDraft] = useState(() => ({ ...settings }));
  const [uploading, setUploading] = useState(false);
  const [imageReady, setImageReady] = useState(!settings.logoUrl);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const uploadRef = useRef<AbortController | null>(null);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  const { data: session } = useSession();
  const mapId = useMapId();
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      uploadRef.current?.abort();
    };
  }, []);
  useEffect(() => {
    // A settings save exports map graphics. Wait for them to load so an early
    // header edit cannot replace an existing map's drawings with empty arrays.
    const sync = () => {
      if (!MapViewRef.current?.ready || !finalizedLayerRef.current) return;
      setMapReady(true);
      window.clearInterval(timer);
    };
    const timer = window.setInterval(sync, 100);
    sync();
    return () => window.clearInterval(timer);
  }, []);

  const changeLogo = async (file: File | null) => {
    if (!file || uploadRef.current || savingRef.current) return;
    const controller = new AbortController();
    uploadRef.current = controller;
    setUploading(true);
    setUploadError(null);
    try {
      const logoUrl = await uploadImage(file, controller.signal);
      if (controller.signal.aborted) return;
      if (!isMapTopBarSettings({ ...settings, logoUrl })) {
        throw new Error("The upload returned an invalid image URL. Please upload another image.");
      }
      setImageReady(false);
      setDraft((current) => ({ ...current, logoUrl }));
    } catch (error) {
      if (!controller.signal.aborted) {
        setUploadError(error instanceof Error ? error.message : "Upload failed.");
      }
    } finally {
      if (!controller.signal.aborted) setUploading(false);
      uploadRef.current = null;
    }
  };

  const clearLogo = () => {
    setDraft((current) => ({ ...current, logoUrl: null }));
    setImageReady(true);
    setUploadError(null);
  };

  const validColor = isHexColor(draft.backgroundColor);
  const save = async () => {
    if (
      uploadRef.current || uploading || uploadError ||
      !imageReady || !validColor || savingRef.current ||
      !MapViewRef.current?.ready || !finalizedLayerRef.current
    ) return;
    const email = session?.user?.email;
    if (!email) {
      setSaveError("You must be signed in to save map settings.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    const topBar = normalizeMapTopBar(draft);
    const s = settingsRef.current;
    const saved = await saveMapToServer(mapId, email, {
      zoom: s.zoom,
      center: [s.center.x, s.center.y],
      constraints: s.constraints,
      featureLayers: s.featureLayers,
      mapTile: s.mapTile,
      baseMap: s.baseMap,
      apiSources: s.apiSources,
      topBar,
    });
    if (!mountedRef.current) return;
    if (saved) {
      settingsRef.current.topBar = topBar;
      onSaved(topBar);
      onClose();
    } else {
      setSaveError("Could not save the map top bar. Please try again.");
      setSaving(false);
      savingRef.current = false;
    }
  };

  return (
    <EditorPanel title="Edit Map Top Bar" contained>
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Logo
        </Typography>
        {draft.logoUrl && (
          <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
            <img
              key={draft.logoUrl}
              src={draft.logoUrl}
              alt="Map top bar logo preview"
              onLoad={() => setImageReady(true)}
              onError={() => {
                setImageReady(false);
                setUploadError("Could not load the logo. Upload another image or clear it.");
              }}
              style={{
                width: 44,
                height: 44,
                objectFit: "contain",
                borderRadius: 4,
                border: "1px solid #ddd",
              }}
            />
            <Button size="small" disabled={uploading || saving} onClick={clearLogo}>
              Clear
            </Button>
          </Box>
        )}
        <Box sx={{ mt: 1, display: "flex", gap: 1, alignItems: "center" }}>
          <Button
            component="label"
            variant="outlined"
            size="small"
            disabled={uploading || saving}
            startIcon={uploading ? <CircularProgress size={14} /> : <UploadFileIcon />}
          >
            {uploading ? "Uploading..." : "Upload"}
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={(event) => {
                void changeLogo(event.target.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
          </Button>
          {!draft.logoUrl && uploadError && (
            <Button size="small" disabled={uploading || saving} onClick={clearLogo}>
              Clear
            </Button>
          )}
        </Box>
      </Box>
      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 700 }}>
        Background Color
      </Typography>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <input
          type="color"
          aria-label="Background color picker"
          value={validColor ? draft.backgroundColor : settings.backgroundColor}
          disabled={saving}
          onChange={(event) =>
            setDraft((current) => ({ ...current, backgroundColor: event.target.value }))
          }
          style={{ width: 44, height: 40, padding: 2, flexShrink: 0, border: "1px solid #ddd", borderRadius: 4 }}
        />
        <TextField
          label="Hex color"
          size="small"
          fullWidth
          value={draft.backgroundColor}
          disabled={saving}
          error={!validColor}
          helperText={!validColor ? "Use a six-digit hex color, such as #002856." : undefined}
          onChange={(event) =>
            setDraft((current) => ({ ...current, backgroundColor: event.target.value }))
          }
        />
      </Box>
      {(uploadError || saveError) && (
        <Typography role="alert" color="error" sx={{ mt: 1 }}>
          {uploadError || saveError}
        </Typography>
      )}
      {!mapReady && <Typography variant="body2" sx={{ mt: 1 }}>Loading map...</Typography>}
      <Box sx={{ textAlign: "right", mt: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ mr: 1 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void save()}
          disabled={uploading || saving || !!uploadError || !imageReady || !validColor || !mapReady}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </Box>
    </EditorPanel>
  );
}
