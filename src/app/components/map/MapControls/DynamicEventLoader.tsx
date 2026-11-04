"use client";

import { useEffect } from "react";
import { useMapId } from "@/app/context/MapContext";
import { eventKey } from "@/app/types/apiSources";
import { eventsLayerRef, GraphicRef } from "../arcgisRefs";
import { normalizeApiEvent } from "../apiEvents";
import { setSourceStatus } from "../apiSourceStore";
import { applyEventVisibility } from "../categories/categoryVisibility";
import { toGraphic } from "./eventsLayer";
import type { MapLoadTrace } from "../mapLoadTrace";

export default function DynamicEventLoader({ eventSources, refreshMs, debounceMs = 0, loadTrace }: {
  eventSources: string[];
  pastDays?: number;
  futureDays?: number;
  refreshMs?: number;
  debounceMs?: number;
  loadTrace?: MapLoadTrace;
}) {
  const mapId = useMapId();
  const signature = JSON.stringify(eventSources);
  useEffect(() => {
    const layer = eventsLayerRef.current;
    const Graphic = GraphicRef.current;
    if (!layer || !Graphic) return;
    let controller: AbortController | null = null;
    let graphics: any[] = [];
    const sources = JSON.parse(signature) as string[];
    const load = async () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      loadTrace?.mark("dynamic-events-start");
      sources.forEach(url => setSourceStatus(url, "loading"));
      await Promise.allSettled(sources.map(async sourceUrl => {
        try {
          const response = await fetch(sourceUrl, { signal: current.signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = await response.json();
          const records = Array.isArray(payload) ? payload : payload?.events ?? payload?.items ?? payload?.data ?? payload?.results;
          if (!Array.isArray(records)) throw new Error("API source did not return a list of records");
          const parsed = await Promise.all(records.map(record => normalizeApiEvent(record, sourceUrl, mapId)));
          if (current.signal.aborted) return;
          const seen = new Set<string>();
          const batch = parsed.flatMap(event => {
            if (!event || seen.has(eventKey(event))) return [];
            seen.add(eventKey(event));
            return [toGraphic(Graphic, event)];
          });
          const previous = graphics.filter(graphic => graphic.attributes?.sourceUrl === sourceUrl);
          layer.removeMany(previous);
          graphics = graphics.filter(graphic => graphic.attributes?.sourceUrl !== sourceUrl);
          layer.addMany(batch);
          graphics.push(...batch);
          applyEventVisibility();
          eventsLayerRef.events.dispatchEvent(new Event("change"));
          setSourceStatus(sourceUrl, "loaded");
          loadTrace?.mark("dynamic-events-source-loaded");
        } catch (error) {
          if (!current.signal.aborted) {
            console.warn(`Could not load API source ${sourceUrl}:`, error);
            setSourceStatus(sourceUrl, "error");
          }
        }
      }));
    };
    const timer = window.setTimeout(() => { void load(); }, debounceMs);
    const refresh = refreshMs && refreshMs > 0 ? window.setInterval(() => { void load(); }, Math.max(5000, refreshMs)) : null;
    return () => {
      window.clearTimeout(timer);
      if (refresh) window.clearInterval(refresh);
      controller?.abort();
      try { layer.removeMany(graphics); } catch { /* MapView may already be destroyed. */ }
      eventsLayerRef.events.dispatchEvent(new Event("change"));
    };
  }, [mapId, signature, refreshMs, debounceMs, loadTrace]);
  return null;
}
