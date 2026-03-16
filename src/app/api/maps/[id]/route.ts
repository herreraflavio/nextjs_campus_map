import { ObjectId, MongoClient, Document, WithId } from "mongodb";
import type { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { findUserByEmail, User } from "@/lib/userModel";
import type {
  DrawingExport,
  EventPoint,
  FeatureLayerConfig,
  HiddenSegmentRange,
  Label,
  MapSaveBody,
  PolylineAnimation,
  SaveSettings,
  SpatialReference,
  VertexPause,
  DirectionalSpriteFrames,
} from "@/app/types/myTypes";

export interface MapDoc extends Document {
  _id: ObjectId;
  ownerId: ObjectId;
  title: string;
  url: string;
  description: string | null;
  polygons: DrawingExport[];
  labels?: Label[];
  events?: EventPoint[];
  settings?: SaveSettings;
  createdAt: Date;
  updatedAt: Date;
  isPrivate: boolean;
}

function isSpatialReference(x: any): x is SpatialReference {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof x.wkid === "number" &&
    typeof x.latestWkid === "number"
  );
}

function isFiniteNumber(x: any): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function isNonNegativeInteger(x: any): x is number {
  return Number.isInteger(x) && x >= 0;
}

function isFrameUrlList(x: any): x is string[] {
  return (
    Array.isArray(x) &&
    x.length <= 4 &&
    x.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

function isDirectionalSpriteFrames(x: any): x is DirectionalSpriteFrames {
  return (
    typeof x === "object" &&
    x !== null &&
    isFrameUrlList(x.up) &&
    isFrameUrlList(x.down) &&
    isFrameUrlList(x.left) &&
    isFrameUrlList(x.right)
  );
}

function isHiddenSegmentRange(x: any): x is HiddenSegmentRange {
  return (
    typeof x === "object" &&
    x !== null &&
    isNonNegativeInteger(x.startSegmentIndex) &&
    isNonNegativeInteger(x.endSegmentIndex) &&
    x.endSegmentIndex >= x.startSegmentIndex
  );
}

function isVertexPause(x: any): x is VertexPause {
  return (
    typeof x === "object" &&
    x !== null &&
    isNonNegativeInteger(x.vertexIndex) &&
    isFiniteNumber(x.durationMs) &&
    x.durationMs >= 0
  );
}

function isPolylineAnimation(x: any): x is PolylineAnimation {
  if (typeof x !== "object" || x === null) return false;

  const ok =
    typeof x.enabled === "boolean" &&
    typeof x.motion === "object" &&
    x.motion !== null &&
    isFiniteNumber(x.motion.durationMs) &&
    x.motion.durationMs >= 0 &&
    typeof x.motion.loop === "boolean" &&
    typeof x.motion.reverse === "boolean" &&
    typeof x.motion.autoPlay === "boolean" &&
    isFiniteNumber(x.motion.startProgress) &&
    x.motion.startProgress >= 0 &&
    x.motion.startProgress <= 1 &&
    typeof x.sprite === "object" &&
    x.sprite !== null &&
    isFiniteNumber(x.sprite.frameMs) &&
    x.sprite.frameMs >= 0 &&
    isFiniteNumber(x.sprite.scale) &&
    x.sprite.scale > 0 &&
    isFiniteNumber(x.sprite.offsetPxX) &&
    isFiniteNumber(x.sprite.offsetPxY) &&
    (x.sprite.anchor === "center" || x.sprite.anchor === "bottom") &&
    isDirectionalSpriteFrames(x.sprite.directionalFrames) &&
    typeof x.behavior === "object" &&
    x.behavior !== null &&
    Array.isArray(x.behavior.hiddenSegments) &&
    x.behavior.hiddenSegments.every(isHiddenSegmentRange) &&
    Array.isArray(x.behavior.vertexPauses) &&
    x.behavior.vertexPauses.every(isVertexPause);

  if (!ok) return false;

  const frames = x.sprite.directionalFrames;
  const totalFrames =
    frames.up.length +
    frames.down.length +
    frames.left.length +
    frames.right.length;

  return !x.enabled || totalFrames > 0;
}

function isPolygonDrawing(x: any): boolean {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof x.attributes === "object" &&
    x.attributes !== null &&
    typeof x.geometry === "object" &&
    x.geometry !== null &&
    x.geometry.type === "polygon" &&
    Array.isArray(x.geometry.rings) &&
    isSpatialReference(x.geometry.spatialReference) &&
    typeof x.symbol === "object" &&
    x.symbol !== null &&
    x.symbol.type === "simple-fill" &&
    Array.isArray(x.symbol.color) &&
    typeof x.symbol.outline === "object" &&
    x.symbol.outline !== null &&
    Array.isArray(x.symbol.outline.color) &&
    typeof x.symbol.outline.width === "number"
  );
}

function isPolylineDrawing(x: any): boolean {
  const animation =
    x?.attributes && typeof x.attributes === "object"
      ? x.attributes.animation
      : undefined;

  const animationOk = animation == null || isPolylineAnimation(animation);

  return (
    typeof x === "object" &&
    x !== null &&
    typeof x.attributes === "object" &&
    x.attributes !== null &&
    animationOk &&
    typeof x.geometry === "object" &&
    x.geometry !== null &&
    x.geometry.type === "polyline" &&
    Array.isArray(x.geometry.paths) &&
    isSpatialReference(x.geometry.spatialReference) &&
    typeof x.symbol === "object" &&
    x.symbol !== null &&
    x.symbol.type === "simple-line" &&
    Array.isArray(x.symbol.color) &&
    typeof x.symbol.width === "number"
  );
}

function isPointDrawing(x: any): boolean {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof x.attributes === "object" &&
    x.attributes !== null &&
    typeof x.geometry === "object" &&
    x.geometry !== null &&
    x.geometry.type === "point" &&
    typeof x.geometry.x === "number" &&
    typeof x.geometry.y === "number" &&
    isSpatialReference(x.geometry.spatialReference) &&
    typeof x.symbol === "object" &&
    x.symbol !== null &&
    x.symbol.type === "simple-marker" &&
    Array.isArray(x.symbol.color) &&
    typeof x.symbol.size === "number" &&
    typeof x.symbol.outline === "object" &&
    x.symbol.outline !== null &&
    Array.isArray(x.symbol.outline.color) &&
    typeof x.symbol.outline.width === "number"
  );
}

function isDrawing(x: any): x is DrawingExport {
  return isPolygonDrawing(x) || isPolylineDrawing(x) || isPointDrawing(x);
}

function isLabel(x: any): x is Label {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof x.attributes === "object" &&
    x.attributes !== null &&
    typeof x.attributes.parentId === "string" &&
    typeof x.attributes.showAtZoom !== "undefined" &&
    typeof x.attributes.hideAtZoom !== "undefined" &&
    typeof x.attributes.fontSize === "number" &&
    Array.isArray(x.attributes.color) &&
    Array.isArray(x.attributes.haloColor) &&
    typeof x.attributes.haloSize === "number" &&
    typeof x.attributes.text === "string" &&
    typeof x.geometry === "object" &&
    x.geometry !== null &&
    typeof x.geometry.type === "string" &&
    typeof x.geometry.x === "number" &&
    typeof x.geometry.y === "number" &&
    isSpatialReference(x.geometry.spatialReference)
  );
}

