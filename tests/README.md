# Map top bar checks

Run the regression checks with the repository's installed dependencies:

```sh
node --test tests/map-top-bar.test.cjs
```

These exercise settings validation, visible legacy defaults and obsolete disabled
settings, category image upload behavior,
empty-map saves, queued saves, failed persistence, API ownership checks, and reloads.
The database and network responses are mocked; no real assets or maps are modified.

For browser checks, run the Next.js development server and provide a Playwright
installation via `PLAYWRIGHT_MODULE` (or install Playwright locally). Then run:

```sh
node tests/verify-map-top-bar.cjs
```

Optional environment variables:

- `VERIFY_BASE_URL`: development server URL; defaults to `http://localhost:3000`.
- `PLAYWRIGHT_MODULE`: absolute path to an available Playwright package.
- `CHROME_PATH`: Chrome executable path; defaults to the standard Windows location.

The browser runner briefly creates `src/app/top-bar-verification-fixture/page.tsx`
and removes it in `finally`. It renders the actual builder components and `/share`
route with fixture API responses, while using the real ArcGIS runtime. It also reads
the Share Map button's generated URL and loads that route inside a real iframe.
It checks that the server-rendered header is visible before map data loads,
that both sidebar/map columns start below it, and that header settings previously
saved as disabled cannot hide it. It also checks
desktop/mobile bounds, editor drafts and Cancel, upload/replacement/clearing,
upload and save failures, color inputs, category editing, reload, map view/layer/
center/zoom preservation, and editor visibility in the builder, share document,
and desktop/mobile iframe. Screenshots and results are
written under `tools/top-bar-verification`.

## Map loading checks

```sh
node --test tests/graphics-hydration.test.cjs tests/map-hydration.test.cjs tests/map-top-bar.test.cjs
node tests/verify-map-loading.cjs
node tests/profile-map-initialization.cjs
```

The loading browser runner uses the same environment variables and real ArcGIS
runtime as the header runner. It temporarily creates and removes
`src/app/loading-verification-fixture/page.tsx`; all map/API responses are fixtures.
It holds configuration and optional layer responses to verify that SDK readiness
reveals the map independently of secondary resources, samples every rendered frame, and checks
initial load, refresh, background updates, map switching, stale requests, reopening,
configuration errors, and the actual `/share` document in an iframe. It also checks
saved graphics/header restoration and unhandled browser errors. Screenshots and
results are written under `tools/loading-verification`.

The profiler uses 600 saved polygons and labels, saved events, concurrent fast/slow
event feeds, and a controlled three-second optional FeatureLayer network stall.
It records browser User Timing and Resource Timing entries for configuration,
sidebar readiness, SDK modules, view creation/readiness, basemap rendering,
saved graphic hydration, live events and visible map content. It verifies partial
graphics at reveal, complete distinct records afterward, stable view identity,
category visibility, sidebar navigation and popups in builder/reload/iframe.
Results and screenshots are under `tools/initial-loading-profile`.

Initialization marks are available in the browser Performance panel with prefix
`logit-map:<mapId>:<loadNumber>`. The `:elapsed` measures are durations from load
start. They are diagnostic only and never determine loading visibility. In
particular, `first-basemap-render` observes basemap layer views without waiting
for operational layers, while `map-visible` records the UI's committed SDK-ready
state. Saves independently wait for `saved-data-ready` to prevent partial exports.
