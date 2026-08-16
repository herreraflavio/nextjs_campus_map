//src/app/components/map/sidebar/PublicMapSidebar.tsx
"use client";

import DrawingSidebar from "./DrawingSidebar";
import {
  goToDrawing,
  useFinalizedDrawings,
} from "./useMapDrawings";

export default function PublicMapSidebar() {
  const drawings = useFinalizedDrawings();

  return (
    <DrawingSidebar
      drawings={drawings}
      onGoTo={goToDrawing}
    />
  );
}
