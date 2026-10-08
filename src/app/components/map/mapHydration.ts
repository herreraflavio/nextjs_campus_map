/**
 * Only saved graphics participate in this barrier. Tile services and live event
 * feeds can continue loading while the map is usable.
 *
 * ArcGIS layers are held in shared refs, so there can be only one active map
 * hydration. Replacing it invalidates pending saves from the previous map.
 */
export type MapHydrationStatus = "pending" | "ready" | "cancelled";

type Hydration = {
  mapId: string;
  status: MapHydrationStatus;
  settled: Promise<boolean>;
  settle: (complete: boolean) => void;
};

let activeHydration: Hydration | null = null;

export function beginMapHydration(mapId: string): {
  complete(): void;
  cancel(): void;
} {
  if (activeHydration) {
    activeHydration.status = "cancelled";
    activeHydration.settle(false);
  }

  let settle!: (complete: boolean) => void;
  const settled = new Promise<boolean>((resolve) => { settle = resolve; });
  const hydration: Hydration = { mapId, status: "pending", settled, settle };
  activeHydration = hydration;

  return {
    complete() {
      if (activeHydration !== hydration || hydration.status !== "pending") return;
      hydration.status = "ready";
      hydration.settle(true);
    },
    cancel() {
      hydration.status = "cancelled";
      hydration.settle(false);
    },
  };
}

export function getMapHydrationStatus(mapId: string): MapHydrationStatus {
  if (!activeHydration) return "ready";
  return activeHydration.mapId === mapId ? activeHydration.status : "cancelled";
}

/** Capture the load identity as well as readiness to avoid same-map reload races. */
export function captureMapHydrationGuard(mapId: string): () => boolean {
  const hydration = activeHydration;
  return () => activeHydration === hydration && getMapHydrationStatus(mapId) === "ready";
}

export function waitForMapHydration(mapId: string): Promise<boolean> {
  const hydration = activeHydration;
  if (!hydration) return Promise.resolve(true);
  if (hydration.mapId !== mapId || hydration.status === "cancelled") {
    return Promise.resolve(false);
  }
  const isCurrent = captureMapHydrationGuard(mapId);
  return hydration.settled.then((complete) => complete && isCurrent());
}
