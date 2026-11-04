//src/app/components/map/MapControls/eventsLayer.ts
import { CampusEvent } from "../arcgisRefs";
import { escapePopupText } from "../eventLocations";

// Converts military time "14:00" to standard time "2:00 pm"
// Leaves already-formatted times like "2:00 pm" unchanged
function formatTimeAMPM(timeStr?: string): string {
  if (!timeStr) return "";

  const normalized = timeStr.trim();

  // Already in am/pm format
  if (/\b(am|pm)\b/i.test(normalized)) {
    return normalized;
  }

  // Not a time we know how to convert
  if (!normalized.includes(":")) {
    return normalized;
  }

  const [hourStr, minute] = normalized.split(":");
  let hour = parseInt(hourStr, 10);

  // If hour is invalid, return original value
  if (Number.isNaN(hour)) {
    return normalized;
  }

  const ampm = hour >= 12 ? "pm" : "am";
  hour = hour % 12;
  hour = hour ? hour : 12;

  return `${hour}:${minute} ${ampm}`;
}

/** Create a popup-enabled point Graphic from a CampusEvent using the AMD Graphic class */
export function toGraphic(Graphic: any, ev: CampusEvent) {
  // tweak these per icon
  const size = ev.iconSize ?? 36; // px on screen (independent of map scale)
  const url = ev.iconUrl ?? "/icons/event-pin.png"; // marker icon
  const poster_url = ev.poster_url ?? (ev.iconUrl !== "/icons/event-pin.png" ? ev.iconUrl : undefined);

  const attributes = {
    ...ev,
    poster_url,
    startAt: formatTimeAMPM(ev.startAt),
    endAt: formatTimeAMPM(ev.endAt),
  };

  return new Graphic({
    geometry: {
      type: "point",
      x: ev.geometry.x,
      y: ev.geometry.y,
      spatialReference: { wkid: ev.geometry.wkid },
    } as any,
    attributes,
    popupTemplate: {
      title: "{event_name}",
      content: (context: any) => {
        const current = context?.graphic?.attributes ?? attributes;
        const details = [
          ["Date", current.date], ["Start", formatTimeAMPM(current.startAt)], ["End", formatTimeAMPM(current.endAt)],
          ["Building", current.location], ["Location details", current.location_at],
          ["Description", current.description], ["People", current.names?.join(", ")],
        ].filter(([, value]) => value);
        const rows = details.map(([label, value]) =>
          `<tr><th style="text-align:left;vertical-align:top;padding:5px 12px 5px 0">${label}</th><td style="padding:5px 0;white-space:pre-wrap">${escapePopupText(value)}</td></tr>`,
        ).join("");
        const photoUrl = current.poster_url ?? poster_url;
        const photo = photoUrl ? `<img src="${escapePopupText(photoUrl)}" alt="Event photo" style="max-width:100%;max-height:240px;object-fit:contain;border-radius:8px" />` : "";
        return `${photo}<table style="width:100%;border-collapse:collapse">${rows}</table>`;
      },
    },
    symbol: {
      type: "picture-marker",
      url,
      width: `${size}px`,
      height: `${size}px`,
      xoffset: 0,
      yoffset: size / 2,
    } as any,
  });
}
