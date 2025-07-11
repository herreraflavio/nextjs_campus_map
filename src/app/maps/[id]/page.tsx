// // app/maps/[id]/page.tsx
// import LoggedInDashboard from "@/app/components/LoggedInDashboard";
// import { auth } from "@/lib/auth";
// interface PageProps {
//   params: Promise<{ id: string }>;
// }

// export default async function Page({ params }: PageProps) {
//   // await the Promise<params>
//   const { id } = await params;
//   const session = await auth();
//   return <LoggedInDashboard user={session?.user} mapId={id} />;
//   // return <div>Map ID: {id}</div>;
// }

// app/maps/[id]/page.tsx
import LoggedInDashboard from "@/app/components/LoggedInDashboard";
import { auth } from "@/lib/auth";
import { MapProvider } from "@/app/context/MapContext";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();

  return (
    <MapProvider mapId={id}>
      <LoggedInDashboard user={session?.user} />
    </MapProvider>
  );
}
