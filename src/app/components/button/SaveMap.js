"use client";
import { finalizedLayerRef } from "../map/arcgisRefs";

export default function SaveMap() {
  const saveMap = () => {
    console.log(finalizedLayerRef.current.graphics.items[0].attributes.title);
  };

  return <button onClick={() => saveMap()}>Save Map</button>;
}
