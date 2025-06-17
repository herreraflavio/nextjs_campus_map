// import { ObjectId } from "mongodb";
// import { NextRequest, NextResponse } from "next/server";
// import { auth } from "@/lib/auth";
// import clientPromise from "@/lib/mongodb";
// import { findUserByEmail } from "@/lib/userModel";
// import type { NextApiRequest, NextApiResponse } from "next";

// export async function PATCH(
//   req: NextApiRequest,
//   res: NextApiResponse,
//   { params }: { params: { id: string } }
// ) {
//   const { isPrivate } = req.body;
//   // 1) Auth check
//   //   const session = await auth();
//   //   if (!session?.user?.email) {
//   //     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   //   }

//   //   // 2) Validate ObjectId
//   //   let mapObjectId: ObjectId;
//   //   try {
//   //     mapObjectId = new ObjectId(params.id);
//   //   } catch {
//   //     return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
//   //   }

//   //   // 3) Find user
//   //   const user = await findUserByEmail(session.user.email);
//   //   if (!user) {
//   //     return NextResponse.json({ error: "User not found" }, { status: 404 });
//   //   }

//   //   // 4) Check if user owns this map
//   //   const ownsMap = user.maps.some((entry: any) => {
//   //     const idToCheck = entry?.id ?? entry; // entry might be an ObjectId or { id, url }
//   //     return new ObjectId(idToCheck).equals(mapObjectId);
//   //   });

//   //   if (!ownsMap) {
//   //     return NextResponse.json(
//   //       { error: "Forbidden: You do not own this map" },
//   //       { status: 403 }
//   //     );
//   //   }

//   //   // 5) Parse the update data (e.g. { isPrivate: false })
//   //   const updateData = await request.json();

//   //   // 6) Perform the update in the `maps` collection
//   //   const db = (await clientPromise).db();
//   //   const result = await db.collection("maps").findOneAndUpdate(
//   //     { _id: mapObjectId },
//   //     { $set: updateData },
//   //     { returnDocument: "after" } // returns the updated doc
//   //   );
//   //   if (result) {
//   //     if (!result.value) {
//   //       return NextResponse.json({ error: "Map not found" }, { status: 404 });
//   //     }

//   //     return NextResponse.json(result.value);
//   //   } else {
//   //     return NextResponse.json("error");

//   //  }
//   console.log(isPrivate);
//   console.log(params.id);
// }

// import { ObjectId } from "mongodb";
// import { NextRequest, NextResponse } from "next/server";
// import { auth } from "@/lib/auth";
// import clientPromise from "@/lib/mongodb";
// import { findUserByEmail } from "@/lib/userModel";

// export async function PATCH(
//   request: NextRequest,
//   { params }: { params: { id: string } }
// ) {
//   const { isPrivate } = await request.json();
//   console.log("paramsID:", params.id);

//   // 1) Auth check
//   const session = await auth();
//   if (!session?.user?.email) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   // 2) Validate ObjectId
//   let mapObjectId: ObjectId;
//   try {
//     mapObjectId = new ObjectId(params.id);
//   } catch {
//     return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
//   }

//   // 3) Find user
//   const user = await findUserByEmail(session.user.email);
//   if (!user) {
//     return NextResponse.json({ error: "User not found" }, { status: 404 });
//   }

//   // 4) Check if user owns this map
//   const ownsMap = user.maps.some((entry: any) => {
//     const idToCheck = entry?.id ?? entry;
//     return new ObjectId(idToCheck).equals(mapObjectId);
//   });

//   if (!ownsMap) {
//     return NextResponse.json(
//       { error: "Forbidden: You do not own this map" },
//       { status: 403 }
//     );
//   }

//   // 5) Update map
//   const db = (await clientPromise).db();
//   const result = await db
//     .collection("maps")
//     .findOneAndUpdate(
//       { _id: mapObjectId },
//       { $set: { isPrivate } },
//       { returnDocument: "after" }
//     );
//   if (result) {
//     if (!result.value) {
//       return NextResponse.json({ error: "Map not found" }, { status: 404 });
//     }

//     return NextResponse.json(result.value);
//   }
// }
// app/api/maps/[id]/route.ts
// -----------------------------------------------------------------------------
// PATCH  /api/maps/[id]   —   Driver: mongodb 6.x
// -----------------------------------------------------------------------------

import { ObjectId, MongoClient, Document, WithId } from "mongodb";
import type { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { findUserByEmail, User } from "@/lib/userModel";

// ─────────── Schema ───────────
export interface MapDoc extends Document {
  _id: ObjectId;
  ownerId: ObjectId;
  title: string;
  description: string | null;
  polygons: unknown[];
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

// import { ObjectId, WithId, Document } from "mongodb";
// import { NextRequest, NextResponse } from "next/server";
// import { auth } from "@/lib/auth";
// import clientPromise from "@/lib/mongodb";
// import { findUserByEmail } from "@/lib/userModel";

// // 1) Define your Map schema for TS
// interface MapDoc extends Document {
//   _id: ObjectId;
//   ownerId: string;
//   title: string;
//   description: string | null;
//   polygons: any[]; // you can replace `any` with a better Polygon type if you have one
//   createdAt: Date;
//   updatedAt: Date;
//   isPrivate: boolean;
// }

// export async function PATCH(
//   request: NextRequest,
//   context: { params: Promise<{ id: string }> }
// ) {
//   // await your dynamic params
//   const { id } = await context.params;
//   console.log("id:", id);

//   // parse the body
//   const { isPrivate } = await request.json();
//   console.log("isPrivate:", isPrivate);
//   // auth guard
//   const session = await auth();
//   if (!session?.user?.email) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   // validate the ID
//   let mapObjectId: ObjectId;
//   try {
//     mapObjectId = new ObjectId("684e2fcaef150dfcd9289473");
//   } catch {
//     return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
//   }

//   // confirm they own it
//   const user = await findUserByEmail(session.user.email);
//   if (!user) {
//     return NextResponse.json({ error: "User not found" }, { status: 404 });
//   }
//   const ownsMap = user.maps.some((entry: any) => {
//     const idToCheck = entry?.id ?? entry;
//     return new ObjectId(idToCheck).equals(mapObjectId);
//   });
//   if (!ownsMap) {
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//   } else {
//     console.log("proceeding...");
//   }

//   // 2) Type your collection and result
//   const db = (await clientPromise).db();
//   const updateResult = await db
//     .collection<MapDoc>("maps")
//     .findOneAndUpdate(
//       { _id: mapObjectId },
//       { $set: { isPrivate } },
//       { returnDocument: "after" }
//     );

//   // 3) Null‐check both updateResult and updateResult.value
//   if (!updateResult || !updateResult.value) {
//     return NextResponse.json({ error: "Map not found" }, { status: 404 });
//   }

//   // TS now knows updateResult.value is a MapDoc
//   const updatedMap: WithId<MapDoc> = updateResult.value;
//   return NextResponse.json(updatedMap);
// }
