"use client";
import { useMapId } from "@/app/context/MapContext";

export default function ShareMap() {
  const mapId = useMapId();
  const shareMap = () => {
    alert(
      "Embed the following url: https://mapbuilder.ucmercedhub.com/share/" +
        mapId
    );
  };

  return <button onClick={() => shareMap()}>Share Map</button>;
}
