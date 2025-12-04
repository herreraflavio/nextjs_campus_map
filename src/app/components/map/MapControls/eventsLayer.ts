import { CampusEvent } from "../arcgisRefs";

/** Create a popup-enabled point Graphic from a CampusEvent using the AMD Graphic class */
export function toGraphic(Graphic: any, ev: CampusEvent) {
  // tweak these per icon
  const size = ev.iconSize ?? 36; // px on screen (independent of map scale)
  const url = ev.iconUrl ?? "/icons/event-pin.png"; // marker icon
  const poster_url =
    ev.poster_url ??
    ev.iconUrl ??
    "https://icon2.cleanpng.com/20180523/puq/kisspng-computer-icons-organization-logo-coventry-high-sch-sensory-lab-5b0572940a3a27.6884089015270836680419.jpg"; // 👈 popup photo fallback

  // const poster_url =
  //   "https://icon2.cleanpng.com/20180523/puq/kisspng-computer-icons-organization-logo-coventry-high-sch-sensory-lab-5b0572940a3a27.6884089015270836680419.jpg"; // 👈 popup photo fallback

  const attributes = {
    ...ev,
    poster_url, // make available to popup as {poster_url}
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
        // 👇 PHOTO BLOCK
        {
          type: "text",
          text:
            "<div style='margin-bottom:8px;'>" +
            "<img src='{poster_url}' alt='Event photo' " +
            "style='max-width:100%;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.2);' />" +
            "</div>",
        },
        // existing fields
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "date", label: "Date" },
            { fieldName: "startAt", label: "Start" },
            { fieldName: "endAt", label: "End" },
            // { fieldName: "locationTag", label: "Location (placeId)" },
            { fieldName: "fullLocationTag", label: "Location (placeId)" },
            // { fieldName: "location_at", label: "Location" },
            // { fieldName: "location", label: "Location" },
            { fieldName: "description", label: "Description" },
            { fieldName: "names", label: "People" },
          ],
        },
      ],
    },
    symbol: {
      type: "picture-marker",
      url, // marker icon
      width: `${size}px`,
      height: `${size}px`,
      // Anchor bottom-center on the point (default anchor is the image center)
      xoffset: 0,
      yoffset: size / 2, // move icon up by half its height
    } as any,
  });
}

// import { CampusEvent } from "../arcgisRefs";

// /** Create a popup-enabled point Graphic from a CampusEvent using the AMD Graphic class */
// export function toGraphic(Graphic: any, ev: CampusEvent) {
//   // tweak these per icon
//   const size = ev.iconSize ?? 36; // px on screen (independent of map scale)
//   const url = ev.iconUrl ?? "/icons/event-pin.png"; // e.g. Next.js /public/icons/event-pin.png

//   return new Graphic({
//     geometry: {
//       type: "point",
//       x: ev.geometry.x,
//       y: ev.geometry.y,
//       spatialReference: { wkid: ev.geometry.wkid },
//     } as any,
//     attributes: ev,
//     popupTemplate: {
//       title: "{event_name}",
//       content: [
//         {
//           type: "fields",
//           fieldInfos: [
//             { fieldName: "date", label: "Date" },
//             { fieldName: "startAt", label: "Start" },
//             { fieldName: "endAt", label: "End" },
//             { fieldName: "fullLocationTag", label: "Location (placeId)" },
//             { fieldName: "description", label: "Description" },
//             { fieldName: "names", label: "People" },
//           ],
//         },
//       ],
//     },
//     symbol: {
//       type: "picture-marker",
//       url, // or use imageData + contentType (see below)
//       width: `${size}px`,
//       height: `${size}px`,
//       // Anchor bottom-center on the point (default anchor is the image center)
//       xoffset: 0,
//       yoffset: size / 2, // move icon up by half its height
//     } as any,
//   });
// }
