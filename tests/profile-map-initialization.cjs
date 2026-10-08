/** Real ArcGIS progressive initialization profile. Run against an existing dev
 * server. --baseline records the earlier readiness barrier without expecting
 * progressive results; the default run verifies the optimized implementation.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const fixtureDir = path.join(root, 'src/app/initial-profile-fixture');
const fixtureFile = path.join(fixtureDir, 'page.tsx');
const outputDir = path.join(root, 'tools/initial-loading-profile');
const mode = process.argv.includes('--baseline') ? 'baseline' : 'optimized';
const baseUrl = process.env.VERIFY_BASE_URL || 'http://localhost:3000';
const mapId = '444444444444444444444444';
const optionalUrl = 'https://initial-profile.example/FeatureServer/0';
const eventUrls = ['https://initial-profile.example/events-fast', 'https://initial-profile.example/events-slow'];
const stallMs = 3000; // A controlled network stall, never an application timer.
const polygonCount = 600;
const savedEventCount = 24;
const checked = [], profiles = [], errors = [], consoleErrors = [], network = [];
let browser, currentPage, scenario = 'setup';

if (fs.existsSync(fixtureDir)) throw new Error('Profiling fixture already exists');
fs.mkdirSync(fixtureDir);
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(fixtureFile, `"use client";
import { useEffect, useState } from "react";
import { SessionProvider } from "next-auth/react";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { useSearchParams, useServerInsertedHTML } from "next/navigation";
import LoggedInDashboard from "@/app/components/LoggedInDashboard";
import { MapProvider } from "@/app/context/MapContext";
import { MapViewRef, settingsRef, finalizedLayerRef } from "@/app/components/map/arcgisRefs";
export default function ProfileMap() {
  const query = useSearchParams();
  const [{ cache, flush }] = useState(() => {
    const cache = createCache({ key: "initial-profile" }); cache.compat = true;
    const previousInsert = cache.insert; let names: string[] = [];
    cache.insert = (...args) => { const serialized = args[1]; if (cache.inserted[serialized.name] === undefined) names.push(serialized.name); return previousInsert(...args); };
    return { cache, flush: () => { const result = names; names = []; return result; } };
  });
  useServerInsertedHTML(() => { const names = flush(); if (!names.length) return null; return <style data-emotion={cache.key + " " + names.join(" ")} dangerouslySetInnerHTML={{ __html: names.map(name => cache.inserted[name]).join("") }} />; });
  useEffect(() => { Object.assign(window, { verifyMapView: MapViewRef, verifySettings: settingsRef, verifyDrawings: finalizedLayerRef }); }, []);
  const session = { user: { email: "profile@example.test" }, expires: "2099-01-01" };
  if (query.get("iframe")) return <iframe title="Published map" src="/share/${mapId}" style={{ width: "100%", height: "100vh", border: 0, display: "block" }} />;
  return <CacheProvider value={cache}><SessionProvider session={session}><MapProvider mapId="${mapId}"><LoggedInDashboard user={session.user} canEdit /></MapProvider></SessionProvider></CacheProvider>;
}`);

const sr = { wkid: 4326, latestWkid: 4326 };
const polygons = Array.from({ length: polygonCount }, (_, index) => {
  const x = -120.424 + (index % 30) * 0.00012;
  const y = 37.367 + Math.floor(index / 30) * 0.00012;
  return {
    attributes: { id: `building-${index}`, name: `Building ${index + 1}`, description: `Profile building ${index + 1}`, categoryId: 'campus', order: index },
    geometry: { type: 'polygon', rings: [[[x, y], [x + 0.00008, y], [x + 0.00008, y + 0.00008], [x, y + 0.00008], [x, y]]], spatialReference: sr },
    symbol: { type: 'simple-fill', color: [25, 120, 180, 180], outline: { color: [0, 40, 86, 255], width: 1 } },
  };
});
const labels = polygons.map((drawing, index) => ({
  attributes: { parentId: drawing.attributes.id, text: `Building ${index + 1}`, fontSize: 9, color: [0, 0, 0, 1], haloColor: [255, 255, 255, 1], haloSize: 1, showAtZoom: 16, hideAtZoom: 23 },
  geometry: { type: 'point', x: drawing.geometry.rings[0][0][0] + 0.00004, y: drawing.geometry.rings[0][0][1] + 0.00004, spatialReference: sr },
}));
const events = Array.from({ length: savedEventCount }, (_, index) => ({
  attributes: { id: `saved-event-${index}`, event_name: `Saved event ${index + 1}`, description: 'Persisted event', date: '2026-10-08', startAt: '09:00', endAt: '17:00', fromUser: true, iconSize: 24, iconUrl: '/icons/event-pin.png' },
  geometry: { type: 'point', x: -120.423 + (index % 8) * 0.00025, y: 37.368 + Math.floor(index / 8) * 0.00025, spatialReference: sr },
}));
const mapData = {
  polygons, labels, events,
  categories: [{ id: 'campus', name: 'Campus', parentId: null, order: 0 }],
  settings: { zoom: 16, center: [-120.422045, 37.368169], constraints: null,
    featureLayers: [{ url: optionalUrl, outFields: ['*'], popupEnabled: true }],
    mapTile: null, baseMap: 'osm', apiSources: eventUrls,
    topBar: { logoUrl: null, backgroundColor: '#235789' } },
};

function pass(name) { checked.push(name); console.log('PASS:', name); }
function resourcePath(value) { try { const url = new URL(value); return url.origin + url.pathname; } catch { return String(value).split(/[?#]/)[0]; } }
async function until(fn, name, timeout = 90000) {
  const start = Date.now();
  while (!await fn()) { if (Date.now() - start > timeout) throw new Error('Timed out: ' + name); await new Promise(resolve => setTimeout(resolve, 40)); }
}
async function entries(surface) {
  return surface.evaluate(() => performance.getEntries().filter(entry => entry.name.startsWith('logit-map:')).map(entry => ({ name: entry.name, type: entry.entryType, start: entry.startTime, duration: entry.duration, epoch: performance.timeOrigin + entry.startTime })));
}
async function hasPhase(surface, phase) {
  return (await entries(surface)).some(entry => entry.name.endsWith(':' + phase) && entry.type === 'mark');
}
async function snapshot(surface) {
  return surface.evaluate(() => {
    const view = window.__profileViews?.at(-1);
    const layers = view?.map?.layers?.toArray() || [];
    const get = id => layers.find(layer => layer.id === id)?.graphics?.toArray() || [];
    const drawings = get('finalized'), events = get('events-layer'), labels = get('labels');
    const content = document.querySelector('[data-map-content]');
    return { ready: Boolean(view?.ready), visible: Boolean(content) && getComputedStyle(content).opacity === '1' && !content.inert,
      viewCount: window.__profileViews?.length || 0, drawings: drawings.length, labels: labels.length,
      eventIds: events.map(graphic => graphic.attributes?.id), drawingIds: drawings.map(graphic => graphic.attributes?.id),
      samples: window.__profileSamples, fastEventAt: window.__profileFastEventAt, slowEventAt: window.__profileSlowEventAt,
      zoom: view?.zoom, layerIds: layers.map(layer => layer.id) };
  });
}

async function profile(surface, name, parentPage) {
  await surface.locator('header[aria-label="Map top bar"]').waitFor({ timeout: 90000 });
  await until(() => hasPhase(surface, 'view-ready'), name + ': native view ready');
  const atViewReady = await snapshot(surface);
  await until(() => hasPhase(surface, 'map-visible'), name + ': map visible');
  const atMapVisible = await snapshot(surface);
  const visibleMark = (await entries(surface)).find(entry => entry.type === 'mark' && entry.name.endsWith(':map-visible'));
  const optional = network.find(request => request.scenario === name && request.kind === 'optional');
  await until(() => hasPhase(surface, 'saved-data-ready'), name + ': saved data hydrated');
  if (mode !== 'baseline') await until(() => hasPhase(surface, 'polygons-rendered'), name + ': saved polygons drawn');
  await until(async () => (await snapshot(surface)).eventIds.includes('dynamic-slow'), name + ': secondary events loaded');
  const state = await snapshot(surface);
  const marks = await entries(surface);
  const fastSource = network.find(request => request.scenario === name && request.kind === 'events-fast');
  const slowSource = network.find(request => request.scenario === name && request.kind === 'events-slow');
  const progressive = { visibleBeforeOptionalSettled: Boolean(optional && visibleMark.epoch < optional.end),
    fastEventsBeforeSlowSettled: Boolean(slowSource && state.fastEventAt < slowSource.end),
    polygonsRenderedBeforeOptionalSettled: marks.find(entry => entry.name.endsWith(':polygons-rendered'))?.epoch < optional?.end,
    basemapBeforeSavedData: marks.find(entry => entry.name.endsWith(':first-basemap-render'))?.epoch < marks.find(entry => entry.name.endsWith(':saved-data-ready'))?.epoch };
  assert.equal(state.drawings, polygonCount);
  assert.equal(state.labels, polygonCount);
  assert.equal(new Set(state.drawingIds).size, polygonCount);
  assert.equal(new Set(state.eventIds).size, state.eventIds.length);
  assert.equal(state.eventIds.filter(id => String(id).startsWith('saved-event-')).length, savedEventCount);
  assert.equal(state.eventIds.filter(id => String(id).startsWith('dynamic-')).length, 2);
  assert.equal(state.viewCount, 1, 'Initial loading must create a single MapView');
  assert.equal(state.visible, true);
  assert.equal(await surface.locator('header[aria-label="Map top bar"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(35, 87, 137)');
  if (mode !== 'baseline') {
    assert.equal(progressive.visibleBeforeOptionalSettled, true, 'The map must become visible while the optional layer is still pending');
    assert.equal(progressive.fastEventsBeforeSlowSettled, true, 'Fast events must render without waiting for a slow event source');
    assert.equal(progressive.polygonsRenderedBeforeOptionalSettled, true, 'Saved polygons must render without waiting for an optional service');
    assert.equal(await surface.getByText('Loading map data...', { exact: true }).count(), 0);
  }
  await surface.evaluate(async () => { const view = window.__profileViews.at(-1); window.__profileInitialView = view; await view.goTo({ zoom: 17 }, { animate: false }); });
  assert.equal(await surface.evaluate(() => window.__profileInitialView === window.__profileViews.at(-1)), true);
  assert.equal((await snapshot(surface)).visible, true);
  await surface.getByRole('button', { name: 'Open Campus', exact: true }).click();
  await surface.getByRole('listitem', { name: 'Go to Building 1', exact: true }).waitFor();
  await surface.getByRole('button', { name: 'Hide Building 1', exact: true }).click();
  assert.equal(await surface.evaluate(() => window.__profileViews.at(-1).map.findLayerById('finalized').graphics.find(graphic => graphic.attributes.id === 'building-0').visible), false);
  await surface.getByRole('button', { name: 'Show Building 1', exact: true }).click();
  assert.equal(await surface.evaluate(() => window.__profileViews.at(-1).map.findLayerById('finalized').graphics.find(graphic => graphic.attributes.id === 'building-0').visible), true);
  await surface.getByRole('listitem', { name: 'Go to Building 1', exact: true }).click();
  await until(() => surface.evaluate(() => window.__profileViews.at(-1).popup?.selectedFeature?.attributes?.id === 'building-0'), name + ': drawing popup');
  await surface.evaluate(() => window.__profileViews.at(-1).popup.close());
  assert.equal(await surface.evaluate(() => window.__profileInitialView === window.__profileViews.at(-1)), true);
  const resources = await surface.evaluate(() => performance.getEntriesByType('resource').filter(entry => /js\.arcgis\.com|api\/maps\/|initial-profile\.example|tile\.openstreetmap\.org|tiles\.flavioherrera\.com/.test(entry.name)).map(entry => {
    const url = new URL(entry.name);
    return { name: url.origin + url.pathname, start: entry.startTime, duration: entry.duration, initiatorType: entry.initiatorType };
  }));
  await parentPage.screenshot({ path: path.join(outputDir, `${mode}-${name}.png`) });
  profiles.push({ scenario: name, atViewReady, atMapVisible, final: state, progressive, entries: marks,
    resources, network: { optional, fastSource, slowSource } });
  pass(`${name}: ${polygonCount} polygons/labels and ${savedEventCount + 2} distinct events remain interactive in one MapView`);
  if (mode !== 'baseline') pass(`${name}: usable map precedes optional layer; fast event source renders independently`);
}

(async () => {
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true });
    context.on('page', page => { page.on('pageerror', error => errors.push({ scenario, message: error.message })); page.on('console', message => { if (message.type() === 'error') consoleErrors.push({ scenario, message: message.text() }); }); });
    await context.addInitScript(() => {
      window.__profileViews = []; window.__profileSamples = [];
      // Observe actual builder AND share-route MapView instances. AMD modules,
      // widgets and network behavior remain the real ArcGIS implementations.
      let originalRequire;
      const wrapped = new WeakMap();
      function observeRequire(require) {
        if (typeof require !== 'function') return require;
        if (wrapped.has(require)) return wrapped.get(require);
        const proxy = new Proxy(require, { apply(target, receiver, args) {
          const deps = args[0]; const callback = args[1];
          if (Array.isArray(deps) && typeof callback === 'function' && deps.includes('esri/views/MapView')) {
            const index = deps.indexOf('esri/views/MapView');
            args[1] = function (...modules) {
              const NativeMapView = modules[index];
              modules[index] = new Proxy(NativeMapView, { construct(target, values) { const view = Reflect.construct(target, values, target); window.__profileViews.push(view); return view; } });
              return callback.apply(this, modules);
            };
          }
          return Reflect.apply(target, receiver, args);
        } });
        wrapped.set(require, proxy); return proxy;
      }
      Object.defineProperty(window, 'require', { configurable: true, get: () => observeRequire(originalRequire), set: value => { originalRequire = value; } });
      const sample = () => {
        const view = window.__profileViews.at(-1);
        const content = document.querySelector('[data-map-content]');
        if (content) {
          const visible = getComputedStyle(content).opacity === '1' && !content.inert;
          const last = window.__profileSamples.at(-1);
          if (!last || last.visible !== visible) window.__profileSamples.push({ visible, epoch: performance.timeOrigin + performance.now() });
        }
        const events = view?.map?.findLayerById('events-layer')?.graphics;
        if (!window.__profileFastEventAt && events?.find(graphic => graphic.attributes?.id === 'dynamic-fast')) window.__profileFastEventAt = performance.timeOrigin + performance.now();
        if (!window.__profileSlowEventAt && events?.find(graphic => graphic.attributes?.id === 'dynamic-slow')) window.__profileSlowEventAt = performance.timeOrigin + performance.now();
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await context.route('**/api/auth/session', route => route.fulfill({ json: { user: { email: 'profile@example.test' }, expires: '2099-01-01' } }));
    await context.route('**/api/maps/' + mapId, route => route.fulfill({ json: mapData }));
    await context.route('https://initial-profile.example/**', async route => {
      const url = route.request().url();
      const kind = url.includes('FeatureServer') ? 'optional' : url.includes('events-slow') ? 'events-slow' : 'events-fast';
      const record = { scenario, kind, url: resourcePath(url), start: Date.now() }; network.push(record);
      if (kind !== 'events-fast') await new Promise(resolve => setTimeout(resolve, stallMs));
      record.end = Date.now();
      if (kind === 'optional') return route.fulfill({ json: { error: { code: 404, message: 'Controlled optional resource failure', details: [] } } }).catch(() => {});
      const name = kind === 'events-fast' ? 'fast' : 'slow';
      await route.fulfill({ json: { events: [{ id: 'dynamic-' + name, title: 'Dynamic ' + name, start_dt: '2026-10-08T09:00:00', date: '2026-10-08', start_at: '09:00', end_at: '17:00', lat: 37.368169, lon: -120.422045 }] } }).catch(() => {});
    });
    // Deterministic tiles eliminate external auth and CDN variation while the
    // ArcGIS SDK, layers, MapView, canvas rendering and interactions remain real.
    const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nV8AAAAASUVORK5CYII=', 'base64');
    await context.route(/https:\/\/[^/]*tile\.openstreetmap\.org\//, route => route.fulfill({ contentType: 'image/png', body: tile }));
    await context.route('https://tiles.flavioherrera.com/**', route => route.fulfill({ contentType: 'image/png', body: tile }));

    scenario = 'builder'; currentPage = await context.newPage();
    await currentPage.goto(baseUrl + '/initial-profile-fixture', { waitUntil: 'domcontentloaded' });
    await profile(currentPage, scenario, currentPage);
    scenario = 'builder-refresh'; await currentPage.reload({ waitUntil: 'domcontentloaded' });
    await profile(currentPage, scenario, currentPage);
    await currentPage.close();
    scenario = 'iframe'; currentPage = await context.newPage();
    await currentPage.goto(baseUrl + '/initial-profile-fixture?iframe=true', { waitUntil: 'domcontentloaded' });
    await until(async () => currentPage.frames().some(frame => frame.url().includes('/share/' + mapId)), 'Actual share iframe');
    const embedded = currentPage.frames().find(frame => frame.url().includes('/share/' + mapId));
    await profile(embedded, scenario, currentPage);
    assert.equal(await embedded.locator('.MuiAppBar-root').count(), 0);
    assert.equal(await embedded.getByRole('button', { name: 'Edit Map Top Bar', exact: true }).count(), 0);
    pass('Published iframe renders saved header without builder navbar or editing controls');
    assert.deepEqual(errors, [], 'Unexpected uncaught browser errors');
    const unexpectedConsoleErrors = consoleErrors.filter(entry =>
      !(entry.message.includes('id: \'feature:0\'') || entry.message.includes("id:'feature:0'"))
    );
    assert.deepEqual(unexpectedConsoleErrors, [], 'Unexpected console errors');
    pass('No uncaught errors during initial loading, refresh or published iframe initialization');
  } catch (error) {
    errors.push({ scenario, failure: String(error) });
    if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: path.join(outputDir, `${mode}-failure.png`) }).catch(() => {});
    throw error;
  } finally {
    fs.writeFileSync(path.join(outputDir, `${mode}.json`), JSON.stringify({ mode, stallMs, polygonCount, savedEventCount, checked, profiles, errors, consoleErrors, network }, null, 2));
    if (browser) await browser.close();
    fs.unlinkSync(fixtureFile); fs.rmdirSync(fixtureDir);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
