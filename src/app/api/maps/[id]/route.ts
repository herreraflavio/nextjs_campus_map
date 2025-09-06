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
//   settings?: {
//     zoom: number;
//     center: [number, number];
//     constraints: null | {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     };
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

// interface ExportBody {
//   userEmail: string;
//   polygons: Polygon[];
//   labels: Label[];
//   settings: {
//     zoom: number;
//     center: [number, number];
//     constraints: null | {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     };
//   };
// }

// function isExportBody(x: any): x is ExportBody {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.userEmail === "string" &&
//     Array.isArray(x.polygons) &&
//     Array.isArray(x.labels) &&
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

//   // 8️⃣  Update   (type: WithId<MapDoc> | null)
//   const result = (await maps.findOneAndUpdate(
//     { _id: mapObjectId, ownerId: user._id },
//     { $set: { isPrivate, updatedAt: new Date() } },
//     { returnDocument: "after" }
//   )) as WithId<MapDoc> | null; // explicit for clarity

//   console.log(`[PATCH ${rawId}] 📦 raw result:`, result);

//   if (!result) {
//     // Should be impossible after the pre-check, but guard anyway
//     const post = await maps.findOne({ _id: mapObjectId });
//     console.error(`[PATCH ${rawId}] 🚫 result is null; post-check doc:`, post);
//     return NextResponse.json(
//       { error: "Map not found or not owned by you" },
//       { status: 404 }
//     );
//   }

//   // ✅ Success
//   console.log(`[PATCH ${rawId}] ✅ updated in ${Date.now() - t0} ms`, result);
//   return NextResponse.json(result, { status: 200 });
// }
// // ─────────── DELETE: Remove a map ───────────
// export async function DELETE(
//   request: NextRequest,
//   context: { params: Promise<{ id: string }> }
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

// // ─────────── GET: Retrieve polygons, labels, settings ───────────
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
//       polygons: map.polygons,
//       labels: map.labels ?? [],

//       settings: map.settings,
//     },
//     { status: 200 }
//   );
// }

// // ─────────── POST: Overwrite polygons, labels, settings ───────────
// export async function POST(
//   request: NextRequest,
//   context: { params: Promise<{ id: string }> }
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
//       { error: "Request must include userEmail, polygons, labels, settings" },
//       { status: 400 }
//     );
//   }
//   const { userEmail, polygons, labels, settings } = body;

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
//   if (!existing) {
//     return NextResponse.json({ error: "Map not found" }, { status: 404 });
//   }
//   if (!existing.ownerId.equals(user._id)) {
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//   }

//   const updateResult = await maps.updateOne(
//     { _id: mapObjectId },
//     { $set: { polygons, labels, settings, updatedAt: new Date() } }
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

