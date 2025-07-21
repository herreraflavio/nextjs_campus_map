import { ObjectId, MongoClient, Document, WithId } from "mongodb";
import type { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { findUserByEmail, User } from "@/lib/userModel";

// ─────────── Schema ───────────
// ─────────── Schema ───────────
export interface MapDoc extends Document {
  _id: ObjectId;
  ownerId: ObjectId;
  title: string;
  url: string;
  description: string | null;
  polygons: unknown[];
  labels?: unknown[];
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

// ───────── Body guard ─────────
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

// ───────── Handler ─────────
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const t0 = Date.now();

  // 1️⃣  Route param
  const { id: rawId } = await context.params;
  if (!rawId) {
    return NextResponse.json({ error: "Missing map ID" }, { status: 400 });
  }

  // 2️⃣  Body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (err) {
    console.error(`[PATCH ${rawId}] 🚫 JSON parse error:`, err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isPatchBody(rawBody)) {
    return NextResponse.json(
      { error: "`isPrivate` must be boolean" },
      { status: 400 }
    );
  }
  const { isPrivate } = rawBody;
  console.log(`[PATCH ${rawId}] 🔧 requested isPrivate =`, isPrivate);

  // 3️⃣  Auth
  let session: Session | null;
  try {
    session = await auth();
  } catch (err) {
    console.error(`[PATCH ${rawId}] 🚫 auth() failed:`, err);
    return NextResponse.json({ error: "Auth failure" }, { status: 500 });
  }
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = session.user.email;
  console.log(`[PATCH ${rawId}] 👤 user =`, email);

  // 4️⃣  ObjectId
  let mapObjectId: ObjectId;
  try {
    mapObjectId = new ObjectId(rawId);
  } catch {
    return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
  }

  // 5️⃣  User lookup
  const user: User | null = await findUserByEmail(email).catch((err) => {
    console.error(`[PATCH ${rawId}] 🚫 findUserByEmail error:`, err);
    return null;
  });
  if (!user?._id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  console.log(`[PATCH ${rawId}] 🗝️ user._id =`, user._id.toHexString());

  // 6️⃣  DB handles
  const mongo: MongoClient = await clientPromise;
  const db = mongo.db("campusmap");
  const maps = db.collection<MapDoc>("maps");

  // 7️⃣  Pre-check
  const existing = await maps.findOne({ _id: mapObjectId });
  console.log(`[PATCH ${rawId}] 🔍 pre-check doc:`, existing);
  if (!existing)
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  if (!existing.ownerId.equals(user._id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 8️⃣  Update   (type: WithId<MapDoc> | null)
  const result = (await maps.findOneAndUpdate(
    { _id: mapObjectId, ownerId: user._id },
    { $set: { isPrivate, updatedAt: new Date() } },
    { returnDocument: "after" }
  )) as WithId<MapDoc> | null; // explicit for clarity

  console.log(`[PATCH ${rawId}] 📦 raw result:`, result);

  if (!result) {
    // Should be impossible after the pre-check, but guard anyway
    const post = await maps.findOne({ _id: mapObjectId });
    console.error(`[PATCH ${rawId}] 🚫 result is null; post-check doc:`, post);
    return NextResponse.json(
      { error: "Map not found or not owned by you" },
      { status: 404 }
    );
  }

  // ✅ Success
  console.log(`[PATCH ${rawId}] ✅ updated in ${Date.now() - t0} ms`, result);
  return NextResponse.json(result, { status: 200 });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const t0 = Date.now();

  // 1️⃣ Route param
  const { id: rawId } = await context.params;
  if (!rawId) {
    return NextResponse.json({ error: "Missing map ID" }, { status: 400 });
  }

  // 2️⃣ Convert to ObjectId
  let mapObjectId: ObjectId;
  try {
    mapObjectId = new ObjectId(rawId);
  } catch {
    return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
  }

  // 3️⃣ Auth
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = session.user.email;

  // 4️⃣ Lookup user
  const user: User | null = await findUserByEmail(email).catch((err) => {
    console.error(`[DELETE ${rawId}] 🚫 findUserByEmail error:`, err);
    return null;
  });
  if (!user?._id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 5️⃣ DB handles
  const mongo: MongoClient = await clientPromise;
  const db = mongo.db("campusmap");
  const maps = db.collection<MapDoc>("maps");

  // 6️⃣ Ownership check
  const existing = await maps.findOne({ _id: mapObjectId });
  if (!existing) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }
  if (!existing.ownerId.equals(user._id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 7️⃣ Delete
  const result = await maps.deleteOne({ _id: mapObjectId });
  if (result.deletedCount !== 1) {
    return NextResponse.json({ error: "Deletion failed" }, { status: 500 });
  }

  console.log(`[DELETE ${rawId}] ✅ deleted in ${Date.now() - t0} ms`);
  return new Response(null, { status: 204 }); // No Content
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await context.params;

  // Validate ObjectId
  let mapObjectId: ObjectId;
  try {
    mapObjectId = new ObjectId(rawId);
  } catch {
    return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
  }

  // Connect to DB
  const mongo: MongoClient = await clientPromise;
  const db = mongo.db("campusmap");
  const maps = db.collection<MapDoc>("maps");

  // Find map
  const map = await maps.findOne({ _id: mapObjectId });
  if (!map) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }

  // Public access check (optional: adjust if you want auth-only)
  if (map.isPrivate) {
    const session = await auth();
    const email = session?.user?.email;
    const user = email ? await findUserByEmail(email) : null;
    if (!user || !map.ownerId.equals(user._id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // ✅ Return only the polygons
  return NextResponse.json(
    {
      polygons: map.polygons,
      labels: (map as any).labels ?? [],
      settings: map.settings,
    },
    { status: 200 }
  );
}

// at the bottom of /api/maps/[id]/route.ts

// interface ExportBody {
//   userEmail: string;
//   polygons: unknown[];
// }
// function isExportBody(x: any): x is ExportBody {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.userEmail === "string" &&
//     Array.isArray(x.polygons)
//   );
// }

// interface ExportBody { … }
interface ExportBody {
  userEmail: string;
  polygons: unknown[];
  labels: unknown[];
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
    typeof x.settings === "object" &&
    x.settings !== null &&
    typeof x.settings.zoom === "number" &&
    Array.isArray(x.settings.center) &&
    x.settings.center.length === 2
  );
}

// interface ExportBody {
//   userEmail: string;
//   polygons: unknown[];
//   labels: unknown[];
// }
// function isExportBody(x: any): x is ExportBody {
//   return (
//     typeof x === "object" &&
//     x !== null &&
//     typeof x.userEmail === "string" &&
//     Array.isArray(x.polygons) &&
//     Array.isArray(x.labels)
//   );
// }

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 1️⃣  Route param
  const { id: rawId } = await context.params;
  if (!rawId) {
    return NextResponse.json({ error: "Missing map ID" }, { status: 400 });
  }

  // 2️⃣  Parse & validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  // if (!isExportBody(body)) {
  //   return NextResponse.json(
  //     { error: "Request must include userEmail (string) and polygons (array)" },
  //     { status: 400 }
  //   );
  // }
  // const { userEmail, polygons } = body;
  if (!isExportBody(body)) {
    return NextResponse.json(
      {
        error:
          "Request must include userEmail (string), polygons (array), labels (array)",
      },
      { status: 400 }
    );
  }
  const { userEmail, polygons, labels, settings } = body;

  // 3️⃣  Validate mapId
  let mapObjectId: ObjectId;
  try {
    mapObjectId = new ObjectId(rawId);
  } catch {
    return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
  }

  // 4️⃣  Lookup user by email
  const user: User | null = await findUserByEmail(userEmail);
  if (!user?._id) {
    return NextResponse.json(
      { error: `No user found for email "${userEmail}"` },
      { status: 404 }
    );
  }

  // 5️⃣  Connect to DB & fetch existing map
  const mongo: MongoClient = await clientPromise;
  const db = mongo.db("campusmap");
  const maps = db.collection<MapDoc>("maps");

  const existing = await maps.findOne({ _id: mapObjectId });
  if (!existing) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }

  // 6️⃣  Authorize ownership
  if (!existing.ownerId.equals(user._id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 7️⃣  Apply the update
  const updateResult = await maps.updateOne(
    { _id: mapObjectId },
    { $set: { polygons, labels, settings, updatedAt: new Date() } }
  );
  if (updateResult.matchedCount !== 1) {
    console.error("updateOne did not match any document:", updateResult);
    return NextResponse.json(
      { error: "Failed to update polygons" },
      { status: 500 }
    );
  }

  // 8️⃣  Fetch the freshly-updated document
  const updatedMap = await maps.findOne({ _id: mapObjectId });
  if (!updatedMap) {
    console.error("findOne after update returned null—this should not happen.");
    return NextResponse.json(
      { error: "Failed to fetch updated map" },
      { status: 500 }
    );
  }

  // 9️⃣  Return the updated map
  return NextResponse.json(updatedMap, { status: 200 });
}
