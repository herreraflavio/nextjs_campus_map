import {
  findBestLocationMatchId,
  normalizeSearchText,
  type Node,
  type SearchOption,
} from "@/app/helper/searchLocation";
import type { DrawingExport } from "@/app/types/myTypes";

function exactMatch(options: SearchOption[], inputs: string[]): string | null {
  for (const input of inputs) {
    const normalized = normalizeSearchText(input);
    const option = options.find(option => [option.id, option.label, ...option.aliases]
      .some(alias => normalizeSearchText(alias) === normalized));
    if (option) return option.id;
  }
  return null;
}

function containsNode(drawing: DrawingExport, node: Node): boolean {
  if (drawing.geometry.type !== "polygon") return false;
  const wkid = drawing.geometry.spatialReference.wkid;
  const [x, y] = wkid === 4326 ? [node.lon, node.lat] : [node.x, node.y];
  let inside = false;
  // Even/odd ring containment also excludes holes in a polygon.
  for (const ring of drawing.geometry.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

export function resolveMapLocation(
  input: string,
  drawings: DrawingExport[],
  searchOptions: SearchOption[],
  publicNodes: Node[],
): { drawing: DrawingExport | null; node: Node | null } | null {
  if (!input.trim()) return null;
  const drawingOptions = drawings.flatMap(drawing => {
    const { id, name } = drawing.attributes;
    if (!id) return [];
    const label = name || id;
    return [{ id, label, aliases: [label] }];
  });
  const nodeId = findBestLocationMatchId(searchOptions, input);
  const nodeOption = searchOptions.find(option => option.id === nodeId);
  const node = publicNodes.find(node => node.id === nodeId) ?? null;
  const drawingId = exactMatch(drawingOptions, [input]) ??
    (nodeOption ? exactMatch(drawingOptions, [nodeOption.label, ...nodeOption.aliases]) : null) ??
    findBestLocationMatchId(drawingOptions, input);
  const drawing = drawings.find(drawing => drawing.attributes.id === drawingId) ??
    (node ? drawings.find(drawing => containsNode(drawing, node)) : null) ?? null;
  if (!drawing && !node) return null;

  // A custom drawing can still be routed to via its nearest public walking vertex.
  let destination = node;
  if (drawing) {
    const namedId = exactMatch(searchOptions, [drawing.attributes.name || "", drawing.attributes.id || ""]);
    destination = publicNodes.find(node => node.id === namedId) ??
      (drawingId ? null : node);
    if (!destination) {
      const geometry = drawing.geometry;
      const coordinates = geometry.type === "point" ? [[geometry.x, geometry.y]] :
        (geometry.type === "polygon" ? geometry.rings : geometry.paths).flat();
      if (coordinates.length) {
        const [x, y] = coordinates.reduce(([x, y], point) => [x + point[0], y + point[1]], [0, 0])
          .map(value => value / coordinates.length);
        const geographic = geometry.spatialReference.wkid === 4326;
        let distance = Infinity;
        for (const candidate of publicNodes) {
          const d = geographic ? Math.hypot(candidate.lon - x, candidate.lat - y) :
            Math.hypot(candidate.x - x, candidate.y - y);
          if (d < distance) { distance = d; destination = candidate; }
        }
      }
    }
  }
  return { drawing, node: destination };
}
