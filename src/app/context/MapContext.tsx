"use client";
// context/MapContext.tsx
import { createContext, useContext } from "react";

const MapContext = createContext<string | null>(null);

export const useMapId = () => {
  const context = useContext(MapContext);
  if (context === null)
    throw new Error("useMapId must be used within MapProvider");
  return context;
};

export const MapProvider = ({
  mapId,
  children,
}: {
  mapId: string;
  children: React.ReactNode;
}) => {
  return <MapContext.Provider value={mapId}>{children}</MapContext.Provider>;
};
