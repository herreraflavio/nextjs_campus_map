"use client";

import { useEffect, useRef } from "react";
import { eventsLayerRef, GraphicRef, type CampusEvent } from "../arcgisRefs";
import { toGraphic as toEventGraphic } from "./eventsLayer";

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
}) {
  const {
    eventSources,
    pastDays = 7,
    futureDays = 30,
    debounceMs = 300,
    refreshMs,
  } = props;

  const dynamicGraphicsRef = useRef<any[]>([]);
  const activeFetchAbortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const refreshRef = useRef<number | null>(null);

  // Helper: wait until map layer & Graphic are ready
  function waitUntilReady(): Promise<void> {
    return new Promise((resolve) => {
      let tries = 0;
      const tick = () => {
        const layerReady = !!eventsLayerRef.current;
        const graphicReady = !!GraphicRef.current;
        if (layerReady && graphicReady) {
          resolve();
          return;
        }
        tries += 1;
        if (tries > 200) {
          // ~20s max wait
          resolve();
          return;
        }
        setTimeout(tick, 100);
      };
      tick();
    });
  }

  // Helpers for time window
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const dateToISODate = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  function computeRollingWindow(): { from: Date; to: Date } {
    const now = new Date();
    const from = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - Math.max(0, pastDays),
      0,
      0,
      0,
      0
    );
    const to = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + Math.max(0, futureDays),
      23,
      59,
      59,
      999
    );
    return { from, to };
  }

  // Core: fetch & inject
  const fetchDynamic = async () => {
    if (!Array.isArray(eventSources) || eventSources.length === 0) return;

    await waitUntilReady();
    const layer = eventsLayerRef.current as any;
    const Graphic = GraphicRef.current as any;
    if (!layer || !Graphic) return;

    // Abort previous fetch
    if (activeFetchAbortRef.current) {
      activeFetchAbortRef.current.abort();
    }
    const ctrl = new AbortController();
    activeFetchAbortRef.current = ctrl;

    // Remove previous dynamic graphics
    if (dynamicGraphicsRef.current.length) {
      try {
        layer.removeMany(dynamicGraphicsRef.current);
      } catch {}
      dynamicGraphicsRef.current = [];
    }

    const { from, to } = computeRollingWindow();
    const qs = (d: Date) => encodeURIComponent(d.toISOString());

    const requests = eventSources.map(async (baseUrl) => {
      const url =
        baseUrl.indexOf("?") >= 0
          ? `${baseUrl}&from=${qs(from)}&to=${qs(to)}`
          : `${baseUrl}?from=${qs(from)}&to=${qs(to)}`;

      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const payload = await res.json();

      // Expect { events: [...] } or an array
      const list: any[] = Array.isArray(payload?.events)
        ? payload.events
        : Array.isArray(payload)
        ? payload
        : [];

      for (const ev of list) {
        try {
          const title = ev.title ?? ev.name ?? ev.event_name ?? "Event";
          const startRaw = ev.start ?? ev.start_at ?? ev.starts_at ?? ev.date;
          const lat =
            ev.lat ?? ev.latitude ?? (typeof ev.y === "number" ? ev.y : null);
          const lon =
            ev.lon ??
            ev.lng ??
            ev.long ??
            ev.longitude ??
            (typeof ev.x === "number" ? ev.x : null);

          if (typeof lat !== "number" || typeof lon !== "number" || !startRaw)
            continue;

          const start = new Date(startRaw);
          if (isNaN(start.getTime())) continue;
          const fromUser = ev.fromUser;
          const ce: CampusEvent = {
            id: String(
              ev.id ?? ev.uuid ?? `api-${Date.now()}-${Math.random()}`
            ),
            event_name: String(title),
            description:
              typeof ev.description === "string" ? ev.description : undefined,
            date: dateToISODate(start),
            startAt: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
            endAt: undefined,
            locationTag: undefined,
            names: undefined,
            original: ev,
            geometry: { x: lon, y: lat, wkid: 4326 }, // 4326; toEventGraphic will handle projecting
            fromUser: false,
            iconSize: 36,
            iconUrl: "/icons/event-pin.png",
          };

          const g = toEventGraphic(Graphic, ce);
          layer.add(g);
          dynamicGraphicsRef.current.push(g);
        } catch (e) {
          console.warn("Skipping event due to parse error:", e);
        }
      }
    });

    try {
      await Promise.allSettled(requests);
    } catch (e) {
      if ((e as any)?.name !== "AbortError") {
        console.error("Dynamic events fetch error:", e);
      }
    } finally {
      if (activeFetchAbortRef.current === ctrl) {
        activeFetchAbortRef.current = null;
      }
      // The self-contained calendar listens to graphics changes & will recompute/filter itself
    }
  };

  // Debounce refetch whenever eventSources change
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      fetchDynamic();
    }, debounceMs) as unknown as number;

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(eventSources)]);

  // Optional periodic refresh
  useEffect(() => {
    if (!refreshMs || refreshMs <= 0) return;
    if (refreshRef.current) window.clearInterval(refreshRef.current);
    refreshRef.current = window.setInterval(() => {
      fetchDynamic();
    }, Math.max(5_000, refreshMs)) as unknown as number;
    return () => {
      if (refreshRef.current) {
        window.clearInterval(refreshRef.current);
        refreshRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMs, JSON.stringify(eventSources), pastDays, futureDays]);

  // Cleanup on unmount: abort & remove dynamic graphics
  useEffect(() => {
    return () => {
      try {
        activeFetchAbortRef.current?.abort();
      } catch {}
      const layer = eventsLayerRef.current as any;
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
