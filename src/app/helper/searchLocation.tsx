"use client";

import React from "react";

/** ========= Shared graph/search types ========= */
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

export type Node = {
  id: string;
  name: string;
  hidden: boolean;
  lon: number;
  lat: number;
  x: number;
  y: number;
};

export type Edge = {
  from: string;
  to: string;
  weight: number;
};

export type VertexMeta = {
  name?: string;
  aliases?: string[];
  hidden?: boolean;
};

export type SearchOption = {
  id: string;
  label: string;
  aliases: string[];
};

export type SearchableLocationInputProps = {
  label: string;
  query: string;
  setQuery: (value: string) => void;
  valueId: string;
  onChangeId: (id: string) => void;
  options: SearchOption[];
  placeholder?: string;
  disabled?: boolean;
  onPickClick?: () => void;
  pickActive?: boolean;
};

type BestMatch = {
  id: string;
  score: number;
  label: string;
};

/** ========= Constants ========= */
const MAX_SUGGESTIONS = 30;
const R = 6378137;

/** ========= Helpers ========= */
const toRad = (d: number) => (d * Math.PI) / 180;

function lonLatToWebMercator(lon: number, lat: number) {
  const x = R * toRad(lon);
  const y = R * Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2));
  return { x, y };
}

function dist(a: Node, b: Node) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

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

    if (Array.isArray(entry.aliases)) {
      for (const a of entry.aliases) {
        if (typeof a === "string") {
          const trimmed = a.trim();
          if (trimmed) aliases.push(trimmed);
        }
      }
    }

    if (aliases.length > 0) {
      meta.name = aliases[0];
      meta.aliases = Array.from(new Set(aliases));
    }

    if (typeof entry.hidden === "boolean") {
      meta.hidden = entry.hidden;
    }
  }

  return meta;
}

function buildSearchOptions(
  publicNodes: Node[],
  metaById: Record<string, VertexMeta>,
): SearchOption[] {
  const options: SearchOption[] = [];

  for (const n of publicNodes) {
    const meta = metaById[n.id];
    const baseName = meta?.name ?? n.name ?? n.id;
    const aliasSet = new Set<string>();

    if (typeof baseName === "string" && baseName.trim()) {
      aliasSet.add(baseName.trim());
    }

    if (Array.isArray(meta?.aliases)) {
      for (const alias of meta.aliases) {
        if (typeof alias === "string" && alias.trim()) {
          aliasSet.add(alias.trim());
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
}

export function filterSearchOptions(
  options: SearchOption[],
  query: string,
): SearchOption[] {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [...options]
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, MAX_SUGGESTIONS);
  }

  const scored: { option: SearchOption; score: number }[] = [];

  for (const option of options) {
    let bestScore = Infinity;

    for (const alias of option.aliases) {
      const normalizedAlias = normalizeSearchText(alias);
      const idx = normalizedAlias.indexOf(normalizedQuery);
      if (idx >= 0 && idx < bestScore) {
        bestScore = idx;
      }
    }

    if (bestScore !== Infinity) {
      scored.push({ option, score: bestScore });
    }
  }

  scored.sort(
    (a, b) => a.score - b.score || a.option.label.localeCompare(b.option.label),
  );

  return scored.map((s) => s.option).slice(0, MAX_SUGGESTIONS);
}

export function findBestLocationMatchId(
  options: SearchOption[],
  rawInput: string,
): string | null {
  const query = normalizeSearchText(rawInput);
  if (!query) return null;

  let best: BestMatch | null = null;

  const consider = (
    current: BestMatch | null,
    id: string,
    label: string,
    candidate: string,
  ): BestMatch | null => {
    const c = normalizeSearchText(candidate);
    if (!c) return current;

    let score = Infinity;

    if (c === query || normalizeSearchText(id) === query) {
      score = 0;
    } else if (c.startsWith(query) || query.startsWith(c)) {
      score = 1;
    } else {
      const idx = c.indexOf(query);
      if (idx >= 0) {
        score = 2 + idx;
      } else if (query.includes(c)) {
        score = 3;
      }
    }

    if (score === Infinity) return current;

    if (
      !current ||
      score < current.score ||
      (score === current.score && label.localeCompare(current.label) < 0)
    ) {
      return { id, score, label };
    }

    return current;
  };

  for (const option of options) {
    best = consider(best, option.id, option.label, option.id);
    best = consider(best, option.id, option.label, option.label);

    for (const alias of option.aliases) {
      best = consider(best, option.id, option.label, alias);
    }
  }

  return best ? best.id : null;
}

export async function loadLocationGraph(): Promise<{
  nodes: Node[];
  edges: Edge[];
  metaById: Record<string, VertexMeta>;
}> {
  const [vtxRes, edgRes, metaRes] = await Promise.all([
    fetch("/walking_vertices.json"),
    fetch("/walking_edges.json"),
    fetch("/vertex_meta.json").catch(() => null),
  ]);

  if (!vtxRes.ok) {
    throw new Error(`walking_vertices.json fetch failed: ${vtxRes.status}`);
  }
  if (!edgRes.ok) {
    throw new Error(`walking_edges.json fetch failed: ${edgRes.status}`);
  }

  const vtxFC = (await vtxRes.json()) as FeatureCollection<VertexFeature>;
  const edgFC = (await edgRes.json()) as FeatureCollection<EdgeFeature>;

  let metaById: Record<string, VertexMeta> = {};

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
          metaById[id] = meta;
        }
      }
    } else if (raw && typeof raw === "object") {
      for (const key of Object.keys(raw)) {
        const entry = (raw as any)[key] || {};
        const meta = parseMetaEntry(entry);

        if (
          meta.name !== undefined ||
          meta.aliases !== undefined ||
          meta.hidden !== undefined
        ) {
          metaById[String(key)] = meta;
        }
      }
    }
  }

  const nodes: Node[] = vtxFC.features.map((f) => {
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

    const hasMeta = Object.prototype.hasOwnProperty.call(metaById, id);
    const meta = hasMeta ? (metaById[id] ?? {}) : undefined;
    const hidden = hasMeta ? (meta?.hidden ?? false) : true;
    const name = meta?.name ?? id;

    return {
      id,
      name,
      hidden,
      lon,
      lat,
      x,
      y,
    };
  });

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const keyFor = (lon: number, lat: number) =>
    `${lon.toFixed(12)},${lat.toFixed(12)}`;

  const idByLonLat = new Map<string, string>();
  for (const n of nodes) {
    idByLonLat.set(keyFor(n.lon, n.lat), n.id);
  }

  function findNodeIdFor(lon: number, lat: number): string | null {
    const exact = idByLonLat.get(keyFor(lon, lat));
    if (exact) return exact;

    let bestId: string | null = null;
    let best = Infinity;
    const { x, y } = lonLatToWebMercator(lon, lat);

    for (const n of nodes) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < best) {
        best = d;
        bestId = n.id;
      }
    }

    return best < 3 ? bestId : null; // 3m tolerance
  }

  const edges: Edge[] = [];

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
    const weight =
      typeof propLen === "number" && isFinite(propLen) && propLen > 0
        ? propLen
        : dist(a, b);

    edges.push({ from: fromId, to: toId, weight });
  }

  return { nodes, edges, metaById };
}

