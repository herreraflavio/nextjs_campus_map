import { apiSourceId } from "@/app/types/apiSources";
import type { CampusEvent } from "./arcgisRefs";
import { resolveEventLocation } from "./eventLocations";
import { waitForMapHydration } from "./mapHydration";

function number(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function time(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw || !/^\d{1,2}(:\d{1,2})?$/.test(raw)) return raw;
  const [hour, minute = "0"] = raw.split(":");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}
function imageUrl(value: unknown, source: string): string | undefined {
  if (!text(value)) return undefined;
  try {
    const url = new URL(String(value), source);
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : undefined;
  } catch { return undefined; }
}

export async function normalizeApiEvent(raw: any, sourceUrl: string, mapId: string): Promise<CampusEvent | null> {
  if (!raw || typeof raw !== "object") return null;
  const title = String(raw.title ?? raw.name ?? raw.event_name ?? "Event");
  const location = text(raw.location);
  const idValue = raw.id ?? raw.page_id ?? raw.uuid ?? raw._id?.$oid ?? raw._id;
  const id = ((typeof idValue === "string" && idValue.trim()) || typeof idValue === "number") ? String(idValue) :
    `record-${apiSourceId(JSON.stringify([title, location, raw.date, raw.start_dt, raw.description]))}`;
  const lat = number(raw.lat ?? raw.latitude ?? raw.y ?? raw.geometry?.coordinates?.[1]);
  const lon = number(raw.lon ?? raw.lng ?? raw.long ?? raw.longitude ?? raw.x ?? raw.geometry?.coordinates?.[0]);
  let geometry: CampusEvent["geometry"] | null = lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    ? { x: lon, y: lat, wkid: 4326 } : null;
  if (!geometry && location) {
    let target = await resolveEventLocation(location);
    if (!target && await waitForMapHydration(mapId)) target = await resolveEventLocation(location);
    if (target?.drawing) {
      const g = target.drawing.geometry as any;
      const point = g.type === "point" ? g : g.extent?.center ?? g.centroid;
      if (point) geometry = { x: point.x, y: point.y, wkid: point.spatialReference?.wkid ?? g.spatialReference.wkid };
    }
    if (!geometry && target?.node) geometry = { x: target.node.lon, y: target.node.lat, wkid: 4326 };
  }
  if (!geometry) return null;
  const date = text(raw.date);
  const startAt = time(raw.start_at ?? raw.startAt);
  const startRaw = raw.start_dt ?? raw.start ?? raw.starts_at ?? (date && startAt ? `${date}T${startAt}:00` : null);
  const start = startRaw ? new Date(startRaw) : null;
  const validStart = start && Number.isFinite(start.getTime()) ? start : null;
  const pad = (value: number) => String(value).padStart(2, "0");
  const host = text(raw.host);
  return {
    id, event_name: title, sourceUrl, sourceId: apiSourceId(sourceUrl),
    description: text(raw.description),
    date: date ?? (validStart ? `${validStart.getFullYear()}-${pad(validStart.getMonth() + 1)}-${pad(validStart.getDate())}` : undefined),
    startAt: startAt ?? (validStart ? `${pad(validStart.getHours())}:${pad(validStart.getMinutes())}` : undefined),
    endAt: time(raw.end_at ?? raw.endAt),
    location, locationTag: location,
    location_at: text(raw.location_at), fullLocationTag: text(raw.location_at),
    names: host ? [host] : undefined,
    original: raw, geometry, fromUser: false, iconSize: 36,
    iconUrl: imageUrl(raw.iconUrl ?? raw.poster_path, sourceUrl) ?? "/icons/event-pin.png",
    poster_url: imageUrl(raw.poster_url, sourceUrl),
  };
}
