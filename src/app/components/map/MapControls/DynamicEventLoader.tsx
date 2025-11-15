"use client";

import { useEffect, useRef } from "react";
import { eventsLayerRef, GraphicRef, type CampusEvent } from "../arcgisRefs";
import { toGraphic as toEventGraphic } from "./eventsLayer";
import { lookupCoordinatesByLocation } from "./locationIndex";

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
    pastDays = 7, // Note: pastDays/futureDays are no longer used but kept for prop compatibility
    futureDays = 30,
    debounceMs = 300,
    refreshMs,
  } = props;

  const dynamicGraphicsRef = useRef<any[]>([]);
  const activeFetchAbortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const refreshRef = useRef<number | null>(null); // Helper: wait until map layer & Graphic are ready

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
  } // Helpers for time window

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

    await waitUntilReady();
    const layer = eventsLayerRef.current as any;
    const Graphic = GraphicRef.current as any;
    if (!layer || !Graphic) return; // Abort previous fetch

    if (activeFetchAbortRef.current) {
      activeFetchAbortRef.current.abort();
    }
    const ctrl = new AbortController();
    activeFetchAbortRef.current = ctrl; // Remove previous dynamic graphics

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
              console.log(coords);
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

          const iconUrl =
            (typeof ev.poster_url === "string" && ev.poster_url) ||
            "/icons/event-pin.png";

          const ce: CampusEvent = {
            id: String(
              ev.id ?? ev.uuid ?? `api-${Date.now()}-${Math.random()}`
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

            names: host ? [host] : undefined,
            original: ev,
            geometry: { x: lon, y: lat, wkid: 4326 }, // 4326 → ArcGIS will project as needed
            fromUser: false,
            iconSize: 36,
            iconUrl: "/icons/event-pin.png",
          };

          console.log("Processed event:", ce);
          const g = toEventGraphic(Graphic, ce);
          return g; // Return the graphic
        } catch (e) {
          console.warn("Skipping event due to parse error:", e);
          return null; // Return null on error
        }
      }); // Wait for all events from *this* source to be processed

      const graphics = (await Promise.all(eventPromises)).filter(
        (g) => g !== null
      );
      return graphics; // Return the array of graphics
    });

    try {
      // Wait for all sources to be fetched and processed
      const results = await Promise.allSettled(requests); // --- NEW: Add all graphics from all sources in one batch ---

      const allGraphics: any[] = [];
      for (const result of results) {
        if (result.status === "fulfilled" && Array.isArray(result.value)) {
          // result.value is the array of graphics from one source
          allGraphics.push(...result.value);
        }
      }

      if (allGraphics.length > 0) {
        layer.addMany(allGraphics);
        dynamicGraphicsRef.current.push(...allGraphics);
        console.log(`Added ${allGraphics.length} dynamic events to map.`);

        //
        // 🎯 *** THIS IS THE FIX *** 🎯
        // Manually notify listeners that the layer contents have changed.
        //
        eventsLayerRef.events.dispatchEvent(new Event("change"));
      } else {
        console.log("No dynamic events to add.");
      } // --- End new logic ---
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
    debounceRef.current = window.setTimeout(() => {
      fetchDynamic();
    }, debounceMs) as unknown as number;

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(eventSources)]); // Optional periodic refresh

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
    }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMs, JSON.stringify(eventSources), pastDays, futureDays]); // Cleanup on unmount: abort & remove dynamic graphics

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
// "use client";

// import { useEffect, useRef } from "react";
// import { eventsLayerRef, GraphicRef, type CampusEvent } from "../arcgisRefs";
// import { toGraphic as toEventGraphic } from "./eventsLayer";
// import { lookupCoordinatesByLocation } from "./locationIndex";

// /**
//  * Fetches events from external endpoints (eventSources) for a rolling time window,
//  * then injects them into the events layer. The (self-contained) EventCalendarOverlay
//  * handles visibility filtering on the map.
//  */
// export default function DynamicEventLoader(props: {
//   eventSources: string[];
//   pastDays?: number; // how many days back to include
//   futureDays?: number; // how many days forward to include
//   debounceMs?: number;
//   refreshMs?: number; // optional periodic refresh interval
// }) {
//   const {
//     eventSources,
//     pastDays = 7, // Note: pastDays/futureDays are no longer used but kept for prop compatibility
//     futureDays = 30,
//     debounceMs = 300,
//     refreshMs,
//   } = props;

//   const dynamicGraphicsRef = useRef<any[]>([]);
//   const activeFetchAbortRef = useRef<AbortController | null>(null);
//   const debounceRef = useRef<number | null>(null);
//   const refreshRef = useRef<number | null>(null); // Helper: wait until map layer & Graphic are ready

//   function waitUntilReady(): Promise<void> {
//     return new Promise((resolve) => {
//       let tries = 0;
//       const tick = () => {
//         const layerReady = !!eventsLayerRef.current;
//         const graphicReady = !!GraphicRef.current;
//         if (layerReady && graphicReady) {
//           resolve();
//           return;
//         }
//         tries += 1;
//         if (tries > 200) {
//           // ~20s max wait
//           resolve();
//           return;
//         }
//         setTimeout(tick, 100);
//       };
//       tick();
//     });
//   } // Helpers for time window

//   const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
//   const dateToISODate = (d: Date) =>
//     `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // [REMOVED] computeRollingWindow function // --- Time normalization helpers ---

//   const normalizeTime = (t: string) => {
//     const trimmed = t.trim(); // Case 1: "HH:MM" / "H:MM"

//     if (trimmed.includes(":")) {
//       const [hhRaw, mmRaw] = trimmed.split(":", 2);
//       const hh = Number(hhRaw);
//       const mm = Number(mmRaw);
//       if (!Number.isFinite(hh) || !Number.isFinite(mm)) return trimmed;
//       return `${pad(hh)}:${pad(mm)}`;
//     } // Case 2: just "HH" (e.g. "18")

//     const hh = Number(trimmed);
//     if (Number.isFinite(hh)) {
//       return `${pad(hh)}:00`; // "18" -> "18:00"
//     }

//     return trimmed;
//   };

//   const buildIsoFromDateAndTime = (dateStr?: string, timeStr?: string) => {
//     if (!dateStr || !timeStr) return null;
//     const safeTime = normalizeTime(timeStr); // "18" -> "18:00", "18:0" -> "18:00"
//     return `${dateStr}T${safeTime}:00`; // "2025-11-30T18:00:00"
//   }; // Core: fetch & inject

//   const fetchDynamic = async () => {
//     if (!Array.isArray(eventSources) || eventSources.length === 0) return;

//     await waitUntilReady();
//     const layer = eventsLayerRef.current as any;
//     const Graphic = GraphicRef.current as any;
//     if (!layer || !Graphic) return; // Abort previous fetch

//     if (activeFetchAbortRef.current) {
//       activeFetchAbortRef.current.abort();
//     }
//     const ctrl = new AbortController();
//     activeFetchAbortRef.current = ctrl; // Remove previous dynamic graphics

//     if (dynamicGraphicsRef.current.length) {
//       try {
//         layer.removeMany(dynamicGraphicsRef.current);
//       } catch {}
//       dynamicGraphicsRef.current = [];
//     } // [REMOVED] from, to, and qs variables

//     const requests = eventSources.map(async (baseUrl) => {
//       const url = baseUrl;

//       const res = await fetch(url, { signal: ctrl.signal });
//       if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
//       const payload = await res.json(); // Expect { events: [...] } or an array

//       const list: any[] = Array.isArray(payload?.events)
//         ? payload.events
//         : Array.isArray(payload)
//         ? payload
//         : []; // --- REFACTOR: Process all events in parallel ---

//       const eventPromises = list.map(async (ev) => {
//         try {
//           // 1) Title
//           const title = ev.title ?? ev.name ?? ev.event_name ?? "Event"; // 2) Start datetime: prefer ISO `start_dt`, else use date + start_at, else generic fallbacks

//           let start: Date | null = null; // a) Try start_dt from backend (e.g. "2025-11-30T18:00:00")

