# Project Structure

```text
nextjs_campus_map/
├── src/
│   ├── app/                         # Next.js App Router routes, pages, APIs, and UI
│   │   ├── (auth)/                  # Sign in and registration pages
│   │   ├── api/                     # Auth, maps, and upload routes
│   │   ├── components/              # Main Map Builder UI and shared components
│   │   │   ├── map/                 # ArcGIS map controls, sidebars, stores, and admin panels
│   │   │   ├── button/              # Dashboard/action button components
│   │   │   └── loading/             # Loading UI
│   │   ├── context/                 # Shared React context for selected map state
│   │   ├── helper/                  # Map save/export and location lookup helpers
│   │   ├── maps/[id]/               # Authenticated map editing route
│   │   ├── share/[id]/              # Public shared map route
│   │   └── types/                   # Shared application data types
│   └── lib/                         # MongoDB, auth, and map persistence helpers
├── public/
│   ├── branding/                    # Brand images used by landing/app surfaces
│   ├── data/                        # Static polygon data
│   ├── icons/                       # Event/map marker icons
│   ├── landingpage/                 # Landing page media
│   ├── sprites/                     # Map animation and sprite assets
│   └── *.geojson, *.json            # Route, vertex, and walking graph data
├── middleware.js                    # Next.js middleware
├── next.config.ts                   # Next.js configuration
├── package.json                     # Scripts and dependencies
└── tsconfig.json                    # TypeScript configuration
```

## Main Map Builder

The authenticated Map Builder route lives in `src/app/maps/[id]/page.tsx` and renders the map through `src/app/components/ArcGISWrapper.tsx` and `src/app/components/ArcGISMap.tsx`. Dashboard and account-facing UI is centered around `src/app/components/LoggedInDashboard.jsx`.

## Map Components

Map-specific state and controls live under `src/app/components/map/`. Important files include `arcgisRefs.ts` for shared ArcGIS refs and event state, `bucketManager.ts` for drawing bucket organization, `sidebar/` for the public/admin drawing sidebar, `admin/` for editor panels, and `MapControls/` for event and turn-by-turn overlays.

## Sharing

Public sharing lives in `src/app/share/[id]/`. This route intentionally coexists with the authenticated editor and should be treated as a separate user-facing surface.

## API Routes And Persistence

Map CRUD and feed routes live under `src/app/api/maps/`. Upload handling is in `src/app/api/upload/route.ts`. Authentication routes live under `src/app/api/auth/` and shared persistence/auth helpers live in `src/lib/`.

## Storage And Uploads

Upload behavior is handled by `src/app/api/upload/route.ts`, using the AWS SDK dependencies declared in `package.json`. Map documents and user records are handled through `src/lib/mapModel.ts`, `src/lib/liteMap.ts`, `src/lib/userModel.ts`, and `src/lib/mongodb.ts`.

## Configuration

`package.json` defines the available project scripts. `tsconfig.json` enables strict TypeScript with the `@/*` path alias. `next.config.ts` contains project-level Next.js configuration.
