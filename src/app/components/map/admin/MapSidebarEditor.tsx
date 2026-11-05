"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Button, TextField, Typography } from "@mui/material";
import { useSession } from "next-auth/react";
import { useMapId } from "@/app/context/MapContext";
import { saveMapToServer } from "@/app/helper/saveMap";
import { isHexColor } from "@/app/types/mapTopBar";
import {
  DEFAULT_MAP_SIDEBAR, isMapSidebarSettings, normalizeMapSidebar,
  type MapSidebarSettings,
} from "@/app/types/mapSidebar";
import { finalizedLayerRef, MapViewRef, settingsRef } from "../arcgisRefs";
import EditorPanel from "./EditorPanel";

const colorFields: { key: keyof MapSidebarSettings; label: string }[] = [
  { key: "backgroundColor", label: "Sidebar background" },
  { key: "borderColor", label: "Border color" },
  { key: "textColor", label: "Text color" },
];

export default function MapSidebarEditor({ settings, onSaved, onClose }: {
  settings: MapSidebarSettings | null;
  onSaved: (settings: MapSidebarSettings | null) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mounted = useRef(true);
  const savingRef = useRef(false);
  const { data: session } = useSession();
  const mapId = useMapId();
  const colors = draft ?? DEFAULT_MAP_SIDEBAR;
  const valid = draft === null || isMapSidebarSettings(draft);

  useEffect(() => {
    mounted.current = true;
    const sync = () => {
      if (!MapViewRef.current?.ready || !finalizedLayerRef.current) return;
      setMapReady(true);
      window.clearInterval(timer);
    };
    const timer = window.setInterval(sync, 100);
    sync();
    return () => { mounted.current = false; window.clearInterval(timer); };
  }, []);

  const save = async () => {
    if (!valid || savingRef.current || !mapReady) return;
    const email = session?.user?.email;
    if (!email) { setError("You must be signed in to save map settings."); return; }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const sidebar = normalizeMapSidebar(draft);
    const s = settingsRef.current;
    const saved = await saveMapToServer(mapId, email, {
      zoom: s.zoom, center: [s.center.x, s.center.y], constraints: s.constraints,
      featureLayers: s.featureLayers, mapTile: s.mapTile, baseMap: s.baseMap,
      apiSources: s.apiSources, sidebar,
    });
    if (!mounted.current) return;
    if (saved) {
      settingsRef.current.sidebar = sidebar;
      onSaved(sidebar);
      onClose();
    } else {
      setError("Could not save the sidebar colors. Please try again.");
      setSaving(false);
      savingRef.current = false;
    }
  };

  return (
    <EditorPanel title="Edit Sidebar Colors" contained>
      {colorFields.map(({ key, label }) => (
        <Box key={key} sx={{ display: "flex", gap: 1, alignItems: "flex-start", mt: 2 }}>
          <input type="color" aria-label={`${label} picker`}
            value={isHexColor(colors[key]) ? colors[key] : DEFAULT_MAP_SIDEBAR[key]}
            disabled={saving}
            onChange={event => setDraft(current => ({ ...(current ?? DEFAULT_MAP_SIDEBAR), [key]: event.target.value }))}
            style={{ width: 44, height: 40, padding: 2, flexShrink: 0, border: "1px solid #ddd", borderRadius: 4 }} />
          <TextField label={label} size="small" fullWidth value={colors[key]} disabled={saving}
            error={!isHexColor(colors[key])}
            helperText={!isHexColor(colors[key]) ? "Use a six-digit hex color, such as #002856." : undefined}
            onChange={event => setDraft(current => ({ ...(current ?? DEFAULT_MAP_SIDEBAR), [key]: event.target.value }))} />
        </Box>
      ))}
      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Preview</Typography>
      <Box aria-label="Sidebar color preview" sx={{ p: 1.5, border: "1px solid", borderRadius: 1,
        backgroundColor: isHexColor(colors.backgroundColor) ? colors.backgroundColor : DEFAULT_MAP_SIDEBAR.backgroundColor,
        borderColor: isHexColor(colors.borderColor) ? colors.borderColor : DEFAULT_MAP_SIDEBAR.borderColor,
        color: isHexColor(colors.textColor) ? colors.textColor : DEFAULT_MAP_SIDEBAR.textColor,
      }}>
        <strong>Home</strong>
        <Box sx={{ borderTop: "1px solid", borderColor: "inherit", mt: 1, pt: 1 }}>
          Places and events
        </Box>
      </Box>
      <Button size="small" disabled={saving} onClick={() => setDraft(null)} sx={{ mt: 1 }}>Reset defaults</Button>
      {error && <Typography role="alert" color="error" sx={{ mt: 1 }}>{error}</Typography>}
      {!mapReady && <Typography variant="body2" sx={{ mt: 1 }}>Loading map...</Typography>}
      <Box sx={{ textAlign: "right", mt: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ mr: 1 }}>Cancel</Button>
        <Button variant="contained" disabled={!valid || saving || !mapReady} onClick={() => void save()}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </Box>
    </EditorPanel>
  );
}