//           if (typeof ev.start_dt === "string" && ev.start_dt) {
//             const candidate = new Date(ev.start_dt);
//             if (!isNaN(candidate.getTime())) {
//               start = candidate;
//             }
//           } // b) Fallback: combine date + start_at -> "YYYY-MM-DDTHH:MM:00"

//           if (
//             !start &&
//             typeof ev.date === "string" &&
//             typeof ev.start_at === "string"
//           ) {
//             const iso = buildIsoFromDateAndTime(ev.date, ev.start_at);
//             if (iso) {
//               const candidate = new Date(iso);
//               if (!isNaN(candidate.getTime())) {
//                 start = candidate;
//               }
//             }
//           } // c) LAST resort: generic `start` / `starts_at` fields (for other APIs)

//           if (!start && typeof ev.start === "string") {
//             const candidate = new Date(ev.start);
//             if (!isNaN(candidate.getTime())) {
//               start = candidate;
//             }
//           }
//           if (!start && typeof ev.starts_at === "string") {
//             const candidate = new Date(ev.starts_at);
//             if (!isNaN(candidate.getTime())) {
//               start = candidate;
//             }
//           }

//           if (!start) {
//             console.warn("Skipping event: invalid start date/time", ev);
//             return null; // <-- Return null instead of continue
//           } // 3) Coordinates from API (if present)

//           let lat: number | null =
//             ev.lat ?? ev.latitude ?? (typeof ev.y === "number" ? ev.y : null);

//           let lon: number | null =
//             ev.lon ??
//             ev.lng ??
//             ev.long ??
//             ev.longitude ??
//             (typeof ev.x === "number" ? ev.x : null); // 4) If no coordinates, try to resolve from `location` via campus JSONs

//           if (
//             (lat == null || lon == null) &&
//             typeof ev.location === "string" &&
//             ev.location.trim().length > 0
//           ) {
//             // This await is fine inside a .map passed to Promise.all
//             const coords = await lookupCoordinatesByLocation(ev.location);
//             if (coords) {
//               console.log(coords);
//               lon = coords.x;
//               lat = coords.y;
//             }
//           } // If we *still* don't have coordinates, skip this event

//           if (typeof lat !== "number" || typeof lon !== "number") {
//             console.warn("Skipping event: no coordinates", ev);
//             return null; // <-- Return null instead of continue
//           } // 5) Map backend fields to CampusEvent

//           const host =
//             typeof ev.host === "string" && ev.host.trim().length > 0
//               ? ev.host
//               : undefined;

//           const iconUrl =
//             (typeof ev.poster_url === "string" && ev.poster_url) ||
//             "/icons/event-pin.png";

//           const ce: CampusEvent = {
//             id: String(
//               ev.id ?? ev.uuid ?? `api-${Date.now()}-${Math.random()}`
//             ),
//             event_name: String(title),

//             description:
//               typeof ev.description === "string" ? ev.description : undefined, // Your backend already sends `date` as "YYYY-MM-DD"

//             date: typeof ev.date === "string" ? ev.date : dateToISODate(start), // Backend uses "HH:MM" in start_at / end_at

//             startAt:
//               typeof ev.start_at === "string"
//                 ? normalizeTime(ev.start_at)
//                 : `${pad(start.getHours())}:${pad(start.getMinutes())}`,
//             endAt:
//               typeof ev.end_at === "string"
//                 ? normalizeTime(ev.end_at)
//                 : undefined, // You can decide what you want as locationTag; here we keep the raw string

//             locationTag:
//               typeof ev.location === "string" ? ev.location : undefined, // Use host as the sole "person" if you want
//             fullLocationTag:
//               typeof ev.location === "string" ? ev.location_at : undefined,

//             names: host ? [host] : undefined,
//             original: ev,
//             geometry: { x: lon, y: lat, wkid: 4326 }, // 4326 → ArcGIS will project as needed
//             fromUser: false,
//             iconSize: 36,
//             iconUrl: "/icons/event-pin.png",
//           };

//           console.log("Processed event:", ce);
//           const g = toEventGraphic(Graphic, ce);
//           return g; // Return the graphic
//         } catch (e) {
//           console.warn("Skipping event due to parse error:", e);
//           return null; // Return null on error
//         }
//       }); // Wait for all events from *this* source to be processed

//       const graphics = (await Promise.all(eventPromises)).filter(
//         (g) => g !== null
//       );
//       return graphics; // Return the array of graphics
//     });

//     try {
//       // Wait for all sources to be fetched and processed
//       const results = await Promise.allSettled(requests); // --- NEW: Add all graphics from all sources in one batch ---

//       const allGraphics: any[] = [];
//       for (const result of results) {
//         if (result.status === "fulfilled" && Array.isArray(result.value)) {
//           // result.value is the array of graphics from one source
//           allGraphics.push(...result.value);
//         }
//       }

//       if (allGraphics.length > 0) {
//         layer.addMany(allGraphics);
//         dynamicGraphicsRef.current.push(...allGraphics);
//         console.log(`Added ${allGraphics.length} dynamic events to map.`);
//       } else {
//         console.log("No dynamic events to add.");
//       } // --- End new logic ---
//     } catch (e) {
//       if ((e as any)?.name !== "AbortError") {
//         console.error("Dynamic events fetch error:", e);
//       }
//     } finally {
//       if (activeFetchAbortRef.current === ctrl) {
//         activeFetchAbortRef.current = null;
//       } // The self-contained calendar listens to graphics changes & will recompute/filter itself
//     }
//   }; // Debounce refetch whenever eventSources change

//   useEffect(() => {
//     if (debounceRef.current) window.clearTimeout(debounceRef.current);
//     debounceRef.current = window.setTimeout(() => {
//       fetchDynamic();
//     }, debounceMs) as unknown as number;

//     return () => {
//       if (debounceRef.current) {
//         window.clearTimeout(debounceRef.current);
//         debounceRef.current = null;
//       }
//     }; // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [JSON.stringify(eventSources)]); // Optional periodic refresh

//   useEffect(() => {
//     if (!refreshMs || refreshMs <= 0) return;
//     if (refreshRef.current) window.clearInterval(refreshRef.current);
//     refreshRef.current = window.setInterval(() => {
//       fetchDynamic();
//     }, Math.max(5_000, refreshMs)) as unknown as number;
//     return () => {
//       if (refreshRef.current) {
//         window.clearInterval(refreshRef.current);
//         refreshRef.current = null;
//       }
//     }; // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [refreshMs, JSON.stringify(eventSources), pastDays, futureDays]); // Cleanup on unmount: abort & remove dynamic graphics

//   useEffect(() => {
//     return () => {
//       try {
//         activeFetchAbortRef.current?.abort();
//       } catch {}
//       const layer = eventsLayerRef.current as any;
//       if (layer && dynamicGraphicsRef.current.length) {
//         try {
//           layer.removeMany(dynamicGraphicsRef.current);
//         } catch {}
//       }
//       dynamicGraphicsRef.current = [];
//     };
//   }, []);

//   return null;
// }
// "use client";

// import { useEffect, useRef } from "react";
// import { eventsLayerRef, GraphicRef, type CampusEvent } from "../arcgisRefs";
// import { toGraphic as toEventGraphic } from "./eventsLayer";
// import { lookupCoordinatesByLocation } from "./locationIndex"; // 👈 NEW

// /**
//  * Fetches events from external endpoints (eventSources) for a rolling time window,
//  * then injects them into the events layer. The (self-contained) EventCalendarOverlay
//  * handles visibility filtering on the map.
//  */
// export default function DynamicEventLoader(props: {
//   eventSources: string[];
//   pastDays?: number; // how many days back to include
//   futureDays?: number; // how many days forward to include
//   debounceMs?: number;
//   refreshMs?: number; // optional periodic refresh interval
// }) {
//   const {
//     eventSources,
//     pastDays = 7,
//     futureDays = 30,
//     debounceMs = 300,
//     refreshMs,
//   } = props;

//   const dynamicGraphicsRef = useRef<any[]>([]);
//   const activeFetchAbortRef = useRef<AbortController | null>(null);
//   const debounceRef = useRef<number | null>(null);
//   const refreshRef = useRef<number | null>(null);

