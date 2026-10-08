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
