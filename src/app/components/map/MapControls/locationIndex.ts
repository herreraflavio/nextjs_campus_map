// components/map/MapControls/locationIndex.ts

// Shape of public/vertex_meta.json
type VertexMeta = {
  id: number; // matches feature.id in walking_verticies.json
  name: string; // human-readable location name
};

// Shape of public/walking_verticies.json
type WalkVertexFeature = {
  type: "Feature";
  id: number;
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lon, lat]
  };
  properties: {
    OBJECTID: number;
    Id: number;
    ORIG_FID: number;
  };
};

type WalkVertices = {
  type: "FeatureCollection";
  features: WalkVertexFeature[];
};

type LocationIndex = {
  byName: Map<string, number>; // lowercased name -> vertex id
  byId: Map<number, { x: number; y: number }>; // vertex id -> lon/lat
};

const VERTEX_META_URL = "/vertex_meta.json";
const WALKING_VERTICES_URL = "/walking_vertices.json";

let indexPromise: Promise<LocationIndex> | null = null;

async function buildIndex(): Promise<LocationIndex> {
  const [metaRes, walkRes] = await Promise.all([
    fetch(VERTEX_META_URL),
    fetch(WALKING_VERTICES_URL),
  ]);

  if (!metaRes.ok) {
    throw new Error(`Failed to load ${VERTEX_META_URL}: ${metaRes.status}`);
  }
  if (!walkRes.ok) {
    throw new Error(
      `Failed to load ${WALKING_VERTICES_URL}: ${walkRes.status}`
    );
  }

  const vertexMeta = (await metaRes.json()) as VertexMeta[];
  const walking = (await walkRes.json()) as WalkVertices;

  const byName = new Map<string, number>();
  for (const v of vertexMeta) {
    if (!v.name || typeof v.id !== "number") continue;
    byName.set(v.name.toLowerCase().trim(), v.id);
  }

  const byId = new Map<number, { x: number; y: number }>();
  for (const f of walking.features || []) {
    const id =
      typeof f.id === "number"
        ? f.id
        : typeof (f as any).properties?.OBJECTID === "number"
        ? (f as any).properties.OBJECTID
        : null;

    const coords = f.geometry?.coordinates;
    if (id == null || !Array.isArray(coords) || coords.length < 2) continue;

    const [lon, lat] = coords;
    byId.set(id, { x: lon, y: lat });
  }

  return { byName, byId };
}

/**
 * Lazily loads & caches the mapping from location names → coordinates.
 */
async function getLocationIndex(): Promise<LocationIndex> {
  if (!indexPromise) {
    indexPromise = buildIndex().catch((err) => {
      console.error("Failed to build location index:", err);
      // reset so a later call can retry
      indexPromise = null;
      return { byName: new Map(), byId: new Map() };
    });
  }
  return indexPromise;
}

/**
 * Look up coordinates from a human-readable location string
 * (e.g. "Recreation Field" from vertex_meta.json).
 *
 * Returns { x, y } in EPSG:4326 (lon, lat) or null if no match.
 */
export async function lookupCoordinatesByLocation(
  location: string | null | undefined
): Promise<{ x: number; y: number } | null> {
  if (!location) return null;

  const normalized = location.toLowerCase().trim();
  if (!normalized) return null;

  const { byName, byId } = await getLocationIndex();
  const vertexId = byName.get(normalized);
  if (vertexId == null) {
    // Optional: loosen match (startsWith / includes) if you want
    return null;
  }

  const coords = byId.get(vertexId);
  if (!coords) return null;

  return { x: coords.x, y: coords.y };
}
