import { MapProvider } from "@/app/context/MapContext";
import ArcGISWrapper from "@/app/components/ArcGISWrapper";
import MapShell from "@/app/components/map/MapShell";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;

  return (
    <MapProvider mapId={id}>
      <MapShell>
        <ArcGISWrapper />
      </MapShell>
    </MapProvider>
  );
}
