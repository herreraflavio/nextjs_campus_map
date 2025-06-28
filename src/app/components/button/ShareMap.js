"use client";
import { useMapId } from "@/app/context/MapContext";

export default function ShareMap() {
  const mapId = useMapId();
  const shareMap = () => {
    alert(
      "Embed the following url: https://dev-campusmap.flavioherrera.com/share/" +
        mapId
    );
  };

  return <button onClick={() => shareMap()}>Share Map</button>;
}
