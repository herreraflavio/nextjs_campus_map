"use client";

import { useEffect, useState } from "react";
import { useMapId } from "@/app/context/MapContext";
import { normalizeApiSourceTabs } from "@/app/types/apiSources";
import { settingsEvents, settingsRef } from "./arcgisRefs";

export type SourceStatus = "loading" | "loaded" | "error";
const statuses = new Map<string, SourceStatus>();
const changes = new EventTarget();
let loadedMapId: string | null = null;
let failedMapId: string | null = null;

export function resetApiSourceStatuses(): void {
  loadedMapId = null;
  failedMapId = null;
  statuses.clear();
  changes.dispatchEvent(new Event("change"));
}

export function markApiSourcesLoaded(mapId: string): void {
  loadedMapId = mapId;
  failedMapId = null;
  changes.dispatchEvent(new Event("change"));
}

export function markMapConfigurationFailed(mapId: string): void {
  failedMapId = mapId;
  changes.dispatchEvent(new Event("change"));
}

export function setSourceStatus(url: string, status: SourceStatus): void {
  statuses.set(url, status);
  changes.dispatchEvent(new Event("change"));
}

export function useApiSources() {
  const mapId = useMapId();
  const [, update] = useState(0);
  useEffect(() => {
    const sync = () => update(value => value + 1);
    settingsEvents.addEventListener("change", sync);
    changes.addEventListener("change", sync);
    return () => {
      settingsEvents.removeEventListener("change", sync);
      changes.removeEventListener("change", sync);
    };
  }, []);
  const ready = loadedMapId === mapId;
  const sources = ready ? normalizeApiSourceTabs(settingsRef.current.apiSources, settingsRef.current.apiSourceTabs) : [];
  return { sources, statuses, ready, configurationFailed: failedMapId === mapId };
}
