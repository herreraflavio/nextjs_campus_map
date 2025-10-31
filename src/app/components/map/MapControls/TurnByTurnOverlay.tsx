"use client";

import React from "react";
import { MapViewRef, GraphicRef, resortByZ } from "../arcgisRefs";

/** ========= Types ========= */
type GeoJSONPoint = {
  type: "Point";
  coordinates: [number, number]; // [lon, lat]
};
type GeoJSONLine = {
  type: "LineString";
  coordinates: [number, number][];
};
type VertexFeature = {
  type: "Feature";
  id?: string | number;
  geometry: GeoJSONPoint;
  properties?: Record<string, any>;
};
type EdgeFeature = {
  type: "Feature";
  id?: string | number;
  geometry: GeoJSONLine;
  properties?: Record<string, any>;
};
type FeatureCollection<T> = {
  type: "FeatureCollection";
  features: T[];
};

type Node = {
  id: string;
  name: string;
  hidden: boolean;
  lon: number;
  lat: number;
  x: number;
  y: number;
};

type Edge = {
  from: string;
  to: string;
  weight: number;
};

type VertexMeta = {
  name?: string;
  hidden?: boolean;
};

type Step = {
  instruction: string;
  meters: number;
};

/** ========= Projections ========= */
const R = 6378137;
const toRad = (d: number) => (d * Math.PI) / 180;
const lonLatToWebMercator = (lon: number, lat: number) => {
  const x = R * toRad(lon);
  const y = R * Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2));
  return { x, y };
};

/** ========= Geometry helpers ========= */
const dist = (a: Node, b: Node) => Math.hypot(a.x - b.x, a.y - b.y);

/** Signed turn angle at B (in degrees) */
function signedTurnAngleDeg(a: Node, b: Node, c: Node): number {
  const v1x = b.x - a.x,
    v1y = b.y - a.y;
  const v2x = c.x - b.x,
    v2y = c.y - b.y;
  const cross = v1x * v2y - v1y * v2x; // +CCW (left), -CW (right)
  const dot = v1x * v2x + v1y * v2y;
  const ang = Math.atan2(cross, dot);
  return (ang * 180) / Math.PI;
}

const TURN_THRESHOLD = 28;
const UTURN_THRESHOLD = 150;

function classifyTurn(
  angleDeg: number
): "left" | "right" | "uturn" | "straight" {
  const a = Math.abs(angleDeg);
  if (a >= UTURN_THRESHOLD) return "uturn";
  if (a >= TURN_THRESHOLD) return angleDeg > 0 ? "left" : "right";
  return "straight";
}

/** ========= Dijkstra ========= */
function dijkstra(
  nodes: Node[],
  edges: Edge[],
  startId: string,
  endId: string
): { path: Node[]; total: number } {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const adj = new Map<string, Array<{ id: string; w: number }>>();
  for (const e of edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue;
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from)!.push({ id: e.to, w: e.weight });
    adj.get(e.to)!.push({ id: e.from, w: e.weight });
  }

  const Q = new Set<string>(nodes.map((n) => n.id));
  const D = new Map<string, number>(nodes.map((n) => [n.id, Infinity]));
  const P = new Map<string, string | null>(nodes.map((n) => [n.id, null]));
  if (!Q.has(startId) || !Q.has(endId)) return { path: [], total: 0 };
  D.set(startId, 0);

  while (Q.size) {
    let u: string | null = null;
    let best = Infinity;
    for (const id of Q) {
      const d = D.get(id)!;
      if (d < best) {
        best = d;
        u = id;
      }
    }
    if (u == null) break;
    Q.delete(u);
    if (u === endId) break;
    for (const nbr of adj.get(u) ?? []) {
      if (!Q.has(nbr.id)) continue;
      const alt = D.get(u)! + nbr.w;
      if (alt < D.get(nbr.id)!) {
        D.set(nbr.id, alt);
        P.set(nbr.id, u);
      }
    }
  }

  const pathIds: string[] = [];
  let cur: string | null = endId;
  while (cur) {
    pathIds.unshift(cur);
    cur = P.get(cur) ?? null;
  }
  if (pathIds[0] !== startId) return { path: [], total: 0 };
  return { path: pathIds.map((id) => byId.get(id)!), total: D.get(endId)! };
}