function isEventPoint(x: any): x is EventPoint {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof x.attributes === "object" &&
    x.attributes !== null &&
    typeof x.attributes.id === "string" &&
    typeof x.attributes.event_name === "string" &&
    typeof x.geometry === "object" &&
    x.geometry !== null &&
    x.geometry.type === "point" &&
    typeof x.geometry.x === "number" &&
    typeof x.geometry.y === "number" &&
    isSpatialReference(x.geometry.spatialReference)
  );
}

function isFeatureLayerConfig(x: any): x is FeatureLayerConfig {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof x.url === "string" &&
    typeof x.index === "number" &&
    Array.isArray(x.outFields) &&
    x.outFields.every((f: any) => typeof f === "string") &&
    typeof x.popupEnabled === "boolean"
  );
}

function isSaveSettings(x: any): x is SaveSettings {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof x.zoom === "number" &&
    Array.isArray(x.center) &&
    x.center.length === 2 &&
    typeof x.center[0] === "number" &&
    typeof x.center[1] === "number" &&
    (x.constraints === null ||
      (typeof x.constraints === "object" &&
        x.constraints !== null &&
        typeof x.constraints.xmin === "number" &&
        typeof x.constraints.ymin === "number" &&
        typeof x.constraints.xmax === "number" &&
        typeof x.constraints.ymax === "number")) &&
    (x.featureLayers === null ||
      (Array.isArray(x.featureLayers) &&
        x.featureLayers.every(isFeatureLayerConfig))) &&
    (typeof x.mapTile === "undefined" ||
      x.mapTile === null ||
      typeof x.mapTile === "string") &&
    (typeof x.baseMap === "undefined" ||
      x.baseMap === null ||
      typeof x.baseMap === "string") &&
    (typeof x.apiSources === "undefined" ||
      (Array.isArray(x.apiSources) &&
        x.apiSources.every((s: any) => typeof s === "string")))
  );
}

function isMapSaveBody(x: any): x is MapSaveBody {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof x.userEmail === "string" &&
    Array.isArray(x.polygons) &&
    x.polygons.every(isDrawing) &&
    Array.isArray(x.labels) &&
    x.labels.every(isLabel) &&
    Array.isArray(x.events) &&
    x.events.every(isEventPoint) &&
    isSaveSettings(x.settings)
  );
}

interface PatchBody {
  isPrivate: boolean;
}

