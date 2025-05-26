"use client";

import { finalizedLayerRef, GraphicRef } from "../map/arcgisRefs";
import Box from "../polygons/Box";

export default function Button() {
  const handleClick = () => {
    if (!finalizedLayerRef.current || !GraphicRef.current) {
      console.warn("Map not ready");
      return;
    }

    const polygon = {
      type: "polygon",
      rings: Box(),
      spatialReference: { wkid: 4326 },
    };

    const polygonSymbol = {
      type: "simple-fill",
      color: [255, 0, 0, 0.3],
      outline: {
        color: [255, 0, 0],
        width: 2,
      },
    };

    const popupTemplate = {
      title: "UC Merced Polygon",
      content: `
    <p><b>Description:</b> Default campus boundary.</p>
    <p><i>Coordinates:</i> Centered at [-120.30, 37.30]</p>
    <p><a href="https://www.ucmerced.edu" target="_blank">Visit UC Merced</a></p>
  `,
    };

    const polygonGraphic = new GraphicRef.current({
      attributes: {
        title: "my polygon",
      },
      geometry: polygon,
      symbol: polygonSymbol,
      popupTemplate: popupTemplate,
    });

    finalizedLayerRef.current.add(polygonGraphic);
  };

  return <button onClick={handleClick}>Add Polygon</button>;
}
