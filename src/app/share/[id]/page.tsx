//src/app/share/[id]/page.tsx
import ArcGISWrapper from "@/app/components/ArcGISWrapper";
import PublicMapSidebar from "@/app/components/map/sidebar/PublicMapSidebar";
import { MapProvider } from "@/app/context/MapContext";
import MapShell from "@/app/components/map/MapShell";
import styles from "./page.module.css";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;

  return (
    <MapProvider mapId={id}>
      <div className={styles.shell}>
        <MapShell>
          <div className={styles.body} data-map-body>
            <aside className={styles.sidebar}>
              <PublicMapSidebar />
            </aside>

            <main className={styles.main}>
              <ArcGISWrapper />
            </main>
          </div>
        </MapShell>
      </div>
    </MapProvider>
  );
}
