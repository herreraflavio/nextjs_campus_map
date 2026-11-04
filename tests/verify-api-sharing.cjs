// Run against the dev server with the real ArcGIS SDK and fixture map/API responses.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const fixtureDir = path.join(root, 'src/app/api-sharing-verification-fixture');
const output = path.join(root, 'tools/api-sharing-verification');
const baseUrl = process.env.VERIFY_BASE_URL || 'http://localhost:3000';
const id = '666666666666666666666666';
const checked = [], errors = [];
let browser, page;
if (fs.existsSync(fixtureDir)) throw new Error('Location verification fixture already exists');
fs.mkdirSync(fixtureDir);
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(fixtureDir, 'page.tsx'), `"use client";
import { SessionProvider } from "next-auth/react";
import { useSearchParams, useServerInsertedHTML } from "next/navigation";
import { useState } from "react";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import LoggedInDashboard from "@/app/components/LoggedInDashboard";
import { MapProvider } from "@/app/context/MapContext";
export default function VerifyLocations() {
  const query = useSearchParams();
  const [{ cache, flush }] = useState(() => {
    const cache = createCache({ key: "locations" }); cache.compat = true;
    const previousInsert = cache.insert; let names: string[] = [];
    cache.insert = (...args) => { const serialized = args[1]; if (cache.inserted[serialized.name] === undefined) names.push(serialized.name); return previousInsert(...args); };
    return { cache, flush: () => { const result = names; names = []; return result; } };
  });
  useServerInsertedHTML(() => { const names = flush(); if (!names.length) return null; return <style data-emotion={cache.key + " " + names.join(" ")} dangerouslySetInnerHTML={{ __html: names.map(name => cache.inserted[name]).join("") }} />; });
  const session = { user: { email: "locations@example.test" }, expires: "2099-01-01" };
  if (query.get("iframe")) return <iframe title="Location map" src="/share/${id}?location=rF" style={{ width: "100%", height: "100vh", border: 0 }} />;
  return <CacheProvider value={cache}><SessionProvider session={session}><MapProvider mapId="${id}"><LoggedInDashboard user={session.user} canEdit /></MapProvider></SessionProvider></CacheProvider>;
}`);
const sr = { wkid: 4326, latestWkid: 4326 };
const vertex = JSON.parse(fs.readFileSync(path.join(root, 'public/walking_vertices.json'), 'utf8')).features.find(item => String(item.id) === '462');
const [lon, lat] = vertex.geometry.coordinates;
function drawing(id, name, categoryId, offset, extra = {}) {
  const x = lon + offset, y = lat;
  return { attributes: { id, name, description: `<p>Details for ${name}</p>`, categoryId, ...extra },
    geometry: { type: 'polygon', rings: [[[x, y], [x + .0002, y], [x + .0002, y + .0002], [x, y + .0002], [x, y]]], spatialReference: sr },
    symbol: { type: 'simple-fill', color: [25, 120, 180, .7], outline: { color: [0, 40, 86, 1], width: 1 } } };
}
let data = {
  polygons: [drawing('field', 'Recreation Field', 'fields', 0), drawing('sibling', 'Other Field', 'fields', .0005),
    drawing('other', 'Other Place', 'other-category', .001), drawing('pinned', 'Emergency Phone', null, -.001, { alwaysVisible: true }),
    drawing('inherited', 'Walking Path', 'paths', -.0005), drawing('hidden-item', 'Hidden Service', null, .0015, { adminVisible: false })],
  labels: [], events: [],
  categories: [{ id: 'campus', name: 'Campus', parentId: null, order: 0 },
    { id: 'fields', name: 'Fields', parentId: 'campus', order: 0 },
    { id: 'other-category', name: 'Other', parentId: null, order: 1 },
    { id: 'paths', name: 'Paths', parentId: null, order: 2, alwaysVisible: true }],
  settings: { zoom: 15, center: [lon, lat], constraints: null, featureLayers: [], mapTile: null, baseMap: 'osm', apiSources: [] },
};
data.labels = data.polygons.map(item => ({ attributes: { parentId: item.attributes.id, text: item.attributes.name,
  showAtZoom: 15, hideAtZoom: 23, fontSize: 12, color: [0, 0, 0, 1], haloColor: [255, 255, 255, 1], haloSize: 1 },
  geometry: { type: 'point', x: item.geometry.rings[0][0][0], y: lat, spatialReference: sr } }));
