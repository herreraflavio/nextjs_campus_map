import { NextRequest, NextResponse } from "next/server";

const BASEMAP_STYLES_URL =
  "https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2";
const DEFAULT_STYLE = "arcgis/navigation";
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

const STYLE_ALIASES: Record<string, string> = {
  arcgisnavigation: "arcgis/navigation",
  arcgisstreets: "arcgis/streets",
  arcgistopographic: "arcgis/topographic",
  arcgisimagery: "arcgis/imagery",
  arcgisoutdoor: "arcgis/outdoor",
  arcgislightgray: "arcgis/light-gray",
  arcgisdarkgray: "arcgis/dark-gray",
  arcgiscoloredpencil: "arcgis/colored-pencil",
  arcgisnova: "arcgis/nova",
};

export const dynamic = "force-dynamic";

function accessToken(): { token: string; isPublic: boolean } {
  const privateToken = (
    process.env.ARCGIS_API_KEY ||
    process.env.ESRI_API_KEY ||
    ""
  ).trim();
  if (privateToken) {
    return {
      token: privateToken,
      isPublic: process.env.MAPLIBRE_ALLOW_ARCGIS_TOKEN_STYLE_URL === "true",
    };
  }

  return {
    token: (process.env.NEXT_PUBLIC_ARCGIS_API_KEY || "").trim(),
    isPublic: true,
  };
}

function normalizeStyle(value: string | null): string {
  const raw = (value || DEFAULT_STYLE).trim();
  const alias = STYLE_ALIASES[raw.replace(/[^a-z0-9]/gi, "").toLowerCase()];
  const style = alias || raw;
  const [family, name] = style.split("/");

  if (
    (family === "arcgis" || family === "open") &&
    /^[a-z0-9][a-z0-9-]*$/i.test(name || "")
  ) {
    return `${family}/${name}`;
  }

  return DEFAULT_STYLE;
}

export async function GET(request: NextRequest) {
  const credentials = accessToken();
  if (!credentials.token) {
    return NextResponse.json(
      { error: "Missing ARCGIS_API_KEY, ESRI_API_KEY, or NEXT_PUBLIC_ARCGIS_API_KEY" },
      { status: 503 },
    );
  }

  const style = normalizeStyle(request.nextUrl.searchParams.get("style"));
  const [styleFamily] = style.split("/");
  const sessionUrl = `${BASEMAP_STYLES_URL}/sessions/start?${new URLSearchParams(
    {
      styleFamily,
      durationSeconds: String(SESSION_DURATION_SECONDS),
    },
  ).toString()}`;

  try {
    const sessionResponse = await fetch(sessionUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${credentials.token}`,
      },
      cache: "no-store",
    });

    const session = await sessionResponse.json().catch(() => ({}));

    if (!sessionResponse.ok || !session?.sessionToken) {
      if (credentials.isPublic) {
        return NextResponse.json(
          {
            style,
            styleFamily,
            styleUrl: `${BASEMAP_STYLES_URL}/styles/${style}?token=${encodeURIComponent(
              credentials.token,
            )}`,
            expiresAt: null,
            authMode: "access-token",
            warning:
              session?.error?.message ||
              session?.message ||
              "ArcGIS basemap session unavailable; using direct access token style URL.",
          },
          {
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      }

      return NextResponse.json(
        {
          error:
            session?.error?.message ||
            session?.message ||
            `Unable to create ArcGIS basemap session (${sessionResponse.status})`,
        },
        { status: 502 },
      );
    }

    const styleUrl = `${BASEMAP_STYLES_URL}/styles/${style}?token=${encodeURIComponent(
      session.sessionToken,
    )}`;

    return NextResponse.json(
      {
        style,
        styleFamily,
        styleUrl,
        expiresAt: session.endTime || null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create ArcGIS basemap session",
      },
      { status: 502 },
    );
  }
}
