import LoggedInDashboard from "@/app/components/LoggedInDashboard";

import { MapProvider } from "@/app/context/MapContext";
import ArcGISWrapper from "@/app/components/ArcGISWrapper";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;

  return (
    <MapProvider mapId={id}>
      <ArcGISWrapper />
    </MapProvider>
  );
}
