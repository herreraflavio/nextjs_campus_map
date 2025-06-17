// // pages/api/maps/index.js
// import { NextResponse } from "next/server";
// import { NextApiRequest, NextApiResponse } from "next";
// import { createMap, getMapById } from "@/lib/mapModel";
// import { addMapToUser } from "@/lib/userModel";

// export default async function handler(req, res) {
//   if (req.method === "POST") {
//     // try {
//     //   // Expect body = { ownerId, polygons: [...], title?, description? }
//     //   const { ownerId, polygons, title, description } = req.body;

//     //   if (!ownerId || !Array.isArray(polygons)) {
//     //     return res
//     //       .status(400)
//     //       .json({ error: "Request must include ownerId and polygons array." });
//     //   }

//     //   // 1) Create map document
//     //   const newMapId = await createMap({
//     //     ownerId,
//     //     polygons,
//     //     title,
//     //     description,
//     //   });

//     //   // 2) Push that mapId into the user’s `maps` array
//     //   await addMapToUser(ownerId, newMapId);

//     //   return res.status(200).json({ mapId: newMapId });
//     // } catch (error) {
//     //   console.error("Error in /api/maps POST:", error);
//     //   return res.status(500).json({ error: "Internal server error." });
//     // }
//     console.log("api endpoint hit");
//     return NextResponse.json({ message: "Email already registered" });
//   } else if (req.method === "GET") {
//     // Optional: allow GET /api/maps?mapId=... to retrieve a single map
//     const { mapId } = req.query;
//     if (!mapId) {
//       return res.status(400).json({ error: "Missing mapId query parameter." });
//     }
//     try {
//       const mapDoc = await getMapById(mapId.toString());
//       if (!mapDoc) {
//         return res.status(404).json({ error: "Map not found." });
//       }
//       return res.status(200).json(mapDoc);
//     } catch (e) {
//       console.error("Error in /api/maps GET:", e);
//       return res.status(500).json({ error: "Internal server error." });
//     }
//   } else {
//     res.setHeader("Allow", ["POST", "GET"]);
//     return res.status(405).end(`Method ${req.method} Not Allowed`);
//   }
// }

// import { NextRequest } from "next/server";

// export async function GET(request: NextRequest) {
//   console.log("GET /api/maps hit");
//   return new Response(JSON.stringify([]), {
//     status: 200,
//     headers: { "Content-Type": "application/json" },
//   });
// }

// export async function POST(request: NextRequest) {
//   console.log("POST /api/maps hit");
//   return new Response(JSON.stringify({ message: "POST success" }), {
//     status: 200,
//     headers: { "Content-Type": "application/json" },
//   });
// }

// app/api/maps/route.ts
// import { NextRequest } from "next/server";
// import { createMap, getMapById } from "@/lib/mapModel";
// import { addMapToUser } from "@/lib/userModel";

// export async function GET(request: NextRequest) {
//   const { searchParams } = new URL(request.url);
//   const mapId = searchParams.get("mapId");
//   if (!mapId) {
//     return new Response(JSON.stringify([]), {
//       status: 400,
//       headers: { "Content-Type": "application/json" },
//     });
//   }
//   const map = await getMapById(mapId);
//   if (!map)
//     return new Response(JSON.stringify([]), {
//       status: 404,
//       headers: { "Content-Type": "application/json" },
//     });
//   return new Response(JSON.stringify(map), {
//     status: 200,
//     headers: { "Content-Type": "application/json" },
//   });
// }

// export async function POST(request: NextRequest) {
//   const body = (await request.json()) as {
//     ownerId: string;
//     polygons: any[];
//     title?: string;
//     description?: string;
//   };
//   if (!body.ownerId || !Array.isArray(body.polygons)) {
//     return new Response(
//       JSON.stringify({ error: "ownerId and polygons required" }),
//       { status: 400, headers: { "Content-Type": "application/json" } }
//     );
//   }
//   const mapId = await createMap(body);
//   await addMapToUser(body.ownerId, mapId);
//   return new Response(JSON.stringify({ mapId }), {
//     status: 200,
//     headers: { "Content-Type": "application/json" },
//   });
// }

// app/api/maps/route.ts
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createMap, getMapById } from "@/lib/mapModel";
// import { addMapToUser } from "@/lib/userModel";
import { findUserByEmail, addMapToUserByEmail } from "@/lib/userModel";

export async function POST(request: NextRequest) {
  // 1) ensure they're logged in
  const session = await auth();
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2) pull name from the POST body
  const { name } = (await request.json()) as { name?: string };
  const title = name?.trim() || "";

  // 3) look up the user by email
  const user = await findUserByEmail(session.user.email);
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!user._id) {
    return new Response(JSON.stringify({ error: "User id not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4) create the map using the user's _id
  const mapId = await createMap({
    ownerId: user._id.toString(),
    polygons: [], // empty for now
    title,
    description: undefined,
    isPrivate: false,
  });

  // 5) push mapId into their `maps` array
  try {
    await addMapToUserByEmail(user.email, mapId);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 6) return the new mapId + title back to the client
  return new Response(JSON.stringify({ mapId, name: title }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
