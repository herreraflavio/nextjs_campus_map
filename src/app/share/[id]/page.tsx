//src/app/share/[id]/page.tsx
import ArcGISWrapper from "@/app/components/ArcGISWrapper";
import PublicMapSidebar from "@/app/components/map/sidebar/PublicMapSidebar";
import { MapProvider } from "@/app/context/MapContext";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;

  return (
    <MapProvider mapId={id}>
      <div
        style={{
          display: "flex",
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        <aside
          style={{
            width: 350,
            flex: "0 0 350px",
            height: "100%",
            overflowY: "auto",
            padding: 16,
            boxSizing: "border-box",
            background: "#fff",
          }}
        >
          <PublicMapSidebar />
        </aside>

        <main
          style={{
            flex: 1,
            minWidth: 0,
            height: "100%",
          }}
        >
          <ArcGISWrapper />
        </main>
      </div>
    </MapProvider>
  );
}

// import LoggedInDashboard from "@/app/components/LoggedInDashboard";

// import { MapProvider } from "@/app/context/MapContext";
// import ArcGISWrapper from "@/app/components/ArcGISWrapper";

// interface PageProps {
//   params: Promise<{ id: string }>;
// }

// export default async function Page({ params }: PageProps) {
//   const { id } = await params;

//   return (
//     <MapProvider mapId={id}>
//       <ArcGISWrapper />
//     </MapProvider>
//   );
// }
