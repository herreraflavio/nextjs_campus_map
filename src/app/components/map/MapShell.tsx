"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useMapId } from "@/app/context/MapContext";
import { MAP_SIDEBAR_LOADED, type MapSidebarLoadedEvent, type MapSidebarSettings } from "@/app/types/mapSidebar";
import { MAP_POPUP_LOADED, type MapPopupLoadedEvent, type MapPopupSettings } from "@/app/types/mapPopup";
import { settingsEvents } from "./arcgisRefs";
import { useApiSources } from "./apiSourceStore";
import MapColorsEditor from "./admin/MapColorsEditor";
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
  const [popup, setPopup] = useState<MapPopupSettings | null>(null);
  const [editingColors, setEditingColors] = useState<"sidebar" | "popup" | null>(null);
  useEffect(() => {
    setSidebar(null);
    setPopup(null);
    setEditingColors(null);
    const load = (event: Event) => {
      const detail = (event as CustomEvent<MapSidebarLoadedEvent>).detail;
      if (detail.mapId === mapId) setSidebar(detail.settings);
    };
    settingsEvents.addEventListener(MAP_SIDEBAR_LOADED, load);
    const loadPopup = (event: Event) => {
      const detail = (event as CustomEvent<MapPopupLoadedEvent>).detail;
      if (detail.mapId === mapId) setPopup(detail.settings);
    };
    settingsEvents.addEventListener(MAP_POPUP_LOADED, loadPopup);
    return () => {
      settingsEvents.removeEventListener(MAP_SIDEBAR_LOADED, load);
      settingsEvents.removeEventListener(MAP_POPUP_LOADED, loadPopup);
    };
  }, [mapId]);
  useEffect(() => {
    if (!canEdit || !ready) return;
    const editSidebar = () => setEditingColors("sidebar");
    const editPopup = () => setEditingColors("popup");
    settingsEvents.addEventListener("edit-sidebar-colors", editSidebar);
    settingsEvents.addEventListener("edit-popup-colors", editPopup);
    return () => {
      settingsEvents.removeEventListener("edit-sidebar-colors", editSidebar);
      settingsEvents.removeEventListener("edit-popup-colors", editPopup);
    };
  }, [canEdit, ready]);
  const appearance = {
    ...(sidebar ? {
      "--map-sidebar-background": sidebar.backgroundColor,
      "--map-sidebar-border": sidebar.borderColor,
      "--map-sidebar-text": sidebar.textColor,
    } : {}),
    ...(popup ? {
      "--map-popup-background": popup.backgroundColor,
      "--map-popup-border": popup.borderColor,
      "--map-popup-text": popup.textColor,
    } : {}),
  } as CSSProperties;
  return (
    <div className={styles.root} data-map-root data-popup-colors={popup ? "" : undefined} style={appearance}>
      <MapTopBar canEdit={canEdit} />
      {children}
      {canEdit && editingColors && <MapColorsEditor key={editingColors} target={editingColors}
        settings={editingColors === "sidebar" ? sidebar : popup}
        onSaved={editingColors === "sidebar" ? setSidebar : setPopup}
        onClose={() => setEditingColors(null)} />}
    </div>
  );
}