//   // Helper: wait until map layer & Graphic are ready
//   function waitUntilReady(): Promise<void> {
//     return new Promise((resolve) => {
//       let tries = 0;
//       const tick = () => {
//         const layerReady = !!eventsLayerRef.current;
//         const graphicReady = !!GraphicRef.current;
//         if (layerReady && graphicReady) {
//           resolve();
//           return;
//         }
//         tries += 1;
//         if (tries > 200) {
//           // ~20s max wait
//           resolve();
//           return;
//         }
//         setTimeout(tick, 100);
//       };
//       tick();
//     });
//   }

//   // Helpers for time window
//   const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
//   const dateToISODate = (d: Date) =>
//     `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

//   function computeRollingWindow(): { from: Date; to: Date } {
//     const now = new Date();
//     const from = new Date(
//       now.getFullYear(),
//       now.getMonth(),
//       now.getDate() - Math.max(0, pastDays),
//       0,
//       0,
//       0,
//       0
//     );
//     const to = new Date(
//       now.getFullYear(),
//       now.getMonth(),
//       now.getDate() + Math.max(0, futureDays),
//       23,
//       59,
//       59,
//       999
//     );
//     return { from, to };
//   }

//   // Core: fetch & inject
//   const fetchDynamic = async () => {
//     if (!Array.isArray(eventSources) || eventSources.length === 0) return;

//     await waitUntilReady();
//     const layer = eventsLayerRef.current as any;
//     const Graphic = GraphicRef.current as any;
//     if (!layer || !Graphic) return;

//     // Abort previous fetch
//     if (activeFetchAbortRef.current) {
//       activeFetchAbortRef.current.abort();
//     }
//     const ctrl = new AbortController();
//     activeFetchAbortRef.current = ctrl;

//     // Remove previous dynamic graphics
//     if (dynamicGraphicsRef.current.length) {
//       try {
//         layer.removeMany(dynamicGraphicsRef.current);
//       } catch {}
//       dynamicGraphicsRef.current = [];
//     }

//     const { from, to } = computeRollingWindow();
//     const qs = (d: Date) => encodeURIComponent(d.toISOString());

//     const requests = eventSources.map(async (baseUrl) => {
//       const url =
//         baseUrl.indexOf("?") >= 0
//           ? `${baseUrl}&from=${qs(from)}&to=${qs(to)}`
//           : `${baseUrl}?from=${qs(from)}&to=${qs(to)}`;

//       const res = await fetch(url, { signal: ctrl.signal });
//       if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
//       const payload = await res.json();

//       // Expect { events: [...] } or an array
//       const list: any[] = Array.isArray(payload?.events)
//         ? payload.events
//         : Array.isArray(payload)
//         ? payload
//         : [];
//       console.log(list);

//       // for (const ev of list) {
//       //   try {
//       //     const title = ev.title ?? ev.name ?? ev.event_name ?? "Event";
//       //   //will be start_at
//       //     const startRaw = ev.start ?? ev.start_at ?? ev.starts_at ?? ev.date;
//       // // will be change for location

//       //        const lat =
//       //       ev.lat ?? ev.latitude ?? (typeof ev.y === "number" ? ev.y : null);

//       //       const lon =
//       //       ev.lon ??
//       //       ev.lng ??
//       //       ev.long ??
//       //       ev.longitude ??
//       //       (typeof ev.x === "number" ? ev.x : null);

//       //     if (typeof lat !== "number" || typeof lon !== "number" || !startRaw)
//       //       continue;

//       //     const start = new Date(startRaw);
//       //     if (isNaN(start.getTime())) continue;
//       //     const fromUser = ev.fromUser;
//       //     const ce: CampusEvent = {
//       //       id: String(
//       //         ev.id ?? ev.uuid ?? `api-${Date.now()}-${Math.random()}`
//       //       ),
//       //       event_name: String(title),
//       //       description:
//       //         typeof ev.description === "string" ? ev.description : undefined,
//       //       date: dateToISODate(start),
//       //       startAt: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
//       //       endAt: undefined,
//       //       locationTag: undefined,
//       //       names: undefined,
//       //       original: ev,
//       //       geometry: { x: lon, y: lat, wkid: 4326 }, // 4326; toEventGraphic will handle projecting
//       //       fromUser: false,
//       //       iconSize: 36,
//       //       iconUrl: "/icons/event-pin.png",
//       //     };

//       //     const g = toEventGraphic(Graphic, ce);
//       //     layer.add(g);
//       //     dynamicGraphicsRef.current.push(g);
//       //   } catch (e) {
//       //     console.warn("Skipping event due to parse error:", e);
//       //   }
//       // }
//       for (const ev of list) {
//         try {
//           console.log("looking");
//           // 1) Title
//           const title = ev.title ?? ev.name ?? ev.event_name ?? "Event";
//           console.log("looking.");
//           // 2) Start datetime: your Python API uses `date` (YYYY-MM-DD) + `start_at` (HH:MM)
//           const startRaw =
//             ev.start ??
//             ev.start_at ??
//             ev.starts_at ??
//             ev.start_dt ?? // in case your backend sends ISO datetime
//             ev.date;
//           console.log("looking..");
//           if (!startRaw) continue;
//           console.log("looking...");
//           const start = new Date(startRaw);
//           console.log("looking....");
//           console.log(startRaw);
//           console.log(start);
//           console.log(start.getTime());
//           if (isNaN(start.getTime())) {
//             // If the backend only sends separate date + start_at strings, you can also do:
//             // const combined = `${ev.date}T${ev.start_at}:00`;
//             // const start = new Date(combined);
//             continue;
//           }
//           console.log("looking.....");
//           // 3) Coordinates from API (if present)
//           let lat: number | null =
//             ev.lat ?? ev.latitude ?? (typeof ev.y === "number" ? ev.y : null);
//           console.log("looking......");
//           let lon: number | null =
//             ev.lon ??
//             ev.lng ??
//             ev.long ??
//             ev.longitude ??
//             (typeof ev.x === "number" ? ev.x : null);

//           // 4) NEW: if no coordinates, try to resolve from `location`
//           console.log("no coordinates");
//           if (
//             (lat == null || lon == null) &&
//             typeof ev.location === "string" &&
//             ev.location.trim().length > 0
//           ) {
//             console.log("looking");
//             const coords = await lookupCoordinatesByLocation(ev.location);

//             if (coords) {
//               console.log(coords.x);
//               console.log(coords.y);
//               lon = coords.x;
//               lat = coords.y;
//             } else {
//               console.log("nothing found");
//             }
//           }

//           // If we *still* don't have coordinates, skip this event
//           if (typeof lat !== "number" || typeof lon !== "number") continue;

//           // 5) Map Python-ish fields to CampusEvent
//           const host =
//             typeof ev.host === "string" && ev.host.trim().length > 0
//               ? ev.host
//               : undefined;

//           const iconUrl =
//             (typeof ev.poster_url === "string" && ev.poster_url) ||
//             "/icons/event-pin.png";

//           const ce: CampusEvent = {
//             id: String(
//               ev.id ?? ev.uuid ?? `api-${Date.now()}-${Math.random()}`
//             ),
//             event_name: String(title),

//             description:
//               typeof ev.description === "string" ? ev.description : undefined,

//             // Your backend already sends `date` as "YYYY-MM-DD"
//             date: typeof ev.date === "string" ? ev.date : dateToISODate(start),

//             // Backend uses "HH:MM" in start_at / end_at
//             startAt:
//               typeof ev.start_at === "string"
//                 ? ev.start_at
//                 : `${pad(start.getHours())}:${pad(start.getMinutes())}`,
//             endAt: typeof ev.end_at === "string" ? ev.end_at : undefined,

//             // You can decide what you want as locationTag (raw string, or something else)
//             locationTag:
//               typeof ev.location === "string" ? ev.location : undefined,

//             // Use host as the sole "person" if you want
//             names: host ? [host] : undefined,

//             original: ev,

//             geometry: { x: lon, y: lat, wkid: 4326 }, // 4326 → ArcGIS will project as needed
//             fromUser: false,
//             iconSize: 36,
//             iconUrl,
//           };

