// Run against the dev server with the real ArcGIS SDK and fixture map/API responses.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const fixtureDir = path.join(root, 'src/app/location-verification-fixture');
const output = path.join(root, 'tools/location-verification');
const baseUrl = process.env.VERIFY_BASE_URL || 'http://localhost:3000';
const id = '555555555555555555555555';
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
(async () => {
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true });
    context.on('page', p => p.on('pageerror', error => errors.push(error.message)));
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
      if (route.request().method() === 'POST') data = { ...data, ...route.request().postDataJSON() };
      return route.fulfill({ json: data });
    });
    const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nV8AAAAASUVORK5CYII=', 'base64');
    await context.route(/https:\/\/[^/]*tile\.openstreetmap\.org\//, route => route.fulfill({ contentType: 'image/png', body: tile }));
    await context.route('https://tiles.flavioherrera.com/**', route => route.fulfill({ contentType: 'image/png', body: tile }));
    page = await context.newPage();
    await page.goto(`${baseUrl}/share/${id}?location=%20rF%20`, { waitUntil: 'domcontentloaded' });
    await verifyTarget(page, 'field');
    assert.equal((await snapshot(page)).drawings.find(item => item.id === 'sibling').visible, false);
    assert.equal((await snapshot(page)).drawings.some(item => item.id === 'hidden-item'), false);
    assert.equal(await page.getByRole('button', { name: 'Emergency Phone always remains visible' }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Paths always remains visible' }).isDisabled(), true);
    await page.screenshot({ path: path.join(output, 'shared-location-desktop.png') });
    pass('Shared URL resolves alias, zooms, selects polygon, docks popup, presets navigation and preserves locked pins');

    await page.getByRole('button', { name: 'Open Campus', exact: true }).click();
    await page.getByRole('button', { name: 'Open Fields', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Hide Recreation Field', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('button', { name: 'Show Other Field', exact: true }).getAttribute('aria-pressed'), 'false');
    await page.evaluate(() => { window.initialLocationView = window.__locationViews.at(-1); history.pushState(null, '', '?location=Other%20Field'); });
    await verifyTarget(page, 'sibling', 'University Lot');
    assert.equal(await page.evaluate(() => window.initialLocationView === window.__locationViews.at(-1)), true);
    await page.evaluate(() => history.pushState(null, '', location.pathname));
    await until(async () => (await snapshot(page)).drawings.every(item => item.visible), 'query removal resets visibility');
    await page.evaluate(() => history.pushState(null, '', '?location=Absolutely%20Unknown%20Place'));
    await until(async () => (await snapshot(page)).drawings.every(item => item.visible), 'invalid location preserves normal map');
    pass('Client URL changes reuse the same map; nested sidebar switches reflect focus; clearing/invalid queries restore normal visibility');

    await page.goto(`${baseUrl}/location-verification-fixture?location=RF`, { waitUntil: 'domcontentloaded' });
    await verifyTarget(page, 'field');
    await page.getByRole('button', { name: 'Edit Other', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Edit Category' });
    await until(async () => await dialog.getByLabel('Name', { exact: true }).inputValue() === 'Other', 'category draft');
    await dialog.getByLabel('Always remain visible', { exact: true }).check();
    assert.equal(await dialog.getByLabel('Visible to users', { exact: true }).isDisabled(), true);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await until(() => data.categories.find(category => category.id === 'other-category').alwaysVisible === true, 'saved category flag');
    assert.equal((await snapshot(page)).drawings.find(item => item.id === 'other').visible, true);
    await page.getByRole('button', { name: 'Edit Emergency Phone', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Edit polygon' });
    await until(async () => await dialog.getByLabel('Name', { exact: true }).inputValue() === 'Emergency Phone', 'item draft');
    assert.equal(await dialog.getByLabel('Always remain visible', { exact: true }).isChecked(), true);
    assert.equal(await dialog.getByLabel('Visible to users', { exact: true }).isDisabled(), true);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await until(() => data.polygons.find(item => item.attributes.id === 'pinned').attributes.alwaysVisible === true, 'saved item flag');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await until(async () => (await snapshot(page)).selected === 'field', 'reloaded location target');
    assert.equal((await snapshot(page)).drawings.find(item => item.id === 'other').visible, true);
    pass('Admin category/item controls lock visibility; saves and reloads preserve flags and override URL filtering');

    // Return the fixture to its original category flags for the mobile iframe check.
    data.categories.find(category => category.id === 'other-category').alwaysVisible = false;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/location-verification-fixture?iframe=true`, { waitUntil: 'domcontentloaded' });
    await until(() => page.frames().some(frame => frame.url().includes('/share/' + id)), 'shared iframe');
    const embedded = page.frames().find(frame => frame.url().includes('/share/' + id));
    await verifyTarget(embedded, 'field');
    await page.screenshot({ path: path.join(output, 'shared-location-mobile-iframe.png') });
    pass('Mobile iframe supports the same query target, pinned visibility, docked popup and destination');
    assert.deepEqual(errors, []);
    pass('No uncaught browser errors');
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    throw error;
  } finally {
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checked, errors }, null, 2));
    if (browser) await browser.close();
    fs.rmSync(fixtureDir, { recursive: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