function pass(message) { checked.push(message); console.log('PASS:', message); }
async function until(fn, name, timeout = 60000) {
  const started = Date.now();
  while (!await fn()) {
    if (Date.now() - started > timeout) throw new Error('Timed out: ' + name);
    await new Promise(resolve => setTimeout(resolve, 80));
  }
}
async function snapshot(surface) {
  return surface.evaluate(() => {
    const view = window.__locationViews.at(-1);
    return { ready: view?.ready, zoom: view?.zoom, selected: view?.popup?.selectedFeature?.attributes?.id,
      popupVisible: view?.popup?.visible, docked: view?.popup?.dockEnabled, dockPosition: view?.popup?.dockOptions?.position,
      drawings: view?.map?.findLayerById('finalized')?.graphics?.toArray().map(graphic => ({ id: graphic.attributes.id, visible: graphic.visible })) };
  });
}
async function verifyTarget(surface, targetId, expectedDestination = 'Recreation Field') {
  await until(async () => { const state = await snapshot(surface); return state.selected === targetId && state.popupVisible && state.docked; }, 'selected docked target');
  const state = await snapshot(surface);
  assert.equal(state.zoom, 18);
  assert.equal(state.dockPosition, 'top-right');
  assert.equal(state.drawings.find(item => item.id === targetId).visible, true);
  assert.equal(state.drawings.find(item => item.id === 'other').visible, false);
  assert.equal(state.drawings.find(item => item.id === 'pinned').visible, true);
  assert.equal(state.drawings.find(item => item.id === 'inherited').visible, true);
  await surface.getByText(`Details for ${targetId === 'field' ? 'Recreation Field' : 'Other Field'}`, { exact: true }).waitFor({ state: 'visible' });
  await surface.getByRole('button', { name: 'Turn-by-turn directions' }).click();
  await until(async () => await surface.getByRole('combobox', { name: 'Destination' }).inputValue() === expectedDestination, 'destination from URL');
  await surface.getByRole('button', { name: 'Turn-by-turn directions' }).click();
}
const feeds = ['https://sharing-fixture.example/events', 'https://sharing-fixture.example/notices'];
data.settings.apiSources = feeds;
data.settings.apiSourceTabs = [{ url: feeds[0], tabName: 'Events' }, { url: feeds[1], tabName: 'Alerts' }];
const payloads = [
  { events: [{ id: 'page-alpha', title: 'Campus Showcase', location: 'RF', location_at: 'Room 213', description: 'Event details from the API', date: '2026-11-04', start_at: '14:00' },
    { id: 'page-beta', title: 'Later Event', location: 'RF', location_at: 'Other room', date: '2026-11-05' }] },
  { items: [{ id: 'page-alpha', name: 'Campus Notice', location: 'Other Field', location_at: 'Do not use this for mapping', description: 'Undated API record' }] },
];
const posts = [];
let failFeed = false;
async function eventState(surface) {
  return surface.evaluate(() => {
    const view = window.__locationViews.at(-1);
    return { selectedName: view?.popup?.selectedFeature?.attributes?.event_name,
      events: view?.map?.findLayerById('events-layer')?.graphics.toArray().map(graphic => ({
        id: graphic.attributes.id, source: graphic.attributes.sourceUrl, visible: graphic.visible,
      })) || [] };
  });
}
async function sharedEvent(surface, name, building) {
  await until(async () => (await eventState(surface)).selectedName === name, 'shared event selection');
  await surface.getByText(name === 'Campus Showcase' ? 'Event details from the API' : 'Undated API record', { exact: true }).waitFor();
  assert.equal(await surface.getByText(`Building: ${building}`, { exact: true }).count(), 0);
  assert.equal(await surface.getByText(`Details for ${building}`, { exact: true }).count(), 0);
  assert.equal((await snapshot(surface)).docked, true);
  assert.equal((await snapshot(surface)).drawings.find(item => item.id === (building === 'Recreation Field' ? 'field' : 'sibling')).visible, true);
  assert.equal((await snapshot(surface)).drawings.find(item => item.id === 'other').visible, false);
  assert.equal((await eventState(surface)).events.filter(item => item.visible).length, 1);
}
(async () => {
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseUrl).origin });
    context.on('page', p => p.on('pageerror', error => { errors.push(error.message); console.log('BROWSER ERROR:', error.stack); }));
    await context.addInitScript(() => {
      window.__locationViews = [];
      let nativeRequire;
      const wrapped = new WeakMap();
      function observe(require) {
        if (typeof require !== 'function') return require;
        if (wrapped.has(require)) return wrapped.get(require);
        const proxy = new Proxy(require, { apply(target, receiver, args) {
          const deps = args[0], callback = args[1];
          if (Array.isArray(deps) && typeof callback === 'function' && deps.includes('esri/views/MapView')) {
            args[1] = function (...modules) {
              const index = deps.indexOf('esri/views/MapView');
              modules[index] = new Proxy(modules[index], { construct(target, values) {
                const view = Reflect.construct(target, values, target); window.__locationViews.push(view); return view;
              } });
              return callback.apply(this, modules);
            };
          }
          return Reflect.apply(target, receiver, args);
        } });
        wrapped.set(require, proxy); return proxy;
      }
      Object.defineProperty(window, 'require', { configurable: true, get: () => observe(nativeRequire), set: value => { nativeRequire = value; } });
    });
    await context.route('**/api/auth/session', route => route.fulfill({ json: { user: { email: 'locations@example.test' }, expires: '2099-01-01' } }));
    await context.route('**/api/maps/' + id, route => {
      if (route.request().method() === 'POST') { posts.push(route.request().postDataJSON()); data = { ...data, ...posts.at(-1) }; }
      return route.fulfill({ json: data });
    });
    await context.route('https://sharing-fixture.example/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (failFeed && route.request().url() === feeds[0]) return route.fulfill({ status: 503, json: { error: 'Unavailable source' } });
      return route.fulfill({ json: payloads[feeds.indexOf(route.request().url())] });
    });
    const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nV8AAAAASUVORK5CYII=', 'base64');
    await context.route(/https:\/\/[^/]*tile\.openstreetmap\.org\//, route => route.fulfill({ contentType: 'image/png', body: tile }));
    await context.route('https://tiles.flavioherrera.com/**', route => route.fulfill({ contentType: 'image/png', body: tile }));
    page = await context.newPage();
    await page.goto(`${baseUrl}/share/${id}?location=field`, { waitUntil: 'domcontentloaded' });
    await verifyTarget(page, 'field');
    await page.getByRole('tab', { name: 'Events', exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Alerts', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Copy link to Emergency Phone', exact: true }).click();
    await page.getByText('Link copied', { exact: true }).waitFor();
    let copied = new URL(await page.evaluate(() => navigator.clipboard.readText()));
    assert.equal(copied.searchParams.get('location'), 'Emergency Phone');
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await until(async () => new URL(await page.evaluate(() => navigator.clipboard.readText())).searchParams.get('location') === 'Recreation Field', 'popup shares a location name');
    pass('Old item-ID URLs still select the polygon; sidebar and popup share readable names');

    await page.getByRole('tab', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Hide all', exact: true }).click();
    assert.equal((await snapshot(page)).drawings.find(item => item.id === 'field').visible, false);
    assert.equal((await snapshot(page)).drawings.find(item => item.id === 'pinned').visible, true);
    await page.getByRole('button', { name: 'Show all', exact: true }).click();
    await page.getByRole('tab', { name: 'Events', exact: true }).click();
    await page.getByRole('button', { name: 'Campus Showcase', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Show all', exact: true }).click();
    assert.equal((await eventState(page)).events.filter(item => item.source === feeds[0] && item.visible).length, 2);
    assert.equal((await eventState(page)).events.find(item => item.source === feeds[1]).visible, false);
    await page.getByRole('button', { name: 'Hide all', exact: true }).click();
    await page.getByRole('button', { name: 'Calendar filters' }).click();
    await page.getByRole('radio', { name: 'Single day', exact: true }).check();
    await page.getByRole('radio', { name: 'Show all', exact: true }).check();
    assert.equal((await eventState(page)).events.filter(item => item.source === feeds[0] && item.visible).length, 0);
    await page.getByRole('button', { name: 'Calendar filters' }).click();
    pass('Dynamic API tabs group source records; bulk controls respect tab scope, admin pins, and calendar filters');

    await page.getByRole('button', { name: 'Campus Showcase', exact: true }).click();
    await page.getByText('Event details from the API', { exact: true }).waitFor();
    assert.equal(await page.getByText('Building: Recreation Field', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Details for Recreation Field', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await until(async () => new URL(await page.evaluate(() => navigator.clipboard.readText())).searchParams.get('event') === 'page-alpha', 'event popup share');
    const eventUrl = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(new URL(eventUrl).searchParams.has('location'), false);
    assert.ok(new URL(eventUrl).searchParams.get('source'));
    await page.goto(eventUrl, { waitUntil: 'domcontentloaded' });
    await sharedEvent(page, 'Campus Showcase', 'Recreation Field');
    assert.equal(await page.getByRole('tab', { name: 'Events', exact: true }).getAttribute('aria-selected'), 'true');
    await page.screenshot({ path: path.join(output, 'shared-api-event.png') });
    await page.getByRole('tab', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Open Campus', exact: true }).click();
    await page.getByRole('button', { name: 'Open Fields', exact: true }).click();
    await page.getByRole('listitem', { name: 'Go to Recreation Field', exact: true }).click();
    await page.getByText('Details for Recreation Field', { exact: true }).waitFor();
    assert.equal(await page.getByText('Event details from the API', { exact: true }).count(), 0);
    pass('Event clicks show event details only; selecting the building opens its own popup content');
    await page.getByRole('tab', { name: 'Alerts', exact: true }).click();
    await page.getByRole('button', { name: 'Copy link to Campus Notice', exact: true }).click();
    await until(async () => new URL(await page.evaluate(() => navigator.clipboard.readText())).searchParams.get('source') !== new URL(eventUrl).searchParams.get('source'), 'source disambiguation');
    const noticeUrl = await page.evaluate(() => navigator.clipboard.readText());
    await page.goto(noticeUrl, { waitUntil: 'domcontentloaded' });
    await sharedEvent(page, 'Campus Notice', 'Other Field');
    pass('Event links preserve location mapping and separate popup content while disambiguating duplicate IDs across sources');

    await page.goto(`${baseUrl}/api-sharing-verification-fixture?location=RF`, { waitUntil: 'domcontentloaded' });
    await verifyTarget(page, 'field');
    await page.evaluate(() => { window.initialSettingsView = window.__locationViews.at(-1); });
    await page.getByRole('button', { name: 'Map settings', exact: true }).click();
    await page.getByLabel('Tab name 2', { exact: true }).fill('Notices');
    await page.getByRole('button', { name: 'Apply All Edits', exact: true }).click();
    await page.getByRole('tab', { name: 'Notices', exact: true }).waitFor();
    await until(() => posts.some(post => post.settings.apiSourceTabs?.some(source => source.tabName === 'Notices')), 'saved source tab');
    assert.equal(await page.evaluate(() => window.initialSettingsView === window.__locationViews.at(-1)), true);
    await page.getByRole('button', { name: 'Edit Other', exact: true }).click();
    await page.getByRole('dialog', { name: 'Edit Category' }).getByRole('button', { name: 'Save', exact: true }).click();
    await until(() => posts.at(-1).settings.apiSourceTabs?.some(source => source.tabName === 'Notices'), 'unrelated saves preserve source tabs');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Notices', exact: true }).waitFor();
    pass('Tab-name settings apply live on the same map and survive category saves and reloads');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/api-sharing-verification-fixture?iframe=true`, { waitUntil: 'domcontentloaded' });
    await until(() => page.frames().some(frame => frame.url().includes('/share/' + id)), 'event iframe');
    const embedded = page.frames().find(frame => frame.url().includes('/share/' + id));
    await embedded.goto(eventUrl, { waitUntil: 'domcontentloaded' });
    await sharedEvent(embedded, 'Campus Showcase', 'Recreation Field');
    await page.screenshot({ path: path.join(output, 'shared-api-event-mobile.png') });
    pass('Mobile iframe opens the shared event with its building and dynamic sidebar tab');
    await page.goto(`${baseUrl}/share/${id}?event=missing-record`, { waitUntil: 'domcontentloaded' });
    await page.getByText('This shared event is no longer available.', { exact: true }).waitFor();
    failFeed = true;
    await page.goto(eventUrl, { waitUntil: 'domcontentloaded' });
    await page.getByText("Could not load the shared event's API source. Please try reloading.", { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    pass('Unavailable records and failed API sources show clear feedback with no uncaught browser errors');
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    throw error;
  } finally {
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checked, errors, posts }, null, 2));
    if (browser) await browser.close();
    fs.rmSync(fixtureDir, { recursive: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