//           const g = toEventGraphic(Graphic, ce);
//           layer.add(g);
//           dynamicGraphicsRef.current.push(g);
//         } catch (e) {
//           console.warn("Skipping event due to parse error:", e);
//         }
//       }
//     });

//     try {
//       await Promise.allSettled(requests);
//     } catch (e) {
//       if ((e as any)?.name !== "AbortError") {
//         console.error("Dynamic events fetch error:", e);
//       }
//     } finally {
//       if (activeFetchAbortRef.current === ctrl) {
//         activeFetchAbortRef.current = null;
//       }
//       // The self-contained calendar listens to graphics changes & will recompute/filter itself
//     }
//   };

//   // Debounce refetch whenever eventSources change
//   useEffect(() => {
//     if (debounceRef.current) window.clearTimeout(debounceRef.current);
//     debounceRef.current = window.setTimeout(() => {
//       fetchDynamic();
//     }, debounceMs) as unknown as number;

//     return () => {
//       if (debounceRef.current) {
//         window.clearTimeout(debounceRef.current);
//         debounceRef.current = null;
//       }
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [JSON.stringify(eventSources)]);

//   // Optional periodic refresh
//   useEffect(() => {
//     if (!refreshMs || refreshMs <= 0) return;
//     if (refreshRef.current) window.clearInterval(refreshRef.current);
//     refreshRef.current = window.setInterval(() => {
//       fetchDynamic();
//     }, Math.max(5_000, refreshMs)) as unknown as number;
//     return () => {
//       if (refreshRef.current) {
//         window.clearInterval(refreshRef.current);
//         refreshRef.current = null;
//       }
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [refreshMs, JSON.stringify(eventSources), pastDays, futureDays]);

//   // Cleanup on unmount: abort & remove dynamic graphics
//   useEffect(() => {
//     return () => {
//       try {
//         activeFetchAbortRef.current?.abort();
//       } catch {}
//       const layer = eventsLayerRef.current as any;
//       if (layer && dynamicGraphicsRef.current.length) {
//         try {
//           layer.removeMany(dynamicGraphicsRef.current);
//         } catch {}
//       }
//       dynamicGraphicsRef.current = [];
//     };
//   }, []);

//   return null;
// }
// "use client";

// import { useEffect, useRef } from "react";
// import {
//   eventsLayerRef,
//   GraphicRef,
//   MapViewRef,
//   type CampusEvent,
// } from "../arcgisRefs";
// import { toGraphic as toEventGraphic } from "./eventsLayer";
// import { lookupCoordinatesByLocation } from "./locationIndex";

// /**
//  * Simple lon/lat → WebMercator (EPSG:3857) converter.
//  * This keeps us consistent with the MapView SR.
//  */
// function toWebMercator(lon: number, lat: number): { x: number; y: number } {
//   const R = 6378137;
//   const rad = (d: number) => (d * Math.PI) / 180;
//   const x = R * rad(lon);
//   const y = R * Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2));
//   return { x, y };
// }

// /**
//  * Fetches events from external endpoints (eventSources) for a rolling time window,
//  * then injects them into the events layer.
//  */
// export default function DynamicEventLoader(props: {
//   eventSources: string[];
//   pastDays?: number; // how many days back to include
//   futureDays?: number; // how many days forward to include
//   debounceMs?: number;
//   refreshMs?: number; // optional periodic refresh interval
// }) {
//   const {
//     eventSources,
//     pastDays = 7,
//     futureDays = 30,
//     debounceMs = 300,
//     refreshMs,
//   } = props;

//   const dynamicGraphicsRef = useRef<any[]>([]);
//   const activeFetchAbortRef = useRef<AbortController | null>(null);
//   const debounceRef = useRef<number | null>(null);
//   const refreshRef = useRef<number | null>(null);

//   // Helpers for time window
//   const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
//   const dateToISODate = (d: Date) =>
//     `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

//   function computeRollingWindow(): { from: Date; to: Date } {
//     const now = new Date();
//     const from = new Date(
//       now.getFullYear(),
//       now.getMonth(),
//       now.getDate() - Math.max(0, pastDays),
//       0,
//       0,
//       0,
//       0
//     );
//     const to = new Date(
//       now.getFullYear(),
//       now.getMonth(),
//       now.getDate() + Math.max(0, futureDays),
//       23,
//       59,
//       59,
//       999
//     );
//     return { from, to };
//   }

//   // --- Time normalization helpers ---

//   const normalizeTime = (t: string) => {
//     const trimmed = t.trim();

//     // Case 1: "HH:MM" / "H:MM"
//     if (trimmed.includes(":")) {
//       const [hhRaw, mmRaw] = trimmed.split(":", 2);
//       const hh = Number(hhRaw);
//       const mm = Number(mmRaw);
//       if (!Number.isFinite(hh) || !Number.isFinite(mm)) return trimmed;
//       return `${pad(hh)}:${pad(mm)}`;
//     }

//     // Case 2: just "HH" (e.g. "18")
//     const hh = Number(trimmed);
//     if (Number.isFinite(hh)) {
//       return `${pad(hh)}:00`; // "18" -> "18:00"
//     }

//     return trimmed;
//   };

//   const buildIsoFromDateAndTime = (dateStr?: string, timeStr?: string) => {
//     if (!dateStr || !timeStr) return null;
//     const safeTime = normalizeTime(timeStr); // "06" -> "06:00"
//     return `${dateStr}T${safeTime}:00`; // "2025-11-15T06:00:00"
//   };

//   // Core: fetch & inject (with retry while layer/Graphic are not ready)
//   const fetchDynamic = async (retryCount = 0) => {
//     if (!Array.isArray(eventSources) || eventSources.length === 0) return;

//     const layer = eventsLayerRef.current as any;
//     const Graphic = GraphicRef.current as any;
//     const view = MapViewRef.current as any;

//     if (!layer || !Graphic || !view) {
//       if (retryCount < 20) {
//         console.warn(
//           "DynamicEventLoader: layer/Graphic/view not ready, retrying...",
//           retryCount
//         );
//         window.setTimeout(() => {
//           fetchDynamic(retryCount + 1);
//         }, 250);
//       } else {
//         console.warn(
//           "DynamicEventLoader: still not ready after retries; giving up."
//         );
//       }
//       return;
//     }

//     // Abort previous fetch
//     if (activeFetchAbortRef.current) {
//       activeFetchAbortRef.current.abort();
//     }
//     const ctrl = new AbortController();
//     activeFetchAbortRef.current = ctrl;

//     // Remove previous dynamic graphics
//     if (dynamicGraphicsRef.current.length) {
//       try {
//         console.log(
//           "DynamicEventLoader: removing previous dynamic graphics",
//           dynamicGraphicsRef.current.length
//         );
//         layer.removeMany(dynamicGraphicsRef.current);
//       } catch (err) {
//         console.warn("DynamicEventLoader: removeMany failed", err);
//       }
//       dynamicGraphicsRef.current = [];
//     }

//     const { from, to } = computeRollingWindow();
//     const qs = (d: Date) => encodeURIComponent(d.toISOString());

//     const requests = eventSources.map(async (baseUrl) => {
//       const url =
//         baseUrl.indexOf("?") >= 0
//           ? `${baseUrl}&from=${qs(from)}&to=${qs(to)}`
//           : `${baseUrl}?from=${qs(from)}&to=${qs(to)}`;

//       console.log("DynamicEventLoader: fetching", url);

//       const res = await fetch(url, { signal: ctrl.signal });
//       if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
//       const payload = await res.json();

//       // Your API returns a raw array like: [ { ... }, ... ]
//       const list: any[] = Array.isArray(payload)
//         ? payload
//         : Array.isArray(payload?.events)
//         ? payload.events
//         : [];

//       console.log("DynamicEventLoader: payload length", list.length);

//       for (const ev of list) {
//         try {
//           // 1) Title
//           const title =
//             ev.title ?? ev.name ?? ev.event_name ?? ev.event ?? "Event";

//           // 2) Start datetime: prefer ISO `start_dt`, else use date + start_at, else generic fallbacks
//           let start: Date | null = null;

//           // a) Try start_dt from backend (e.g. "2025-11-15T06:00:00")
//           if (typeof ev.start_dt === "string" && ev.start_dt) {
//             const candidate = new Date(ev.start_dt);
//             if (!isNaN(candidate.getTime())) {
//               start = candidate;
//             }
//           }

