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
  name?: string; // canonical display name
  aliases?: string[]; // all acceptable names (including canonical)
  hidden?: boolean;
};

type Step = {
  instruction: string;
  meters: number;
};

type SearchOption = {
  id: string;
  label: string; // canonical display label
  aliases: string[]; // all names used for matching
};

type SearchableLocationInputProps = {
  label: string;
  role: "origin" | "dest";
  query: string;
  setQuery: (value: string) => void;
  valueId: string;
  onChangeId: (id: string) => void;
  options: SearchOption[];
  onPickClick: () => void;
  pickActive: boolean;
};

/** ========= Constants ========= */
const DIRECTIONS_LAYER_ID = "directions-layer";

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

/** ========= Search helpers & component ========= */
const MAX_SUGGESTIONS = 30;

function filterSearchOptions(
  options: SearchOption[],
  query: string,
): SearchOption[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) {
    return [...options].sort((a, b) => a.label.localeCompare(b.label));
  }

  const scored: { option: SearchOption; score: number }[] = [];
  for (const option of options) {
    let bestScore = Infinity;
    for (const alias of option.aliases) {
      const idx = alias.toLowerCase().indexOf(normalizedQuery);
      if (idx >= 0 && idx < bestScore) bestScore = idx;
    }
    if (bestScore !== Infinity) scored.push({ option, score: bestScore });
  }

  scored.sort(
    (a, b) => a.score - b.score || a.option.label.localeCompare(b.option.label),
  );
  return scored.map((s) => s.option).slice(0, MAX_SUGGESTIONS);
}