/** ========= Shared hook ========= */
export function useLocationSearchGraph() {
  const [nodes, setNodes] = React.useState<Node[]>([]);
  const [edges, setEdges] = React.useState<Edge[]>([]);
  const [metaById, setMetaById] = React.useState<Record<string, VertexMeta>>(
    {},
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    setLoading(true);
    setError(null);

    loadLocationGraph()
      .then((data) => {
        if (!mounted) return;
        setNodes(data.nodes);
        setEdges(data.edges);
        setMetaById(data.metaById);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(
          err instanceof Error ? err.message : "Failed to load locations",
        );
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const publicNodes = React.useMemo(
    () => nodes.filter((n) => !n.hidden),
    [nodes],
  );

  const searchOptions = React.useMemo(
    () => buildSearchOptions(publicNodes, metaById),
    [publicNodes, metaById],
  );

  const nodeById = React.useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  );

  const optionById = React.useMemo(
    () => new Map(searchOptions.map((o) => [o.id, o])),
    [searchOptions],
  );

  const getNodeById = React.useCallback(
    (id: string) => nodeById.get(id) ?? null,
    [nodeById],
  );

  const getLabelById = React.useCallback(
    (id: string) => optionById.get(id)?.label ?? nodeById.get(id)?.name ?? "",
    [optionById, nodeById],
  );

  const resolveLocationId = React.useCallback(
    (input: string) => findBestLocationMatchId(searchOptions, input),
    [searchOptions],
  );

  return {
    loading,
    error,
    nodes,
    edges,
    metaById,
    publicNodes,
    searchOptions,
    getNodeById,
    getLabelById,
    resolveLocationId,
  };
}

/** ========= Shared autocomplete input ========= */
export function SearchableLocationInput({
  label,
  query,
  setQuery,
  valueId,
  onChangeId,
  options,
  placeholder,
  disabled,
  onPickClick,
  pickActive,
}: SearchableLocationInputProps) {
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

  const showDropdown = !disabled && isOpen && filteredOptions.length > 0;

  React.useEffect(() => {
    if (!showDropdown) return;
    const el = optionRefs.current[highlightIndex];
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex, showDropdown]);

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setQuery(e.target.value);
    setIsOpen(true);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (disabled) return;

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
          onFocus={() => !disabled && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder ?? `Search ${label.toLowerCase()}…`}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #ccc",
            fontSize: 14,
            background: disabled ? "#f3f4f6" : "white",
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
                  padding: "6px 10px",
                  cursor: "pointer",
                  background:
                    idx === highlightIndex ? "#e5e7eb" : "transparent",
                  fontSize: 14,
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

      {onPickClick && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onPickClick}
          style={{
            flex: "0 0 auto",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: pickActive ? "#dbeafe" : "#f9fafb",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {pickActive ? "Picking…" : "Pick"}
        </button>
      )}
    </div>
  );
}