//           // b) Fallback: combine date + start_at -> "YYYY-MM-DDTHH:MM:00"
//           if (
//             !start &&
//             typeof ev.date === "string" &&
//             typeof ev.start_at === "string"
//           ) {
//             const iso = buildIsoFromDateAndTime(ev.date, ev.start_at);
//             if (iso) {
//               const candidate = new Date(iso);
//               if (!isNaN(candidate.getTime())) {
//                 start = candidate;
//               }
//             }
//           }

//           // c) LAST resort: generic `start` / `starts_at` fields (for other APIs)
//           if (!start && typeof ev.start === "string") {
//             const candidate = new Date(ev.start);
//             if (!isNaN(candidate.getTime())) {
//               start = candidate;
//             }
//           }
//           if (!start && typeof ev.starts_at === "string") {
//             const candidate = new Date(ev.starts_at);
//             if (!isNaN(candidate.getTime())) {
//               start = candidate;
//             }
//           }

//           if (!start) {
//             console.warn(
//               "DynamicEventLoader: Skipping event, bad start time",
//               ev
//             );
//             continue;
//           }

//           // 3) Coordinates in lon/lat
//           let lat: number | null =
//             ev.lat ?? ev.latitude ?? (typeof ev.y === "number" ? ev.y : null);

//           let lon: number | null =
//             ev.lon ??
//             ev.lng ??
//             ev.long ??
//             ev.longitude ??
//             (typeof ev.x === "number" ? ev.x : null);

//           // 4) If no coordinates, try to resolve from BOTH `location_at` and `location`
//           const locationKey: string | undefined =
//             typeof ev.location_at === "string" && ev.location_at.trim().length
//               ? ev.location_at
//               : typeof ev.location === "string" && ev.location.trim().length
//               ? ev.location
//               : undefined;

//           if ((lat == null || lon == null) && locationKey) {
//             try {
//               const coords = await lookupCoordinatesByLocation(locationKey);
//               if (coords) {
//                 lon = coords.x;
//                 lat = coords.y;
//                 console.log(
//                   "DynamicEventLoader: resolved coords from locationKey",
//                   locationKey,
//                   coords
//                 );
//               } else {
//                 console.warn(
//                   "DynamicEventLoader: no coords for locationKey",
//                   locationKey
//                 );
//               }
//             } catch (err) {
//               console.warn(
//                 "DynamicEventLoader: lookupCoordinatesByLocation failed",
//                 err
//               );
//             }
//           }

//           // 5) Convert to WebMercator (3857) or fall back to view center
//           let x3857: number;
//           let y3857: number;
//           let wkid = 3857;

//           if (typeof lon === "number" && typeof lat === "number") {
//             const wm = toWebMercator(lon, lat);
//             x3857 = wm.x;
//             y3857 = wm.y;
//           } else if (view?.center) {
//             x3857 = view.center.x;
//             y3857 = view.center.y;
//             wkid = view.center.spatialReference?.wkid ?? 3857;
//             console.warn(
//               "DynamicEventLoader: using view center for event with no coords",
//               ev
//             );
//           } else {
//             // Hard fallback (UC Merced-ish in 3857)
//             x3857 = -13405694.019024547;
//             y3857 = 4489223.854452545;
//             wkid = 3857;
//             console.warn(
//               "DynamicEventLoader: using hardcoded campus center for event",
//               ev
//             );
//           }

//           // 6) Map backend fields to CampusEvent
//           const host =
//             typeof ev.host === "string" && ev.host.trim().length > 0
//               ? ev.host
//               : undefined;

//           const iconUrl =
//             (typeof ev.poster_url === "string" && ev.poster_url) ||
//             "/icons/event-pin.png";

//           const ce: CampusEvent = {
//             id: String(
//               ev.id ?? ev.uuid ?? ev._id ?? `api-${Date.now()}-${Math.random()}`
//             ),
//             event_name: String(title),

//             description:
//               typeof ev.description === "string" ? ev.description : undefined,

//             // Backend already sends `date` as "YYYY-MM-DD"
//             date: typeof ev.date === "string" ? ev.date : dateToISODate(start),

//             // "HH:MM" style
//             startAt:
//               typeof ev.start_at === "string"
//                 ? normalizeTime(ev.start_at)
//                 : `${pad(start.getHours())}:${pad(start.getMinutes())}`,
//             endAt:
//               typeof ev.end_at === "string"
//                 ? normalizeTime(ev.end_at)
//                 : undefined,

//             // Location tags
//             locationTag:
//               typeof ev.location_at === "string" ? ev.location_at : undefined,
//             fullLocationTag:
//               typeof ev.location === "string" ? ev.location : undefined,

//             // Host as the "person"
//             names: host ? [host] : undefined,

//             original: ev,

//             geometry: {
//               x: x3857,
//               y: y3857,
//               wkid,
//             },

//             fromUser: false,
//             iconSize: 36,
//             iconUrl,
//           };

//           console.log("DynamicEventLoader: mapped event", ce);

//           let g: any;
//           try {
//             // Preferred path: reuse your existing symbol / attributes logic
//             g = toEventGraphic(Graphic, ce);
//           } catch (err) {
//             console.warn(
//               "DynamicEventLoader: toEventGraphic failed, falling back to raw Graphic",
//               err
//             );
//             try {
//               g = new (Graphic as any)({
//                 geometry: {
//                   type: "point",
//                   x: ce.geometry.x,
//                   y: ce.geometry.y,
//                   spatialReference: {
//                     wkid: ce.geometry.wkid ?? 3857,
//                   },
//                 },
//                 attributes: ce,
//               });
//             } catch (fallbackErr) {
//               console.error(
//                 "DynamicEventLoader: fallback Graphic creation failed, skipping event",
//                 fallbackErr,
//                 ev
//               );
//               continue;
//             }
//           }

//           layer.add(g);
//           dynamicGraphicsRef.current.push(g);
//         } catch (e) {
//           console.warn(
//             "DynamicEventLoader: Skipping event due to parse error:",
//             e,
//             ev
//           );
//         }
//       }
//     });

//     try {
//       await Promise.allSettled(requests);
//     } catch (e) {
//       if ((e as any)?.name !== "AbortError") {
//         console.error("Dynamic events fetch error:", e);
//       }
//     } finally {
//       if (activeFetchAbortRef.current === ctrl) {
//         activeFetchAbortRef.current = null;
//       }

//       const finalLayer = eventsLayerRef.current as any;
//       const count =
//         finalLayer?.graphics?.toArray?.().length ??
//         finalLayer?.graphics?.items?.length;
//       console.log("DynamicEventLoader: graphics count after fetch", count);
//     }
//   };

//   // Debounce refetch whenever eventSources change
//   useEffect(() => {
//     if (debounceRef.current) window.clearTimeout(debounceRef.current);
//     debounceRef.current = window.setTimeout(() => {
//       fetchDynamic();
//     }, debounceMs) as unknown as number;

//     return () => {
//       if (debounceRef.current) {
//         window.clearTimeout(debounceRef.current);
//         debounceRef.current = null;
//       }
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [JSON.stringify(eventSources)]);

//   // Optional periodic refresh
//   useEffect(() => {
//     if (!refreshMs || refreshMs <= 0) return;
//     if (refreshRef.current) window.clearInterval(refreshRef.current);
//     refreshRef.current = window.setInterval(() => {
//       fetchDynamic();
//     }, Math.max(5_000, refreshMs)) as unknown as number;
//     return () => {
//       if (refreshRef.current) {
//         window.clearInterval(refreshRef.current);
//         refreshRef.current = null;
//       }
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [refreshMs, JSON.stringify(eventSources), pastDays, futureDays]);

//   // Cleanup on unmount: abort & remove dynamic graphics
//   useEffect(() => {
//     return () => {
//       try {
//         activeFetchAbortRef.current?.abort();
//       } catch {}
//       const layer = eventsLayerRef.current as any;
//       if (layer && dynamicGraphicsRef.current.length) {
//         try {
//           layer.removeMany(dynamicGraphicsRef.current);
//         } catch (err) {
//           console.warn("DynamicEventLoader: cleanup removeMany failed", err);
//         }
//       }
//       dynamicGraphicsRef.current = [];
//     };
//   }, []);

