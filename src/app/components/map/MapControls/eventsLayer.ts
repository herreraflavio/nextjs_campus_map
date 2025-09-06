// // eventsLayer.ts
// import Graphic from "@arcgis/core/Graphic";
// import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
// import { CampusEvent, eventsLayerRef, eventsStore } from "../arcgisRefs";

// export function initEventsLayer(view: __esri.MapView) {
//   const layer = new GraphicsLayer({
//     id: "events-layer",
//     title: "Campus Events",
//     listMode: "show",
//   });
//   view.map.add(layer);
//   eventsLayerRef.current = layer;

//   for (const ev of eventsStore.items) layer.add(toGraphic(ev));
//   eventsStore.events.addEventListener("added", (e: any) => {
//     layer.add(toGraphic(e.detail as CampusEvent));
//   });
// }

// export function toGraphic(ev: CampusEvent) {
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
//       size: 8,
//       color: [255, 128, 0, 0.9],
//       outline: { color: [0, 0, 0, 1], width: 1 },
//     } as any,
//   });
// }

// eventsLayer.ts
// NOTE: no @arcgis/core imports here to avoid ESM/AMD mixing.
// We accept the AMD Graphic class from arcgismap.tsx.

import { CampusEvent } from "../arcgisRefs";

/** Create a popup-enabled point Graphic from a CampusEvent using the AMD Graphic class */
export function toGraphic(Graphic: any, ev: CampusEvent) {
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
            { fieldName: "locationTag", label: "Location (placeId)" },
            { fieldName: "description", label: "Description" },
            { fieldName: "names", label: "People" },
          ],
        },
      ],
    },
    symbol: {
      type: "simple-marker",
      size: 9,
      color: [255, 128, 0, 0.95],
      outline: { color: [0, 0, 0, 1], width: 1.25 },
    } as any,
  });
}
