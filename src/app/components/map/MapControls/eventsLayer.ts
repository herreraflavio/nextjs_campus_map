import { CampusEvent } from "../arcgisRefs";

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
  const poster_url =
    ev.poster_url ??
    ev.iconUrl ??
    "https://cdn-icons-png.flaticon.com/512/2558/2558944.png"; // 👈 popup photo fallback

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
      content: [
        {
          type: "text",
          text:
            "<div style='margin-bottom:8px;'>" +
            "<img src='{poster_url}' alt='Event photo' " +
            "style='max-width:300px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.2);' />" +
            "</div>",
        },
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "date", label: "Date" },
            { fieldName: "startAt", label: "Start" },
            { fieldName: "endAt", label: "End" },
            { fieldName: "fullLocationTag", label: "Location" },
            { fieldName: "location_at", label: "Location" },
            { fieldName: "description", label: "Description" },
            { fieldName: "names", label: "People" },
          ],
        },
      ],
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
