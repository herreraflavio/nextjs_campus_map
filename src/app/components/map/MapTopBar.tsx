"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_MAP_TOP_BAR,
  MAP_TOP_BAR_LOADED,
  normalizeMapTopBar,
  type MapTopBarLoadedEvent,
} from "@/app/types/mapTopBar";
import { useMapId } from "@/app/context/MapContext";
import { settingsEvents } from "./arcgisRefs";
import { EditIconButton } from "./sidebar/MapSidebar";
import MapTopBarEditor from "./admin/MapTopBarEditor";
import styles from "./MapTopBar.module.css";

export default function MapTopBar({ canEdit = false }: { canEdit?: boolean }) {
  const mapId = useMapId();
  const [saved, setSaved] = useState(() => ({ ...DEFAULT_MAP_TOP_BAR }));
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setSaved({ ...DEFAULT_MAP_TOP_BAR });
    setEditing(false);
    setLoaded(false);
    const load = (event: Event) => {
      const detail = (event as CustomEvent<MapTopBarLoadedEvent>).detail;
      if (detail.mapId !== mapId) return;
      setSaved(normalizeMapTopBar(detail.settings));
      setLoaded(true);
    };
    settingsEvents.addEventListener(MAP_TOP_BAR_LOADED, load);
    return () => settingsEvents.removeEventListener(MAP_TOP_BAR_LOADED, load);
  }, [mapId]);
  useEffect(() => {
    if (!canEdit || !loaded) return;
    const edit = () => setEditing(true);
    settingsEvents.addEventListener("edit-top-bar", edit);
    return () => settingsEvents.removeEventListener("edit-top-bar", edit);
  }, [canEdit, loaded]);

  return (
    <>
      <header
        className={styles.bar}
        style={{ backgroundColor: saved.backgroundColor }}
        aria-label="Map top bar"
      >
        {saved.logoUrl && (
          <img className={styles.logo} src={saved.logoUrl} alt="Map logo" />
        )}
        {!saved.logoUrl && canEdit && (
          <button
            type="button"
            className={styles.placeholder}
            disabled={!loaded}
            onClick={() => setEditing(true)}
          >
            Add map logo
          </button>
        )}
        {canEdit && (
          <span className={styles.edit}>
            <EditIconButton
              label="Edit Map Top Bar"
              disabled={!loaded}
              onClick={() => setEditing(true)}
            />
          </span>
        )}
      </header>
      {canEdit && editing && (
        <MapTopBarEditor
          settings={saved}
          onSaved={setSaved}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
