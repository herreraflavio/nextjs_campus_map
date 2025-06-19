// // exportMap.ts
// import { finalizedLayerRef } from "@/app/components/map/arcgisRefs";

// // serialize your map just as before
// export function generateMapJSON() {
//   const layer = finalizedLayerRef.current;
//   if (!layer) return [];
//   const polygons = layer.graphics.items.map((g: any) => {
//     const attrs: any = {
//       id: g.attributes.id,
//       name: g.attributes.name,
//       description: g.attributes.description,
//     };
//     if (g.attributes.showAtZoom != null)
//       attrs.showAtZoom = g.attributes.showAtZoom;
//     if (g.attributes.hideAtZoom != null)
//       attrs.hideAtZoom = g.attributes.hideAtZoom;

//     const geom = {
//       type: g.geometry.type,
//       rings: g.geometry.rings,
//       spatialReference: g.geometry.spatialReference.toJSON
//         ? g.geometry.spatialReference.toJSON()
//         : g.geometry.spatialReference,
//     };

//     const sym = g.symbol;
//     const color =
//       typeof sym.color.toRgba === "function" ? sym.color.toRgba() : sym.color;
//     const outline = sym.outline;
//     const outlineColor =
//       typeof outline.color.toRgba === "function"
//         ? outline.color.toRgba()
//         : outline.color;

//     return {
//       attributes: attrs,
//       geometry: geom,
//       symbol: {
//         type: sym.type,
//         color,
//         outline: {
//           color: outlineColor,
//           width: outline.width,
//         },
//       },
//     };
//   });

//   return [{ polygons }];
// }

// // download + API sync in one go
// export function exportAndSaveMap(
//   mapId: string,
//   userEmail: string,
//   filename = "map.json"
// ) {
//   const data = generateMapJSON();
//   const json = JSON.stringify(data, null, 2);

//   // 1) prompt JSON download
//   const blob = new Blob([json], { type: "application/json" });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement("a");
//   a.href = url;
//   a.download = filename;
//   a.click();
//   URL.revokeObjectURL(url);

//   // 2) fire‐and‐forget save to backend
//   fetch(`/api/maps/${mapId}`, {
//     method: "POST", // or "PATCH" depending on your endpoint
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({
//       userEmail,
//       polygons: data[0].polygons,
//     }),
//   })
//     .then((res) => {
//       if (!res.ok)
//         console.error(`Failed to save map to server (${res.status})`);
//       return res.json();
//     })
//     .then((body) => {
//       console.log("Server save response:", body);
//     })
//     .catch((err) => console.error("Error saving map:", err));
// }

// exportMap.ts
import { finalizedLayerRef } from "@/app/components/map/arcgisRefs";

// serialize your map as before
function generatePolygons() {
  const layer = finalizedLayerRef.current;
  if (!layer) return [];
  return layer.graphics.items.map((g: any) => {
    const attrs: any = {
      id: g.attributes.id,
      name: g.attributes.name,
      description: g.attributes.description,
    };
    if (g.attributes.showAtZoom != null)
      attrs.showAtZoom = g.attributes.showAtZoom;
    if (g.attributes.hideAtZoom != null)
      attrs.hideAtZoom = g.attributes.hideAtZoom;

    const geom = {
      type: g.geometry.type,
      rings: g.geometry.rings,
      spatialReference: g.geometry.spatialReference.toJSON
        ? g.geometry.spatialReference.toJSON()
        : g.geometry.spatialReference,
    };

    const sym = g.symbol;
    const color =
      typeof sym.color.toRgba === "function" ? sym.color.toRgba() : sym.color;
    const outline = sym.outline;
    const outlineColor =
      typeof outline.color.toRgba === "function"
        ? outline.color.toRgba()
        : outline.color;

    return {
      attributes: attrs,
      geometry: geom,
      symbol: {
        type: sym.type,
        color,
        outline: {
          color: outlineColor,
          width: outline.width,
        },
      },
    };
  });
}

/**
 * Synchronously POSTs the current map’s polygons to your `/api/maps/[id]` endpoint.
 * Non-blocking: fires off in the background.
 */
export function saveMapToServer(mapId: string, userEmail: string): void {
  const polygons = generatePolygons();
  if (polygons.length === 0) {
    console.warn("No polygons to save.");
    return;
  }

  fetch(`/api/maps/${mapId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userEmail,
      polygons,
    }),
  })
    .then((res) => {
      if (!res.ok) {
        console.error(`Save failed (${res.status}):`, res.statusText);
        return res.json().then((body) => console.error(body));
      }
      return res.json();
    })
    .then((updatedMap) => {
      console.log("Map saved successfully:", updatedMap);
    })
    .catch((err) => console.error("Error saving map:", err));
}
