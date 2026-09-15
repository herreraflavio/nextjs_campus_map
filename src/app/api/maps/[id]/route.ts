//src/app/api/maps/[id]/route.ts
import { ObjectId, MongoClient, Document, WithId } from "mongodb";
import type { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMongoClient } from "@/lib/mongodb";
import { findUserByEmail, User } from "@/lib/userModel";
import type {
  DrawingExport,
  EventPoint,
  FeatureLayerConfig,
  HiddenSegmentRange,
  Label,
  MapCategory,
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
  categories?: MapCategory[];
  settings?: SaveSettings;
  createdAt: Date;
  updatedAt: Date;
  isPrivate: boolean;
}

function ownsMap(ownerId: any, userId: any): boolean {
  if (!ownerId || !userId) return false;
  if (typeof ownerId.equals === "function") return ownerId.equals(userId);
  return String(ownerId) === String(userId);
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

function isMapCategory(x: any): x is MapCategory {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof x.id === "string" &&
    x.id.trim().length > 0 &&
    x.id !== "home" &&
    typeof x.name === "string" &&
    x.name.trim().length > 0 &&
    (x.parentId === null || typeof x.parentId === "string") &&
    (typeof x.iconUrl === "undefined" ||
      x.iconUrl === null ||
      typeof x.iconUrl === "string") &&
    (typeof x.adminVisible === "undefined" ||
      typeof x.adminVisible === "boolean") &&
    typeof x.order === "number" &&
    Number.isFinite(x.order)
  );
}

function normalizeMapCategoriesForStorage(categories: MapCategory[]): MapCategory[] {
  const seen = new Set<string>();
  const cleaned: MapCategory[] = [];

  categories.forEach((category, index) => {
    const id = category.id.trim();
    const name = category.name.trim();

    if (!id || id === "home" || !name || seen.has(id)) return;

    seen.add(id);
    const normalized: MapCategory = {
      id,
      name,
      parentId:
        category.parentId && category.parentId !== "home"
          ? category.parentId
          : null,
      iconUrl:
        typeof category.iconUrl === "string" && category.iconUrl.trim()
          ? category.iconUrl.trim()
          : null,
      order: Number.isFinite(category.order) ? category.order : index,
    };

    if (typeof category.adminVisible === "boolean") {
      normalized.adminVisible = category.adminVisible;
    }

    cleaned.push(normalized);
  });

  const byId = new Map(cleaned.map((category) => [category.id, category]));

  return cleaned.map((category) => {
    if (
      !category.parentId ||
      category.parentId === category.id ||
      !byId.has(category.parentId)
    ) {
      return { ...category, parentId: null };
    }

    let current: string | null = category.parentId;
    const ancestors = new Set<string>([category.id]);

    while (current) {
      if (ancestors.has(current)) {
        return { ...category, parentId: null };
      }
      ancestors.add(current);
      current = byId.get(current)?.parentId ?? null;
    }

    return category;
  });
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
    (typeof x.categories === "undefined" ||
      (Array.isArray(x.categories) && x.categories.every(isMapCategory))) &&
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

  const mongo: MongoClient = await getMongoClient();
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

  const mongo: MongoClient = await getMongoClient();
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
  try {
    const { id: rawId } = await context.params;

    let mapObjectId: ObjectId;
    try {
      mapObjectId = new ObjectId(rawId);
    } catch {
      return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
    }

    const mongo: MongoClient = await getMongoClient();
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

      if (!user || !ownsMap(map.ownerId, user._id)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(
      {
        polygons: map.polygons ?? [],
        labels: map.labels ?? [],
        events: map.events ?? [],
        categories: map.categories ?? [],
        settings: map.settings,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[api/maps/[id]] Failed to load map data.", error);
    return NextResponse.json(
      { error: "Failed to load map data" },
      { status: 500 },
    );
  }
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
          "Request must include valid userEmail, polygons, labels, events, categories, and settings",
      },
      { status: 400 },
    );
  }

  // Keep userEmail in the request shape for backward compatibility, but never
  // trust client-supplied identity for authorization.
  const { polygons, labels, events, settings } = body;
  const categories = Array.isArray((body as MapSaveBody).categories)
    ? normalizeMapCategoriesForStorage((body as MapSaveBody).categories)
    : [];

  let session: Session | null;
  try {
    session = await auth();
  } catch {
    return NextResponse.json({ error: "Auth failure" }, { status: 500 });
  }

  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const mongo: MongoClient = await getMongoClient();
  const db = mongo.db("campusmap");
  const maps = db.collection<MapDoc>("maps");

  const existing = await maps.findOne({ _id: mapObjectId });
  if (!existing) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }

  if (!ownsMap(existing.ownerId, user._id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updateResult = await maps.updateOne(
    { _id: mapObjectId, ownerId: user._id },
    {
      $set: {
        polygons,
        labels,
        events,
        categories,
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