//   return null;
// }

// "use client";

// import { useEffect, useRef } from "react";
// import {
//   eventsLayerRef,
//   GraphicRef,
//   eventsStore,
//   type CampusEvent,
// } from "../arcgisRefs";
// import { toGraphic as toEventGraphic } from "./eventsLayer";
// import { lookupCoordinatesByLocation } from "./locationIndex";

// /**
//  * Fetches events from external endpoints (eventSources) for a rolling time window,
//  * then injects them into the events layer. The EventCalendarOverlay listens to
//  * graphics changes (and a custom "added" event) and recomputes its timeline.
//  */
// export default function DynamicEventLoader(props: {
//   eventSources: string[];
//   pastDays?: number; // how many days back to include
//   futureDays?: number; // how many days forward to include
//   debounceMs?: number;
//   refreshMs?: number; // optional periodic refresh interval
// }) {
//   const {
//     eventSources,
//     pastDays = 7,
//     futureDays = 30,
//     debounceMs = 300,
//     refreshMs,
//   } = props;

//   const dynamicGraphicsRef = useRef<any[]>([]);
//   const activeFetchAbortRef = useRef<AbortController | null>(null);
//   const debounceRef = useRef<number | null>(null);
//   const refreshRef = useRef<number | null>(null);

//   // Helpers for time window
//   const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
//   const dateToISODate = (d: Date) =>
//     `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

//   function computeRollingWindow(): { from: Date; to: Date } {
//     const now = new Date();
//     const from = new Date(
//       now.getFullYear(),
//       now.getMonth(),
//       now.getDate() - Math.max(0, pastDays),
//       0,
//       0,
//       0,
//       0
//     );
//     const to = new Date(
//       now.getFullYear(),
//       now.getMonth(),
//       now.getDate() + Math.max(0, futureDays),
//       23,
//       59,
//       59,
//       999
//     );
//     return { from, to };
//   }

//   // --- Time normalization helpers ---

//   const normalizeTime = (t: string) => {
//     const trimmed = t.trim();

//     // Case 1: "HH:MM" / "H:MM"
//     const m = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
//     if (m) {
//       const [, hStr, mStr] = m;
//       const hh = Number(hStr);
//       const mm = Number(mStr);
//       if (!Number.isFinite(hh) || !Number.isFinite(mm)) return trimmed;
//       return `${pad(hh)}:${pad(mm)}`;
//     }

//     // Case 2: just "HH" (e.g. "18")
//     const hh = Number(trimmed);
//     if (Number.isFinite(hh)) {
//       return `${pad(hh)}:00`; // "18" -> "18:00"
//     }

//     return trimmed;
//   };

//   const buildIsoFromDateAndTime = (dateStr?: string, timeStr?: string) => {
//     if (!dateStr || !timeStr) return null;
//     const safeTime = normalizeTime(timeStr); // "18" -> "18:00", "6:0" -> "06:00"
//     return `${dateStr}T${safeTime}:00`; // "2025-11-30T18:00:00"
//   };

//   // Core: fetch & inject
//   const fetchDynamic = async () => {
//     if (!Array.isArray(eventSources) || eventSources.length === 0) return;

//     const layer = eventsLayerRef.current as any;
//     const Graphic = GraphicRef.current as any;
//     if (!layer || !Graphic) {
//       console.warn(
//         "DynamicEventLoader: eventsLayerRef or GraphicRef not ready; skipping fetch."
//       );
//       return;
//     }

//     // Abort previous fetch
//     if (activeFetchAbortRef.current) {
//       activeFetchAbortRef.current.abort();
//     }
//     const ctrl = new AbortController();
//     activeFetchAbortRef.current = ctrl;

//     // Remove previous dynamic graphics
//     if (dynamicGraphicsRef.current.length) {
//       try {
//         console.log(
//           "DynamicEventLoader: removing previous dynamic graphics",
//           dynamicGraphicsRef.current.length
//         );
//         layer.removeMany(dynamicGraphicsRef.current);
//       } catch (err) {
//         console.warn("DynamicEventLoader: removeMany failed", err);
//       }
//       dynamicGraphicsRef.current = [];
//     }

//     const { from, to } = computeRollingWindow();
//     const qs = (d: Date) => encodeURIComponent(d.toISOString());

//     const requests = eventSources.map(async (baseUrl) => {
//       const url =
//         baseUrl.indexOf("?") >= 0
//           ? `${baseUrl}&from=${qs(from)}&to=${qs(to)}`
//           : `${baseUrl}?from=${qs(from)}&to=${qs(to)}`;

//       console.log("DynamicEventLoader: fetching", url);

//       const res = await fetch(url, { signal: ctrl.signal });
//       if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
//       const payload = await res.json();

//       // Your API returns a raw array like: [ { ... }, ... ]
//       const list: any[] = Array.isArray(payload)
//         ? payload
//         : Array.isArray(payload?.events)
//         ? payload.events
//         : [];

//       console.log("DynamicEventLoader: payload length", list.length);

//       for (const ev of list) {
//         try {
//           // 1) Title
//           const title =
//             ev.title ?? ev.name ?? ev.event_name ?? ev.event ?? "Event";

//           // 2) Start datetime: prefer ISO `start_dt`, else use date + start_at, else generic fallbacks
//           let start: Date | null = null;

//           // a) Try start_dt from backend (e.g. "2025-11-15T06:00:00")
//           if (typeof ev.start_dt === "string" && ev.start_dt) {
//             const candidate = new Date(ev.start_dt);
//             if (!isNaN(candidate.getTime())) {
//               start = candidate;
//             }
//           }

//           // b) Fallback: combine date + start_at -> "YYYY-MM-DDTHH:MM:00"
//           if (
//             !start &&
//             typeof ev.date === "string" &&
//             typeof ev.start_at === "string"
//           ) {
//             const iso = buildIsoFromDateAndTime(ev.date, ev.start_at);
//             if (iso) {
//               const candidate = new Date(iso);
//               if (!isNaN(candidate.getTime())) {
//                 start = candidate;
//               }
//             }
//           }

//           // c) LAST resort: generic `start` / `starts_at` fields (for other APIs)
//           if (!start && typeof ev.start === "string") {
//             const candidate = new Date(ev.start);
//             if (!isNaN(candidate.getTime())) {
//               start = candidate;
//             }
//           }
//           if (!start && typeof ev.starts_at === "string") {
//             const candidate = new Date(ev.starts_at);
//             if (!isNaN(candidate.getTime())) {
//               start = candidate;
//             }
//           }

//           if (!start) {
//             console.warn(
//               "DynamicEventLoader: Skipping event, bad start time",
//               ev
//             );
//             continue;
//           }

//           // 3) Coordinates from API (if present)
//           let lat: number | null =
//             ev.lat ?? ev.latitude ?? (typeof ev.y === "number" ? ev.y : null);

//           let lon: number | null =
//             ev.lon ??
//             ev.lng ??
//             ev.long ??
//             ev.longitude ??
//             (typeof ev.x === "number" ? ev.x : null);

//           // 4) If no coordinates, try to resolve from BOTH `location_at` and `location`
//           const locationKey: string | undefined =
//             typeof ev.location_at === "string" && ev.location_at.trim().length
//               ? ev.location_at
//               : typeof ev.location === "string" && ev.location.trim().length
//               ? ev.location
//               : undefined;

//           if ((lat == null || lon == null) && locationKey) {
//             try {
//               const coords = await lookupCoordinatesByLocation(locationKey);
//               if (coords) {
//                 lon = coords.x;
//                 lat = coords.y;
//                 console.log(
//                   "DynamicEventLoader: resolved coords from locationKey",
//                   locationKey,
//                   coords
//                 );
//               } else {
//                 console.warn(
//                   "DynamicEventLoader: no coords for locationKey",
//                   locationKey
//                 );
//               }
//             } catch (err) {
//               console.warn(
//                 "DynamicEventLoader: lookupCoordinatesByLocation failed",
//                 err
//               );
//             }
//           }