// /api/maps/[id]/route.ts
import { ObjectId, MongoClient, Document, WithId } from "mongodb";
import type { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { findUserByEmail, User } from "@/lib/userModel";

// ─────────── Shared Types ───────────
export interface SpatialReference {
  wkid: number;
  latestWkid: number;
}

export interface MapDoc extends Document {
  _id: ObjectId;
  ownerId: ObjectId;
  title: string;
  url: string;
  description: string | null;
  polygons: unknown[];
  labels?: unknown[];
  events?: unknown[]; // ⬅️ NEW
  settings?: {
    zoom: number;
    center: [number, number];
    constraints: null | {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
  isPrivate: boolean;
}

// ─────────── Request Body Types ───────────
interface Polygon {
  attributes: Record<string, any>;
  geometry: {
    type: string;
    rings: number[][][];
    spatialReference: SpatialReference;
  };
  symbol: {
    type: string;
    color: number[];
    outline: { color: number[]; width: number };
  };
}

interface Label {
  attributes: {
    parentId: string;
    showAtZoom: number | null;
    hideAtZoom: number | null;
    fontSize: number;
    color: number[];
    haloColor: number[];
    haloSize: number;
    text: string;
  };
  geometry: {
    type: string;
    x: number;
    y: number;
    spatialReference: SpatialReference;
  };
}

// ⬅️ NEW: Event point (mirrors how we export)
interface EventPoint {
  attributes: {
    id: string;
    event_name: string;
    description?: string | null;
    date?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    locationTag?: string | null;
    names?: string[] | null;
    original?: any | null;
  };
  geometry: {
    type: "point";
    x: number;
    y: number;
    spatialReference: SpatialReference;
  };
}

interface ExportBody {
  userEmail: string;
  polygons: Polygon[];
  labels: Label[];
  events: EventPoint[]; // ⬅️ NEW
  settings: {
    zoom: number;
    center: [number, number];
    constraints: null | {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    };
  };
}

function isExportBody(x: any): x is ExportBody {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof x.userEmail === "string" &&
    Array.isArray(x.polygons) &&
    Array.isArray(x.labels) &&
    Array.isArray(x.events) && // ⬅️ NEW
    typeof x.settings === "object" &&
    typeof x.settings.zoom === "number" &&
    Array.isArray(x.settings.center) &&
    x.settings.center.length === 2 &&
    typeof x.settings.center[0] === "number" &&
    typeof x.settings.center[1] === "number" &&
    (x.settings.constraints === null ||
      (typeof x.settings.constraints === "object" &&
        typeof x.settings.constraints.xmin === "number" &&
        typeof x.settings.constraints.ymin === "number" &&
        typeof x.settings.constraints.xmax === "number" &&
        typeof x.settings.constraints.ymax === "number"))
  );
}

// ─────────── PATCH: Update isPrivate ───────────
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
  context: { params: Promise<{ id: string }> }
) {
  const t0 = Date.now();
  const { id: rawId } = await context.params;
  if (!rawId)
    return NextResponse.json({ error: "Missing map ID" }, { status: 400 });

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isPatchBody(rawBody)) {
    return NextResponse.json(
      { error: "`isPrivate` must be boolean" },
      { status: 400 }
    );
  }
  const { isPrivate } = rawBody;

  let session: Session | null;
  try {
    session = await auth();
  } catch {
    return NextResponse.json({ error: "Auth failure" }, { status: 500 });
  }

  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const email = session.user.email;

  let mapObjectId: ObjectId;
  try {
    mapObjectId = new ObjectId(rawId);
  } catch {
    return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
  }

  const user: User | null = await findUserByEmail(email).catch(() => null);
  if (!user?._id)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const mongo: MongoClient = await clientPromise;
  const db = mongo.db("campusmap");
  const maps = db.collection<MapDoc>("maps");

  const existing = await maps.findOne({ _id: mapObjectId });
  if (!existing)
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  if (!existing.ownerId.equals(user._id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = (await maps.findOneAndUpdate(
    { _id: mapObjectId, ownerId: user._id },
    { $set: { isPrivate, updatedAt: new Date() } },
    { returnDocument: "after" }
  )) as WithId<MapDoc> | null;

  if (!result) {
    const post = await maps.findOne({ _id: mapObjectId });
    console.error(`[PATCH ${rawId}] result is null; post-check doc:`, post);
    return NextResponse.json(
      { error: "Map not found or not owned by you" },
      { status: 404 }
    );
  }

  return NextResponse.json(result, { status: 200 });
}

// ─────────── DELETE ───────────
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await context.params;
  if (!rawId)
    return NextResponse.json({ error: "Missing map ID" }, { status: 400 });

  let mapObjectId: ObjectId;
  try {
    mapObjectId = new ObjectId(rawId);
  } catch {
    return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = session.user.email;
  const user: User | null = await findUserByEmail(email).catch(() => null);
  if (!user?._id)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const mongo: MongoClient = await clientPromise;
  const db = mongo.db("campusmap");
  const maps = db.collection<MapDoc>("maps");

  const existing = await maps.findOne({ _id: mapObjectId });
  if (!existing)
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  if (!existing.ownerId.equals(user._id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await maps.deleteOne({ _id: mapObjectId });
  if (result.deletedCount !== 1)
    return NextResponse.json({ error: "Deletion failed" }, { status: 500 });

  return new Response(null, { status: 204 });
}

// ─────────── GET: now returns events too ───────────
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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
  if (!map)
    return NextResponse.json({ error: "Map not found" }, { status: 404 });

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
      polygons: map.polygons,
      labels: map.labels ?? [],
      events: map.events ?? [], // ⬅️ NEW
      settings: map.settings,
    },
    { status: 200 }
  );
}

// ─────────── POST: overwrite polygons, labels, events, settings ───────────
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await context.params;
  if (!rawId)
    return NextResponse.json({ error: "Missing map ID" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isExportBody(body)) {
    return NextResponse.json(
      {
        error:
          "Request must include userEmail, polygons, labels, events, settings",
      },
      { status: 400 }
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
      { status: 404 }
    );
  }

  const mongo: MongoClient = await clientPromise;
  const db = mongo.db("campusmap");
  const maps = db.collection<MapDoc>("maps");

  const existing = await maps.findOne({ _id: mapObjectId });
  if (!existing)
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  if (!existing.ownerId.equals(user._id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updateResult = await maps.updateOne(
    { _id: mapObjectId },
    { $set: { polygons, labels, events, settings, updatedAt: new Date() } } // ⬅️ NEW
  );
  if (updateResult.matchedCount !== 1) {
    return NextResponse.json(
      { error: "Failed to update map" },
      { status: 500 }
    );
  }

  const updatedMap = await maps.findOne({ _id: mapObjectId });
  return NextResponse.json(updatedMap, { status: 200 });
}
