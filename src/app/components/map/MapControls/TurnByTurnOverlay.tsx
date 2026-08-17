//src/app/components/map/MapControls/TurnByTurnOverlay.tsx
"use client";

import React from "react";
import { MapViewRef, GraphicRef, resortByZ } from "../arcgisRefs";
import {
  SearchableLocationInput,
  type Edge,
  type Node,
  type VertexMeta,
  useLocationSearchGraph,
} from "../../../helper/searchLocation";

/** ========= Types ========= */
type Step = {
  instruction: string;
  meters: number;
};

/** ========= Constants ========= */
const DIRECTIONS_LAYER_ID = "directions-layer";

/** ========= Geometry helpers ========= */
const dist = (a: Node, b: Node) => Math.hypot(a.x - b.x, a.y - b.y);

/** Signed turn angle at B (in degrees) */
function signedTurnAngleDeg(a: Node, b: Node, c: Node): number {
  const v1x = b.x - a.x;
  const v1y = b.y - a.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;

  const cross = v1x * v2y - v1y * v2x;
  const dot = v1x * v2x + v1y * v2y;
  const ang = Math.atan2(cross, dot);

  return (ang * 180) / Math.PI;
}

const TURN_THRESHOLD = 28;
const UTURN_THRESHOLD = 150;

function classifyTurn(
  angleDeg: number,
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
  endId: string,
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

  if (!Q.has(startId) || !Q.has(endId)) {
    return { path: [], total: 0 };
  }

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

  if (pathIds[0] !== startId) {
    return { path: [], total: 0 };
  }

  return {
    path: pathIds.map((id) => byId.get(id)!),
    total: D.get(endId)!,
  };
}

