// app/api/maps/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createMap, getMapById, getMapsByOwnerId } from "@/lib/mapModel";
// import { addMapToUser } from "@/lib/userModel";
import { findUserByEmail, addMapToUserByEmail } from "@/lib/userModel";

// const sampleMap = [
//   {
//     polygons: [
//       {
//         attributes: {
//           id: "poly1",
//           name: "Engineering Quad",
//           description: "Building footprint for Engineering Quad",
//           showAtZoom: 14,
//           hideAtZoom: 18,
//         },
//         geometry: {
//           type: "polygon",
//           rings: [
//             [
//               [-120.423, 37.366],
//               [-120.422, 37.366],
//               [-120.422, 37.365],
//               [-120.423, 37.365],
//               [-120.423, 37.366],
//             ],
//           ],
//           spatialReference: { wkid: 4326 },
//         },
//         symbol: {
//           type: "simple-fill",
//           color: [255, 0, 0, 0.4],
//           outline: {
//             color: [0, 0, 0, 1],
//             width: 1,
//           },
//         },
//       },
//       {
//         attributes: {
//           id: "poly2",
//           name: "Student Union Complex",
//           description: "Multipolygon: Student Union Building + Adjacent Plaza",
//           showAtZoom: 15,
//           hideAtZoom: 19,
//         },
//         geometry: {
//           type: "polygon",
//           rings: [
//             [
//               [-120.4215, 37.3665],
//               [-120.4205, 37.3665],
//               [-120.4205, 37.3655],
//               [-120.4215, 37.3655],
//               [-120.4215, 37.3665],
//             ],
//             [
//               [-120.4202, 37.3662],
//               [-120.4196, 37.3662],
//               [-120.4196, 37.3658],
//               [-120.4202, 37.3658],
//               [-120.4202, 37.3662],
//             ],
//           ],
//           spatialReference: { wkid: 4326 },
//         },
//         symbol: {
//           type: "simple-fill",
//           color: [0, 128, 255, 0.4],
//           outline: {
//             color: [0, 0, 0, 1],
//             width: 1,
//           },
//         },
//       },
//     ],
//   },
// ];

const sampleMap = [
  {
    _id: "68535a8bed9b51a297fd3f94",
    ownerId: "684e3cc02fcbaee2ec8696bb",
    title: "map1",
    url: "/maps/68535a8bed9b51a297fd3f94",
    description: null,
    polygons: [
      {
        attributes: {
          id: "polygon1",
          name: "Multi Building",
          description: "Two part building",
        },
        geometry: {
          type: "polygon",
          rings: [
            [
              [-13405382.834770162, 4490257.11622234],
              [-13405271.166994514, 4490257.11622234],
              [-13405271.166994514, 4490143.220735788],
              [-13405382.834770162, 4490143.220735788],
              [-13405382.834770162, 4490257.11622234],
            ],
            [
              [-13405238.307763627, 4490212.022650697],
              [-13405170.50303265, 4490212.022650697],
              [-13405170.50303265, 4490168.286427814],
              [-13405238.307763627, 4490168.286427814],
              [-13405238.307763627, 4490212.022650697],
            ],
          ],
          spatialReference: {
            wkid: 102100,
            latestWkid: 3857,
          },
        },
        symbol: {
          type: "simple-fill",
          color: [150, 0, 200, 0.5],
          outline: {
            color: [50, 0, 100, 1],
            width: 2,
          },
        },
      },
      {
        attributes: {
          id: "polygon2",
          name: "Lab",
          description: "New improved Lab",
        },
        geometry: {
          type: "polygon",
          rings: [
            [
              [-13405498.68464116, 4490355.444509694],
              [-13405485.54702692, 4490468.905723558],
              [-13405373.28014163, 4490427.104223712],
              [-13405364.76384219, 4490379.304862633],
              [-13405498.68464116, 4490355.444509694],
            ],
          ],
          spatialReference: {
            wkid: 102100,
            latestWkid: 3857,
          },
        },
        symbol: {
          type: "simple-fill",
          color: [150, 150, 150, 0.2],
          outline: {
            color: [50, 50, 50, 1],
            width: 2,
          },
        },
      },
    ],
    createdAt: new Date(1750293131158),
    updatedAt: new Date(1750298603959),
    isPrivate: false,
  },
];

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
  const mapURL = `/maps/${title}`;

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
  const newMap = await createMap({
    ownerId: user._id.toString(),
    polygons: sampleMap[0].polygons, // empty for now
    title,
    url: undefined,
    description: undefined,
    isPrivate: false,
  });

  // 5) push mapId into their `maps` array
  try {
    await addMapToUserByEmail(user.email, newMap._id.toString());
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 6) return the new mapId + title back to the client
  return new Response(JSON.stringify(newMap), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// GET: Fetch all maps for the logged-in user
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await findUserByEmail(session.user.email);
  if (!user || !user._id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const maps = await getMapsByOwnerId(user._id.toString());
    return NextResponse.json(maps);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
