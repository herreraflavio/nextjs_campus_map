//src/app/components/map/sidebar/PublicMapSidebar.tsx
"use client";

import { Suspense } from "react";
import MapSidebarTabs from "./MapSidebarTabs";
import MapLoadingSkeleton from "../MapLoadingSkeleton";
import {
  goToDrawing,
  useFinalizedDrawings,
} from "./useMapDrawings";

export default function PublicMapSidebar() {
  const drawings = useFinalizedDrawings();

  return (
    <Suspense fallback={<MapLoadingSkeleton section="sidebar" />}><MapSidebarTabs
      drawings={drawings}
      onGoTo={goToDrawing}
      showItemType={false}
    /></Suspense>
  );
}
