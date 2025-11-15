// import { CampusEvent } from "../arcgisRefs";

// /** Create a popup-enabled point Graphic from a CampusEvent using the AMD Graphic class */
// export function toGraphic(Graphic: any, ev: CampusEvent) {
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
//             { fieldName: "locationTag", label: "Location (placeId)" },
//             { fieldName: "description", label: "Description" },
//             { fieldName: "names", label: "People" },
//           ],
//         },
//       ],
//     },
//     symbol: {
//       type: "simple-marker",
//       size: 9,
//       color: [255, 128, 0, 0.95],
//       outline: { color: [0, 0, 0, 1], width: 1.25 },
//     } as any,
//   });
// }

import { CampusEvent } from "../arcgisRefs";

/** Create a popup-enabled point Graphic from a CampusEvent using the AMD Graphic class */
export function toGraphic(Graphic: any, ev: CampusEvent) {
  // tweak these per icon
  const size = ev.iconSize ?? 36; // px on screen (independent of map scale)
  const url = ev.iconUrl ?? "/icons/event-pin.png"; // e.g. Next.js /public/icons/event-pin.png

  return new Graphic({
    geometry: {
      type: "point",
      x: ev.geometry.x,
      y: ev.geometry.y,
      spatialReference: { wkid: ev.geometry.wkid },
    } as any,
    attributes: ev,
    popupTemplate: {
      title: "{event_name}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "date", label: "Date" },
            { fieldName: "startAt", label: "Start" },
            { fieldName: "endAt", label: "End" },
            // { fieldName: "locationTag", label: "Location (placeId)" },
            { fieldName: "fullLocationTag", label: "Location" },
            { fieldName: "description", label: "Description" },
            { fieldName: "names", label: "People" },
          ],
        },
      ],
    },
    symbol: {
      type: "picture-marker",
      url, // or use imageData + contentType (see below)
      width: `${size}px`,
      height: `${size}px`,
      // Anchor bottom-center on the point (default anchor is the image center)
      xoffset: 0,
      yoffset: size / 2, // move icon up by half its height
    } as any,
  });
}
