//src/app/components/map/MapControls/DynamicEventLoader.tsx
"use client";

import { useEffect, useRef } from "react";
import { eventsLayerRef, GraphicRef, type CampusEvent } from "../arcgisRefs";
import { toGraphic as toEventGraphic } from "./eventsLayer";
import { lookupCoordinatesByLocation } from "./locationIndex";
import type { MapLoadTrace } from "../mapLoadTrace";

/**
 * Fetches events from external endpoints (eventSources) for a rolling time window,
 * then injects them into the events layer. The (self-contained) EventCalendarOverlay
 * handles visibility filtering on the map.
 */
export default function DynamicEventLoader(props: {
  eventSources: string[];
  pastDays?: number; // how many days back to include
  futureDays?: number; // how many days forward to include
  debounceMs?: number;
  refreshMs?: number; // optional periodic refresh interval
  loadTrace?: MapLoadTrace;
}) {
  const {
    eventSources,
    pastDays = 7, // Note: pastDays/futureDays are no longer used but kept for prop compatibility
    futureDays = 30,
    debounceMs = 0,
    refreshMs,
    loadTrace,
  } = props;

  const dynamicGraphicsRef = useRef<any[]>([]);
  const activeFetchAbortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const refreshRef = useRef<number | null>(null); // Helper: wait until map layer & Graphic are ready
  const dynamicLayerRef = useRef<any>(null);

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const dateToISODate = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // [REMOVED] computeRollingWindow function // --- Time normalization helpers ---

  const normalizeTime = (t: string) => {
    const trimmed = t.trim(); // Case 1: "HH:MM" / "H:MM"

    if (trimmed.includes(":")) {
      const [hhRaw, mmRaw] = trimmed.split(":", 2);
      const hh = Number(hhRaw);
      const mm = Number(mmRaw);
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return trimmed;
      return `${pad(hh)}:${pad(mm)}`;
    } // Case 2: just "HH" (e.g. "18")

    const hh = Number(trimmed);
    if (Number.isFinite(hh)) {
      return `${pad(hh)}:00`; // "18" -> "18:00"
    }

    return trimmed;
  };

  const buildIsoFromDateAndTime = (dateStr?: string, timeStr?: string) => {
    if (!dateStr || !timeStr) return null;
    const safeTime = normalizeTime(timeStr); // "18" -> "18:00", "18:0" -> "18:00"
    return `${dateStr}T${safeTime}:00`; // "2025-11-30T18:00:00"
  }; // Core: fetch & inject

  const fetchDynamic = async () => {
    if (!Array.isArray(eventSources) || eventSources.length === 0) return;

    // Mounted at MapView readiness; the event layer and Graphic are already set.
    const layer = eventsLayerRef.current as any;
    const Graphic = GraphicRef.current as any;
    if (!layer || !Graphic) return; // Abort previous fetch

    if (activeFetchAbortRef.current) {
      activeFetchAbortRef.current.abort();
    }
    const ctrl = new AbortController();
    loadTrace?.mark("dynamic-events-start");
    activeFetchAbortRef.current = ctrl; // Remove previous dynamic graphics
    dynamicLayerRef.current = layer;

    if (dynamicGraphicsRef.current.length) {
      try {
        layer.removeMany(dynamicGraphicsRef.current);
      } catch {}
      dynamicGraphicsRef.current = [];
    } // [REMOVED] from, to, and qs variables

    const requests = eventSources.map(async (baseUrl) => {
      const url = baseUrl;

      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const payload = await res.json(); // Expect { events: [...] } or an array

      const list: any[] = Array.isArray(payload?.events)
        ? payload.events
        : Array.isArray(payload)
          ? payload
          : []; // --- REFACTOR: Process all events in parallel ---

      const eventPromises = list.map(async (ev) => {
        try {
          // 1) Title
          const title = ev.title ?? ev.name ?? ev.event_name ?? "Event"; // 2) Start datetime: prefer ISO `start_dt`, else use date + start_at, else generic fallbacks

          let start: Date | null = null; // a) Try start_dt from backend (e.g. "2025-11-30T18:00:00")

          if (typeof ev.start_dt === "string" && ev.start_dt) {
            const candidate = new Date(ev.start_dt);
            if (!isNaN(candidate.getTime())) {
              start = candidate;
            }
          } // b) Fallback: combine date + start_at -> "YYYY-MM-DDTHH:MM:00"

          if (
            !start &&
            typeof ev.date === "string" &&
            typeof ev.start_at === "string"
          ) {
            const iso = buildIsoFromDateAndTime(ev.date, ev.start_at);
            if (iso) {
              const candidate = new Date(iso);
              if (!isNaN(candidate.getTime())) {
                start = candidate;
              }
            }
          } // c) LAST resort: generic `start` / `starts_at` fields (for other APIs)

          if (!start && typeof ev.start === "string") {
            const candidate = new Date(ev.start);
            if (!isNaN(candidate.getTime())) {
              start = candidate;
            }
          }
          if (!start && typeof ev.starts_at === "string") {
            const candidate = new Date(ev.starts_at);
            if (!isNaN(candidate.getTime())) {
              start = candidate;
            }
          }

          if (!start) {
            console.warn("Skipping event: invalid start date/time", ev);
            return null; // <-- Return null instead of continue
          } // 3) Coordinates from API (if present)

          let lat: number | null =
            ev.lat ?? ev.latitude ?? (typeof ev.y === "number" ? ev.y : null);

          let lon: number | null =
            ev.lon ??
            ev.lng ??
            ev.long ??
            ev.longitude ??
            (typeof ev.x === "number" ? ev.x : null); // 4) If no coordinates, try to resolve from `location` via campus JSONs

          if (
            (lat == null || lon == null) &&
            typeof ev.location === "string" &&
            ev.location.trim().length > 0
          ) {
            // This await is fine inside a .map passed to Promise.all
            const coords = await lookupCoordinatesByLocation(ev.location);
            if (coords) {
              lon = coords.x;
              lat = coords.y;
            }
          } // If we *still* don't have coordinates, skip this event

          if (typeof lat !== "number" || typeof lon !== "number") {
            console.warn("Skipping event: no coordinates", ev);
            return null; // <-- Return null instead of continue
          } // 5) Map backend fields to CampusEvent

          const host =
            typeof ev.host === "string" && ev.host.trim().length > 0
              ? ev.host
              : undefined;

          const ce: CampusEvent = {
            id: String(
              ev.id ?? ev.uuid ?? `api-${Date.now()}-${Math.random()}`,
            ),
            event_name: String(title),

            description:
              typeof ev.description === "string" ? ev.description : undefined, // Your backend already sends `date` as "YYYY-MM-DD"

            date: typeof ev.date === "string" ? ev.date : dateToISODate(start), // Backend uses "HH:MM" in start_at / end_at

            startAt:
              typeof ev.start_at === "string"
                ? normalizeTime(ev.start_at)
                : `${pad(start.getHours())}:${pad(start.getMinutes())}`,
            endAt:
              typeof ev.end_at === "string"
                ? normalizeTime(ev.end_at)
                : undefined, // You can decide what you want as locationTag; here we keep the raw string

            locationTag:
              typeof ev.location === "string" ? ev.location : undefined, // Use host as the sole "person" if you want
            fullLocationTag:
              typeof ev.location === "string" ? ev.location_at : undefined,
            location_at:
              typeof ev.location === "string" ? ev.location_at : undefined,

            names: host ? [host] : undefined,
            original: ev,
            geometry: { x: lon, y: lat, wkid: 4326 }, // 4326 → ArcGIS will project as needed
            fromUser: false,
            iconSize: 36,
            // iconUrl: "/icons/event-pin.png",
            iconUrl: ev.poster_path,
            poster_url: ev.poster_url,
          };

          const g = toEventGraphic(Graphic, ce);
          return g; // Return the graphic
        } catch (e) {
          console.warn("Skipping event due to parse error:", e);
          return null; // Return null on error
        }
      }); // Wait for all events from *this* source to be processed

      const graphics = (await Promise.all(eventPromises)).filter(
        (g) => g !== null,
      );
      if (ctrl.signal.aborted || activeFetchAbortRef.current !== ctrl) return;
      // Publish each source when it finishes, independently of slower sources.
      if (graphics.length) {
        layer.addMany(graphics);
        dynamicGraphicsRef.current.push(...graphics);
        eventsLayerRef.events.dispatchEvent(new Event("change"));
      }
      loadTrace?.mark("dynamic-events-source-loaded");
      return graphics; // Return the array of graphics
    });

    try {
      // Await settlement only for request cleanup, never for rendering a source.
      await Promise.allSettled(requests);
    } catch (e) {
      if ((e as any)?.name !== "AbortError") {
        console.error("Dynamic events fetch error:", e);
      }
    } finally {
      if (activeFetchAbortRef.current === ctrl) {
        activeFetchAbortRef.current = null;
      } // The self-contained calendar listens to graphics changes & will recompute/filter itself
    }
  }; // Debounce refetch whenever eventSources change

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (debounceMs > 0) {
      debounceRef.current = window.setTimeout(() => { void fetchDynamic(); }, debounceMs);
    } else {
      void fetchDynamic();
    }

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      activeFetchAbortRef.current?.abort();
    }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(eventSources), debounceMs]); // Optional periodic refresh

  useEffect(() => {
    if (!refreshMs || refreshMs <= 0) return;
    if (refreshRef.current) window.clearInterval(refreshRef.current);
    refreshRef.current = window.setInterval(
      () => {
        fetchDynamic();
      },
      Math.max(5_000, refreshMs),
    ) as unknown as number;
    return () => {
      if (refreshRef.current) {
        window.clearInterval(refreshRef.current);
        refreshRef.current = null;
      }
    }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMs, JSON.stringify(eventSources), pastDays, futureDays]); // Cleanup on unmount: abort & remove dynamic graphics

  useEffect(() => {
    return () => {
      try {
        activeFetchAbortRef.current?.abort();
      } catch {}
      const layer = dynamicLayerRef.current;
      if (layer && dynamicGraphicsRef.current.length) {
        try {
          layer.removeMany(dynamicGraphicsRef.current);
        } catch {}
      }
      dynamicGraphicsRef.current = [];
    };
  }, []);

  return null;
}
