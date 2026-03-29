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
        title: "UC Merced Events Map",
        description:
          "The primary campus events map. Click on pins scattered across the campus to learn more.",
        previewImageURL:
          "https://campusmap.ucmercedhub.com/maps/images/ucm-maps-preview-2.jpg",
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
          basemapStyle: "arcGISTopographic",
          basemapURLTemplate: null,
        },
      },
      {
        id: "ucm-general-info",
        title: "UC Merced General Information Map",
        description:
          "A simplified campus map focused on general information. Click on buidings to learn more about them",
        previewImageURL:
          "https://news.ucmerced.edu/sites/g/files/ufvvjh1306/f/news/image/campus-hero.jpg",
        datePublished: "2026-03-29T10:00:00Z",
        config: {
          walkingVerticesURL:
            "https://mapbuilder.ucmercedhub.com/walking_vertices.json",
          walkingEdgesURL:
            "https://mapbuilder.ucmercedhub.com/walking_edges.json",
          vertexMetaURL: "https://mapbuilder.ucmercedhub.com/vertex_meta.json",
          polygonsAPIURL: "https://campusmap.ucmercedhub.com/polygon",
          eventsAPIURL: null,
          mapTilesURLTemplate:
            "https://tiles.flavioherrera.com/v12/{level}/{col}/{row}.png",
          initialLatitude: 37.359848,
          initialLongitude: -120.426165,
          initialScale: 12000,
          basemapStyle: "arcGISColoredPencil",
          basemapURLTemplate: null,
        },
      },
    ];
    return NextResponse.json(feed);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