const SearchableLocationInput: React.FC<SearchableLocationInputProps> = ({
  label,
  role,
  query,
  setQuery,
  valueId,
  onChangeId,
  options,
  onPickClick,
  pickActive,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [highlightIndex, setHighlightIndex] = React.useState(0);

  const filteredOptions = React.useMemo(
    () => filterSearchOptions(options, query),
    [options, query],
  );

  const optionRefs = React.useRef<(HTMLLIElement | null)[]>([]);

  React.useEffect(() => {
    if (filteredOptions.length > 0) {
      const idx = filteredOptions.findIndex((o) => o.id === valueId);
      setHighlightIndex(idx >= 0 ? idx : 0);
    } else {
      setHighlightIndex(0);
    }
  }, [filteredOptions, valueId]);

  const showDropdown = isOpen && filteredOptions.length > 0;

  React.useEffect(() => {
    if (!showDropdown) return;
    const el = optionRefs.current[highlightIndex];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, showDropdown]);

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setQuery(e.target.value);
    setIsOpen(true);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "ArrowDown") {
      if (filteredOptions.length === 0) return;
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightIndex(0);
      } else {
        setHighlightIndex((prev) =>
          Math.min(prev + 1, filteredOptions.length - 1),
        );
      }
    } else if (e.key === "ArrowUp") {
      if (!isOpen || filteredOptions.length === 0) return;
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      if (isOpen && filteredOptions.length > 0) {
        e.preventDefault();
        const chosen = filteredOptions[highlightIndex] ?? filteredOptions[0];
        if (chosen) {
          onChangeId(chosen.id);
          setQuery(chosen.label);
        }
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    }
  };

  const handleBlur: React.FocusEventHandler<HTMLInputElement> = () => {
    setTimeout(() => setIsOpen(false), 120);
  };

  const handleOptionMouseDown =
    (opt: SearchOption, idx: number) =>
    (e: React.MouseEvent<HTMLLIElement>) => {
      e.preventDefault();
      onChangeId(opt.id);
      setQuery(opt.label);
      setIsOpen(false);
      setHighlightIndex(idx);
    };

  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "center",
        position: "relative",
      }}
    >
      <div style={{ flex: 1, position: "relative" }}>
        <input
          aria-label={label}
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={`Search ${label.toLowerCase()}…`}
          style={{
            width: "90%",
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid #ccc",
            fontSize: 12,
          }}
        />
        {showDropdown && (
          <ul
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              margin: 0,
              marginTop: 2,
              padding: 0,
              listStyle: "none",
              maxHeight: 190,
              overflowY: "auto",
              background: "white",
              border: "1px solid #ddd",
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
              zIndex: 2000,
            }}
          >
            {filteredOptions.map((opt, idx) => (
              <li
                key={opt.id}
                ref={(el) => {
                  optionRefs.current[idx] = el;
                }}
                onMouseDown={handleOptionMouseDown(opt, idx)}
                style={{
                  padding: "4px 8px",
                  cursor: "pointer",
                  background:
                    idx === highlightIndex ? "#b5b5b5ff" : "transparent",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                }}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

/** ========= Component ========= */
export default function TurnByTurnOverlay({
  viewReady,
  viewToken = 0, // optional: passed from ArcGISMap; forces clean re-init in dev
}: {
  viewReady: boolean;
  viewToken?: number;
}) {
  const [nodes, setNodes] = React.useState<Node[]>([]);
  const [edges, setEdges] = React.useState<Edge[]>([]);
  const [metaById, setMetaById] = React.useState<Record<string, VertexMeta>>(
    {},
  );

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

  /** --------- Layer helpers (stale-ref safe) --------- */
  const getDirectionsLayer = React.useCallback(
    (view: __esri.MapView | null) => {
      if (!view?.map) return null;

      // If ref exists but is not in current map, treat as stale
      const ref = directionsLayerRef.current;
      if (ref) {
        try {
          if ((view.map.layers as any).includes(ref)) return ref;
        } catch {
          // fall through
        }
        directionsLayerRef.current = null;
      }

      // Reuse by id if present
      const existing = view.map.findLayerById(
        DIRECTIONS_LAYER_ID,
      ) as __esri.GraphicsLayer | null;
      if (existing) directionsLayerRef.current = existing;

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

            // Might have been added between calls
            const recheck = view.map.findLayerById(
              DIRECTIONS_LAYER_ID,
            ) as __esri.GraphicsLayer | null;
            if (recheck) {
              directionsLayerRef.current = recheck;
              resortByZ(view.map);
              return resolve(recheck);
            }

            const layer = new GraphicsLayer({ id: DIRECTIONS_LAYER_ID });
            (layer as any).z = 60; // below labels(z=70)

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

  /** Load all JSONs from /public on mount */
  React.useEffect(() => {
    let isMounted = true;

    function parseMetaEntry(entry: any): VertexMeta {
      const meta: VertexMeta = {};
      if (entry && typeof entry === "object") {
        const rawName = entry.name;
        const aliases: string[] = [];

        if (typeof rawName === "string") {
          const trimmed = rawName.trim();
          if (trimmed) aliases.push(trimmed);
        } else if (Array.isArray(rawName)) {
          for (const n of rawName) {
            if (typeof n === "string") {
              const trimmed = n.trim();
              if (trimmed) aliases.push(trimmed);
            }
          }
        }

        if (aliases.length > 0) {
          meta.name = aliases[0];
          meta.aliases = Array.from(new Set(aliases));
        }
        if (typeof entry.hidden === "boolean") meta.hidden = entry.hidden;
      }
      return meta;
    }

    async function loadAll() {
      const [vtxRes, edgRes, metaRes] = await Promise.all([
        fetch("/walking_vertices.json"),
        fetch("/walking_edges.json"),
        fetch("/vertex_meta.json").catch(() => null),
      ]);

      if (!vtxRes.ok)
        throw new Error(`walking_vertices.json fetch failed: ${vtxRes.status}`);
      if (!edgRes.ok)
        throw new Error(`walking_edges.json fetch failed: ${edgRes.status}`);

      const vtxFC = (await vtxRes.json()) as FeatureCollection<VertexFeature>;
      const edgFC = (await edgRes.json()) as FeatureCollection<EdgeFeature>;

      let metaMap: Record<string, VertexMeta> = {};
      if (metaRes && metaRes.ok) {
        const raw = await metaRes.json();
        if (Array.isArray(raw)) {
          for (const r of raw) {
            const id = String((r as any).id ?? "");
            if (!id) continue;
            const meta = parseMetaEntry(r);
            if (
              meta.name !== undefined ||
              meta.aliases !== undefined ||
              meta.hidden !== undefined
            ) {
              metaMap[id] = meta;
            }
          }
        } else if (raw && typeof raw === "object") {
          for (const k of Object.keys(raw)) {
            const entry = (raw as any)[k] || {};
            const meta = parseMetaEntry(entry);
            if (
              meta.name !== undefined ||
              meta.aliases !== undefined ||
              meta.hidden !== undefined
            ) {
              metaMap[String(k)] = meta;
            }
          }
        }
      }

      if (!isMounted) return;

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
        const meta = hasMeta ? (metaMap[id] ?? {}) : undefined;
        const hidden = hasMeta ? (meta?.hidden ?? false) : true;

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

      const nodeById = new Map(nodesTmp.map((n) => [n.id, n]));

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
        return best < 3 ? bestId : null; // 3m tolerance
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

        const a = nodeById.get(fromId);
        const b = nodeById.get(toId);
        if (!a || !b) continue;

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

  /** Initialize/reuse directions layer whenever the view becomes ready (and on dev view rebuilds) */
  React.useEffect(() => {
    if (!viewReady) return;

    let cancelled = false;

    (async () => {
      const view = MapViewRef.current as __esri.MapView | null;
      if (!view) return;

      const layer = await ensureDirectionsLayer(view);
      if (cancelled) return;

      // Optional: force it empty on init (prevents “ghost” routes in dev)
      layer?.removeAll?.();
    })().catch(console.error);

    return () => {
      cancelled = true;

      // Dev-safe cleanup: remove + destroy the layer (prevents stale layers across refresh cycles)
      const view = MapViewRef.current as __esri.MapView | null;
      const lyr = directionsLayerRef.current;

      if (view?.map && lyr) {
        try {
          if ((view.map.layers as any).includes(lyr)) view.map.remove(lyr);
        } catch {}
      }

      try {
        (lyr as any)?.destroy?.();
      } catch {}

      directionsLayerRef.current = null;
    };
  }, [viewReady, viewToken, ensureDirectionsLayer]);

  const publicNodes = React.useMemo(
    () => nodes.filter((n) => !n.hidden),
    [nodes],
  );

  const searchOptions = React.useMemo<SearchOption[]>(() => {
    const options: SearchOption[] = [];
    for (const n of publicNodes) {
      const meta = metaById[n.id];
      const baseName = meta?.name ?? n.name ?? n.id;
      const aliasSet = new Set<string>();

      if (baseName && typeof baseName === "string") {
        const trimmed = baseName.trim();
        if (trimmed) aliasSet.add(trimmed);
      }

      if (meta?.aliases && Array.isArray(meta.aliases)) {
        for (const a of meta.aliases) {
          if (typeof a === "string") {
            const trimmed = a.trim();
            if (trimmed) aliasSet.add(trimmed);
          }
        }
      }

      const aliases = Array.from(aliasSet);
      options.push({
        id: n.id,
        label: baseName,
        aliases: aliases.length > 0 ? aliases : [baseName],
      });
    }

    options.sort((a, b) => a.label.localeCompare(b.label));
    return options;
  }, [publicNodes, metaById]);

  const isSignificant = React.useCallback(
    (n: Node) => {
      const m = metaById[n.id];
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

  /** Keep origin/dest query text in sync with selected ids */
  React.useEffect(() => {
    if (!origin) return;
    const n = publicNodes.find((node) => node.id === origin);
    if (!n) return;
    const meta = metaById[n.id];
    const name = meta?.name ?? n.name ?? n.id;
    setOriginQuery(name);
  }, [origin, publicNodes, metaById]);

  React.useEffect(() => {
    if (!dest) return;
    const n = publicNodes.find((node) => node.id === dest);
    if (!n) return;
    const meta = metaById[n.id];
    const name = meta?.name ?? n.name ?? n.id;
    setDestQuery(name);
  }, [dest, publicNodes, metaById]);

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
    [isSignificant],
  );

  /** Compute and draw route */
  const route = React.useCallback(async () => {
    const view = MapViewRef.current as __esri.MapView | null;
    const G = GraphicRef.current as typeof __esri.Graphic | null;

    if (!view || !G) return;
    if (!origin || !dest || nodes.length === 0 || edges.length === 0) return;

    // Ensure layer exists on CURRENT map (dev refresh safe)
    const layer = await ensureDirectionsLayer(view);
    if (!layer) return;

    // Always clear previous route + steps first (clears current map layer)
    layer.removeAll();
    setSteps([]);
    setTotal(0);

    const { path, total } = dijkstra(nodes, edges, origin, dest);

    if (path.length < 2) {
      setSteps([]);
      setTotal(0);
      return;
    }

    setSteps(buildSteps(path));
    setTotal(total);

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

      {nodes.length === 0 || edges.length === 0 ? (
        <div style={{ fontSize: 12, color: "#666" }}>
          Loading vertices/edges from <code>/public</code>…
        </div>
      ) : (
        <>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Origin</label>
          <SearchableLocationInput
            label="Origin"
            role="origin"
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
            role="dest"
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
                // Ensure any async errors show up cleanly in console
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