//           // 5) If we *still* don't have coordinates, fall back to campus center
//           // so events still appear and are in the timeline.
//           if (typeof lat !== "number" || typeof lon !== "number") {
//             console.warn(
//               "DynamicEventLoader: no coords for event, using campus center",
//               ev
//             );
//             // UC Merced-ish center — adjust if you like
//             lon = -120.431;
//             lat = 37.363;
//           }

//           // 6) Map backend fields to CampusEvent (matching your original shape)
//           const host =
//             typeof ev.host === "string" && ev.host.trim().length > 0
//               ? ev.host
//               : undefined;

//           const ce: CampusEvent = {
//             id: String(
//               ev.id ?? ev.uuid ?? ev._id ?? `api-${Date.now()}-${Math.random()}`
//             ),
//             event_name: String(title),

//             description:
//               typeof ev.description === "string" ? ev.description : undefined,

//             // Backend already sends `date` as "YYYY-MM-DD"
//             date: typeof ev.date === "string" ? ev.date : dateToISODate(start),

//             // "HH:MM" style
//             startAt:
//               typeof ev.start_at === "string"
//                 ? normalizeTime(ev.start_at)
//                 : `${pad(start.getHours())}:${pad(start.getMinutes())}`,
//             endAt:
//               typeof ev.end_at === "string"
//                 ? normalizeTime(ev.end_at)
//                 : undefined,

//             // Location tags
//             locationTag:
//               typeof ev.location_at === "string" ? ev.location_at : undefined,
//             fullLocationTag:
//               typeof ev.location === "string" ? ev.location : undefined,

//             // Host as "person"
//             names: host ? [host] : undefined,

//             original: ev,

//             geometry: {
//               x: lon,
//               y: lat,
//               wkid: 4326, // 🔥 IMPORTANT: so lon/lat is treated as WGS84
//             },

//             fromUser: false,
//             iconSize: 36,
//             iconUrl:
//               (typeof ev.poster_url === "string" && ev.poster_url) ||
//               "/icons/event-pin.png",
//           };

//           console.log("DynamicEventLoader: adding event", ce);

//           const g = toEventGraphic(Graphic, ce);
//           layer.add(g);
//           dynamicGraphicsRef.current.push(g);
//         } catch (e) {
//           console.warn(
//             "DynamicEventLoader: Skipping event due to parse error:",
//             e,
//             ev
//           );
//         }
//       }
//     });

//     try {
//       await Promise.allSettled(requests);
//     } catch (e) {
//       if ((e as any)?.name !== "AbortError") {
//         console.error("Dynamic events fetch error:", e);
//       }
//     } finally {
//       if (activeFetchAbortRef.current === ctrl) {
//         activeFetchAbortRef.current = null;
//       }

//       // Explicitly notify listeners (in addition to layer.graphics "change")
//       try {
//         eventsStore?.events?.dispatchEvent(new Event("added"));
//       } catch (err) {
//         console.warn(
//           "DynamicEventLoader: failed to dispatch 'added' event",
//           err
//         );
//       }

//       const layer = eventsLayerRef.current as any;
//       const count =
//         layer?.graphics?.toArray?.().length ?? layer?.graphics?.items?.length;
//       console.log("DynamicEventLoader: graphics count after fetch", count);
//     }
//   };

//   // Debounce refetch whenever eventSources change
//   useEffect(() => {
//     if (debounceRef.current) window.clearTimeout(debounceRef.current);
//     debounceRef.current = window.setTimeout(() => {
//       fetchDynamic();
//     }, debounceMs) as unknown as number;

//     return () => {
//       if (debounceRef.current) {
//         window.clearTimeout(debounceRef.current);
//         debounceRef.current = null;
//       }
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [JSON.stringify(eventSources)]);

//   // Optional periodic refresh
//   useEffect(() => {
//     if (!refreshMs || refreshMs <= 0) return;
//     if (refreshRef.current) window.clearInterval(refreshRef.current);
//     refreshRef.current = window.setInterval(() => {
//       fetchDynamic();
//     }, Math.max(5_000, refreshMs)) as unknown as number;
//     return () => {
//       if (refreshRef.current) {
//         window.clearInterval(refreshRef.current);
//         refreshRef.current = null;
//       }
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [refreshMs, JSON.stringify(eventSources), pastDays, futureDays]);

//   // Cleanup on unmount: abort & remove dynamic graphics
//   useEffect(() => {
//     return () => {
//       try {
//         activeFetchAbortRef.current?.abort();
//       } catch {}
//       const layer = eventsLayerRef.current as any;
//       if (layer && dynamicGraphicsRef.current.length) {
//         try {
//           layer.removeMany(dynamicGraphicsRef.current);
//         } catch (err) {
//           console.warn("DynamicEventLoader: cleanup removeMany failed", err);
//         }
//       }
//       dynamicGraphicsRef.current = [];
//     };
//   }, []);

//   return null;
// }

// working version bellow with small bug
// "use client";

// import { useEffect, useRef } from "react";
// import { eventsLayerRef, GraphicRef, type CampusEvent } from "../arcgisRefs";
// import { toGraphic as toEventGraphic } from "./eventsLayer";
// import { lookupCoordinatesByLocation } from "./locationIndex";

// /**
//  * Fetches events from external endpoints (eventSources) for a rolling time window,
//  * then injects them into the events layer. The (self-contained) EventCalendarOverlay
//  * handles visibility filtering on the map.
//  */
// export default function DynamicEventLoader(props: {
//   eventSources: string[];
//   pastDays?: number; // how many days back to include
//   futureDays?: number; // how many days forward to include
//   debounceMs?: number;
//   refreshMs?: number; // optional periodic refresh interval
// }) {
//   const {
//     eventSources,
//     pastDays = 7,
//     futureDays = 30,
//     debounceMs = 300,
//     refreshMs,
//   } = props;

//   const dynamicGraphicsRef = useRef<any[]>([]);
//   const activeFetchAbortRef = useRef<AbortController | null>(null);
//   const debounceRef = useRef<number | null>(null);
//   const refreshRef = useRef<number | null>(null);

//   // Helper: wait until map layer & Graphic are ready
//   function waitUntilReady(): Promise<void> {
//     return new Promise((resolve) => {
//       let tries = 0;
//       const tick = () => {
//         const layerReady = !!eventsLayerRef.current;
//         const graphicReady = !!GraphicRef.current;
//         if (layerReady && graphicReady) {
//           resolve();
//           return;
//         }
//         tries += 1;
//         if (tries > 200) {
//           // ~20s max wait
//           resolve();
//           return;
//         }
//         setTimeout(tick, 100);
//       };
//       tick();
//     });
//   }

//   // Helpers for time window
//   const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
//   const dateToISODate = (d: Date) =>
//     `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

//   function computeRollingWindow(): { from: Date; to: Date } {
//     const now = new Date();
//     const from = new Date(
//       now.getFullYear(),
//       now.getMonth(),
//       now.getDate() - Math.max(0, pastDays),
//       0,
//       0,
//       0,
//       0
//     );
//     const to = new Date(
//       now.getFullYear(),
//       now.getMonth(),
//       now.getDate() + Math.max(0, futureDays),
//       23,
//       59,
//       59,
//       999
//     );
//     return { from, to };
//   }

//   // --- Time normalization helpers ---

//   const normalizeTime = (t: string) => {
//     const trimmed = t.trim();

//     // Case 1: "HH:MM" / "H:MM"
//     if (trimmed.includes(":")) {
//       const [hhRaw, mmRaw] = trimmed.split(":", 2);
//       const hh = Number(hhRaw);
//       const mm = Number(mmRaw);
//       if (!Number.isFinite(hh) || !Number.isFinite(mm)) return trimmed;
//       return `${pad(hh)}:${pad(mm)}`;
//     }

//     // Case 2: just "HH" (e.g. "18")
//     const hh = Number(trimmed);
//     if (Number.isFinite(hh)) {
//       return `${pad(hh)}:00`; // "18" -> "18:00"
//     }

//     return trimmed;
//   };