/** ========= Component ========= */
export default function TurnByTurnOverlay({
  viewReady,
  viewToken = 0,
}: {
  viewReady: boolean;
  viewToken?: number;
}) {
  const {
    loading,
    error,
    nodes,
    edges,
    metaById,
    publicNodes,
    searchOptions,
    getLabelById,
  } = useLocationSearchGraph();

  const [origin, setOrigin] = React.useState<string>("");
  const [dest, setDest] = React.useState<string>("");

  const [originQuery, setOriginQuery] = React.useState<string>("");
  const [destQuery, setDestQuery] = React.useState<string>("");

  const [steps, setSteps] = React.useState<Step[]>([]);
  const [total, setTotal] = React.useState<number>(0);

  const directionsLayerRef = React.useRef<__esri.GraphicsLayer | null>(null);

  type IHandle = { remove: () => void };
  const clickHandleRef = React.useRef<IHandle | null>(null);
  const [clickMode, setClickMode] = React.useState<"none" | "origin" | "dest">(
    "none",
  );

  /** --------- Layer helpers --------- */
  const getDirectionsLayer = React.useCallback(
    (view: __esri.MapView | null) => {
      if (!view?.map) return null;

      const ref = directionsLayerRef.current;
      if (ref) {
        try {
          if ((view.map.layers as any).includes(ref)) return ref;
        } catch {}
        directionsLayerRef.current = null;
      }

      const existing = view.map.findLayerById(
        DIRECTIONS_LAYER_ID,
      ) as __esri.GraphicsLayer | null;

      if (existing) {
        directionsLayerRef.current = existing;
      }

      return existing;
    },
    [],
  );

  const ensureDirectionsLayer = React.useCallback(
    async (
      view: __esri.MapView | null,
    ): Promise<__esri.GraphicsLayer | null> => {
      if (!view?.map) return null;

      const already = getDirectionsLayer(view);
      if (already) return already;

      const amd = (window as any).require;
      if (!amd) return null;

      return await new Promise((resolve) => {
        amd(
          ["esri/layers/GraphicsLayer"],
          (GraphicsLayer: typeof __esri.GraphicsLayer) => {
            if (!view?.map) return resolve(null);

            const recheck = view.map.findLayerById(
              DIRECTIONS_LAYER_ID,
            ) as __esri.GraphicsLayer | null;

            if (recheck) {
              directionsLayerRef.current = recheck;
              resortByZ(view.map);
              return resolve(recheck);
            }

            const layer = new GraphicsLayer({ id: DIRECTIONS_LAYER_ID });
            (layer as any).z = 60;

            const labels = view.map.findLayerById("labels");
            if (labels) {
              const idx = view.map.layers.indexOf(labels);
              view.map.add(layer, idx);
            } else {
              view.map.add(layer);
            }

            directionsLayerRef.current = layer;
            resortByZ(view.map);
            resolve(layer);
          },
        );
      });
    },
    [getDirectionsLayer],
  );

  /** Initialize default origin/destination from shared public nodes */
  React.useEffect(() => {
    if (publicNodes.length === 0) return;

    setOrigin((prev) => {
      if (prev && publicNodes.some((n) => n.id === prev)) return prev;
      return publicNodes[0].id;
    });

    setDest((prev) => {
      if (prev && publicNodes.some((n) => n.id === prev)) return prev;
      return publicNodes[Math.min(1, publicNodes.length - 1)].id;
    });
  }, [publicNodes]);

  /** Initialize/reuse directions layer whenever the view becomes ready */
  React.useEffect(() => {
    if (!viewReady) return;

    let cancelled = false;

    (async () => {
      const view = MapViewRef.current as __esri.MapView | null;
      if (!view) return;

      const layer = await ensureDirectionsLayer(view);
      if (cancelled) return;

      layer?.removeAll?.();
    })().catch(console.error);

    return () => {
      cancelled = true;

      const view = MapViewRef.current as __esri.MapView | null;
      const lyr = directionsLayerRef.current;

      if (view?.map && lyr) {
        try {
          if ((view.map.layers as any).includes(lyr)) {
            view.map.remove(lyr);
          }
        } catch {}
      }

      try {
        (lyr as any)?.destroy?.();
      } catch {}

      directionsLayerRef.current = null;
    };
  }, [viewReady, viewToken, ensureDirectionsLayer]);

  const isSignificant = React.useCallback(
    (n: Node) => {
      const m: VertexMeta | undefined = metaById[n.id];
      return !!m?.name && !n.hidden;
    },
    [metaById],
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
    [publicNodes],
  );

  const enablePick = (kind: "origin" | "dest") => {
    const view = MapViewRef.current as __esri.MapView | null;
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

  /** Clear route graphics + directions */
  const clearGraphics = React.useCallback(() => {
    const view = MapViewRef.current as __esri.MapView | null;
    const layer = getDirectionsLayer(view);
    layer?.removeAll?.();
    setSteps([]);
    setTotal(0);
  }, [getDirectionsLayer]);

  /** Cleanup click handler + route graphics on unmount */
  React.useEffect(() => {
    return () => {
      clickHandleRef.current?.remove?.();
      clickHandleRef.current = null;
      clearGraphics();
    };
  }, [clearGraphics]);

  /** Keep query text in sync with selected ids */
  React.useEffect(() => {
    if (!origin) return;
    const label = getLabelById(origin);
    if (label) setOriginQuery(label);
  }, [origin, getLabelById]);

  React.useEffect(() => {
    if (!dest) return;
    const label = getLabelById(dest);
    if (label) setDestQuery(label);
  }, [dest, getLabelById]);

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

            out.push({
              instruction: text,
              meters: Math.round(acc),
            });

            acc = 0;
          }
        }
      }

      const destNode = path[path.length - 1];

      if (acc > 0) {
        out.push({
          instruction: `Continue for ${
            acc >= 1000
              ? `${(acc / 1000).toFixed(2)} km`
              : `${Math.round(acc)} m`
          }`,
          meters: acc,
        });
      }

      out.push({ instruction: `Arrive at ${destNode.name}`, meters: 0 });
      return out;
    },
    [isSignificant],
  );

  /** Compute and draw route */
  const route = React.useCallback(async () => {
    const view = MapViewRef.current as __esri.MapView | null;
    const G = GraphicRef.current as typeof __esri.Graphic | null;

    if (!view || !G) return;
    if (!origin || !dest || nodes.length === 0 || edges.length === 0) return;

    const layer = await ensureDirectionsLayer(view);
    if (!layer) return;

    layer.removeAll();
    setSteps([]);
    setTotal(0);

    const result = dijkstra(nodes, edges, origin, dest);
    const path = result.path;

    if (path.length < 2) {
      setSteps([]);
      setTotal(0);
      return;
    }

    setSteps(buildSteps(path));
    setTotal(result.total);

    const amd = (window as any).require;
    if (!amd) return;

    amd(
      ["esri/geometry/Polyline", "esri/geometry/Point"],
      (Polyline: typeof __esri.Polyline, Point: typeof __esri.Point) => {
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
        if (view.map) resortByZ(view.map);
      },
    );
  }, [nodes, edges, origin, dest, ensureDirectionsLayer, buildSteps]);

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

      {loading ? (
        <div style={{ fontSize: 12, color: "#666" }}>
          Loading vertices/edges from <code>/public</code>…
        </div>
      ) : error ? (
        <div style={{ fontSize: 12, color: "#b91c1c" }}>
          Failed to load search graph: {error}
        </div>
      ) : (
        <>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Origin</label>
          <SearchableLocationInput
            label="Origin"
            query={originQuery}
            setQuery={setOriginQuery}
            valueId={origin}
            onChangeId={setOrigin}
            options={searchOptions}
            onPickClick={() => enablePick("origin")}
            pickActive={clickMode === "origin"}
          />

          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              marginTop: 8,
              display: "block",
            }}
          >
            Destination
          </label>
          <SearchableLocationInput
            label="Destination"
            query={destQuery}
            setQuery={setDestQuery}
            valueId={dest}
            onChangeId={setDest}
            options={searchOptions}
            onPickClick={() => enablePick("dest")}
            pickActive={clickMode === "dest"}
          />

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
              onClick={() => {
                route().catch(console.error);
              }}
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