/** ========= Component ========= */
export default function TurnByTurnOverlay() {
  const [nodes, setNodes] = React.useState<Node[]>([]);
  const [edges, setEdges] = React.useState<Edge[]>([]);
  const [metaById, setMetaById] = React.useState<Record<string, VertexMeta>>(
    {}
  );

  const [origin, setOrigin] = React.useState<string>("");
  const [dest, setDest] = React.useState<string>("");

  const [steps, setSteps] = React.useState<Step[]>([]);
  const [total, setTotal] = React.useState<number>(0);

  const directionsLayerRef = React.useRef<__esri.GraphicsLayer | null>(null);
  type IHandle = { remove: () => void };
  const clickHandleRef = React.useRef<IHandle | null>(null);
  const [clickMode, setClickMode] = React.useState<"none" | "origin" | "dest">(
    "none"
  );

  /** Load all JSONs from /public on mount */
  React.useEffect(() => {
    let isMounted = true;

    async function loadAll() {
      const [vtxRes, edgRes, metaRes] = await Promise.all([
        fetch("/walking_vertices.json"),
        fetch("/walking_edges.json"),
        fetch("/vertex_meta.json").catch(() => null),
      ]);

      const vtxFC = (await vtxRes.json()) as FeatureCollection<VertexFeature>;
      const edgFC = (await edgRes.json()) as FeatureCollection<EdgeFeature>;

      // Meta normalize
      let metaMap: Record<string, VertexMeta> = {};
      if (metaRes && metaRes.ok) {
        const raw = await metaRes.json();
        if (Array.isArray(raw)) {
          for (const r of raw) {
            const id = String(r.id ?? "");
            if (id) metaMap[id] = { name: r.name, hidden: !!r.hidden };
          }
        } else if (raw && typeof raw === "object") {
          for (const k of Object.keys(raw)) {
            const m = raw[k] || {};
            metaMap[String(k)] = { name: m.name, hidden: !!m.hidden };
          }
        }
      }
      if (!isMounted) return;

      // Build nodes (default hidden for unknown ids)
      const nodesTmp: Node[] = vtxFC.features.map((f) => {
        const id =
          f.id != null
            ? String(f.id)
            : f.properties?.OBJECTID != null
            ? String(f.properties.OBJECTID)
            : f.properties?.Id != null
            ? String(f.properties.Id)
            : `${f.geometry.coordinates[0]},${f.geometry.coordinates[1]}`;

        const [lon, lat] = f.geometry.coordinates;
        const { x, y } = lonLatToWebMercator(lon, lat);

        const hasMeta = Object.prototype.hasOwnProperty.call(metaMap, id);
        const meta = hasMeta ? metaMap[id] ?? {} : undefined;
        const hidden = hasMeta ? meta?.hidden ?? false : true;

        return {
          id,
          name: meta?.name ?? id,
          hidden,
          lon,
          lat,
          x,
          y,
        };
      });

      const keyFor = (lon: number, lat: number) =>
        `${lon.toFixed(12)},${lat.toFixed(12)}`;
      const idByLL = new Map<string, string>();
      for (const n of nodesTmp) idByLL.set(keyFor(n.lon, n.lat), n.id);

      function findNodeIdFor(lon: number, lat: number): string | null {
        const k = keyFor(lon, lat);
        if (idByLL.has(k)) return idByLL.get(k)!;
        let bestId: string | null = null;
        let best = Infinity;
        const { x, y } = lonLatToWebMercator(lon, lat);
        for (const n of nodesTmp) {
          const d = Math.hypot(n.x - x, n.y - y);
          if (d < best) {
            best = d;
            bestId = n.id;
          }
        }
        return best < 3 ? bestId : null;
      }

      const edgesTmp: Edge[] = [];
      for (const f of edgFC.features) {
        const coords = f.geometry.coordinates;
        if (!coords || coords.length < 2) continue;
        const [lonA, latA] = coords[0];
        const [lonB, latB] = coords[coords.length - 1];

        const fromId = findNodeIdFor(lonA, latA);
        const toId = findNodeIdFor(lonB, latB);
        if (!fromId || !toId || fromId === toId) continue;

        const a = nodesTmp.find((n) => n.id === fromId)!;
        const b = nodesTmp.find((n) => n.id === toId)!;

        const propLen = (f as any).properties?.Shape_Length;
        const w =
          typeof propLen === "number" && isFinite(propLen) && propLen > 0
            ? propLen
            : dist(a, b);

        edgesTmp.push({ from: fromId, to: toId, weight: w });
      }

      setNodes(nodesTmp);
      setEdges(edgesTmp);
      setMetaById(metaMap);

      const publicNodes = nodesTmp.filter((n) => !n.hidden);
      if (publicNodes.length >= 2) {
        setOrigin(publicNodes[0].id);
        setDest(publicNodes[1].id);
      } else if (publicNodes.length === 1) {
        setOrigin(publicNodes[0].id);
        setDest(publicNodes[0].id);
      }
    }

    loadAll().catch(console.error);
    return () => {
      isMounted = false;
    };
  }, []);

  /** Create the graphics layer once ArcGIS is ready */
  React.useEffect(() => {
    const tryInit = () => {
      const view = MapViewRef.current;
      if (!view || !(window as any).require) return false;
      (window as any).require(
        ["esri/layers/GraphicsLayer"],
        (GraphicsLayer: typeof __esri.GraphicsLayer) => {
          if (!directionsLayerRef.current) {
            const layer = new GraphicsLayer({ id: "directions-layer" });
            (layer as any).z = 60; // below labels(z=70)
            directionsLayerRef.current = layer;

            const labels = view.map.findLayerById("labels");
            if (labels) {
              const idx = view.map.layers.indexOf(labels);
              view.map.add(layer, idx); // under labels
            } else {
              view.map.add(layer);
            }
            resortByZ(view.map); // keep Sketch temp layer on top
          }
        }
      );
      return true;
    };
    const intv = setInterval(() => {
      if (tryInit()) clearInterval(intv);
    }, 120);
    return () => clearInterval(intv);
  }, []);

  /** Cleanup click handler on unmount */
  React.useEffect(() => {
    return () => clickHandleRef.current?.remove?.();
  }, []);

  const publicNodes = React.useMemo(
    () => nodes.filter((n) => !n.hidden),
    [nodes]
  );

  const isSignificant = React.useCallback(
    (n: Node) => {
      const m = metaById[n.id];
      return !!m?.name && !n.hidden;
    },
    [metaById]
  );

  const snapToNearestPublic = React.useCallback(
    (x: number, y: number) => {
      if (publicNodes.length === 0) return "";
      let bestId = publicNodes[0].id;
      let best = Infinity;
      for (const n of publicNodes) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < best) {
          best = d;
          bestId = n.id;
        }
      }
      return bestId;
    },
    [publicNodes]
  );

  const enablePick = (kind: "origin" | "dest") => {
    const view = MapViewRef.current;
    if (!view || !(window as any).require) return;
    clickHandleRef.current?.remove?.();
    setClickMode(kind);
    clickHandleRef.current = view.on("click", (ev: any) => {
      const mp = ev.mapPoint;
      if (!mp) return;
      const id = snapToNearestPublic(mp.x, mp.y);
      if (id) {
        if (kind === "origin") setOrigin(id);
        else setDest(id);
      }
      setClickMode("none");
      clickHandleRef.current?.remove?.();
      clickHandleRef.current = null;
    }) as any;
  };

  const clearGraphics = React.useCallback(() => {
    directionsLayerRef.current?.removeAll();
    setSteps([]);
    setTotal(0);
  }, []);

  const buildSteps = React.useCallback(
    (path: Node[]): Step[] => {
      if (path.length < 2) return [];
      const out: Step[] = [];
      let acc = 0;

      out.push({ instruction: `Start at ${path[0].name}`, meters: 0 });

      for (let i = 1; i < path.length; i++) {
        acc += dist(path[i - 1], path[i]);

        if (i < path.length - 1) {
          const angle = signedTurnAngleDeg(path[i - 1], path[i], path[i + 1]);
          const kind = classifyTurn(angle);
          if (kind !== "straight" && isSignificant(path[i])) {
            const at = ` at ${path[i].name}`;
            const text =
              kind === "uturn" ? `Make a U-turn${at}` : `Turn ${kind}${at}`;
            out.push({ instruction: text, meters: Math.round(acc) });
            acc = 0;
          }
        }
      }

      const destNode = path[path.length - 1];
      if (acc > 0) {
        out.push({
          instruction: `Continue for ${
            acc >= 1000
              ? (acc / 1000).toFixed(2) + " km"
              : Math.round(acc) + " m"
          }`,
          meters: acc,
        });
      }
      out.push({ instruction: `Arrive at ${destNode.name}`, meters: 0 });
      return out;
    },
    [isSignificant]
  );

  const route = React.useCallback(() => {
    const view = MapViewRef.current;
    const G = GraphicRef.current as typeof __esri.Graphic | null;
    if (!view || !G || !(window as any).require) return;
    if (!origin || !dest || nodes.length === 0 || edges.length === 0) return;

    const { path, total } = dijkstra(nodes, edges, origin, dest);
    clearGraphics();

    if (path.length < 2) {
      setSteps([]);
      setTotal(0);
      return;
    }

    setSteps(buildSteps(path));
    setTotal(total);

    (window as any).require(
      ["esri/geometry/Polyline", "esri/geometry/Point"],
      (Polyline: typeof __esri.Polyline, Point: typeof __esri.Point) => {
        const layer = directionsLayerRef.current!;
        const line = new Polyline({
          paths: [path.map((n) => [n.x, n.y])],
          spatialReference: { wkid: 3857 },
        });

        const routeGraphic = new G({
          geometry: line,
          symbol: {
            type: "simple-line",
            color: [0, 120, 255, 1],
            width: 5,
          } as any,
          attributes: { type: "route" },
        });

        const start = new G({
          geometry: new Point({
            x: path[0].x,
            y: path[0].y,
            spatialReference: { wkid: 3857 },
          }),
          symbol: {
            type: "simple-marker",
            size: 10,
            style: "circle",
            color: [0, 200, 0, 1],
            outline: { color: [255, 255, 255, 1], width: 1 },
          } as any,
          attributes: { type: "start" },
        });

        const end = new G({
          geometry: new Point({
            x: path[path.length - 1].x,
            y: path[path.length - 1].y,
            spatialReference: { wkid: 3857 },
          }),
          symbol: {
            type: "simple-marker",
            size: 10,
            style: "diamond",
            color: [220, 0, 0, 1],
            outline: { color: [255, 255, 255, 1], width: 1 },
          } as any,
          attributes: { type: "end" },
        });

        layer.addMany([routeGraphic, start, end]);
        resortByZ(view.map);
      }
    );
  }, [nodes, edges, origin, dest, clearGraphics, buildSteps]);

  const swap = () => {
    setOrigin(dest);
    setDest(origin);
  };

  return (
    <div
      style={{
        position: "relative",
        top: 0,
        right: 0,
        zIndex: 1000,
        background: "rgba(255,255,255,0.94)",
        borderRadius: 12,
        padding: 8,
        width: 270,
        border: "solid 4px",
        boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
        Turn-by-Turn (GeoJSON graph)
      </div>

      {nodes.length === 0 || edges.length === 0 ? (
        <div style={{ fontSize: 12, color: "#666" }}>
          Loading vertices/edges from <code>/public</code>…
        </div>
      ) : (
        <>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Origin</label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              style={{ flex: 1, padding: "6px 8px", width: "220px" }}
            >
              {publicNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => enablePick("origin")}
              style={{
                padding: "6px 8px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: clickMode === "origin" ? "#eef6ff" : "#f6f7f8",
                cursor: "pointer",
              }}
              title="Pick on map (snaps to nearest PUBLIC node)"
            >
              Pick
            </button>
          </div>

          <label style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>
            Destination
          </label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              style={{ flex: 1, padding: "6px 8px", width: "220px" }}
            >
              {publicNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => enablePick("dest")}
              style={{
                padding: "6px 8px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: clickMode === "dest" ? "#eef6ff" : "#f6f7f8",
                cursor: "pointer",
              }}
              title="Pick on map (snaps to nearest PUBLIC node)"
            >
              Pick
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={swap}
              style={{
                flex: "0 0 auto",
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#f6f7f8",
                cursor: "pointer",
              }}
            >
              Swap
            </button>
            <button
              onClick={route}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #0a6cff",
                background: "#0a6cff",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Route
            </button>
            <button
              onClick={clearGraphics}
              style={{
                flex: "0 0 auto",
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#f6f7f8",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#333" }}>
            {total > 0 ? (
              <div style={{ marginBottom: 6 }}>
                <strong>Total:</strong>{" "}
                {total >= 1000
                  ? `${(total / 1000).toFixed(2)} km`
                  : `${Math.round(total)} m`}
              </div>
            ) : (
              <div style={{ color: "#777" }}>
                Pick a start and destination, then Route.
              </div>
            )}

            {steps.length > 0 && (
              <ol
                style={{
                  paddingLeft: 18,
                  margin: 0,
                  maxHeight: 180,
                  overflow: "auto",
                }}
              >
                {steps.map((s, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {s.instruction}
                    {s.meters > 0 && (
                      <>
                        {" — "}
                        {s.meters >= 1000
                          ? `${(s.meters / 1000).toFixed(2)} km`
                          : `${Math.round(s.meters)} m`}
                      </>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// working version 3 bellow
// "use client";

// import React from "react";
// import { MapViewRef, GraphicRef } from "../arcgisRefs";

// /** ========= Types ========= */
// type GeoJSONPoint = {
//   type: "Point";
//   coordinates: [number, number]; // [lon, lat]
// };
// type GeoJSONLine = {
//   type: "LineString";
//   coordinates: [number, number][];
// };
// type VertexFeature = {
//   type: "Feature";
//   id?: string | number;
//   geometry: GeoJSONPoint;
//   properties?: Record<string, any>;
// };
// type EdgeFeature = {
//   type: "Feature";
//   id?: string | number;
//   geometry: GeoJSONLine;
//   properties?: Record<string, any>;
// };
// type FeatureCollection<T> = {
//   type: "FeatureCollection";
//   features: T[];
// };

// type Node = {
//   id: string;
//   name: string; // display name (or fallback to id)
//   hidden: boolean;
//   lon: number;
//   lat: number;
//   x: number; // WebMercator
//   y: number; // WebMercator
// };

// type Edge = {
//   from: string; // node id
//   to: string; // node id
//   weight: number; // meters
// };

// type VertexMeta = {
//   name?: string;
//   hidden?: boolean;
// };

// type Step = {
//   instruction: string; // e.g., "Turn left at COB2"
//   meters: number; // segment length carried to this instruction
// };

// /** ========= Projections ========= */
// const R = 6378137; // Web Mercator radius (meters)
// const toRad = (d: number) => (d * Math.PI) / 180;
// const lonLatToWebMercator = (lon: number, lat: number) => {
//   const x = R * toRad(lon);
//   const y = R * Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2));
//   return { x, y };
// };

// /** ========= Geometry helpers ========= */
// const dist = (a: Node, b: Node) => Math.hypot(a.x - b.x, a.y - b.y);

// /** Signed turn angle at B (in degrees) for segment A->B->C (WebMercator) */
// function signedTurnAngleDeg(a: Node, b: Node, c: Node): number {
//   const v1x = b.x - a.x,
//     v1y = b.y - a.y;
//   const v2x = c.x - b.x,
//     v2y = c.y - b.y;
//   const cross = v1x * v2y - v1y * v2x; // +CCW (left), -CW (right)
//   const dot = v1x * v2x + v1y * v2y;
//   const ang = Math.atan2(cross, dot);
//   return (ang * 180) / Math.PI;
// }

// const TURN_THRESHOLD = 28; // deg: left/right if |angle| >= this
// const UTURN_THRESHOLD = 150; // deg: U-turn if |angle| >= this

// function classifyTurn(
//   angleDeg: number
// ): "left" | "right" | "uturn" | "straight" {
//   const a = Math.abs(angleDeg);
//   if (a >= UTURN_THRESHOLD) return "uturn";
//   if (a >= TURN_THRESHOLD) return angleDeg > 0 ? "left" : "right";
//   return "straight";
// }

// /** ========= Dijkstra (O(V^2), fine for campus graphs) ========= */
// function dijkstra(
//   nodes: Node[],
//   edges: Edge[],
//   startId: string,
//   endId: string
// ): { path: Node[]; total: number } {
//   const byId = new Map(nodes.map((n) => [n.id, n]));

//   const adj = new Map<string, Array<{ id: string; w: number }>>([]);
//   for (const e of edges) {
//     if (!byId.has(e.from) || !byId.has(e.to)) continue;
//     if (!adj.has(e.from)) adj.set(e.from, []);
//     if (!adj.has(e.to)) adj.set(e.to, []);
//     adj.get(e.from)!.push({ id: e.to, w: e.weight });
//     adj.get(e.to)!.push({ id: e.from, w: e.weight }); // undirected
//   }

//   const Q = new Set<string>(nodes.map((n) => n.id));
//   const D = new Map<string, number>(nodes.map((n) => [n.id, Infinity]));
//   const P = new Map<string, string | null>(nodes.map((n) => [n.id, null]));
//   if (!Q.has(startId) || !Q.has(endId)) return { path: [], total: 0 };
//   D.set(startId, 0);

//   while (Q.size) {
//     let u: string | null = null;
//     let best = Infinity;
//     for (const id of Q) {
//       const d = D.get(id)!;
//       if (d < best) {
//         best = d;
//         u = id;
//       }
//     }
//     if (u == null) break;
//     Q.delete(u);
//     if (u === endId) break;
//     for (const nbr of adj.get(u) ?? []) {
//       if (!Q.has(nbr.id)) continue;
//       const alt = D.get(u)! + nbr.w;
//       if (alt < D.get(nbr.id)!) {
//         D.set(nbr.id, alt);
//         P.set(nbr.id, u);
//       }
//     }
//   }

//   const pathIds: string[] = [];
//   let cur: string | null = endId;
//   while (cur) {
//     pathIds.unshift(cur);
//     cur = P.get(cur) ?? null;
//   }
//   if (pathIds[0] !== startId) return { path: [], total: 0 };
//   return { path: pathIds.map((id) => byId.get(id)!), total: D.get(endId)! };
// }

// /** ========= Z-order helper (local) ========= */
// function resortByZ(map: any) {
//   if (!map?.layers?.items) return;
//   // Guard to avoid re-entrancy if Collection change events fire during reorders
//   const flagKey = "__resortingByZ__";
//   if ((map as any)[flagKey]) return;
//   (map as any)[flagKey] = true;

//   try {
//     const sorted = [...map.layers.items].sort(
//       (a: any, b: any) => ((a?.z ?? 0) as number) - ((b?.z ?? 0) as number)
//     );
//     sorted.forEach((lyr: any, index: number) => map.reorder(lyr, index));
//   } finally {
//     (map as any)[flagKey] = false;
//   }
// }

// /** ========= Component ========= */
// export default function TurnByTurnOverlay() {
//   const [nodes, setNodes] = React.useState<Node[]>([]);
//   const [edges, setEdges] = React.useState<Edge[]>([]);
//   const [metaById, setMetaById] = React.useState<Record<string, VertexMeta>>(
//     {}
//   );

//   const [origin, setOrigin] = React.useState<string>("");
//   const [dest, setDest] = React.useState<string>("");

//   const [steps, setSteps] = React.useState<Step[]>([]);
//   const [total, setTotal] = React.useState<number>(0);

//   const directionsLayerRef = React.useRef<__esri.GraphicsLayer | null>(null);
//   type IHandle = { remove: () => void };
//   const clickHandleRef = React.useRef<IHandle | null>(null);
//   const [clickMode, setClickMode] = React.useState<"none" | "origin" | "dest">(
//     "none"
//   );

//   /** Load all JSONs from /public on mount */
//   React.useEffect(() => {
//     let isMounted = true;

//     async function loadAll() {
//       const [vtxRes, edgRes, metaRes] = await Promise.all([
//         fetch("/walking_vertices.json"),
//         fetch("/walking_edges.json"),
//         fetch("/vertex_meta.json").catch(() => null),
//       ]);

//       const vtxFC = (await vtxRes.json()) as FeatureCollection<VertexFeature>;
//       const edgFC = (await edgRes.json()) as FeatureCollection<EdgeFeature>;

//       // Meta can be missing or malformed; normalize to Record<string, VertexMeta>
//       let metaMap: Record<string, VertexMeta> = {};
//       if (metaRes && metaRes.ok) {
//         const raw = await metaRes.json();
//         if (Array.isArray(raw)) {
//           for (const r of raw) {
//             const id = String(r.id ?? "");
//             if (id) metaMap[id] = { name: r.name, hidden: !!r.hidden };
//           }
//         } else if (raw && typeof raw === "object") {
//           for (const k of Object.keys(raw)) {
//             const m = raw[k] || {};
//             metaMap[String(k)] = { name: m.name, hidden: !!m.hidden };
//           }
//         }
//       }
//       if (!isMounted) return;

//       // Build nodes (default: HIDE unknown ids)
//       const nodesTmp: Node[] = vtxFC.features.map((f) => {
//         const id =
//           f.id != null
//             ? String(f.id)
//             : f.properties?.OBJECTID != null
//             ? String(f.properties.OBJECTID)
//             : f.properties?.Id != null
//             ? String(f.properties.Id)
//             : `${f.geometry.coordinates[0]},${f.geometry.coordinates[1]}`;

//         const [lon, lat] = f.geometry.coordinates;
//         const { x, y } = lonLatToWebMercator(lon, lat);

//         // If id present in meta: visible unless hidden:true. If not present: hidden by default.
//         const hasMeta = Object.prototype.hasOwnProperty.call(metaMap, id);
//         const meta = hasMeta ? metaMap[id] ?? {} : undefined;
//         const hidden = hasMeta ? meta?.hidden ?? false : true;

//         return {
//           id,
//           name: meta?.name ?? id,
//           hidden,
//           lon,
//           lat,
//           x,
//           y,
//         };
//       });

//       // Build a coordinate index for quick endpoint->node matching
//       const keyFor = (lon: number, lat: number) =>
//         `${lon.toFixed(12)},${lat.toFixed(12)}`;
//       const idByLL = new Map<string, string>();
//       for (const n of nodesTmp) idByLL.set(keyFor(n.lon, n.lat), n.id);

//       // Helper: find node id for endpoint (exact match preferred; else nearest)
//       function findNodeIdFor(lon: number, lat: number): string | null {
//         const k = keyFor(lon, lat);
//         if (idByLL.has(k)) return idByLL.get(k)!;
//         // fallback: nearest within ~3 meters
//         let bestId: string | null = null;
//         let best = Infinity;
//         const { x, y } = lonLatToWebMercator(lon, lat);
//         for (const n of nodesTmp) {
//           const d = Math.hypot(n.x - x, n.y - y);
//           if (d < best) {
//             best = d;
//             bestId = n.id;
//           }
//         }
//         return best < 3 ? bestId : null;
//       }

//       // Build edges (use first & last coordinate of each LineString)
//       const edgesTmp: Edge[] = [];
//       for (const f of edgFC.features) {
//         const coords = f.geometry.coordinates;
//         if (!coords || coords.length < 2) continue;
//         const [lonA, latA] = coords[0];
//         const [lonB, latB] = coords[coords.length - 1];

//         const fromId = findNodeIdFor(lonA, latA);
//         const toId = findNodeIdFor(lonB, latB);
//         if (!fromId || !toId || fromId === toId) continue;

//         const a = nodesTmp.find((n) => n.id === fromId)!;
//         const b = nodesTmp.find((n) => n.id === toId)!;

//         // Prefer property Shape_Length if it looks like meters; else compute Euclidean in 3857
//         const propLen = (f as any).properties?.Shape_Length;
//         const w =
//           typeof propLen === "number" && isFinite(propLen) && propLen > 0
//             ? propLen
//             : dist(a, b);

//         edgesTmp.push({ from: fromId, to: toId, weight: w });
//       }

//       setNodes(nodesTmp);
//       setEdges(edgesTmp);
//       setMetaById(metaMap);

//       // Preselect a default origin/dest (first two non-hidden)
//       const publicNodes = nodesTmp.filter((n) => !n.hidden);
//       if (publicNodes.length >= 2) {
//         setOrigin(publicNodes[0].id);
//         setDest(publicNodes[1].id);
//       } else if (publicNodes.length === 1) {
//         setOrigin(publicNodes[0].id);
//         setDest(publicNodes[0].id);
//       }
//     }

//     loadAll().catch(console.error);
//     return () => {
//       isMounted = false;
//     };
//   }, []);

//   /** Create the graphics layer once ArcGIS is ready */
//   React.useEffect(() => {
//     const tryInit = () => {
//       const view = MapViewRef.current;
//       if (!view || !(window as any).require) return false;
//       (window as any).require(
//         ["esri/layers/GraphicsLayer"],
//         (GraphicsLayer: typeof __esri.GraphicsLayer) => {
//           if (!directionsLayerRef.current) {
//             const layer = new GraphicsLayer({ id: "directions-layer" });
//             // Our canonical z position (labels are z=70)
//             (layer as any).z = 60;
//             directionsLayerRef.current = layer;

//             // Prefer: insert directly below labels (if present)
//             const labels = view.map.findLayerById("labels");
//             if (labels) {
//               const idx = view.map.layers.indexOf(labels);
//               view.map.add(layer, idx); // under labels
//             } else {
//               view.map.add(layer);
//             }

//             // Final safety: enforce global z-order
//             resortByZ(view.map);
//           }
//         }
//       );
//       return true;
//     };
//     const intv = setInterval(() => {
//       if (tryInit()) clearInterval(intv);
//     }, 120);
//     return () => clearInterval(intv);
//   }, []);

//   /** Cleanup click handler on unmount */
//   React.useEffect(() => {
//     return () => clickHandleRef.current?.remove?.();
//   }, []);

//   const publicNodes = React.useMemo(
//     () => nodes.filter((n) => !n.hidden),
//     [nodes]
//   );

//   /** A vertex is "significant" if it comes from vertex_meta.json AND has a name AND is not hidden */
//   const isSignificant = React.useCallback(
//     (n: Node) => {
//       const m = metaById[n.id];
//       return !!m?.name && !n.hidden;
//     },
//     [metaById]
//   );

//   /** Snap to nearest PUBLIC node on map click */
//   const snapToNearestPublic = React.useCallback(
//     (x: number, y: number) => {
//       if (publicNodes.length === 0) return "";
//       let bestId = publicNodes[0].id;
//       let best = Infinity;
//       for (const n of publicNodes) {
//         const d = Math.hypot(n.x - x, n.y - y);
//         if (d < best) {
//           best = d;
//           bestId = n.id;
//         }
//       }
//       return bestId;
//     },
//     [publicNodes]
//   );

//   /** Enable picking on the map */
//   const enablePick = (kind: "origin" | "dest") => {
//     const view = MapViewRef.current;
//     if (!view || !(window as any).require) return;
//     clickHandleRef.current?.remove?.();
//     setClickMode(kind);
//     clickHandleRef.current = view.on("click", (ev: any) => {
//       const mp = ev.mapPoint;
//       if (!mp) return;
//       const id = snapToNearestPublic(mp.x, mp.y);
//       if (id) {
//         if (kind === "origin") setOrigin(id);
//         else setDest(id);
//       }
//       setClickMode("none");
//       clickHandleRef.current?.remove?.();
//       clickHandleRef.current = null;
//     }) as any;
//   };

//   /** Clear graphics & UI */
//   const clearGraphics = React.useCallback(() => {
//     directionsLayerRef.current?.removeAll();
//     setSteps([]);
//     setTotal(0);
//   }, []);

//   /** Build steps: only emit turn instructions at significant nodes */
//   const buildSteps = React.useCallback(
//     (path: Node[]): Step[] => {
//       if (path.length < 2) return [];

//       const out: Step[] = [];
//       let acc = 0;

//       // Start
//       const startName = path[0].name;
//       out.push({ instruction: `Start at ${startName}`, meters: 0 });

//       for (let i = 1; i < path.length; i++) {
//         acc += dist(path[i - 1], path[i]);

//         // Intermediate vertices (possible turns)
//         if (i < path.length - 1) {
//           const angle = signedTurnAngleDeg(path[i - 1], path[i], path[i + 1]);
//           const kind = classifyTurn(angle);

//           // Emit only if significant + actual maneuver
//           if (kind !== "straight" && isSignificant(path[i])) {
//             const at = ` at ${path[i].name}`;
//             const text =
//               kind === "uturn" ? `Make a U-turn${at}` : `Turn ${kind}${at}`;
//             out.push({ instruction: text, meters: Math.round(acc) });
//             acc = 0;
//           }
//         }
//       }

//       // Final leg & arrival
//       const destNode = path[path.length - 1];
//       if (acc > 0) {
//         out.push({
//           instruction: `Continue for ${
//             acc >= 1000
//               ? (acc / 1000).toFixed(2) + " km"
//               : Math.round(acc) + " m"
//           }`,
//           meters: acc,
//         });
//       }
//       out.push({ instruction: `Arrive at ${destNode.name}`, meters: 0 });
//       return out;
//     },
//     [isSignificant]
//   );

//   /** Compute route & draw */
//   const route = React.useCallback(() => {
//     const view = MapViewRef.current;
//     const G = GraphicRef.current as typeof __esri.Graphic | null;
//     if (!view || !G || !(window as any).require) return;
//     if (!origin || !dest || nodes.length === 0 || edges.length === 0) return;

//     const { path, total } = dijkstra(nodes, edges, origin, dest);
//     clearGraphics();

//     if (path.length < 2) {
//       setSteps([]);
//       setTotal(0);
//       return;
//     }

//     setSteps(buildSteps(path));
//     setTotal(total);

//     (window as any).require(
//       ["esri/geometry/Polyline", "esri/geometry/Point"],
//       (Polyline: typeof __esri.Polyline, Point: typeof __esri.Point) => {
//         const layer = directionsLayerRef.current!;
//         const line = new Polyline({
//           paths: [path.map((n) => [n.x, n.y])],
//           spatialReference: { wkid: 3857 },
//         });

//         const routeGraphic = new G({
//           geometry: line,
//           symbol: {
//             type: "simple-line",
//             color: [0, 120, 255, 1],
//             width: 5,
//           } as any,
//           attributes: { type: "route" },
//         });

//         const start = new G({
//           geometry: new Point({
//             x: path[0].x,
//             y: path[0].y,
//             spatialReference: { wkid: 3857 },
//           }),
//           symbol: {
//             type: "simple-marker",
//             size: 10,
//             style: "circle",
//             color: [0, 200, 0, 1],
//             outline: { color: [255, 255, 255, 1], width: 1 },
//           } as any,
//           attributes: { type: "start" },
//         });

//         const end = new G({
//           geometry: new Point({
//             x: path[path.length - 1].x,
//             y: path[path.length - 1].y,
//             spatialReference: { wkid: 3857 },
//           }),
//           symbol: {
//             type: "simple-marker",
//             size: 10,
//             style: "diamond",
//             color: [220, 0, 0, 1],
//             outline: { color: [255, 255, 255, 1], width: 1 },
//           } as any,
//           attributes: { type: "end" },
//         });

//         layer.addMany([routeGraphic, start, end]);

//         // Just in case any other dynamic layer was added:
//         resortByZ(view.map);
//       }
//     );
//   }, [nodes, edges, origin, dest, clearGraphics, buildSteps]);

//   const swap = () => {
//     setOrigin(dest);
//     setDest(origin);
//   };

//   return (
//     <div
//       style={{
//         position: "relative",
//         top: 0,
//         right: 0,
//         zIndex: 1000,
//         background: "rgba(255,255,255,0.94)",
//         borderRadius: 12,
//         padding: 8,
//         width: 300,
//         border: "solid 4px",
//         boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
//         fontFamily: "system-ui, sans-serif",
//       }}
//     >
//       <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
//         Turn-by-Turn (GeoJSON graph)
//       </div>

//       {/* Load guard */}
//       {nodes.length === 0 || edges.length === 0 ? (
//         <div style={{ fontSize: 12, color: "#666" }}>
//           Loading vertices/edges from <code>/public</code>…
//         </div>
//       ) : (
//         <>
//           {/* Origin */}
//           <label style={{ fontSize: 12, fontWeight: 600 }}>Origin</label>
//           <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
//             <select
//               value={origin}
//               onChange={(e) => setOrigin(e.target.value)}
//               style={{ flex: 1, padding: "6px 8px" }}
//             >
//               {publicNodes.map((n) => (
//                 <option key={n.id} value={n.id}>
//                   {n.name}
//                 </option>
//               ))}
//             </select>
//             <button
//               onClick={() => enablePick("origin")}
//               style={{
//                 padding: "6px 8px",
//                 borderRadius: 8,
//                 border: "1px solid #ddd",
//                 background: clickMode === "origin" ? "#eef6ff" : "#f6f7f8",
//                 cursor: "pointer",
//               }}
//               title="Pick on map (snaps to nearest PUBLIC node)"
//             >
//               Pick
//             </button>
//           </div>

//           {/* Destination */}
//           <label style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>
//             Destination
//           </label>
//           <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
//             <select
//               value={dest}
//               onChange={(e) => setDest(e.target.value)}
//               style={{ flex: 1, padding: "6px 8px" }}
//             >
//               {publicNodes.map((n) => (
//                 <option key={n.id} value={n.id}>
//                   {n.name}
//                 </option>
//               ))}
//             </select>
//             <button
//               onClick={() => enablePick("dest")}
//               style={{
//                 padding: "6px 8px",
//                 borderRadius: 8,
//                 border: "1px solid #ddd",
//                 background: clickMode === "dest" ? "#eef6ff" : "#f6f7f8",
//                 cursor: "pointer",
//               }}
//               title="Pick on map (snaps to nearest PUBLIC node)"
//             >
//               Pick
//             </button>
//           </div>

//           {/* Actions */}
//           <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
//             <button
//               onClick={swap}
//               style={{
//                 flex: "0 0 auto",
//                 padding: "8px 10px",
//                 borderRadius: 10,
//                 border: "1px solid #ddd",
//                 background: "#f6f7f8",
//                 cursor: "pointer",
//               }}
//             >
//               Swap
//             </button>
//             <button
//               onClick={route}
//               style={{
//                 flex: 1,
//                 padding: "8px 10px",
//                 borderRadius: 10,
//                 border: "1px solid #0a6cff",
//                 background: "#0a6cff",
//                 color: "white",
//                 fontWeight: 600,
//                 cursor: "pointer",
//               }}
//             >
//               Route
//             </button>
//             <button
//               onClick={clearGraphics}
//               style={{
//                 flex: "0 0 auto",
//                 padding: "8px 10px",
//                 borderRadius: 10,
//                 border: "1px solid #ddd",
//                 background: "#f6f7f8",
//                 cursor: "pointer",
//               }}
//             >
//               Clear
//             </button>
//           </div>

//           {/* Summary */}
//           <div style={{ marginTop: 10, fontSize: 12, color: "#333" }}>
//             {total > 0 ? (
//               <div style={{ marginBottom: 6 }}>
//                 <strong>Total:</strong>{" "}
//                 {total >= 1000
//                   ? `${(total / 1000).toFixed(2)} km`
//                   : `${Math.round(total)} m`}
//               </div>
//             ) : (
//               <div style={{ color: "#777" }}>
//                 Pick a start and destination, then Route.
//               </div>
//             )}

//             {/* Steps */}
//             {steps.length > 0 && (
//               <ol
//                 style={{
//                   paddingLeft: 18,
//                   margin: 0,
//                   maxHeight: 180,
//                   overflow: "auto",
//                 }}
//               >
//                 {steps.map((s, i) => (
//                   <li key={i} style={{ marginBottom: 4 }}>
//                     {s.instruction}
//                     {s.meters > 0 && (
//                       <>
//                         {" — "}
//                         {s.meters >= 1000
//                           ? `${(s.meters / 1000).toFixed(2)} km`
//                           : `${Math.round(s.meters)} m`}
//                       </>
//                     )}
//                   </li>
//                 ))}
//               </ol>
//             )}
//           </div>
//         </>
//       )}
//     </div>
//   );
// }

// working version 2 bellow
// "use client";

// import React from "react";
// import { MapViewRef, GraphicRef } from "../arcgisRefs";

// /** ========= Types ========= */
// type GeoJSONPoint = {
//   type: "Point";
//   coordinates: [number, number]; // [lon, lat]
// };
// type GeoJSONLine = {
//   type: "LineString";
//   coordinates: [number, number][];
// };
// type VertexFeature = {
//   type: "Feature";
//   id?: string | number;
//   geometry: GeoJSONPoint;
//   properties?: Record<string, any>;
// };
// type EdgeFeature = {
//   type: "Feature";
//   id?: string | number;
//   geometry: GeoJSONLine;
//   properties?: Record<string, any>;
// };
// type FeatureCollection<T> = {
//   type: "FeatureCollection";
//   features: T[];
// };

// type Node = {
//   id: string;
//   name: string; // display name (or fallback to id)
//   hidden: boolean;
//   lon: number;
//   lat: number;
//   x: number; // WebMercator
//   y: number; // WebMercator
// };

// type Edge = {
//   from: string; // node id
//   to: string; // node id
//   weight: number; // meters
// };

// type VertexMeta = {
//   name?: string;
//   hidden?: boolean;
// };

// type Step = {
//   instruction: string; // e.g., "Turn left at COB2"
//   meters: number; // segment length carried to this instruction
// };

// /** ========= Projections ========= */
// const R = 6378137; // Web Mercator radius (meters)
// const toRad = (d: number) => (d * Math.PI) / 180;
// const lonLatToWebMercator = (lon: number, lat: number) => {
//   const x = R * toRad(lon);
//   const y = R * Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2));
//   return { x, y };
// };

// /** ========= Geometry helpers ========= */
// const dist = (a: Node, b: Node) => Math.hypot(a.x - b.x, a.y - b.y);

// /** Signed turn angle at B (in degrees) for segment A->B->C (WebMercator) */
// function signedTurnAngleDeg(a: Node, b: Node, c: Node): number {
//   const v1x = b.x - a.x,
//     v1y = b.y - a.y;
//   const v2x = c.x - b.x,
//     v2y = c.y - b.y;
//   const cross = v1x * v2y - v1y * v2x; // +CCW (left), -CW (right)
//   const dot = v1x * v2x + v1y * v2y;
//   const ang = Math.atan2(cross, dot);
//   return (ang * 180) / Math.PI;
// }

// const TURN_THRESHOLD = 28; // deg: left/right if |angle| >= this
// const UTURN_THRESHOLD = 150; // deg: U-turn if |angle| >= this

// function classifyTurn(
//   angleDeg: number
// ): "left" | "right" | "uturn" | "straight" {
//   const a = Math.abs(angleDeg);
//   if (a >= UTURN_THRESHOLD) return "uturn";
//   if (a >= TURN_THRESHOLD) return angleDeg > 0 ? "left" : "right";
//   return "straight";
// }

// /** ========= Dijkstra (O(V^2), fine for campus graphs) ========= */
// function dijkstra(
//   nodes: Node[],
//   edges: Edge[],
//   startId: string,
//   endId: string
// ): { path: Node[]; total: number } {
//   const byId = new Map(nodes.map((n) => [n.id, n]));

//   const adj = new Map<string, Array<{ id: string; w: number }>>();
//   for (const e of edges) {
//     if (!byId.has(e.from) || !byId.has(e.to)) continue;
//     if (!adj.has(e.from)) adj.set(e.from, []);
//     if (!adj.has(e.to)) adj.set(e.to, []);
//     adj.get(e.from)!.push({ id: e.to, w: e.weight });
//     adj.get(e.to)!.push({ id: e.from, w: e.weight }); // undirected
//   }

//   const Q = new Set<string>(nodes.map((n) => n.id));
//   const D = new Map<string, number>(nodes.map((n) => [n.id, Infinity]));
//   const P = new Map<string, string | null>(nodes.map((n) => [n.id, null]));
//   if (!Q.has(startId) || !Q.has(endId)) return { path: [], total: 0 };
//   D.set(startId, 0);

//   while (Q.size) {
//     let u: string | null = null;
//     let best = Infinity;
//     for (const id of Q) {
//       const d = D.get(id)!;
//       if (d < best) {
//         best = d;
//         u = id;
//       }
//     }
//     if (u == null) break;
//     Q.delete(u);
//     if (u === endId) break;
//     for (const nbr of adj.get(u) ?? []) {
//       if (!Q.has(nbr.id)) continue;
//       const alt = D.get(u)! + nbr.w;
//       if (alt < D.get(nbr.id)!) {
//         D.set(nbr.id, alt);
//         P.set(nbr.id, u);
//       }
//     }
//   }

//   const pathIds: string[] = [];
//   let cur: string | null = endId;
//   while (cur) {
//     pathIds.unshift(cur);
//     cur = P.get(cur) ?? null;
//   }
//   if (pathIds[0] !== startId) return { path: [], total: 0 };
//   return { path: pathIds.map((id) => byId.get(id)!), total: D.get(endId)! };
// }

// /** ========= Component ========= */
// export default function TurnByTurnOverlay() {
//   const [nodes, setNodes] = React.useState<Node[]>([]);
//   const [edges, setEdges] = React.useState<Edge[]>([]);
//   const [metaById, setMetaById] = React.useState<Record<string, VertexMeta>>(
//     {}
//   );

//   const [origin, setOrigin] = React.useState<string>("");
//   const [dest, setDest] = React.useState<string>("");

//   const [steps, setSteps] = React.useState<Step[]>([]);
//   const [total, setTotal] = React.useState<number>(0);

//   const directionsLayerRef = React.useRef<__esri.GraphicsLayer | null>(null);
//   type IHandle = { remove: () => void };
//   const clickHandleRef = React.useRef<IHandle | null>(null);
//   const [clickMode, setClickMode] = React.useState<"none" | "origin" | "dest">(
//     "none"
//   );

//   /** Load all JSONs from /public on mount */
//   React.useEffect(() => {
//     let isMounted = true;

//     async function loadAll() {
//       const [vtxRes, edgRes, metaRes] = await Promise.all([
//         fetch("/walking_vertices.json"),
//         fetch("/walking_edges.json"),
//         fetch("/vertex_meta.json").catch(() => null),
//       ]);

//       const vtxFC = (await vtxRes.json()) as FeatureCollection<VertexFeature>;
//       const edgFC = (await edgRes.json()) as FeatureCollection<EdgeFeature>;

//       // Meta can be missing or malformed; normalize to Record<string, VertexMeta>
//       let metaMap: Record<string, VertexMeta> = {};
//       if (metaRes && metaRes.ok) {
//         const raw = await metaRes.json();
//         if (Array.isArray(raw)) {
//           for (const r of raw) {
//             const id = String(r.id ?? "");
//             if (id) metaMap[id] = { name: r.name, hidden: !!r.hidden };
//           }
//         } else if (raw && typeof raw === "object") {
//           for (const k of Object.keys(raw)) {
//             const m = raw[k] || {};
//             metaMap[String(k)] = { name: m.name, hidden: !!m.hidden };
//           }
//         }
//       }
//       if (!isMounted) return;

//       // Build nodes (default: HIDE unknown ids)
//       const nodesTmp: Node[] = vtxFC.features.map((f) => {
//         const id =
//           f.id != null
//             ? String(f.id)
//             : f.properties?.OBJECTID != null
//             ? String(f.properties.OBJECTID)
//             : f.properties?.Id != null
//             ? String(f.properties.Id)
//             : `${f.geometry.coordinates[0]},${f.geometry.coordinates[1]}`;

//         const [lon, lat] = f.geometry.coordinates;
//         const { x, y } = lonLatToWebMercator(lon, lat);

//         // If id present in meta: visible unless hidden:true. If not present: hidden by default.
//         const hasMeta = Object.prototype.hasOwnProperty.call(metaMap, id);
//         const meta = hasMeta ? metaMap[id] ?? {} : undefined;
//         const hidden = hasMeta ? meta?.hidden ?? false : true;

//         return {
//           id,
//           name: meta?.name ?? id,
//           hidden,
//           lon,
//           lat,
//           x,
//           y,
//         };
//       });

//       // Build a coordinate index for quick endpoint->node matching
//       const keyFor = (lon: number, lat: number) =>
//         `${lon.toFixed(12)},${lat.toFixed(12)}`;
//       const idByLL = new Map<string, string>();
//       for (const n of nodesTmp) idByLL.set(keyFor(n.lon, n.lat), n.id);

//       // Helper: find node id for endpoint (exact match preferred; else nearest)
//       function findNodeIdFor(lon: number, lat: number): string | null {
//         const k = keyFor(lon, lat);
//         if (idByLL.has(k)) return idByLL.get(k)!;
//         // fallback: nearest within ~3 meters
//         let bestId: string | null = null;
//         let best = Infinity;
//         const { x, y } = lonLatToWebMercator(lon, lat);
//         for (const n of nodesTmp) {
//           const d = Math.hypot(n.x - x, n.y - y);
//           if (d < best) {
//             best = d;
//             bestId = n.id;
//           }
//         }
//         return best < 3 ? bestId : null;
//       }

//       // Build edges (use first & last coordinate of each LineString)
//       const edgesTmp: Edge[] = [];
//       for (const f of edgFC.features) {
//         const coords = f.geometry.coordinates;
//         if (!coords || coords.length < 2) continue;
//         const [lonA, latA] = coords[0];
//         const [lonB, latB] = coords[coords.length - 1];

//         const fromId = findNodeIdFor(lonA, latA);
//         const toId = findNodeIdFor(lonB, latB);
//         if (!fromId || !toId || fromId === toId) continue;

//         const a = nodesTmp.find((n) => n.id === fromId)!;
//         const b = nodesTmp.find((n) => n.id === toId)!;

//         // Prefer property Shape_Length if it looks like meters; else compute Euclidean in 3857
//         const propLen = f.properties?.Shape_Length;
//         const w =
//           typeof propLen === "number" && isFinite(propLen) && propLen > 0
//             ? propLen
//             : dist(a, b);

//         edgesTmp.push({ from: fromId, to: toId, weight: w });
//       }

//       setNodes(nodesTmp);
//       setEdges(edgesTmp);
//       setMetaById(metaMap);

//       // Preselect a default origin/dest (first two non-hidden)
//       const publicNodes = nodesTmp.filter((n) => !n.hidden);
//       if (publicNodes.length >= 2) {
//         setOrigin(publicNodes[0].id);
//         setDest(publicNodes[1].id);
//       } else if (publicNodes.length === 1) {
//         setOrigin(publicNodes[0].id);
//         setDest(publicNodes[0].id);
//       }
//     }

//     loadAll().catch(console.error);
//     return () => {
//       isMounted = false;
//     };
//   }, []);

//   /** Create the graphics layer once ArcGIS is ready */
//   React.useEffect(() => {
//     const tryInit = () => {
//       const view = MapViewRef.current;
//       if (!view || !(window as any).require) return false;
//       (window as any).require(
//         ["esri/layers/GraphicsLayer"],
//         (GraphicsLayer: typeof __esri.GraphicsLayer) => {
//           if (!directionsLayerRef.current) {
//             const layer = new GraphicsLayer({ id: "directions-layer" });
//             (layer as any).z = 60;
//             directionsLayerRef.current = layer;
//             view.map.add(layer);
//           }
//         }
//       );
//       return true;
//     };
//     const intv = setInterval(() => {
//       if (tryInit()) clearInterval(intv);
//     }, 120);
//     return () => clearInterval(intv);
//   }, []);

//   /** Cleanup click handler on unmount */
//   React.useEffect(() => {
//     return () => clickHandleRef.current?.remove?.();
//   }, []);

//   const publicNodes = React.useMemo(
//     () => nodes.filter((n) => !n.hidden),
//     [nodes]
//   );

//   /** A vertex is "significant" if it comes from vertex_meta.json AND has a name AND is not hidden */
//   const isSignificant = React.useCallback(
//     (n: Node) => {
//       const m = metaById[n.id];
//       return !!m?.name && !n.hidden;
//     },
//     [metaById]
//   );

//   /** Snap to nearest PUBLIC node on map click */
//   const snapToNearestPublic = React.useCallback(
//     (x: number, y: number) => {
//       if (publicNodes.length === 0) return "";
//       let bestId = publicNodes[0].id;
//       let best = Infinity;
//       for (const n of publicNodes) {
//         const d = Math.hypot(n.x - x, n.y - y);
//         if (d < best) {
//           best = d;
//           bestId = n.id;
//         }
//       }
//       return bestId;
//     },
//     [publicNodes]
//   );

//   /** Enable picking on the map */
//   const enablePick = (kind: "origin" | "dest") => {
//     const view = MapViewRef.current;
//     if (!view || !(window as any).require) return;
//     clickHandleRef.current?.remove?.();
//     setClickMode(kind);
//     clickHandleRef.current = view.on("click", (ev: any) => {
//       const mp = ev.mapPoint;
//       if (!mp) return;
//       const id = snapToNearestPublic(mp.x, mp.y);
//       if (id) {
//         if (kind === "origin") setOrigin(id);
//         else setDest(id);
//       }
//       setClickMode("none");
//       clickHandleRef.current?.remove?.();
//       clickHandleRef.current = null;
//     }) as any;
//   };

//   /** Clear graphics & UI */
//   const clearGraphics = React.useCallback(() => {
//     directionsLayerRef.current?.removeAll();
//     setSteps([]);
//     setTotal(0);
//   }, []);

//   /** Build steps: only emit turn instructions at significant nodes */
//   const buildSteps = React.useCallback(
//     (path: Node[]): Step[] => {
//       if (path.length < 2) return [];

//       const out: Step[] = [];
//       let acc = 0;

//       // Start
//       const startName = path[0].name;
//       out.push({ instruction: `Start at ${startName}`, meters: 0 });

//       for (let i = 1; i < path.length; i++) {
//         acc += dist(path[i - 1], path[i]);

//         // Intermediate vertices (possible turns)
//         if (i < path.length - 1) {
//           const angle = signedTurnAngleDeg(path[i - 1], path[i], path[i + 1]);
//           const kind = classifyTurn(angle);

//           // Emit only if significant + actual maneuver
//           if (kind !== "straight" && isSignificant(path[i])) {
//             const at = ` at ${path[i].name}`;
//             const text =
//               kind === "uturn" ? `Make a U-turn${at}` : `Turn ${kind}${at}`;
//             out.push({ instruction: text, meters: Math.round(acc) });
//             acc = 0;
//           }
//         }
//       }

//       // Final leg & arrival
//       const destNode = path[path.length - 1];
//       if (acc > 0) {
//         out.push({
//           instruction: `Continue for ${
//             acc >= 1000
//               ? (acc / 1000).toFixed(2) + " km"
//               : Math.round(acc) + " m"
//           }`,
//           meters: acc,
//         });
//       }
//       out.push({ instruction: `Arrive at ${destNode.name}`, meters: 0 });
//       return out;
//     },
//     [isSignificant]
//   );

//   /** Compute route & draw */
//   const route = React.useCallback(() => {
//     const view = MapViewRef.current;
//     const G = GraphicRef.current as typeof __esri.Graphic | null;
//     if (!view || !G || !(window as any).require) return;
//     if (!origin || !dest || nodes.length === 0 || edges.length === 0) return;

//     const { path, total } = dijkstra(nodes, edges, origin, dest);
//     clearGraphics();

//     if (path.length < 2) {
//       setSteps([]);
//       setTotal(0);
//       return;
//     }

//     setSteps(buildSteps(path));
//     setTotal(total);

//     (window as any).require(
//       ["esri/geometry/Polyline", "esri/geometry/Point"],
//       (Polyline: typeof __esri.Polyline, Point: typeof __esri.Point) => {
//         const layer = directionsLayerRef.current!;
//         const line = new Polyline({
//           paths: [path.map((n) => [n.x, n.y])],
//           spatialReference: { wkid: 3857 },
//         });

//         const routeGraphic = new G({
//           geometry: line,
//           symbol: {
//             type: "simple-line",
//             color: [0, 120, 255, 1],
//             width: 5,
//           } as any,
//           attributes: { type: "route" },
//         });

//         const start = new G({
//           geometry: new Point({
//             x: path[0].x,
//             y: path[0].y,
//             spatialReference: { wkid: 3857 },
//           }),
//           symbol: {
//             type: "simple-marker",
//             size: 10,
//             style: "circle",
//             color: [0, 200, 0, 1],
//             outline: { color: [255, 255, 255, 1], width: 1 },
//           } as any,
//           attributes: { type: "start" },
//         });

//         const end = new G({
//           geometry: new Point({
//             x: path[path.length - 1].x,
//             y: path[path.length - 1].y,
//             spatialReference: { wkid: 3857 },
//           }),
//           symbol: {
//             type: "simple-marker",
//             size: 10,
//             style: "diamond",
//             color: [220, 0, 0, 1],
//             outline: { color: [255, 255, 255, 1], width: 1 },
//           } as any,
//           attributes: { type: "end" },
//         });

//         layer.addMany([routeGraphic, start, end]);
//       }
//     );
//   }, [nodes, edges, origin, dest, clearGraphics, buildSteps]);

//   const swap = () => {
//     setOrigin(dest);
//     setDest(origin);
//   };

//   return (
//     <div
//       style={{
//         position: "relative",
//         top: 0,
//         right: 0,
//         zIndex: 1000,
//         background: "rgba(255,255,255,0.94)",
//         borderRadius: 12,
//         padding: 8,
//         width: 300,
//         border: "solid 4px",
//         boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
//         fontFamily: "system-ui, sans-serif",
//       }}
//     >
//       <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
//         Turn-by-Turn (GeoJSON graph)
//       </div>

//       {/* Load guard */}
//       {nodes.length === 0 || edges.length === 0 ? (
//         <div style={{ fontSize: 12, color: "#666" }}>
//           Loading vertices/edges from <code>/public</code>…
//         </div>
//       ) : (
//         <>
//           {/* Origin */}
//           <label style={{ fontSize: 12, fontWeight: 600 }}>Origin</label>
//           <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
//             <select
//               value={origin}
//               onChange={(e) => setOrigin(e.target.value)}
//               style={{ flex: 1, padding: "6px 8px" }}
//             >
//               {publicNodes.map((n) => (
//                 <option key={n.id} value={n.id}>
//                   {n.name}
//                 </option>
//               ))}
//             </select>
//             <button
//               onClick={() => enablePick("origin")}
//               style={{
//                 padding: "6px 8px",
//                 borderRadius: 8,
//                 border: "1px solid #ddd",
//                 background: clickMode === "origin" ? "#eef6ff" : "#f6f7f8",
//                 cursor: "pointer",
//               }}
//               title="Pick on map (snaps to nearest PUBLIC node)"
//             >
//               Pick
//             </button>
//           </div>

//           {/* Destination */}
//           <label style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>
//             Destination
//           </label>
//           <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
//             <select
//               value={dest}
//               onChange={(e) => setDest(e.target.value)}
//               style={{ flex: 1, padding: "6px 8px" }}
//             >
//               {publicNodes.map((n) => (
//                 <option key={n.id} value={n.id}>
//                   {n.name}
//                 </option>
//               ))}
//             </select>
//             <button
//               onClick={() => enablePick("dest")}
//               style={{
//                 padding: "6px 8px",
//                 borderRadius: 8,
//                 border: "1px solid #ddd",
//                 background: clickMode === "dest" ? "#eef6ff" : "#f6f7f8",
//                 cursor: "pointer",
//               }}
//               title="Pick on map (snaps to nearest PUBLIC node)"
//             >
//               Pick
//             </button>
//           </div>

//           {/* Actions */}
//           <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
//             <button
//               onClick={swap}
//               style={{
//                 flex: "0 0 auto",
//                 padding: "8px 10px",
//                 borderRadius: 10,
//                 border: "1px solid #ddd",
//                 background: "#f6f7f8",
//                 cursor: "pointer",
//               }}
//             >
//               Swap
//             </button>
//             <button
//               onClick={route}
//               style={{
//                 flex: 1,
//                 padding: "8px 10px",
//                 borderRadius: 10,
//                 border: "1px solid #0a6cff",
//                 background: "#0a6cff",
//                 color: "white",
//                 fontWeight: 600,
//                 cursor: "pointer",
//               }}
//             >
//               Route
//             </button>
//             <button
//               onClick={clearGraphics}
//               style={{
//                 flex: "0 0 auto",
//                 padding: "8px 10px",
//                 borderRadius: 10,
//                 border: "1px solid #ddd",
//                 background: "#f6f7f8",
//                 cursor: "pointer",
//               }}
//             >
//               Clear
//             </button>
//           </div>

//           {/* Summary */}
//           <div style={{ marginTop: 10, fontSize: 12, color: "#333" }}>
//             {total > 0 ? (
//               <div style={{ marginBottom: 6 }}>
//                 <strong>Total:</strong>{" "}
//                 {total >= 1000
//                   ? `${(total / 1000).toFixed(2)} km`
//                   : `${Math.round(total)} m`}
//               </div>
//             ) : (
//               <div style={{ color: "#777" }}>
//                 Pick a start and destination, then Route.
//               </div>
//             )}

//             {/* Steps */}
//             {steps.length > 0 && (
//               <ol
//                 style={{
//                   paddingLeft: 18,
//                   margin: 0,
//                   maxHeight: 180,
//                   overflow: "auto",
//                 }}
//               >
//                 {steps.map((s, i) => (
//                   <li key={i} style={{ marginBottom: 4 }}>
//                     {s.instruction}
//                     {s.meters > 0 && (
//                       <>
//                         {" — "}
//                         {s.meters >= 1000
//                           ? `${(s.meters / 1000).toFixed(2)} km`
//                           : `${Math.round(s.meters)} m`}
//                       </>
//                     )}
//                   </li>
//                 ))}
//               </ol>
//             )}
//           </div>
//         </>
//       )}
//     </div>
//   );
// }

//working down bellow
// "use client";

// import React from "react";
// import { MapViewRef, GraphicRef } from "../arcgisRefs";

// type Node = {
//   id: string;
//   name: string;
//   x: number;
//   y: number;
//   hidden?: boolean;
// }; // 3857 meters
// type Edge = { from: string; to: string; weight?: number; silent?: boolean };

// const R = 6378137;
// const toRad = (d: number) => (d * Math.PI) / 180;
// const lonLatToWebMercator = (lon: number, lat: number) => {
//   const x = R * toRad(lon);
//   const y = R * Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2));
//   return { x, y };
// };

// /** --- Public vertices (UC Merced-ish), stored 4326 then converted to 3857 --- */
// const publicNodesLL = [
//   { id: "kl", name: "Kolligian Library (KL)", lon: -120.4245, lat: 37.366 },
//   { id: "cob1", name: "COB 1", lon: -120.4232, lat: 37.3668 },
//   { id: "cob2", name: "COB 2", lon: -120.4222, lat: 37.3662 },
//   { id: "se1", name: "SE 1", lon: -120.4228, lat: 37.3652 },
//   { id: "se2", name: "SE 2", lon: -120.4218, lat: 37.365 },
//   { id: "pavilion", name: "Pavilion", lon: -120.424655, lat: 37.36376 },
//   { id: "conf", name: "Conference Center", lon: -120.4255, lat: 37.3673 },
//   {
//     id: "elportal",
//     name: "El Portal",
//     lon: -120.42659088119318,
//     lat: 37.36152828812577,
//   },
// ];

// /** --- Connector vertices (hidden), used only to “shape” routes --- */
// const connectorNodesLL = [
//   // quad + walkway midpoints (rough placeholders)
//   {
//     id: "quad_mid",
//     name: "_quad_mid",
//     lon: -120.4239,
//     lat: 37.3662,
//     hidden: true,
//   },
//   {
//     id: "walk_n1",
//     name: "_walk_n1",
//     lon: -120.4234,
//     lat: 37.3665,
//     hidden: true,
//   },
//   {
//     id: "walk_s1",
//     name: "_walk_s1",
//     lon: -120.425962,
//     lat: 37.364791,
//     hidden: true,
//   },
//   {
//     id: "seg1",
//     name: "_seg1",
//     lon: -120.424589,
//     lat: 37.363617,
//     hidden: true,
//   },

//   {
//     id: "seg2",
//     name: "_seg2",
//     lon: -120.42681886584991,
//     lat: 37.36207521446155,
//     hidden: true,
//   },
//   {
//     id: "seg3",
//     name: "_seg3",
//     lon: -120.426782,
//     lat: 37.36152,

//     hidden: true,
//   },
// ];

// /** Undirected edges; omit weights to auto-use Euclidean.
//  * Mark edges that should NOT produce a step as { silent: true }.
//  */
// const sampleEdges: Edge[] = [
//   // normal public-to-public edges (these DO create steps)
//   { from: "kl", to: "conf" },

//   // connectors around KL↔COB1 area (these should NOT show as steps)
//   { from: "kl", to: "walk_n1", silent: true },
//   { from: "walk_n1", to: "cob1", silent: true },

//   // another path KL -> Pavilion via a hidden point (still silent)
//   { from: "kl", to: "walk_s1", silent: true },
//   { from: "walk_s1", to: "pavilion", silent: true },

//   { from: "pavilion", to: "seg1", silent: true },
//   { from: "seg1", to: "seg2", silent: true },
//   { from: "seg2", to: "seg3", silent: true },
//   { from: "seg3", to: "elportal", silent: true },

//   // public structural edges
//   { from: "cob1", to: "cob2" },
//   { from: "cob1", to: "se1" },
//   { from: "cob2", to: "se2" },
//   { from: "se1", to: "se2" },

//   // optional diagonal across the quad using a hidden node (silent)
//   { from: "cob1", to: "quad_mid", silent: true },
//   { from: "quad_mid", to: "se1", silent: true },

//   // Pavilion connects into SE1 (public)
//   { from: "pavilion", to: "se1" },
// ];

// /** Euclidean distance in Web Mercator (meters) */
// const dist = (a: Node, b: Node) => Math.hypot(a.x - b.x, a.y - b.y);

// /** Dijkstra (small graph, simple O(V^2)) */
// function dijkstra(
//   nodes: Node[],
//   edges: Edge[],
//   startId: string,
//   endId: string
// ): { path: Node[]; total: number } {
//   const byId = new Map(nodes.map((n) => [n.id, n]));
//   if (!byId.has(startId) || !byId.has(endId)) return { path: [], total: 0 };

//   const adj = new Map<string, Array<{ id: string; w: number }>>();
//   for (const e of edges) {
//     const a = byId.get(e.from);
//     const b = byId.get(e.to);
//     if (!a || !b) continue;
//     const w = e.weight ?? dist(a, b);
//     if (!adj.has(e.from)) adj.set(e.from, []);
//     if (!adj.has(e.to)) adj.set(e.to, []);
//     adj.get(e.from)!.push({ id: e.to, w });
//     adj.get(e.to)!.push({ id: e.from, w }); // undirected
//   }

//   const Q = new Set<string>(nodes.map((n) => n.id));
//   const D = new Map<string, number>(nodes.map((n) => [n.id, Infinity]));
//   const P = new Map<string, string | null>(nodes.map((n) => [n.id, null]));
//   D.set(startId, 0);

//   while (Q.size) {
//     // pick u with min D
//     let u: string | null = null;
//     let best = Infinity;
//     for (const id of Q) {
//       const d = D.get(id)!;
//       if (d < best) {
//         best = d;
//         u = id;
//       }
//     }
//     if (u == null) break;
//     Q.delete(u);
//     if (u === endId) break;

//     for (const nbr of adj.get(u) ?? []) {
//       if (!Q.has(nbr.id)) continue;
//       const alt = D.get(u)! + nbr.w;
//       if (alt < D.get(nbr.id)!) {
//         D.set(nbr.id, alt);
//         P.set(nbr.id, u);
//       }
//     }
//   }

//   // Reconstruct
//   const pathIds: string[] = [];
//   let cur: string | null = endId;
//   while (cur) {
//     pathIds.unshift(cur);
//     cur = P.get(cur) ?? null;
//   }
//   if (pathIds[0] !== startId) return { path: [], total: 0 };
//   const path = pathIds.map((id) => byId.get(id)!);
//   return { path, total: D.get(endId)! };
// }

// // util for edge lookup
// const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

// export default function TurnByTurnOverlay() {
//   const [nodes] = React.useState<Node[]>(() => {
//     const toNode = (n: any): Node => {
//       const { x, y } = lonLatToWebMercator(n.lon, n.lat);
//       return { id: n.id, name: n.name, x, y, hidden: !!n.hidden };
//     };
//     return [...publicNodesLL.map(toNode), ...connectorNodesLL.map(toNode)];
//   });

//   const publicNodes = React.useMemo(
//     () => nodes.filter((n) => !n.hidden),
//     [nodes]
//   );

//   const [origin, setOrigin] = React.useState<string>("kl");
//   const [dest, setDest] = React.useState<string>("cob2");
//   const [clickMode, setClickMode] = React.useState<"none" | "origin" | "dest">(
//     "none"
//   );
//   const [steps, setSteps] = React.useState<
//     { from: string; to: string; meters: number }[]
//   >([]);
//   const [total, setTotal] = React.useState<number>(0);

//   const directionsLayerRef = React.useRef<__esri.GraphicsLayer | null>(null);
//   const clickHandleRef = React.useRef<IHandle | null>(null);
//   type IHandle = { remove: () => void };

//   const hiddenSet = React.useMemo(
//     () => new Set(nodes.filter((n) => n.hidden).map((n) => n.id)),
//     [nodes]
//   );
//   const silentSet = React.useMemo(() => {
//     const s = new Set<string>();
//     for (const e of sampleEdges) if (e.silent) s.add(edgeKey(e.from, e.to));
//     return s;
//   }, []);

//   /** Helper: find nearest PUBLIC node to a map click */
//   const snapToNearestPublic = React.useCallback(
//     (x: number, y: number) => {
//       let bestId = publicNodes[0].id;
//       let best = Infinity;
//       for (const n of publicNodes) {
//         const d = Math.hypot(n.x - x, n.y - y);
//         if (d < best) {
//           best = d;
//           bestId = n.id;
//         }
//       }
//       return bestId;
//     },
//     [publicNodes]
//   );

//   /** Init: create a dedicated GraphicsLayer once */
//   React.useEffect(() => {
//     const tryInit = () => {
//       const view = MapViewRef.current;
//       if (!view || !(window as any).require) return false;

//       (window as any).require(
//         ["esri/layers/GraphicsLayer"],
//         (GraphicsLayer: typeof __esri.GraphicsLayer) => {
//           if (!directionsLayerRef.current) {
//             const layer = new GraphicsLayer({ id: "directions-layer" });
//             (layer as any).z = 60;
//             directionsLayerRef.current = layer;
//             view.map.add(layer);
//           }
//         }
//       );
//       return true;
//     };

//     const intv = setInterval(() => {
//       if (tryInit()) clearInterval(intv);
//     }, 100);
//     return () => clearInterval(intv);
//   }, []);

//   /** Cleanup click handlers on unmount */
//   React.useEffect(() => {
//     return () => {
//       clickHandleRef.current?.remove?.();
//     };
//   }, []);

//   /** Enable/disable map picking for origin/dest (PUBLIC nodes only) */
//   const enablePick = (kind: "origin" | "dest") => {
//     const view = MapViewRef.current;
//     if (!view || !(window as any).require) return;
//     clickHandleRef.current?.remove?.();
//     setClickMode(kind);

//     clickHandleRef.current = view.on("click", (ev: any) => {
//       const mapPoint = ev.mapPoint;
//       if (!mapPoint) return;
//       const id = snapToNearestPublic(mapPoint.x, mapPoint.y);
//       if (kind === "origin") setOrigin(id);
//       else setDest(id);
//       setClickMode("none");
//       clickHandleRef.current?.remove?.();
//       clickHandleRef.current = null;
//     });
//   };

//   /** Clear current route graphics */
//   const clearGraphics = React.useCallback(() => {
//     directionsLayerRef.current?.removeAll();
//     setSteps([]);
//     setTotal(0);
//   }, []);

//   /** Build human-readable steps that SKIP hidden nodes and SILENT edges */
//   const buildSteps = React.useCallback(
//     (path: Node[]) => {
//       if (path.length < 2) return { segments: [], meters: 0 };

//       let segments: { from: string; to: string; meters: number }[] = [];
//       let anchorIdx = 0; // path[0] is public because origin is public
//       let acc = 0;

//       for (let i = 1; i < path.length; i++) {
//         const prev = path[i - 1];
//         const cur = path[i];
//         const edgeMeters = dist(prev, cur);
//         acc += edgeMeters;

//         const curIsPublic = !hiddenSet.has(cur.id);
//         const isSilent = silentSet.has(edgeKey(prev.id, cur.id));

//         // Create a step only when we enter a PUBLIC node via a NON-silent edge.
//         if (curIsPublic && !isSilent) {
//           const from = path[anchorIdx];
//           segments.push({ from: from.name, to: cur.name, meters: acc });
//           anchorIdx = i;
//           acc = 0;
//         }
//       }

//       // If we ended on the destination via only silent edges, still emit the last leg.
//       const last = path[path.length - 1];
//       if (anchorIdx < path.length - 1 && !hiddenSet.has(last.id)) {
//         let tail = 0;
//         for (let j = anchorIdx + 1; j < path.length; j++) {
//           tail += dist(path[j - 1], path[j]);
//         }
//         if (tail > 0) {
//           segments.push({
//             from: path[anchorIdx].name,
//             to: last.name,
//             meters: tail,
//           });
//         }
//       }

//       return {
//         segments,
//         meters: segments.reduce((s, seg) => s + seg.meters, 0),
//       };
//     },
//     [hiddenSet, silentSet]
//   );

//   /** Compute + draw route */
//   const route = React.useCallback(() => {
//     const view = MapViewRef.current;
//     const G = GraphicRef.current as typeof __esri.Graphic | null;
//     if (!view || !G || !(window as any).require) return;

//     const { path, total } = dijkstra(nodes, sampleEdges, origin, dest);
//     clearGraphics();

//     if (path.length < 2) {
//       setSteps([]);
//       setTotal(0);
//       return;
//     }

//     const { segments } = buildSteps(path);
//     setSteps(segments);
//     setTotal(total);

//     (window as any).require(
//       ["esri/geometry/Polyline", "esri/geometry/Point"],
//       (Polyline: typeof __esri.Polyline, Point: typeof __esri.Point) => {
//         const layer = directionsLayerRef.current!;
//         const line = new Polyline({
//           paths: [path.map((n) => [n.x, n.y])],
//           spatialReference: { wkid: 3857 },
//         });

//         const lineGraphic = new G({
//           geometry: line,
//           symbol: {
//             type: "simple-line",
//             color: [0, 120, 255, 1],
//             width: 5,
//           } as any,
//           attributes: { type: "route" },
//         });

//         const start = new G({
//           geometry: new Point({
//             x: path[0].x,
//             y: path[0].y,
//             spatialReference: { wkid: 3857 },
//           }),
//           symbol: {
//             type: "simple-marker",
//             size: 10,
//             style: "circle",
//             color: [0, 200, 0, 1],
//             outline: { color: [255, 255, 255, 1], width: 1 },
//           } as any,
//           attributes: { type: "start" },
//         });

//         const end = new G({
//           geometry: new Point({
//             x: path[path.length - 1].x,
//             y: path[path.length - 1].y,
//             spatialReference: { wkid: 3857 },
//           }),
//           symbol: {
//             type: "simple-marker",
//             size: 10,
//             style: "diamond",
//             color: [220, 0, 0, 1],
//             outline: { color: [255, 255, 255, 1], width: 1 },
//           } as any,
//           attributes: { type: "end" },
//         });

//         layer.addMany([lineGraphic, start, end]);
//       }
//     );
//   }, [nodes, origin, dest, clearGraphics, buildSteps]);

//   const swap = () => {
//     setOrigin(dest);
//     setDest(origin);
//   };

//   return (
//     <div
//       style={{
//         position: "relative",
//         top: 0,
//         right: 0,
//         zIndex: 1000,
//         background: "rgba(255,255,255,0.94)",
//         borderRadius: 12,
//         padding: 3,
//         width: "280px",
//         border: "solid 4px",
//         boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
//         fontFamily: "system-ui, sans-serif",
//       }}
//     >
//       <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
//         Turn-by-Turn (Campus Graph)
//       </div>

//       {/* Origin */}
//       <label style={{ fontSize: 12, fontWeight: 600 }}>Origin</label>
//       <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
//         <select
//           value={origin}
//           onChange={(e) => setOrigin(e.target.value)}
//           style={{ flex: 1, padding: "6px 8px" }}
//         >
//           {publicNodes.map((n) => (
//             <option key={n.id} value={n.id}>
//               {n.name}
//             </option>
//           ))}
//         </select>
//         <button
//           onClick={() => enablePick("origin")}
//           style={{
//             padding: "6px 8px",
//             borderRadius: 8,
//             border: "1px solid #ddd",
//             background: clickMode === "origin" ? "#eef6ff" : "#f6f7f8",
//             cursor: "pointer",
//           }}
//           title="Pick on map (snaps to nearest PUBLIC node)"
//         >
//           Pick
//         </button>
//       </div>

//       {/* Destination */}
//       <label style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>
//         Destination
//       </label>
//       <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
//         <select
//           value={dest}
//           onChange={(e) => setDest(e.target.value)}
//           style={{ flex: 1, padding: "6px 8px" }}
//         >
//           {publicNodes.map((n) => (
//             <option key={n.id} value={n.id}>
//               {n.name}
//             </option>
//           ))}
//         </select>
//         <button
//           onClick={() => enablePick("dest")}
//           style={{
//             padding: "6px 8px",
//             borderRadius: 8,
//             border: "1px solid #ddd",
//             background: clickMode === "dest" ? "#eef6ff" : "#f6f7f8",
//             cursor: "pointer",
//           }}
//           title="Pick on map (snaps to nearest PUBLIC node)"
//         >
//           Pick
//         </button>
//       </div>

//       {/* Actions */}
//       <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
//         <button
//           onClick={swap}
//           style={{
//             flex: "0 0 auto",
//             padding: "8px 10px",
//             borderRadius: 10,
//             border: "1px solid #ddd",
//             background: "#f6f7f8",
//             cursor: "pointer",
//           }}
//         >
//           Swap
//         </button>
//         <button
//           onClick={route}
//           style={{
//             flex: 1,
//             padding: "8px 10px",
//             borderRadius: 10,
//             border: "1px solid #0a6cff",
//             background: "#0a6cff",
//             color: "white",
//             fontWeight: 600,
//             cursor: "pointer",
//           }}
//         >
//           Route
//         </button>
//         <button
//           onClick={clearGraphics}
//           style={{
//             flex: "0 0 auto",
//             padding: "8px 10px",
//             borderRadius: 10,
//             border: "1px solid #ddd",
//             background: "#f6f7f8",
//             cursor: "pointer",
//           }}
//         >
//           Clear
//         </button>
//       </div>

//       {/* Summary */}
//       <div style={{ marginTop: 10, fontSize: 12, color: "#333" }}>
//         {total > 0 ? (
//           <div style={{ marginBottom: 6 }}>
//             <strong>Total:</strong>{" "}
//             {total >= 1000
//               ? `${(total / 1000).toFixed(2)} km`
//               : `${Math.round(total)} m`}
//           </div>
//         ) : (
//           <div style={{ color: "#777" }}>
//             Pick a start and destination, then Route.
//           </div>
//         )}

//         {/* Steps */}
//         {steps.length > 0 && (
//           <ol
//             style={{
//               paddingLeft: 18,
//               margin: 0,
//               maxHeight: 140,
//               overflow: "auto",
//             }}
//           >
//             {steps.map((s, i) => (
//               <li key={i} style={{ marginBottom: 4 }}>
//                 Go from <strong>{s.from}</strong> to <strong>{s.to}</strong> —{" "}
//                 {s.meters >= 1000
//                   ? `${(s.meters / 1000).toFixed(2)} km`
//                   : `${Math.round(s.meters)} m`}
//               </li>
//             ))}
//           </ol>
//         )}
//       </div>
//     </div>
//   );
// }
