import json
import math
import heapq
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any


# ------------------------------------------------------------
# Settings
# ------------------------------------------------------------

DEFAULT_WALKING_SPEED_MPS = 1.3
DEFAULT_COORD_TOLERANCE_METERS = 0.25

INACCESSIBLE_EDGE_TYPES = {
    "stair",
    "stairs",
    "stairway",
    "outdoor_stair",
    "outdoor_stairs"
}

ACCESSIBLE_EDGE_TYPES = {
    "elevator",
    "lift",
    "ramp",
    "hallway",
    "sidewalk",
    "crosswalk",
    "entrance",
    "entrance_connector",
    "doorway",
    "walkway",
    "path"
}


# ------------------------------------------------------------
# Utility functions
# ------------------------------------------------------------

def load_geojson(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_objectid(feature: dict) -> int:
    props = feature.get("properties", {})
    if "OBJECTID" not in props:
        raise ValueError(f"Feature is missing OBJECTID: {feature}")
    return int(props["OBJECTID"])


def point_xy(feature: dict) -> Tuple[float, float]:
    geom = feature.get("geometry", {})
    if geom.get("type") != "Point":
        raise ValueError("Expected Point geometry in nodes.json")

    coords = geom.get("coordinates")
    return float(coords[0]), float(coords[1])


def edge_coords(feature: dict) -> List[Tuple[float, float]]:
    geom = feature.get("geometry", {})
    if geom.get("type") != "LineString":
        raise ValueError("Expected LineString geometry in edges.json")

    return [(float(x), float(y)) for x, y in geom.get("coordinates", [])]


def distance_xy(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    dx = a[0] - b[0]
    dy = a[1] - b[1]
    return math.sqrt(dx * dx + dy * dy)


def normalize_type(value: Optional[Any]) -> str:
    if value is None:
        return "walkway"

    text = str(value).strip().lower()

    if text in {"", "none", "null"}:
        return "walkway"

    return text


def edge_is_accessible(edge_type: str) -> bool:
    edge_type = normalize_type(edge_type)

    if edge_type in INACCESSIBLE_EDGE_TYPES:
        return False

    # Unknown or null edge types are treated as normal walking paths for now.
    return True


def edge_length_m(feature: dict) -> float:
    props = feature.get("properties", {})

    if props.get("Shape_Length") is not None:
        return float(props["Shape_Length"])

    coords = edge_coords(feature)
    total = 0.0

    for i in range(len(coords) - 1):
        total += distance_xy(coords[i], coords[i + 1])

    return total


# ------------------------------------------------------------
# Node matching
# ------------------------------------------------------------

def build_nodes(nodes_geojson: dict) -> Dict[int, dict]:
    nodes = {}

    for feature in nodes_geojson["features"]:
        oid = get_objectid(feature)
        x, y = point_xy(feature)

        nodes[oid] = {
            "objectid": oid,
            "x": x,
            "y": y,
            "feature": feature
        }

    return nodes


def find_nearest_node(
    xy: Tuple[float, float],
    nodes: Dict[int, dict],
    tolerance_m: float
) -> int:
    best_oid = None
    best_dist = float("inf")

    for oid, node in nodes.items():
        d = distance_xy(xy, (node["x"], node["y"]))

        if d < best_dist:
            best_dist = d
            best_oid = oid

    if best_oid is None or best_dist > tolerance_m:
        raise ValueError(
            f"No node found within {tolerance_m} meters of edge endpoint {xy}. "
            f"Nearest node was OBJECTID={best_oid} at distance {best_dist:.3f} meters."
        )

    return best_oid


# ------------------------------------------------------------
# Graph construction
# ------------------------------------------------------------

def build_graph(
    nodes: Dict[int, dict],
    edges_geojson: dict,
    accessible_only: bool,
    tolerance_m: float
) -> Tuple[Dict[int, List[dict]], Dict[int, dict]]:
    """
    Returns:
        adjacency:
            node OBJECTID -> list of directed arcs

        edge_lookup:
            edge OBJECTID -> original edge metadata
    """

    adjacency = {oid: [] for oid in nodes}
    edge_lookup = {}

    for edge_feature in edges_geojson["features"]:
        edge_oid = get_objectid(edge_feature)
        coords = edge_coords(edge_feature)

        if len(coords) < 2:
            continue

        start_xy = coords[0]
        end_xy = coords[-1]

        from_node = find_nearest_node(start_xy, nodes, tolerance_m)
        to_node = find_nearest_node(end_xy, nodes, tolerance_m)

        props = edge_feature.get("properties", {})
        edge_type = normalize_type(props.get("type"))

        if accessible_only and not edge_is_accessible(edge_type):
            continue

        length_m = edge_length_m(edge_feature)
        walk_time_s = length_m / DEFAULT_WALKING_SPEED_MPS

        # Optional: elevator penalty/wait time
        if edge_type in {"elevator", "lift"}:
            walk_time_s += 30.0

        # Optional: stairs penalty if non-accessible mode
        if edge_type in INACCESSIBLE_EDGE_TYPES:
            walk_time_s += 10.0

        edge_lookup[edge_oid] = {
            "objectid": edge_oid,
            "from_node": from_node,
            "to_node": to_node,
            "edge_type": edge_type,
            "length_m": length_m,
            "walk_time_s": walk_time_s,
            "feature": edge_feature
        }

        # For now, assume all edges are bidirectional.
        adjacency[from_node].append({
            "edge_oid": edge_oid,
            "from_node": from_node,
            "to_node": to_node,
            "cost": walk_time_s,
            "reverse_geometry": False
        })

        adjacency[to_node].append({
            "edge_oid": edge_oid,
            "from_node": to_node,
            "to_node": from_node,
            "cost": walk_time_s,
            "reverse_geometry": True
        })

    return adjacency, edge_lookup


# ------------------------------------------------------------
# Dijkstra shortest path
# ------------------------------------------------------------

def dijkstra(
    adjacency: Dict[int, List[dict]],
    start_oid: int,
    end_oid: int
) -> Tuple[float, List[int], List[dict]]:
    distances = {node_oid: float("inf") for node_oid in adjacency}
    previous_node = {node_oid: None for node_oid in adjacency}
    previous_arc = {node_oid: None for node_oid in adjacency}

    distances[start_oid] = 0.0

    queue = [(0.0, start_oid)]

    while queue:
        current_cost, current_node = heapq.heappop(queue)

        if current_cost > distances[current_node]:
            continue

        if current_node == end_oid:
            break

        for arc in adjacency[current_node]:
            next_node = arc["to_node"]
            new_cost = current_cost + arc["cost"]

            if new_cost < distances[next_node]:
                distances[next_node] = new_cost
                previous_node[next_node] = current_node
                previous_arc[next_node] = arc
                heapq.heappush(queue, (new_cost, next_node))

    if distances[end_oid] == float("inf"):
        raise ValueError(f"No route found from OBJECTID {start_oid} to OBJECTID {end_oid}")

    path_nodes = []
    path_arcs = []

    current = end_oid

    while current is not None:
        path_nodes.append(current)

        arc = previous_arc[current]
        if arc is not None:
            path_arcs.append(arc)

        current = previous_node[current]

    path_nodes.reverse()
    path_arcs.reverse()

    return distances[end_oid], path_nodes, path_arcs


# ------------------------------------------------------------
# Route GeoJSON export
# ------------------------------------------------------------

def build_route_geojson(
    path_arcs: List[dict],
    edge_lookup: Dict[int, dict]
) -> dict:
    route_features = []

    for sequence, arc in enumerate(path_arcs, start=1):
        edge_data = edge_lookup[arc["edge_oid"]]
        original_feature = edge_data["feature"]

        feature = json.loads(json.dumps(original_feature))
        feature["properties"] = dict(feature.get("properties", {}))

        feature["properties"]["route_seq"] = sequence
        feature["properties"]["route_from"] = arc["from_node"]
        feature["properties"]["route_to"] = arc["to_node"]
        feature["properties"]["route_cost_s"] = arc["cost"]
        feature["properties"]["route_edge_type"] = edge_data["edge_type"]

        if arc["reverse_geometry"]:
            feature["geometry"]["coordinates"] = list(reversed(feature["geometry"]["coordinates"]))

        route_features.append(feature)

    return {
        "type": "FeatureCollection",
        "crs": {
            "type": "name",
            "properties": {
                "name": "EPSG:3857"
            }
        },
        "features": route_features
    }


# ------------------------------------------------------------
# Basic text instructions
# ------------------------------------------------------------

def print_route_summary(
    total_cost_s: float,
    path_nodes: List[int],
    path_arcs: List[dict],
    edge_lookup: Dict[int, dict]
) -> None:
    print("\nRoute found")
    print("-----------")
    print(f"Total estimated time: {total_cost_s:.1f} seconds")
    print(f"Node path by OBJECTID: {path_nodes}")

    print("\nEdges:")
    for i, arc in enumerate(path_arcs, start=1):
        edge = edge_lookup[arc["edge_oid"]]
        edge_type = edge["edge_type"]

        if edge_type in {"elevator", "lift"}:
            action = "Take elevator"
        elif edge_type in INACCESSIBLE_EDGE_TYPES:
            action = "Take stairs"
        else:
            action = "Walk"

        print(
            f"{i}. {action}: "
            f"edge OBJECTID {arc['edge_oid']} | "
            f"{arc['from_node']} -> {arc['to_node']} | "
            f"type={edge_type} | "
            f"{arc['cost']:.1f}s"
        )


# ------------------------------------------------------------
# Main
# ------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Basic campus routing using nodes.json and edges.json."
    )

    parser.add_argument("--nodes", default="assets/nodes.json", help="Path to nodes GeoJSON")
    parser.add_argument("--edges", default="assets/edges.json", help="Path to edges GeoJSON")
    parser.add_argument("--start", type=int, required=True, help="Start node OBJECTID")
    parser.add_argument("--end", type=int, required=True, help="End node OBJECTID")
    parser.add_argument(
        "--accessible",
        action="store_true",
        help="Use accessible routing. Stairs are blocked; elevators are allowed."
    )
    parser.add_argument(
        "--tolerance",
        type=float,
        default=DEFAULT_COORD_TOLERANCE_METERS,
        help="Endpoint-to-node matching tolerance in meters"
    )
    parser.add_argument(
        "--out",
        default="route.geojson",
        help="Output route GeoJSON path"
    )

    args = parser.parse_args()

    nodes_geojson = load_geojson(args.nodes)
    edges_geojson = load_geojson(args.edges)

    nodes = build_nodes(nodes_geojson)

    if args.start not in nodes:
        raise ValueError(f"Start OBJECTID {args.start} does not exist in nodes.json")

    if args.end not in nodes:
        raise ValueError(f"End OBJECTID {args.end} does not exist in nodes.json")

    adjacency, edge_lookup = build_graph(
        nodes=nodes,
        edges_geojson=edges_geojson,
        accessible_only=args.accessible,
        tolerance_m=args.tolerance
    )

    total_cost_s, path_nodes, path_arcs = dijkstra(
        adjacency=adjacency,
        start_oid=args.start,
        end_oid=args.end
    )

    print_route_summary(
        total_cost_s=total_cost_s,
        path_nodes=path_nodes,
        path_arcs=path_arcs,
        edge_lookup=edge_lookup
    )

    route_geojson = build_route_geojson(path_arcs, edge_lookup)

    out_path = Path(args.out)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(route_geojson, f, indent=2)

    print(f"\nWrote route GeoJSON to: {out_path.resolve()}")


if __name__ == "__main__":
    main()