function isPatchBody(x: unknown): x is PatchBody {
  return (
    typeof x === "object" &&
    x !== null &&
    "isPrivate" in x &&
    typeof (x as any).isPrivate === "boolean"
  );
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;

  if (!rawId) {
    return NextResponse.json({ error: "Missing map ID" }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isPatchBody(rawBody)) {
    return NextResponse.json(
      { error: "`isPrivate` must be boolean" },
      { status: 400 },
    );
  }

  const { isPrivate } = rawBody;

  let session: Session | null;
  try {
    session = await auth();
  } catch {
    return NextResponse.json({ error: "Auth failure" }, { status: 500 });
  }

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;

  let mapObjectId: ObjectId;
  try {
    mapObjectId = new ObjectId(rawId);
  } catch {
    return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
  }

  const user: User | null = await findUserByEmail(email).catch(() => null);
  if (!user?._id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const mongo: MongoClient = await clientPromise;
  const db = mongo.db("campusmap");
  const maps = db.collection<MapDoc>("maps");

  const existing = await maps.findOne({ _id: mapObjectId });
  if (!existing) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }
  if (!existing.ownerId.equals(user._id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = (await maps.findOneAndUpdate(
    { _id: mapObjectId, ownerId: user._id },
    { $set: { isPrivate, updatedAt: new Date() } },
    { returnDocument: "after" },
  )) as WithId<MapDoc> | null;

  if (!result) {
    const post = await maps.findOne({ _id: mapObjectId });
    console.error(`[PATCH ${rawId}] result is null; post-check doc:`, post);
    return NextResponse.json(
      { error: "Map not found or not owned by you" },
      { status: 404 },
    );
  }

  return NextResponse.json(result, { status: 200 });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;

  if (!rawId) {
    return NextResponse.json({ error: "Missing map ID" }, { status: 400 });
  }

  let mapObjectId: ObjectId;
  try {
    mapObjectId = new ObjectId(rawId);
  } catch {
    return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;
  const user: User | null = await findUserByEmail(email).catch(() => null);

  if (!user?._id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const mongo: MongoClient = await clientPromise;
  const db = mongo.db("campusmap");
  const maps = db.collection<MapDoc>("maps");

  const existing = await maps.findOne({ _id: mapObjectId });
  if (!existing) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }
  if (!existing.ownerId.equals(user._id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await maps.deleteOne({ _id: mapObjectId });
  if (result.deletedCount !== 1) {
    return NextResponse.json({ error: "Deletion failed" }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;

  let mapObjectId: ObjectId;
  try {
    mapObjectId = new ObjectId(rawId);
  } catch {
    return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
  }

  const mongo: MongoClient = await clientPromise;
  const db = mongo.db("campusmap");
  const maps = db.collection<MapDoc>("maps");

  const map = await maps.findOne({ _id: mapObjectId });
  if (!map) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }

  if (map.isPrivate) {
    const session = await auth();
    const email = session?.user?.email;
    const user = email ? await findUserByEmail(email) : null;

    if (!user || !map.ownerId.equals(user._id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json(
    {
      polygons: map.polygons ?? [],
      labels: map.labels ?? [],
      events: map.events ?? [],
      settings: map.settings,
    },
    { status: 200 },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;

  if (!rawId) {
    return NextResponse.json({ error: "Missing map ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isMapSaveBody(body)) {
    return NextResponse.json(
      {
        error:
          "Request must include valid userEmail, polygons, labels, events, and settings",
      },
      { status: 400 },
    );
  }

  const { userEmail, polygons, labels, events, settings } = body;

  let mapObjectId: ObjectId;
  try {
    mapObjectId = new ObjectId(rawId);
  } catch {
    return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
  }

  const user: User | null = await findUserByEmail(userEmail);
  if (!user?._id) {
    return NextResponse.json(
      { error: `No user found for email "${userEmail}"` },
      { status: 404 },
    );
  }

  const mongo: MongoClient = await clientPromise;
  const db = mongo.db("campusmap");
  const maps = db.collection<MapDoc>("maps");

  const existing = await maps.findOne({ _id: mapObjectId });
  if (!existing) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }
  if (!existing.ownerId.equals(user._id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updateResult = await maps.updateOne(
    { _id: mapObjectId },
    {
      $set: {
        polygons,
        labels,
        events,
        settings,
        updatedAt: new Date(),
      },
    },
  );

  if (updateResult.matchedCount !== 1) {
    return NextResponse.json(
      { error: "Failed to update map" },
      { status: 500 },
    );
  }

  const updatedMap = await maps.findOne({ _id: mapObjectId });
  return NextResponse.json(updatedMap, { status: 200 });
}
// // /api/maps/[id]/route.ts
// import { ObjectId, MongoClient, Document, WithId } from "mongodb";
// import type { Session } from "next-auth";
// import { NextRequest, NextResponse } from "next/server";
// import { auth } from "@/lib/auth";
// import clientPromise from "@/lib/mongodb";
// import { findUserByEmail, User } from "@/lib/userModel";

// // ─────────── Shared Types ───────────
// export interface SpatialReference {
//   wkid: number;
//   latestWkid: number;
// }

// interface FieldInfo {
//   fieldName: string;
//   label: string;
//   visible: boolean;
//   format?: {
//     digitSeparator?: boolean;
//     places?: number;
//   };
// }

// interface FeatureLayerConfig {
//   url: string;
//   index: number;
//   outFields: string[];
//   popupEnabled: boolean;
//   popupTemplate?: {
//     title: string;
//     content: Array<{
//       type: string;
//       fieldInfos?: FieldInfo[];
//     }>;
//   };
// }

// interface PolygonDrawing {
//   attributes: Record<string, any>;
//   geometry: {
//     type: "polygon";
//     rings: number[][][];
//     spatialReference: SpatialReference;
//   };
//   symbol: {
//     type: "simple-fill";
//     color: number[];
//     outline: { color: number[]; width: number };
//   };
// }

// interface PolylineDrawing {
//   attributes: Record<string, any>;
//   geometry: {
//     type: "polyline";
//     paths: number[][][];
//     spatialReference: SpatialReference;
//   };
//   symbol: {
//     type: "simple-line";
//     color: number[];
//     width: number;
//   };
// }

// interface PointDrawing {
//   attributes: Record<string, any>;
//   geometry: {
//     type: "point";
//     x: number;
//     y: number;
//     spatialReference: SpatialReference;
//   };
//   symbol: {
//     type: "simple-marker";
//     color: number[];
//     size: number;
//     outline: { color: number[]; width: number };
//   };
// }

// type Drawing = PolygonDrawing | PolylineDrawing | PointDrawing;

// interface Label {
//   attributes: {
//     parentId: string;
//     showAtZoom: number | null;
//     hideAtZoom: number | null;
//     fontSize: number;
//     color: number[];
//     haloColor: number[];
//     haloSize: number;
//     text: string;
//   };
//   geometry: {
//     type: string;
//     x: number;
//     y: number;
//     spatialReference: SpatialReference;
//   };
// }

// interface EventPoint {
//   attributes: {
//     id: string;
//     event_name: string;
//     description?: string | null;
//     date?: string | null;
//     startAt?: string | null;
//     endAt?: string | null;
//     poster_url?: string | null;
//     locationTag?: string | null;
//     location?: string | null;
//     location_at?: string | null;
//     names?: string[] | null;
//     original?: any | null;
//     fromUser?: boolean;
//   };
//   geometry: {
//     type: "point";
//     x: number;
//     y: number;
//     spatialReference: SpatialReference;
//   };
// }

// export interface MapDoc extends Document {
//   _id: ObjectId;
//   ownerId: ObjectId;
//   title: string;
//   url: string;
//   description: string | null;
//   polygons: Drawing[];
//   labels?: Label[];
//   events?: EventPoint[];
//   settings?: {
//     zoom: number;
//     center: [number, number];
//     constraints: null | {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     };
//     featureLayers: FeatureLayerConfig[] | null;
//     mapTile: string | null;
//     baseMap: string | null;
//     apiSources: string[];
//   };
//   createdAt: Date;
//   updatedAt: Date;
//   isPrivate: boolean;
// }

// // ─────────── Request Body Types ───────────
// interface ExportBody {
//   userEmail: string;
//   polygons: Drawing[];
//   labels: Label[];
//   events: EventPoint[];
//   settings: {
//     zoom: number;
//     center: [number, number];
//     constraints: null | {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     };
//     featureLayers: FeatureLayerConfig[] | null;
//     mapTile: string | null;
//     baseMap: string | null;
//     apiSources: string[];
//   };
// }

// function isSpatialReference(x: any): x is SpatialReference {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.wkid === "number" &&
//     typeof x.latestWkid === "number"
//   );
// }

// function isPolygonDrawing(x: any): x is PolygonDrawing {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.attributes === "object" &&
//     x.attributes !== null &&
//     typeof x.geometry === "object" &&
//     x.geometry !== null &&
//     x.geometry.type === "polygon" &&
//     Array.isArray(x.geometry.rings) &&
//     isSpatialReference(x.geometry.spatialReference) &&
//     typeof x.symbol === "object" &&
//     x.symbol !== null &&
//     x.symbol.type === "simple-fill" &&
//     Array.isArray(x.symbol.color) &&
//     typeof x.symbol.outline === "object" &&
//     x.symbol.outline !== null &&
//     Array.isArray(x.symbol.outline.color) &&
//     typeof x.symbol.outline.width === "number"
//   );
// }

// function isPolylineDrawing(x: any): x is PolylineDrawing {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.attributes === "object" &&
//     x.attributes !== null &&
//     typeof x.geometry === "object" &&
//     x.geometry !== null &&
//     x.geometry.type === "polyline" &&
//     Array.isArray(x.geometry.paths) &&
//     isSpatialReference(x.geometry.spatialReference) &&
//     typeof x.symbol === "object" &&
//     x.symbol !== null &&
//     x.symbol.type === "simple-line" &&
//     Array.isArray(x.symbol.color) &&
//     typeof x.symbol.width === "number"
//   );
// }

// function isPointDrawing(x: any): x is PointDrawing {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.attributes === "object" &&
//     x.attributes !== null &&
//     typeof x.geometry === "object" &&
//     x.geometry !== null &&
//     x.geometry.type === "point" &&
//     typeof x.geometry.x === "number" &&
//     typeof x.geometry.y === "number" &&
//     isSpatialReference(x.geometry.spatialReference) &&
//     typeof x.symbol === "object" &&
//     x.symbol !== null &&
//     x.symbol.type === "simple-marker" &&
//     Array.isArray(x.symbol.color) &&
//     typeof x.symbol.size === "number" &&
//     typeof x.symbol.outline === "object" &&
//     x.symbol.outline !== null &&
//     Array.isArray(x.symbol.outline.color) &&
//     typeof x.symbol.outline.width === "number"
//   );
// }

// function isDrawing(x: any): x is Drawing {
//   return isPolygonDrawing(x) || isPolylineDrawing(x) || isPointDrawing(x);
// }

// function isLabel(x: any): x is Label {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.attributes === "object" &&
//     x.attributes !== null &&
//     typeof x.attributes.parentId === "string" &&
//     typeof x.attributes.showAtZoom !== "undefined" &&
//     typeof x.attributes.hideAtZoom !== "undefined" &&
//     typeof x.attributes.fontSize === "number" &&
//     Array.isArray(x.attributes.color) &&
//     Array.isArray(x.attributes.haloColor) &&
//     typeof x.attributes.haloSize === "number" &&
//     typeof x.attributes.text === "string" &&
//     typeof x.geometry === "object" &&
//     x.geometry !== null &&
//     typeof x.geometry.type === "string" &&
//     typeof x.geometry.x === "number" &&
//     typeof x.geometry.y === "number" &&
//     isSpatialReference(x.geometry.spatialReference)
//   );
// }

// function isEventPoint(x: any): x is EventPoint {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.attributes === "object" &&
//     x.attributes !== null &&
//     typeof x.attributes.id === "string" &&
//     typeof x.attributes.event_name === "string" &&
//     typeof x.geometry === "object" &&
//     x.geometry !== null &&
//     x.geometry.type === "point" &&
//     typeof x.geometry.x === "number" &&
//     typeof x.geometry.y === "number" &&
//     isSpatialReference(x.geometry.spatialReference)
//   );
// }

// function isFeatureLayerConfig(x: any): x is FeatureLayerConfig {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.url === "string" &&
//     typeof x.index === "number" &&
//     Array.isArray(x.outFields) &&
//     x.outFields.every((f: any) => typeof f === "string") &&
//     typeof x.popupEnabled === "boolean"
//   );
// }

// function isExportBody(x: any): x is ExportBody {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.userEmail === "string" &&
//     Array.isArray(x.polygons) &&
//     x.polygons.every(isDrawing) &&
//     Array.isArray(x.labels) &&
//     x.labels.every(isLabel) &&
//     Array.isArray(x.events) &&
//     x.events.every(isEventPoint) &&
//     typeof x.settings === "object" &&
//     x.settings !== null &&
//     typeof x.settings.zoom === "number" &&
//     Array.isArray(x.settings.center) &&
//     x.settings.center.length === 2 &&
//     typeof x.settings.center[0] === "number" &&
//     typeof x.settings.center[1] === "number" &&
//     (x.settings.constraints === null ||
//       (typeof x.settings.constraints === "object" &&
//         x.settings.constraints !== null &&
//         typeof x.settings.constraints.xmin === "number" &&
//         typeof x.settings.constraints.ymin === "number" &&
//         typeof x.settings.constraints.xmax === "number" &&
//         typeof x.settings.constraints.ymax === "number")) &&
//     (x.settings.featureLayers === null ||
//       (Array.isArray(x.settings.featureLayers) &&
//         x.settings.featureLayers.every(isFeatureLayerConfig))) &&
//     (x.settings.mapTile === null || typeof x.settings.mapTile === "string") &&
//     (x.settings.baseMap === null || typeof x.settings.baseMap === "string") &&
//     Array.isArray(x.settings.apiSources) &&
//     x.settings.apiSources.every((s: any) => typeof s === "string")
//   );
// }

// // ─────────── PATCH: Update isPrivate ───────────
// interface PatchBody {
//   isPrivate: boolean;
// }

// function isPatchBody(x: unknown): x is PatchBody {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     "isPrivate" in x &&
//     typeof (x as any).isPrivate === "boolean"
//   );
// }

// export async function PATCH(
//   request: NextRequest,
//   context: { params: Promise<{ id: string }> },
// ) {
//   const { id: rawId } = await context.params;

//   if (!rawId) {
//     return NextResponse.json({ error: "Missing map ID" }, { status: 400 });
//   }

//   let rawBody: unknown;
//   try {
//     rawBody = await request.json();
//   } catch {
//     return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
//   }

//   if (!isPatchBody(rawBody)) {
//     return NextResponse.json(
//       { error: "`isPrivate` must be boolean" },
//       { status: 400 },
//     );
//   }

//   const { isPrivate } = rawBody;

//   let session: Session | null;
//   try {
//     session = await auth();
//   } catch {
//     return NextResponse.json({ error: "Auth failure" }, { status: 500 });
//   }

//   if (!session?.user?.email) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   const email = session.user.email;

//   let mapObjectId: ObjectId;
//   try {
//     mapObjectId = new ObjectId(rawId);
//   } catch {
//     return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
//   }

//   const user: User | null = await findUserByEmail(email).catch(() => null);
//   if (!user?._id) {
//     return NextResponse.json({ error: "User not found" }, { status: 404 });
//   }

//   const mongo: MongoClient = await clientPromise;
//   const db = mongo.db("campusmap");
//   const maps = db.collection<MapDoc>("maps");

//   const existing = await maps.findOne({ _id: mapObjectId });
//   if (!existing) {
//     return NextResponse.json({ error: "Map not found" }, { status: 404 });
//   }
//   if (!existing.ownerId.equals(user._id)) {
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//   }

//   const result = (await maps.findOneAndUpdate(
//     { _id: mapObjectId, ownerId: user._id },
//     { $set: { isPrivate, updatedAt: new Date() } },
//     { returnDocument: "after" },
//   )) as WithId<MapDoc> | null;

//   if (!result) {
//     const post = await maps.findOne({ _id: mapObjectId });
//     console.error(`[PATCH ${rawId}] result is null; post-check doc:`, post);
//     return NextResponse.json(
//       { error: "Map not found or not owned by you" },
//       { status: 404 },
//     );
//   }

//   return NextResponse.json(result, { status: 200 });
// }

// // ─────────── DELETE ───────────
// export async function DELETE(
//   request: NextRequest,
//   context: { params: Promise<{ id: string }> },
// ) {
//   const { id: rawId } = await context.params;

//   if (!rawId) {
//     return NextResponse.json({ error: "Missing map ID" }, { status: 400 });
//   }

//   let mapObjectId: ObjectId;
//   try {
//     mapObjectId = new ObjectId(rawId);
//   } catch {
//     return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
//   }

//   const session = await auth();
//   if (!session?.user?.email) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   const email = session.user.email;
//   const user: User | null = await findUserByEmail(email).catch(() => null);

//   if (!user?._id) {
//     return NextResponse.json({ error: "User not found" }, { status: 404 });
//   }

//   const mongo: MongoClient = await clientPromise;
//   const db = mongo.db("campusmap");
//   const maps = db.collection<MapDoc>("maps");

//   const existing = await maps.findOne({ _id: mapObjectId });
//   if (!existing) {
//     return NextResponse.json({ error: "Map not found" }, { status: 404 });
//   }
//   if (!existing.ownerId.equals(user._id)) {
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//   }

//   const result = await maps.deleteOne({ _id: mapObjectId });
//   if (result.deletedCount !== 1) {
//     return NextResponse.json({ error: "Deletion failed" }, { status: 500 });
//   }

//   return new Response(null, { status: 204 });
// }

// // ─────────── GET ───────────
// export async function GET(
//   request: NextRequest,
//   context: { params: Promise<{ id: string }> },
// ) {
//   const { id: rawId } = await context.params;

//   let mapObjectId: ObjectId;
//   try {
//     mapObjectId = new ObjectId(rawId);
//   } catch {
//     return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
//   }

//   const mongo: MongoClient = await clientPromise;
//   const db = mongo.db("campusmap");
//   const maps = db.collection<MapDoc>("maps");

//   const map = await maps.findOne({ _id: mapObjectId });
//   if (!map) {
//     return NextResponse.json({ error: "Map not found" }, { status: 404 });
//   }

//   if (map.isPrivate) {
//     const session = await auth();
//     const email = session?.user?.email;
//     const user = email ? await findUserByEmail(email) : null;

//     if (!user || !map.ownerId.equals(user._id)) {
//       return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//     }
//   }

//   return NextResponse.json(
//     {
//       polygons: map.polygons ?? [],
//       labels: map.labels ?? [],
//       events: map.events ?? [],
//       settings: map.settings,
//     },
//     { status: 200 },
//   );
// }

// // ─────────── POST: overwrite drawings, labels, events, settings ───────────
// export async function POST(
//   request: NextRequest,
//   context: { params: Promise<{ id: string }> },
// ) {
//   const { id: rawId } = await context.params;

//   if (!rawId) {
//     return NextResponse.json({ error: "Missing map ID" }, { status: 400 });
//   }

//   let body: unknown;
//   try {
//     body = await request.json();
//   } catch {
//     return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
//   }

//   if (!isExportBody(body)) {
//     return NextResponse.json(
//       {
//         error:
//           "Request must include valid userEmail, polygons, labels, events, and settings",
//       },
//       { status: 400 },
//     );
//   }

//   const { userEmail, polygons, labels, events, settings } = body;

//   let mapObjectId: ObjectId;
//   try {
//     mapObjectId = new ObjectId(rawId);
//   } catch {
//     return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
//   }

//   const user: User | null = await findUserByEmail(userEmail);
//   if (!user?._id) {
//     return NextResponse.json(
//       { error: `No user found for email "${userEmail}"` },
//       { status: 404 },
//     );
//   }

//   const mongo: MongoClient = await clientPromise;
//   const db = mongo.db("campusmap");
//   const maps = db.collection<MapDoc>("maps");

//   const existing = await maps.findOne({ _id: mapObjectId });
//   if (!existing) {
//     return NextResponse.json({ error: "Map not found" }, { status: 404 });
//   }
//   if (!existing.ownerId.equals(user._id)) {
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//   }

//   const updateResult = await maps.updateOne(
//     { _id: mapObjectId },
//     {
//       $set: {
//         polygons,
//         labels,
//         events,
//         settings,
//         updatedAt: new Date(),
//       },
//     },
//   );

//   if (updateResult.matchedCount !== 1) {
//     return NextResponse.json(
//       { error: "Failed to update map" },
//       { status: 500 },
//     );
//   }

//   const updatedMap = await maps.findOne({ _id: mapObjectId });
//   return NextResponse.json(updatedMap, { status: 200 });
// }
// // /api/maps/[id]/route.ts
// import { ObjectId, MongoClient, Document, WithId } from "mongodb";
// import type { Session } from "next-auth";
// import { NextRequest, NextResponse } from "next/server";
// import { auth } from "@/lib/auth";
// import clientPromise from "@/lib/mongodb";
// import { findUserByEmail, User } from "@/lib/userModel";

// // ─────────── Shared Types ───────────
// export interface SpatialReference {
//   wkid: number;
//   latestWkid: number;
// }

// interface FieldInfo {
//   fieldName: string;
//   label: string;
//   visible: boolean;
//   format?: {
//     digitSeparator?: boolean;
//     places?: number;
//   };
// }

// interface FeatureLayerConfig {
//   url: string;
//   index: number;
//   outFields: string[];
//   popupEnabled: boolean;
//   popupTemplate?: {
//     title: string;
//     content: Array<{
//       type: string;
//       fieldInfos?: FieldInfo[];
//     }>;
//   };
// }

// interface PolygonDrawing {
//   attributes: Record<string, any>;
//   geometry: {
//     type: "polygon";
//     rings: number[][][];
//     spatialReference: SpatialReference;
//   };
//   symbol: {
//     type: "simple-fill";
//     color: number[];
//     outline: { color: number[]; width: number };
//   };
// }

// interface PolylineDrawing {
//   attributes: Record<string, any>;
//   geometry: {
//     type: "polyline";
//     paths: number[][][];
//     spatialReference: SpatialReference;
//   };
//   symbol: {
//     type: "simple-line";
//     color: number[];
//     width: number;
//   };
// }

// type Drawing = PolygonDrawing | PolylineDrawing;

// interface Label {
//   attributes: {
//     parentId: string;
//     showAtZoom: number | null;
//     hideAtZoom: number | null;
//     fontSize: number;
//     color: number[];
//     haloColor: number[];
//     haloSize: number;
//     text: string;
//   };
//   geometry: {
//     type: string;
//     x: number;
//     y: number;
//     spatialReference: SpatialReference;
//   };
// }

// interface EventPoint {
//   attributes: {
//     id: string;
//     event_name: string;
//     description?: string | null;
//     date?: string | null;
//     startAt?: string | null;
//     endAt?: string | null;
//     poster_url?: string | null;
//     locationTag?: string | null;
//     location?: string | null;
//     location_at?: string | null;
//     names?: string[] | null;
//     original?: any | null;
//     fromUser?: boolean;
//   };
//   geometry: {
//     type: "point";
//     x: number;
//     y: number;
//     spatialReference: SpatialReference;
//   };
// }

// export interface MapDoc extends Document {
//   _id: ObjectId;
//   ownerId: ObjectId;
//   title: string;
//   url: string;
//   description: string | null;
//   polygons: Drawing[];
//   labels?: Label[];
//   events?: EventPoint[];
//   settings?: {
//     zoom: number;
//     center: [number, number];
//     constraints: null | {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     };
//     featureLayers: FeatureLayerConfig[] | null;
//     mapTile: string | null;
//     baseMap: string | null;
//     apiSources: string[];
//   };
//   createdAt: Date;
//   updatedAt: Date;
//   isPrivate: boolean;
// }

// // ─────────── Request Body Types ───────────
// interface ExportBody {
//   userEmail: string;
//   polygons: Drawing[];
//   labels: Label[];
//   events: EventPoint[];
//   settings: {
//     zoom: number;
//     center: [number, number];
//     constraints: null | {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     };
//     featureLayers: FeatureLayerConfig[] | null;
//     mapTile: string | null;
//     baseMap: string | null;
//     apiSources: string[];
//   };
// }

// function isSpatialReference(x: any): x is SpatialReference {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.wkid === "number" &&
//     typeof x.latestWkid === "number"
//   );
// }

// function isPolygonDrawing(x: any): x is PolygonDrawing {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.attributes === "object" &&
//     x.attributes !== null &&
//     typeof x.geometry === "object" &&
//     x.geometry !== null &&
//     x.geometry.type === "polygon" &&
//     Array.isArray(x.geometry.rings) &&
//     isSpatialReference(x.geometry.spatialReference) &&
//     typeof x.symbol === "object" &&
//     x.symbol !== null &&
//     x.symbol.type === "simple-fill" &&
//     Array.isArray(x.symbol.color) &&
//     typeof x.symbol.outline === "object" &&
//     x.symbol.outline !== null &&
//     Array.isArray(x.symbol.outline.color) &&
//     typeof x.symbol.outline.width === "number"
//   );
// }

// function isPolylineDrawing(x: any): x is PolylineDrawing {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.attributes === "object" &&
//     x.attributes !== null &&
//     typeof x.geometry === "object" &&
//     x.geometry !== null &&
//     x.geometry.type === "polyline" &&
//     Array.isArray(x.geometry.paths) &&
//     isSpatialReference(x.geometry.spatialReference) &&
//     typeof x.symbol === "object" &&
//     x.symbol !== null &&
//     x.symbol.type === "simple-line" &&
//     Array.isArray(x.symbol.color) &&
//     typeof x.symbol.width === "number"
//   );
// }

// function isDrawing(x: any): x is Drawing {
//   return isPolygonDrawing(x) || isPolylineDrawing(x);
// }

// function isLabel(x: any): x is Label {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.attributes === "object" &&
//     x.attributes !== null &&
//     typeof x.attributes.parentId === "string" &&
//     typeof x.attributes.showAtZoom !== "undefined" &&
//     typeof x.attributes.hideAtZoom !== "undefined" &&
//     typeof x.attributes.fontSize === "number" &&
//     Array.isArray(x.attributes.color) &&
//     Array.isArray(x.attributes.haloColor) &&
//     typeof x.attributes.haloSize === "number" &&
//     typeof x.attributes.text === "string" &&
//     typeof x.geometry === "object" &&
//     x.geometry !== null &&
//     typeof x.geometry.type === "string" &&
//     typeof x.geometry.x === "number" &&
//     typeof x.geometry.y === "number" &&
//     isSpatialReference(x.geometry.spatialReference)
//   );
// }

// function isEventPoint(x: any): x is EventPoint {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.attributes === "object" &&
//     x.attributes !== null &&
//     typeof x.attributes.id === "string" &&
//     typeof x.attributes.event_name === "string" &&
//     typeof x.geometry === "object" &&
//     x.geometry !== null &&
//     x.geometry.type === "point" &&
//     typeof x.geometry.x === "number" &&
//     typeof x.geometry.y === "number" &&
//     isSpatialReference(x.geometry.spatialReference)
//   );
// }

// function isFeatureLayerConfig(x: any): x is FeatureLayerConfig {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.url === "string" &&
//     typeof x.index === "number" &&
//     Array.isArray(x.outFields) &&
//     x.outFields.every((f: any) => typeof f === "string") &&
//     typeof x.popupEnabled === "boolean"
//   );
// }

// function isExportBody(x: any): x is ExportBody {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.userEmail === "string" &&
//     Array.isArray(x.polygons) &&
//     x.polygons.every(isDrawing) &&
//     Array.isArray(x.labels) &&
//     x.labels.every(isLabel) &&
//     Array.isArray(x.events) &&
//     x.events.every(isEventPoint) &&
//     typeof x.settings === "object" &&
//     x.settings !== null &&
//     typeof x.settings.zoom === "number" &&
//     Array.isArray(x.settings.center) &&
//     x.settings.center.length === 2 &&
//     typeof x.settings.center[0] === "number" &&
//     typeof x.settings.center[1] === "number" &&
//     (x.settings.constraints === null ||
//       (typeof x.settings.constraints === "object" &&
//         x.settings.constraints !== null &&
//         typeof x.settings.constraints.xmin === "number" &&
//         typeof x.settings.constraints.ymin === "number" &&
//         typeof x.settings.constraints.xmax === "number" &&
//         typeof x.settings.constraints.ymax === "number")) &&
//     (x.settings.featureLayers === null ||
//       (Array.isArray(x.settings.featureLayers) &&
//         x.settings.featureLayers.every(isFeatureLayerConfig))) &&
//     (x.settings.mapTile === null || typeof x.settings.mapTile === "string") &&
//     (x.settings.baseMap === null || typeof x.settings.baseMap === "string") &&
//     Array.isArray(x.settings.apiSources) &&
//     x.settings.apiSources.every((s: any) => typeof s === "string")
//   );
// }

// // ─────────── PATCH: Update isPrivate ───────────
// interface PatchBody {
//   isPrivate: boolean;
// }

// function isPatchBody(x: unknown): x is PatchBody {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     "isPrivate" in x &&
//     typeof (x as any).isPrivate === "boolean"
//   );
// }

// export async function PATCH(
//   request: NextRequest,
//   context: { params: Promise<{ id: string }> },
// ) {
//   const { id: rawId } = await context.params;

//   if (!rawId) {
//     return NextResponse.json({ error: "Missing map ID" }, { status: 400 });
//   }

//   let rawBody: unknown;
//   try {
//     rawBody = await request.json();
//   } catch {
//     return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
//   }

//   if (!isPatchBody(rawBody)) {
//     return NextResponse.json(
//       { error: "`isPrivate` must be boolean" },
//       { status: 400 },
//     );
//   }

//   const { isPrivate } = rawBody;

//   let session: Session | null;
//   try {
//     session = await auth();
//   } catch {
//     return NextResponse.json({ error: "Auth failure" }, { status: 500 });
//   }

//   if (!session?.user?.email) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   const email = session.user.email;

//   let mapObjectId: ObjectId;
//   try {
//     mapObjectId = new ObjectId(rawId);
//   } catch {
//     return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
//   }

//   const user: User | null = await findUserByEmail(email).catch(() => null);
//   if (!user?._id) {
//     return NextResponse.json({ error: "User not found" }, { status: 404 });
//   }

//   const mongo: MongoClient = await clientPromise;
//   const db = mongo.db("campusmap");
//   const maps = db.collection<MapDoc>("maps");

//   const existing = await maps.findOne({ _id: mapObjectId });
//   if (!existing) {
//     return NextResponse.json({ error: "Map not found" }, { status: 404 });
//   }
//   if (!existing.ownerId.equals(user._id)) {
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//   }

//   const result = (await maps.findOneAndUpdate(
//     { _id: mapObjectId, ownerId: user._id },
//     { $set: { isPrivate, updatedAt: new Date() } },
//     { returnDocument: "after" },
//   )) as WithId<MapDoc> | null;

//   if (!result) {
//     const post = await maps.findOne({ _id: mapObjectId });
//     console.error(`[PATCH ${rawId}] result is null; post-check doc:`, post);
//     return NextResponse.json(
//       { error: "Map not found or not owned by you" },
//       { status: 404 },
//     );
//   }

//   return NextResponse.json(result, { status: 200 });
// }

// // ─────────── DELETE ───────────
// export async function DELETE(
//   request: NextRequest,
//   context: { params: Promise<{ id: string }> },
// ) {
//   const { id: rawId } = await context.params;

//   if (!rawId) {
//     return NextResponse.json({ error: "Missing map ID" }, { status: 400 });
//   }

//   let mapObjectId: ObjectId;
//   try {
//     mapObjectId = new ObjectId(rawId);
//   } catch {
//     return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
//   }

//   const session = await auth();
//   if (!session?.user?.email) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   const email = session.user.email;
//   const user: User | null = await findUserByEmail(email).catch(() => null);

//   if (!user?._id) {
//     return NextResponse.json({ error: "User not found" }, { status: 404 });
//   }

//   const mongo: MongoClient = await clientPromise;
//   const db = mongo.db("campusmap");
//   const maps = db.collection<MapDoc>("maps");

//   const existing = await maps.findOne({ _id: mapObjectId });
//   if (!existing) {
//     return NextResponse.json({ error: "Map not found" }, { status: 404 });
//   }
//   if (!existing.ownerId.equals(user._id)) {
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//   }

//   const result = await maps.deleteOne({ _id: mapObjectId });
//   if (result.deletedCount !== 1) {
//     return NextResponse.json({ error: "Deletion failed" }, { status: 500 });
//   }

//   return new Response(null, { status: 204 });
// }

// // ─────────── GET ───────────
// export async function GET(
//   request: NextRequest,
//   context: { params: Promise<{ id: string }> },
// ) {
//   const { id: rawId } = await context.params;

//   let mapObjectId: ObjectId;
//   try {
//     mapObjectId = new ObjectId(rawId);
//   } catch {
//     return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
//   }

//   const mongo: MongoClient = await clientPromise;
//   const db = mongo.db("campusmap");
//   const maps = db.collection<MapDoc>("maps");

//   const map = await maps.findOne({ _id: mapObjectId });
//   if (!map) {
//     return NextResponse.json({ error: "Map not found" }, { status: 404 });
//   }

//   if (map.isPrivate) {
//     const session = await auth();
//     const email = session?.user?.email;
//     const user = email ? await findUserByEmail(email) : null;

//     if (!user || !map.ownerId.equals(user._id)) {
//       return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//     }
//   }

//   return NextResponse.json(
//     {
//       polygons: map.polygons ?? [],
//       labels: map.labels ?? [],
//       events: map.events ?? [],
//       settings: map.settings,
//     },
//     { status: 200 },
//   );
// }

// // ─────────── POST: overwrite drawings, labels, events, settings ───────────
// export async function POST(
//   request: NextRequest,
//   context: { params: Promise<{ id: string }> },
// ) {
//   const { id: rawId } = await context.params;

//   if (!rawId) {
//     return NextResponse.json({ error: "Missing map ID" }, { status: 400 });
//   }

//   let body: unknown;
//   try {
//     body = await request.json();
//   } catch {
//     return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
//   }

//   if (!isExportBody(body)) {
//     return NextResponse.json(
//       {
//         error:
//           "Request must include valid userEmail, polygons, labels, events, and settings",
//       },
//       { status: 400 },
//     );
//   }

//   const { userEmail, polygons, labels, events, settings } = body;

//   let mapObjectId: ObjectId;
//   try {
//     mapObjectId = new ObjectId(rawId);
//   } catch {
//     return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
//   }

//   const user: User | null = await findUserByEmail(userEmail);
//   if (!user?._id) {
//     return NextResponse.json(
//       { error: `No user found for email "${userEmail}"` },
//       { status: 404 },
//     );
//   }

//   const mongo: MongoClient = await clientPromise;
//   const db = mongo.db("campusmap");
//   const maps = db.collection<MapDoc>("maps");

//   const existing = await maps.findOne({ _id: mapObjectId });
//   if (!existing) {
//     return NextResponse.json({ error: "Map not found" }, { status: 404 });
//   }
//   if (!existing.ownerId.equals(user._id)) {
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//   }

//   const updateResult = await maps.updateOne(
//     { _id: mapObjectId },
//     {
//       $set: {
//         polygons,
//         labels,
//         events,
//         settings,
//         updatedAt: new Date(),
//       },
//     },
//   );

//   if (updateResult.matchedCount !== 1) {
//     return NextResponse.json(
//       { error: "Failed to update map" },
//       { status: 500 },
//     );
//   }

//   const updatedMap = await maps.findOne({ _id: mapObjectId });
//   return NextResponse.json(updatedMap, { status: 200 });
// }
// // /api/maps/[id]/route.ts
// import { ObjectId, MongoClient, Document, WithId } from "mongodb";
// import type { Session } from "next-auth";
// import { NextRequest, NextResponse } from "next/server";
// import { auth } from "@/lib/auth";
// import clientPromise from "@/lib/mongodb";
// import { findUserByEmail, User } from "@/lib/userModel";

// // ─────────── Shared Types ───────────
// export interface SpatialReference {
//   wkid: number;
//   latestWkid: number;
// }

// export interface MapDoc extends Document {
//   _id: ObjectId;
//   ownerId: ObjectId;
//   title: string;
//   url: string;
//   description: string | null;
//   polygons: unknown[];
//   labels?: unknown[];
//   events?: unknown[]; // ⬅️ NEW
//   settings?: {
//     zoom: number;
//     center: [number, number];
//     constraints: null | {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     };
//     mapTile: string;
//     baseMap: string;
//     apiSources: string[];
//   };
//   createdAt: Date;
//   updatedAt: Date;
//   isPrivate: boolean;
// }

// // ─────────── Request Body Types ───────────
// interface Polygon {
//   attributes: Record<string, any>;
//   geometry: {
//     type: string;
//     rings: number[][][];
//     spatialReference: SpatialReference;
//   };
//   symbol: {
//     type: string;
//     color: number[];
//     outline: { color: number[]; width: number };
//   };
// }

// interface Label {
//   attributes: {
//     parentId: string;
//     showAtZoom: number | null;
//     hideAtZoom: number | null;
//     fontSize: number;
//     color: number[];
//     haloColor: number[];
//     haloSize: number;
//     text: string;
//   };
//   geometry: {
//     type: string;
//     x: number;
//     y: number;
//     spatialReference: SpatialReference;
//   };
// }

// // ⬅️ NEW: Event point (mirrors how we export)
// interface EventPoint {
//   attributes: {
//     id: string;
//     event_name: string;
//     description?: string | null;
//     date?: string | null;
//     startAt?: string | null;
//     endAt?: string | null;
//     locationTag?: string | null;
//     names?: string[] | null;
//     original?: any | null;
//     fromUser?: boolean;
//   };
//   geometry: {
//     type: "point";
//     x: number;
//     y: number;
//     spatialReference: SpatialReference;
//   };
// }

// interface ExportBody {
//   userEmail: string;
//   polygons: Polygon[];
//   labels: Label[];
//   events: EventPoint[]; // ⬅️ NEW
//   settings: {
//     zoom: number;
//     center: [number, number];
//     constraints: null | {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     };
//     mapTile: string;
//     baseMap: string;
//     apiSources: string[];
//   };
// }

// function isExportBody(x: any): x is ExportBody {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.userEmail === "string" &&
//     Array.isArray(x.polygons) &&
//     Array.isArray(x.labels) &&
//     Array.isArray(x.events) && // ⬅️ NEW
//     typeof x.settings === "object" &&
//     typeof x.settings.zoom === "number" &&
//     Array.isArray(x.settings.center) &&
//     x.settings.center.length === 2 &&
//     typeof x.settings.center[0] === "number" &&
//     typeof x.settings.center[1] === "number" &&
//     (x.settings.constraints === null ||
//       (typeof x.settings.constraints === "object" &&
//         typeof x.settings.constraints.xmin === "number" &&
//         typeof x.settings.constraints.ymin === "number" &&
//         typeof x.settings.constraints.xmax === "number" &&
//         typeof x.settings.constraints.ymax === "number"))
//   );
// }

// // ─────────── PATCH: Update isPrivate ───────────
// interface PatchBody {
//   isPrivate: boolean;
// }
// function isPatchBody(x: unknown): x is PatchBody {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     "isPrivate" in x &&
//     typeof (x as any).isPrivate === "boolean"
//   );
// }

// export async function PATCH(
//   request: NextRequest,
//   context: { params: Promise<{ id: string }> }
// ) {
//   const t0 = Date.now();
//   const { id: rawId } = await context.params;
//   if (!rawId)
//     return NextResponse.json({ error: "Missing map ID" }, { status: 400 });

//   let rawBody: unknown;
//   try {
//     rawBody = await request.json();
//   } catch {
//     return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
//   }

//   if (!isPatchBody(rawBody)) {
//     return NextResponse.json(
//       { error: "`isPrivate` must be boolean" },
//       { status: 400 }
//     );
//   }
//   const { isPrivate } = rawBody;

//   let session: Session | null;
//   try {
//     session = await auth();
//   } catch {
//     return NextResponse.json({ error: "Auth failure" }, { status: 500 });
//   }

//   if (!session?.user?.email)
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   const email = session.user.email;

//   let mapObjectId: ObjectId;
//   try {
//     mapObjectId = new ObjectId(rawId);
//   } catch {
//     return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
//   }

//   const user: User | null = await findUserByEmail(email).catch(() => null);
//   if (!user?._id)
//     return NextResponse.json({ error: "User not found" }, { status: 404 });

//   const mongo: MongoClient = await clientPromise;
//   const db = mongo.db("campusmap");
//   const maps = db.collection<MapDoc>("maps");

//   const existing = await maps.findOne({ _id: mapObjectId });
//   if (!existing)
//     return NextResponse.json({ error: "Map not found" }, { status: 404 });
//   if (!existing.ownerId.equals(user._id))
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });

//   const result = (await maps.findOneAndUpdate(
//     { _id: mapObjectId, ownerId: user._id },
//     { $set: { isPrivate, updatedAt: new Date() } },
//     { returnDocument: "after" }
//   )) as WithId<MapDoc> | null;

//   if (!result) {
//     const post = await maps.findOne({ _id: mapObjectId });
//     console.error(`[PATCH ${rawId}] result is null; post-check doc:`, post);
//     return NextResponse.json(
//       { error: "Map not found or not owned by you" },
//       { status: 404 }
//     );
//   }

//   return NextResponse.json(result, { status: 200 });
// }

// // ─────────── DELETE ───────────
// export async function DELETE(
//   request: NextRequest,
//   context: { params: Promise<{ id: string }> }
// ) {
//   const { id: rawId } = await context.params;
//   if (!rawId)
//     return NextResponse.json({ error: "Missing map ID" }, { status: 400 });

//   let mapObjectId: ObjectId;
//   try {
//     mapObjectId = new ObjectId(rawId);
//   } catch {
//     return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
//   }

//   const session = await auth();
//   if (!session?.user?.email)
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

//   const email = session.user.email;
//   const user: User | null = await findUserByEmail(email).catch(() => null);
//   if (!user?._id)
//     return NextResponse.json({ error: "User not found" }, { status: 404 });

//   const mongo: MongoClient = await clientPromise;
//   const db = mongo.db("campusmap");
//   const maps = db.collection<MapDoc>("maps");

//   const existing = await maps.findOne({ _id: mapObjectId });
//   if (!existing)
//     return NextResponse.json({ error: "Map not found" }, { status: 404 });
//   if (!existing.ownerId.equals(user._id))
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });

//   const result = await maps.deleteOne({ _id: mapObjectId });
//   if (result.deletedCount !== 1)
//     return NextResponse.json({ error: "Deletion failed" }, { status: 500 });

//   return new Response(null, { status: 204 });
// }

// // ─────────── GET: now returns events too ───────────
// export async function GET(
//   request: NextRequest,
//   context: { params: Promise<{ id: string }> }
// ) {
//   const { id: rawId } = await context.params;
//   let mapObjectId: ObjectId;
//   try {
//     mapObjectId = new ObjectId(rawId);
//   } catch {
//     return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
//   }

//   const mongo: MongoClient = await clientPromise;
//   const db = mongo.db("campusmap");
//   const maps = db.collection<MapDoc>("maps");

//   const map = await maps.findOne({ _id: mapObjectId });
//   if (!map)
//     return NextResponse.json({ error: "Map not found" }, { status: 404 });

//   if (map.isPrivate) {
//     const session = await auth();
//     const email = session?.user?.email;
//     const user = email ? await findUserByEmail(email) : null;
//     if (!user || !map.ownerId.equals(user._id)) {
//       return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//     }
//   }

//   return NextResponse.json(
//     {
//       polygons: map.polygons,
//       labels: map.labels ?? [],
//       events: map.events ?? [], // ⬅️ NEW
//       settings: map.settings,
//     },
//     { status: 200 }
//   );
// }

// // ─────────── POST: overwrite polygons, labels, events, settings ───────────
// export async function POST(
//   request: NextRequest,
//   context: { params: Promise<{ id: string }> }
// ) {
//   const { id: rawId } = await context.params;
//   if (!rawId)
//     return NextResponse.json({ error: "Missing map ID" }, { status: 400 });

//   let body: unknown;
//   try {
//     body = await request.json();
//   } catch {
//     return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
//   }

//   if (!isExportBody(body)) {
//     return NextResponse.json(
//       {
//         error:
//           "Request must include userEmail, polygons, labels, events, settings",
//       },
//       { status: 400 }
//     );
//   }
//   const { userEmail, polygons, labels, events, settings } = body;

//   let mapObjectId: ObjectId;
//   try {
//     mapObjectId = new ObjectId(rawId);
//   } catch {
//     return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
//   }

//   const user: User | null = await findUserByEmail(userEmail);
//   if (!user?._id) {
//     return NextResponse.json(
//       { error: `No user found for email "${userEmail}"` },
//       { status: 404 }
//     );
//   }

//   const mongo: MongoClient = await clientPromise;
//   const db = mongo.db("campusmap");
//   const maps = db.collection<MapDoc>("maps");

//   const existing = await maps.findOne({ _id: mapObjectId });
//   if (!existing)
//     return NextResponse.json({ error: "Map not found" }, { status: 404 });
//   if (!existing.ownerId.equals(user._id))
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });

//   const updateResult = await maps.updateOne(
//     { _id: mapObjectId },
//     { $set: { polygons, labels, events, settings, updatedAt: new Date() } } // ⬅️ NEW
//   );
//   if (updateResult.matchedCount !== 1) {
//     return NextResponse.json(
//       { error: "Failed to update map" },
//       { status: 500 }
//     );
//   }

//   const updatedMap = await maps.findOne({ _id: mapObjectId });
//   return NextResponse.json(updatedMap, { status: 200 });
// }