//   const buildIsoFromDateAndTime = (dateStr?: string, timeStr?: string) => {
//     if (!dateStr || !timeStr) return null;
//     const safeTime = normalizeTime(timeStr); // "18" -> "18:00", "18:0" -> "18:00"
//     return `${dateStr}T${safeTime}:00`; // "2025-11-30T18:00:00"
//   };

//   // Core: fetch & inject
//   const fetchDynamic = async () => {
//     if (!Array.isArray(eventSources) || eventSources.length === 0) return;

//     await waitUntilReady();
//     const layer = eventsLayerRef.current as any;
//     const Graphic = GraphicRef.current as any;
//     if (!layer || !Graphic) return;

//     // Abort previous fetch
//     if (activeFetchAbortRef.current) {
//       activeFetchAbortRef.current.abort();
//     }
//     const ctrl = new AbortController();
//     activeFetchAbortRef.current = ctrl;

//     // Remove previous dynamic graphics
//     if (dynamicGraphicsRef.current.length) {
//       try {
//         layer.removeMany(dynamicGraphicsRef.current);
//       } catch {}
//       dynamicGraphicsRef.current = [];
//     }

//     const { from, to } = computeRollingWindow();
//     const qs = (d: Date) => encodeURIComponent(d.toISOString());

//     const requests = eventSources.map(async (baseUrl) => {
//       const url =
//         baseUrl.indexOf("?") >= 0
//           ? `${baseUrl}&from=${qs(from)}&to=${qs(to)}`
//           : `${baseUrl}?from=${qs(from)}&to=${qs(to)}`;

//       const res = await fetch(url, { signal: ctrl.signal });
//       if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
//       const payload = await res.json();

//       // Expect { events: [...] } or an array
//       const list: any[] = Array.isArray(payload?.events)
//         ? payload.events
//         : Array.isArray(payload)
//         ? payload
//         : [];

//       for (const ev of list) {
//         try {
//           // 1) Title
//           const title = ev.title ?? ev.name ?? ev.event_name ?? "Event";

//           // 2) Start datetime: prefer ISO `start_dt`, else use date + start_at, else generic fallbacks
//           let start: Date | null = null;

//           // a) Try start_dt from backend (e.g. "2025-11-30T18:00:00")
//           if (typeof ev.start_dt === "string" && ev.start_dt) {
//             const candidate = new Date(ev.start_dt);
//             if (!isNaN(candidate.getTime())) {
//               start = candidate;
//             }
//           }

//           // b) Fallback: combine date + start_at -> "YYYY-MM-DDTHH:MM:00"
//           if (
//             !start &&
//             typeof ev.date === "string" &&
//             typeof ev.start_at === "string"
//           ) {
//             const iso = buildIsoFromDateAndTime(ev.date, ev.start_at);
//             if (iso) {
//               const candidate = new Date(iso);
//               if (!isNaN(candidate.getTime())) {
//                 start = candidate;
//               }
//             }
//           }

//           // c) LAST resort: generic `start` / `starts_at` fields (for other APIs)
//           if (!start && typeof ev.start === "string") {
//             const candidate = new Date(ev.start);
//             if (!isNaN(candidate.getTime())) {
//               start = candidate;
//             }
//           }
//           if (!start && typeof ev.starts_at === "string") {
//             const candidate = new Date(ev.starts_at);
//             if (!isNaN(candidate.getTime())) {
//               start = candidate;
//             }
//           }

//           if (!start) {
//             console.warn("Skipping event: invalid start date/time", ev);
//             continue;
//           }

//           // 3) Coordinates from API (if present)
//           let lat: number | null =
//             ev.lat ?? ev.latitude ?? (typeof ev.y === "number" ? ev.y : null);

//           let lon: number | null =
//             ev.lon ??
//             ev.lng ??
//             ev.long ??
//             ev.longitude ??
//             (typeof ev.x === "number" ? ev.x : null);

//           // 4) If no coordinates, try to resolve from `location` via campus JSONs
//           if (
//             (lat == null || lon == null) &&
//             typeof ev.location === "string" &&
//             ev.location.trim().length > 0
//           ) {
//             const coords = await lookupCoordinatesByLocation(ev.location);
//             if (coords) {
//               console.log(coords);
//               lon = coords.x;
//               lat = coords.y;
//             }
//           }

//           // If we *still* don't have coordinates, skip this event
//           if (typeof lat !== "number" || typeof lon !== "number") {
//             console.warn("Skipping event: no coordinates", ev);
//             continue;
//           }

//           // 5) Map backend fields to CampusEvent
//           const host =
//             typeof ev.host === "string" && ev.host.trim().length > 0
//               ? ev.host
//               : undefined;

//           const iconUrl =
//             (typeof ev.poster_url === "string" && ev.poster_url) ||
//             "/icons/event-pin.png";

//           const ce: CampusEvent = {
//             id: String(
//               ev.id ?? ev.uuid ?? `api-${Date.now()}-${Math.random()}`
//             ),
//             event_name: String(title),

//             description:
//               typeof ev.description === "string" ? ev.description : undefined,

//             // Your backend already sends `date` as "YYYY-MM-DD"
//             date: typeof ev.date === "string" ? ev.date : dateToISODate(start),

//             // Backend uses "HH:MM" in start_at / end_at
//             startAt:
//               typeof ev.start_at === "string"
//                 ? normalizeTime(ev.start_at)
//                 : `${pad(start.getHours())}:${pad(start.getMinutes())}`,
//             endAt:
//               typeof ev.end_at === "string"
//                 ? normalizeTime(ev.end_at)
//                 : undefined,

//             // You can decide what you want as locationTag; here we keep the raw string
//             locationTag:
//               typeof ev.location === "string" ? ev.location : undefined,

//             // Use host as the sole "person" if you want
//             names: host ? [host] : undefined,
//             original: ev,
//             geometry: { x: lon, y: lat, wkid: 4326 }, // 4326 → ArcGIS will project as needed
//             fromUser: false,
//             iconSize: 36,
//             iconUrl: "/icons/event-pin.png",
//           };

//           console.log(ce);
//           const g = toEventGraphic(Graphic, ce);
//           layer.add(g);
//           dynamicGraphicsRef.current.push(g);
//         } catch (e) {
//           console.warn("Skipping event due to parse error:", e);
//         }
//       }
//     });

//     try {
//       await Promise.allSettled(requests);
//     } catch (e) {
//       if ((e as any)?.name !== "AbortError") {
//         console.error("Dynamic events fetch error:", e);
//       }
//     } finally {
//       if (activeFetchAbortRef.current === ctrl) {
//         activeFetchAbortRef.current = null;
//       }
//       // The self-contained calendar listens to graphics changes & will recompute/filter itself
//     }
//   };

//   // Debounce refetch whenever eventSources change
//   useEffect(() => {
//     if (debounceRef.current) window.clearTimeout(debounceRef.current);
//     debounceRef.current = window.setTimeout(() => {
//       fetchDynamic();
//     }, debounceMs) as unknown as number;

//     return () => {
//       if (debounceRef.current) {
//         window.clearTimeout(debounceRef.current);
//         debounceRef.current = null;
//       }
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [JSON.stringify(eventSources)]);

//   // Optional periodic refresh
//   useEffect(() => {
//     if (!refreshMs || refreshMs <= 0) return;
//     if (refreshRef.current) window.clearInterval(refreshRef.current);
//     refreshRef.current = window.setInterval(() => {
//       fetchDynamic();
//     }, Math.max(5_000, refreshMs)) as unknown as number;
//     return () => {
//       if (refreshRef.current) {
//         window.clearInterval(refreshRef.current);
//         refreshRef.current = null;
//       }
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [refreshMs, JSON.stringify(eventSources), pastDays, futureDays]);

//   // Cleanup on unmount: abort & remove dynamic graphics
//   useEffect(() => {
//     return () => {
//       try {
//         activeFetchAbortRef.current?.abort();
//       } catch {}
//       const layer = eventsLayerRef.current as any;
//       if (layer && dynamicGraphicsRef.current.length) {
//         try {
//           layer.removeMany(dynamicGraphicsRef.current);
//         } catch {}
//       }
//       dynamicGraphicsRef.current = [];
//     };
//   }, []);

//   return null;
// }
