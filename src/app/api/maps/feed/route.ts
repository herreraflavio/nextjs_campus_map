// app/api/maps/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createMap, getMapById, getMapsByOwnerId } from "@/lib/mapModel";
import { findUserByEmail, addMapToUserByEmail } from "@/lib/userModel";

export async function GET(request: NextRequest) {
  try {
    const feed = [
      {
        id: "ucm-main-campus",
        title: "UC Merced Main Campus",
        description:
          "The primary campus map including academic buildings, dorms, and parking.",
        previewImageURL: "https://ucmercedhub.com/images/ucm-preview.jpg",
        datePublished: "2026-03-28T10:00:00Z",
        config: {
          walkingVerticesURL:
            "https://mapbuilder.ucmercedhub.com/walking_vertices.json",
          walkingEdgesURL:
            "https://mapbuilder.ucmercedhub.com/walking_edges.json",
          vertexMetaURL: "https://mapbuilder.ucmercedhub.com/vertex_meta.json",
          polygonsAPIURL: "https://campusmap.ucmercedhub.com/polygon",
          eventsAPIURL:
            "https://uc-merced-campus-event-api-backend.onrender.com/presence_events_ios",
          mapTilesURLTemplate:
            "https://tiles.flavioherrera.com/v12/{level}/{col}/{row}.png",
          initialLatitude: 37.359848,
          initialLongitude: -120.426165,
          initialScale: 12000,
        },
      },
    ];
    return NextResponse.json(feed);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
