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

  // --- Time normalization helpers ---

  const normalizeTime = (t: string) => {
    const trimmed = t.trim();

    // Case 1: "HH:MM" / "H:MM"
    if (trimmed.includes(":")) {
      const [hhRaw, mmRaw] = trimmed.split(":", 2);
      const hh = Number(hhRaw);
      const mm = Number(mmRaw);
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return trimmed;
      return `${pad(hh)}:${pad(mm)}`;
    }

    // Case 2: just "HH" (e.g. "18")
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
  };

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
          // 1) Title
          const title = ev.title ?? ev.name ?? ev.event_name ?? "Event";

          // 2) Start datetime: prefer ISO `start_dt`, else use date + start_at, else generic fallbacks
          let start: Date | null = null;

          // a) Try start_dt from backend (e.g. "2025-11-30T18:00:00")
          if (typeof ev.start_dt === "string" && ev.start_dt) {
            const candidate = new Date(ev.start_dt);
            if (!isNaN(candidate.getTime())) {
              start = candidate;
            }
          }

          // b) Fallback: combine date + start_at -> "YYYY-MM-DDTHH:MM:00"
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
          }

          // c) LAST resort: generic `start` / `starts_at` fields (for other APIs)
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
            continue;
          }

          // 3) Coordinates from API (if present)
          let lat: number | null =
            ev.lat ?? ev.latitude ?? (typeof ev.y === "number" ? ev.y : null);

          let lon: number | null =
            ev.lon ??
            ev.lng ??
            ev.long ??
            ev.longitude ??
            (typeof ev.x === "number" ? ev.x : null);

          // 4) If no coordinates, try to resolve from `location` via campus JSONs
          if (
            (lat == null || lon == null) &&
            typeof ev.location === "string" &&
            ev.location.trim().length > 0
          ) {
            const coords = await lookupCoordinatesByLocation(ev.location);
            if (coords) {
              console.log(coords);
              lon = coords.x;
              lat = coords.y;
            }
          }

          // If we *still* don't have coordinates, skip this event
          if (typeof lat !== "number" || typeof lon !== "number") {
            console.warn("Skipping event: no coordinates", ev);
            continue;
          }

          // 5) Map backend fields to CampusEvent
          const host =
            typeof ev.host === "string" && ev.host.trim().length > 0
              ? ev.host
              : undefined;

          const iconUrl =
            (typeof ev.poster_url === "string" && ev.poster_url) ||
            "/icons/event-pin.png";

          // const ce: CampusEvent = {
          //   id: String(
          //     ev.id ?? ev.uuid ?? `api-${Date.now()}-${Math.random()}`
          //   ),
          //   event_name: String(title),

          //   description:
          //     typeof ev.description === "string" ? ev.description : undefined,

          //   // Your backend already sends `date` as "YYYY-MM-DD"
          //   date: typeof ev.date === "string" ? ev.date : dateToISODate(start),

          //   // Backend uses "HH:MM" in start_at / end_at
          //   startAt:
          //     typeof ev.start_at === "string"
          //       ? normalizeTime(ev.start_at)
          //       : `${pad(start.getHours())}:${pad(start.getMinutes())}`,
          //   endAt:
          //     typeof ev.end_at === "string"
          //       ? normalizeTime(ev.end_at)
          //       : undefined,

          //   // You can decide what you want as locationTag; here we keep the raw string
          //   locationTag:
          //     typeof ev.location === "string" ? ev.location : undefined,

          //   // Use host as the sole "person" if you want
          //   names: host ? [host] : undefined,

          //   original: ev,

          //   // geometry: { x: lon, y: lat, wkid: 4326 }, // 4326 → ArcGIS will project as needed

          //   geometry: {
          //     x: -13405891.265299773,
          //     y: 4489792.134399914,
          //     wkid: 3857,
          //   },
          //   fromUser: false,
          //   iconSize: 36,
          //   iconUrl,
          // };

          const ce: CampusEvent = {
            // id: "evt-1",
            // event_name: "Club Fair",
            // description: "Meet campus orgs",
            // date: "2025-09-15",
            // startAt: "12:00",
            // endAt: "15:00",
            // locationTag: "ballroom",
            // names: ["ASUCM", "Clubs Council"],
            id: String(
              ev.id ?? ev.uuid ?? `api-${Date.now()}-${Math.random()}`
            ),
            event_name: String(title),

            description:
              typeof ev.description === "string" ? ev.description : undefined,

            // Your backend already sends `date` as "YYYY-MM-DD"
            date: typeof ev.date === "string" ? ev.date : dateToISODate(start),

            // Backend uses "HH:MM" in start_at / end_at
            startAt:
              typeof ev.start_at === "string"
                ? normalizeTime(ev.start_at)
                : `${pad(start.getHours())}:${pad(start.getMinutes())}`,
            endAt:
              typeof ev.end_at === "string"
                ? normalizeTime(ev.end_at)
                : undefined,

            // You can decide what you want as locationTag; here we keep the raw string
            locationTag:
              typeof ev.location === "string" ? ev.location : undefined,

            // Use host as the sole "person" if you want
            names: host ? [host] : undefined,
            original: ev,
            // geometry: {
            //   x: -13405891.265299773,
            //   y: 4489792.134399914,
            //   wkid: 3857,
            // },
            geometry: { x: lon, y: lat, wkid: 4326 }, // 4326 → ArcGIS will project as needed
            fromUser: true,
            iconSize: 36,
            iconUrl: "/icons/event-pin.png",
            // iconUrl,
          };

          console.log(ce);
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
