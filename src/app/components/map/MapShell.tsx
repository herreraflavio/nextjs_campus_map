"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useMapId } from "@/app/context/MapContext";
import { MAP_SIDEBAR_LOADED, type MapSidebarLoadedEvent, type MapSidebarSettings } from "@/app/types/mapSidebar";
import { settingsEvents } from "./arcgisRefs";
import { useApiSources } from "./apiSourceStore";
import MapSidebarEditor from "./admin/MapSidebarEditor";
import MapTopBar from "./MapTopBar";
import styles from "./MapShell.module.css";

// One map root for the builder and iframe: header first, then sidebar/map body.
export default function MapShell({ children, canEdit = false }: {
  children: ReactNode;
  canEdit?: boolean;
}) {
  const mapId = useMapId();
  const { ready } = useApiSources();
  const [sidebar, setSidebar] = useState<MapSidebarSettings | null>(null);
  const [editingSidebar, setEditingSidebar] = useState(false);
  useEffect(() => {
    setSidebar(null);
    setEditingSidebar(false);
    const load = (event: Event) => {
      const detail = (event as CustomEvent<MapSidebarLoadedEvent>).detail;
      if (detail.mapId === mapId) setSidebar(detail.settings);
    };
    settingsEvents.addEventListener(MAP_SIDEBAR_LOADED, load);
    return () => settingsEvents.removeEventListener(MAP_SIDEBAR_LOADED, load);
  }, [mapId]);
  useEffect(() => {
    if (!canEdit || !ready) return;
    const edit = () => setEditingSidebar(true);
    settingsEvents.addEventListener("edit-sidebar-colors", edit);
    return () => settingsEvents.removeEventListener("edit-sidebar-colors", edit);
  }, [canEdit, ready]);
  const appearance = sidebar ? {
    "--map-sidebar-background": sidebar.backgroundColor,
    "--map-sidebar-border": sidebar.borderColor,
    "--map-sidebar-text": sidebar.textColor,
  } as CSSProperties : undefined;
  return (
    <div className={styles.root} data-map-root style={appearance}>
      <MapTopBar canEdit={canEdit} />
      {children}
      {canEdit && editingSidebar && <MapSidebarEditor settings={sidebar} onSaved={setSidebar}
        onClose={() => setEditingSidebar(false)} />}
    </div>
  );
}
