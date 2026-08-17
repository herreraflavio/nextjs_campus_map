//src/app/components/map/sidebar/PublicMapSidebar.tsx
"use client";

import MapSidebar from "./MapSidebar";
import {
  goToDrawing,
  useFinalizedDrawings,
} from "./useMapDrawings";

export default function PublicMapSidebar() {
  const drawings = useFinalizedDrawings();

  return (
    <MapSidebar
      drawings={drawings}
      onGoTo={goToDrawing}
      showItemType={false}
    />
  );
}
