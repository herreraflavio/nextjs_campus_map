//src/app/share/[id]/page.tsx
import type { Metadata, ResolvingMetadata } from "next";
import ArcGISWrapper from "@/app/components/ArcGISWrapper";
import PublicMapSidebar from "@/app/components/map/sidebar/PublicMapSidebar";
import { MapProvider } from "@/app/context/MapContext";
import MapShell from "@/app/components/map/MapShell";
import styles from "./page.module.css";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(
  { params, searchParams }: PageProps,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const [{ id }, search, defaults] = await Promise.all([params, searchParams, parent]);
  const query = new URLSearchParams();
  for (const key of ["location", "event", "source"]) {
    const value = search[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) query.set(key, first);
  }

  return {
    openGraph: {
      ...defaults.openGraph,
      // Keep location and event deep links intact when platforms use og:url.
      url: `/share/${encodeURIComponent(id)}${query.size ? `?${query}` : ""}`,
    },
  };
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
