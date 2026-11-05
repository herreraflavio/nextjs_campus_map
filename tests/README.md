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

## Sidebar colors

Map Settings → **Edit Sidebar Colors** provides background, border, and text
colors with a preview. Save persists them for the builder and shared maps;
Cancel discards drafts, and Reset defaults restores the original palette.
Appearance saves retain the same MapView and preserve colors during unrelated
map edits. The map-top-bar and map-hydration tests also cover sidebar validation,
save failures, queued saves, reloads, and explicit resets.

## Map loading checks

The top bar and sidebar use subtle gray skeletons while map configuration loads.
The viewport keeps its own skeleton until the SDK is ready, independently of
optional layers and event feeds. The pulse respects reduced-motion preferences;
configuration errors clear the placeholders and retain the existing error UI.

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

## Location links and visibility locks

Append `?location=Recreation%20Field` (or an alias such as `?location=RF`) to a
map URL, including `/share/<map-id>`. Names, aliases, partial names and IDs use
the navigation search. The target zooms to level 18, selects its polygon and
opens a popup docked to the right; navigation starts with that destination.
Other categories and drawings start hidden. Removing the parameter restores
normal visibility; an unrecognized location leaves the normal map available.

Each sidebar item has a **Copy link** button in both the editor and public map.
It copies the public `/share/<map-id>?location=<location-name>` URL and confirms
when copied. Existing links that use item IDs continue to work. Popups also have
a **Share** action that copies the corresponding location or event link.

Category and item editors offer **Always remain visible** alongside **Visible
to users**. This setting overrides location filtering and user visibility
switches. Categories apply the setting to their descendants. Independent item
locks also survive hiding their category. Labels retain their zoom limits.
These settings persist; URL filtering and user switches do not.

```sh
node --test tests/*.test.cjs
node tests/verify-map-locations.cjs
```

The browser runner uses the real ArcGIS SDK against a running dev server, with
fixture map/API responses. It covers aliases, destination defaults, nested
sidebar switches, docked popup content, changing/removing/invalid query values,
admin edits, save/reload, and a mobile shared iframe. It accepts
`PLAYWRIGHT_MODULE`, `CHROME_PATH` and `VERIFY_BASE_URL` and removes its temporary
fixture route when finished. Screenshots and results are written under
`tools/location-verification`.

## API records, event sharing and sidebar tabs

In Map Settings, each API source has a **Tab name** input. Existing sources
default to **Events**. Sources with the same name share a tab; **Home** is reserved
for categories and drawings. Labels persist independently of source order and
apply immediately without replacing the MapView.
Additional tabs are created only from configured API sources. Maps without any
API sources display Home only.

Each tab has **Hide all** and **Show all** controls for its own content. Home
controls all nested categories and drawings while honoring admin visibility
locks. Source-tab controls also apply to records that finish loading later.
Calendar filters compose with these switches.

Event links use `/share/<map-id>?event=<record-id>&source=<source-key>`. The source
key distinguishes identical record IDs from different APIs. The map fetches its
configured sources, finds the record, and uses its **location** field to resolve
the building. **location_at** remains display detail. The event and its building
stay visible, the building is highlighted, navigation defaults to that location,
and a docked popup contains the event's details. Selecting the building opens
its own popup content separately. Undated API records are also
supported. Unavailable records and source failures produce a status message.

```sh
node --test tests/*.test.cjs
node tests/verify-api-sharing.cjs
```

The browser runner checks readable and legacy links, popup sharing, API record
mapping, duplicate source IDs, tabs and bulk visibility, calendar composition,
live settings and persistence, and mobile iframe behavior using the real ArcGIS
SDK. Screenshots and results are under `tools/api-sharing-verification`.
