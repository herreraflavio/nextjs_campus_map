// app/maps/[id]/page.tsx
import LoggedInDashboard from "@/app/components/LoggedInDashboard";
import { auth } from "@/lib/auth";
import { MapProvider } from "@/app/context/MapContext";
import { getMapById } from "@/lib/mapModel";
import { findUserByEmail } from "@/lib/userModel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  const [map, owner] = session?.user?.email
    ? await Promise.all([
        getMapById(id).catch(() => null),
        findUserByEmail(session.user.email).catch(() => null),
      ])
    : [null, null];
  const canEdit = !!map?.ownerId && !!owner?._id && String(map.ownerId) === String(owner._id);

  return (
    <MapProvider mapId={id}>
      <LoggedInDashboard user={session?.user} canEdit={canEdit} />
    </MapProvider>
  );
}
