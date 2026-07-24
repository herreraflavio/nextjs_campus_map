import { ObjectId, type Document } from "mongodb";
import type { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { createLiteMapPayload } from "@/lib/liteMap";
import { findUserByEmail } from "@/lib/userModel";

type LiteMapDocument = Document & {
  _id: ObjectId;
  ownerId: ObjectId;
  isPrivate?: boolean;
};

function ownsMap(ownerId: any, userId: any): boolean {
  if (!ownerId || !userId) return false;
  if (typeof ownerId.equals === "function") return ownerId.equals(userId);
  return String(ownerId) === String(userId);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;

  let mapObjectId: ObjectId;
  try {
    mapObjectId = new ObjectId(rawId);
  } catch {
    return NextResponse.json({ error: "Invalid map ID" }, { status: 400 });
  }

  const mongo = await clientPromise;
  const db = mongo.db("campusmap");
  const maps = db.collection<LiteMapDocument>("maps");

  const map = await maps.findOne(
    { _id: mapObjectId },
    {
      projection: {
        ownerId: 1,
        title: 1,
        url: 1,
        description: 1,
        polygons: 1,
        labels: 1,
        events: 1,
        settings: 1,
        createdAt: 1,
        updatedAt: 1,
        isPrivate: 1,
      },
    },
  );

  if (!map) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }

  if (map.isPrivate) {
    let session: Session | null = null;
    try {
      session = await auth();
    } catch {
      return NextResponse.json({ error: "Auth failure" }, { status: 500 });
    }

    const email = session?.user?.email;
    const user = email ? await findUserByEmail(email) : null;

    if (!user || !ownsMap(map.ownerId, user._id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const response = NextResponse.json(createLiteMapPayload(map));
  response.headers.set(
    "Cache-Control",
    map.isPrivate ? "no-store" : "public, s-maxage=60, stale-while-revalidate=300",
  );

  return response;
}
