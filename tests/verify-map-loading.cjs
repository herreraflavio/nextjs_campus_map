const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const fixtureDir = path.join(root, 'src/app/loading-verification-fixture');
const output = path.join(root, 'tools/loading-verification');
const baseUrl = process.env.VERIFY_BASE_URL || 'http://localhost:3000';
const ids = ['111111111111111111111111', '222222222222222222222222', '333333333333333333333333'];
if (fs.existsSync(fixtureDir)) throw new Error('Verification fixture already exists');
fs.mkdirSync(fixtureDir);
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(fixtureDir, 'page.tsx'), `"use client";
import { useEffect, useState } from "react";
import { SessionProvider } from "next-auth/react";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { useSearchParams, useServerInsertedHTML } from "next/navigation";
import LoggedInDashboard from "@/app/components/LoggedInDashboard";
import { MapProvider } from "@/app/context/MapContext";
import { MapViewRef, settingsRef, finalizedLayerRef, editingLayerRef } from "@/app/components/map/arcgisRefs";
export default function Verify() {
  const query = useSearchParams();
  const [id, setId] = useState("${ids[0]}");
  // Insert fixture Emotion styles into the head, where the App Router expects
  // them, rather than letting cache hydration move inline nodes out of the body.
  const [{ cache, flush }] = useState(() => {
    const cache = createCache({ key: "loading-fixture" });
    cache.compat = true;
    const previousInsert = cache.insert;
    let names: string[] = [];
    cache.insert = (...args) => {
      const serialized = args[1];
      if (cache.inserted[serialized.name] === undefined) names.push(serialized.name);
      return previousInsert(...args);
    };
    return { cache, flush: () => { const result = names; names = []; return result; } };
  });
  useServerInsertedHTML(() => {
    const names = flush();
    if (!names.length) return null;
    const styles = names.map(name => cache.inserted[name]).join("");
    return <style data-emotion={cache.key + " " + names.join(" ")} dangerouslySetInnerHTML={{ __html: styles }} />;
  });
  useEffect(() => { Object.assign(window, { verifyMapView: MapViewRef, verifySettings: settingsRef, verifyDrawings: finalizedLayerRef, verifyEditing: editingLayerRef, switchVerifyMap: setId }); }, []);
  const session = { user: { email: "verify@example.test" }, expires: "2099-01-01" };
  if (query.get("iframe")) return <iframe title="Shared map" src="/share/${ids[0]}" style={{ width: "100%", height: "100vh", border: 0 }} />;
  return <CacheProvider value={cache}><SessionProvider session={session}><MapProvider mapId={id}><LoggedInDashboard user={session.user} canEdit /></MapProvider></SessionProvider></CacheProvider>;
}`);

const checked = [], errors = [], consoleErrors = [], failedResponses = [], posts = [];
const gates = new Map();
let optionalRequested, releaseOptional, optionalPending = true;
const optionalGate = new Promise(resolve => { releaseOptional = resolve; });
let browser, page;
const data = index => ({
  polygons: [{ attributes: { id: 'saved-point', name: 'Saved point', description: 'Saved drawing', categoryId: 'campus' },
    geometry: { type: 'point', x: -120.422045, y: 37.368169, spatialReference: { wkid: 4326, latestWkid: 4326 } },
    symbol: { type: 'simple-marker', color: [255, 0, 0, 255], size: 12, outline: { color: [255, 255, 255, 255], width: 1 } } }],
  labels: [], events: [], categories: [{ id: 'campus', name: 'Campus', order: 0 }],
  settings: { zoom: 15, center: [-120.422045 + index * 0.001, 37.368169], constraints: null,
    featureLayers: index === 0 ? [{ url: 'https://optional.example/FeatureServer/0', outFields: ['*'] }] : [],
    mapTile: null, baseMap: 'osm', apiSources: [],
    topBar: { logoUrl: null, backgroundColor: index === 1 ? '#abcdef' : '#123456' } },
});
function hold(id) {
  let release, requested;
  const wait = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { requested = resolve; });
  gates.set(id, { wait, release, requested, started });
  return gates.get(id);
}
function pass(name) { checked.push(name); console.log('PASS:', name); }
async function until(fn, label, timeout = 90000) {
  const start = Date.now();
  while (!await fn()) {
    if (Date.now() - start > timeout) throw new Error('Timed out: ' + label);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
async function ready(surface) {
  await surface.locator('[data-map-loading="false"]').waitFor({ timeout: 90000 });
  assert.equal(await surface.getByRole('status').filter({ hasText: 'Loading map data...' }).count(), 0);
  assert.equal(await surface.locator('[data-map-content]').evaluate(el => getComputedStyle(el).opacity), '1');
  // Let the per-frame observer sample the newly committed visible state.
  await surface.locator('[data-map-content]').evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve(null))));
}
async function loading(surface) {
  await surface.locator('[data-map-loading="true"]').waitFor();
  assert.equal(await surface.getByRole('status').filter({ hasText: 'Loading map data...' }).count(), 0);
  assert.equal(await surface.locator('[data-map-content]').evaluate(el => getComputedStyle(el).opacity), '1');
  assert.equal(await surface.locator('[data-map-content]').evaluate(el => el.hasAttribute('inert') || el.getAttribute('aria-hidden') === 'true'), false);
}
async function savedReady(surface, mapId) {
  // A reused map ID can have older completed marks. Scope this check to its
  // latest load so switching/reopening cannot accidentally inspect old data.
  await until(() => surface.locator('[data-map-content]').evaluate((_, id) => {
    const marks = performance.getEntriesByType('mark');
    const latest = marks.filter(mark => mark.name.startsWith('logit-map:' + id + ':') && mark.name.endsWith(':start')).at(-1);
    return Boolean(latest && marks.some(mark => mark.name === latest.name.slice(0, -'start'.length) + 'saved-data-ready'));
  }, mapId), 'saved graphics hydration for ' + mapId);
}
async function assertSamples(surface) {
  assert.deepEqual(await surface.locator('[data-map-content]').evaluate(() => window.loadingSamples), [
    { loading: 'true', opacity: '1' }, { loading: 'false', opacity: '1' },
  ]);
}

(async () => {
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true });
    context.on('page', surface => surface.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    }));
    context.on('response', response => {
      if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url().split('?')[0] });
    });
    // Observe every rendered frame, including before React effects run.
    await context.addInitScript(() => {
      window.loadingSamples = [];
      const sample = () => {
        const el = document.querySelector('[data-map-loading]');
        if (el) {
          const loading = el.dataset.mapLoading;
          const opacity = getComputedStyle(el.querySelector('[data-map-content]')).opacity;
          const last = window.loadingSamples.at(-1);
          if (!last || last.loading !== loading || last.opacity !== opacity) window.loadingSamples.push({ loading, opacity });
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await context.route('**/api/auth/session', route => route.fulfill({ json: { user: { email: 'verify@example.test' }, expires: '2099-01-01' } }));
    await context.route('**/api/maps/*', async route => {
      const id = route.request().url().split('/').at(-1);
      if (route.request().method() === 'POST') posts.push(route.request().postDataJSON());
      const gate = gates.get(id);
      if (gate) { gate.requested(); await gate.wait; }
      if (id === ids[2]) return route.fulfill({ status: 403, json: { error: 'Permission denied' } });
      await route.fulfill({ json: data(ids.indexOf(id)) }).catch(() => {}); // An old map request can be aborted during switching.
    });
    await context.route('https://optional.example/**', async route => {
      optionalRequested = true;
      if (optionalPending) await optionalGate;
      await route.fulfill({ json: { error: { code: 404, message: 'Optional layer unavailable', details: [] } } });
    });
    page = await context.newPage();
    page.on('pageerror', error => { errors.push(error.message); console.log('BROWSER ERROR:', error.stack); });
    const first = hold(ids[0]);
    const response = await page.goto(baseUrl + '/loading-verification-fixture', { waitUntil: 'domcontentloaded' });
    assert.ok(!(await response.text()).includes('Loading map data...'));
    await first.started;
    await loading(page);
    assert.equal(await page.evaluate(() => Boolean(window.verifyMapView?.current)), false);
    await page.locator('header[aria-label="Map top bar"]').waitFor();
    await page.screenshot({ path: path.join(output, 'builder-loading.png') });
    pass('First server/client render keeps basic UI available without a global loader; no default MapView starts before saved configuration');

    first.release(); gates.delete(ids[0]);
    await until(() => page.evaluate(() => Boolean(window.verifyMapView?.current?.ready)), 'SDK readiness');
    await until(() => Boolean(optionalRequested && releaseOptional), 'optional layer request');
    await ready(page);
    await page.evaluate(() => { window.initialView = window.verifyMapView.current; });
    assert.equal(await page.locator('header[aria-label="Map top bar"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(18, 52, 86)');
    await savedReady(page, ids[0]);
    assert.equal(await page.evaluate(() => window.verifyDrawings.current.graphics.length), 1);
    assert.equal(optionalPending, true);
    pass('SDK-ready map and saved graphics are visible while the optional network layer remains pending; header configuration hydrates promptly');
    optionalPending = false; releaseOptional();
    await until(() => page.evaluate(() => window.verifyMapView.current.map.findLayerById('feature:0')?.loadStatus === 'failed'), 'optional layer failure');
    await ready(page);
    assert.equal(await page.evaluate(() => window.initialView === window.verifyMapView.current), true);
    assert.equal(await page.evaluate(() => window.verifyDrawings.current.graphics.length), 1);
    await assertSamples(page);
    await page.screenshot({ path: path.join(output, 'builder-ready.png') });
    pass('Optional layer failure preserves the same visible MapView without hiding or duplicating saved graphics');

    await page.evaluate(async () => { await window.verifyMapView.current.goTo({ zoom: 16 }, { animate: false }); });
    await ready(page);
    assert.equal(await page.evaluate(() => window.initialView === window.verifyMapView.current), true);
    assert.equal(await page.evaluate(() => window.loadingSamples.length), 2);
    pass('Background zoom/layer updates keep the map visible without another initial loading transition');

    await page.getByRole('button', { name: 'Start Drawing', exact: true }).click();
    await page.getByRole('button', { name: 'Stop Drawing', exact: true }).waitFor({ timeout: 60000 });
    assert.equal(await page.evaluate(() => window.verifyDrawings.current.graphics.length), 0);
    assert.equal(await page.evaluate(() => window.verifyEditing.current.graphics.length), 1);
    await page.getByRole('button', { name: 'Stop Drawing', exact: true }).click();
    await page.getByRole('button', { name: 'Start Drawing', exact: true }).waitFor();
    await until(() => posts.length > 0, 'drawing autosave');
    assert.equal(posts.at(-1).polygons.length, 1);
    assert.equal(posts.at(-1).polygons[0].attributes.id, 'saved-point');
    assert.equal(await page.evaluate(() => window.initialView === window.verifyMapView.current), true);
    pass('Drawing controls and autosave preserve all hydrated graphics on the same MapView');

    await page.reload();
    await ready(page);
    await savedReady(page, ids[0]);
    assert.equal(await page.locator('header[aria-label="Map top bar"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(18, 52, 86)');
    assert.equal(await page.evaluate(() => window.verifyDrawings.current.graphics.length), 1);
    await assertSamples(page);
    pass('Refresh restores saved map/header with one SDK readiness transition and no opacity mask');

    const second = hold(ids[1]);
    await page.evaluate(id => window.switchVerifyMap(id), ids[1]);
    await second.started;
    await loading(page);
    assert.equal(await page.evaluate(() => Boolean(window.verifyMapView.current)), false);
    second.release(); gates.delete(ids[1]);
    await ready(page);
    await savedReady(page, ids[1]);
    assert.equal(await page.locator('header[aria-label="Map top bar"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(171, 205, 239)');
    assert.equal(await page.evaluate(() => window.verifyDrawings.current.graphics.length), 1);
    pass('Switching maps disposes the old view and initializes the next saved configuration without a blocking overlay');

    const stale = hold(ids[0]);
    await page.evaluate(id => window.switchVerifyMap(id), ids[0]);
    await stale.started;
    await loading(page);
    await page.evaluate(id => window.switchVerifyMap(id), ids[1]);
    await ready(page);
    await savedReady(page, ids[1]);
    stale.release(); gates.delete(ids[0]);
    assert.equal(await page.evaluate(() => window.verifySettings.current.topBar.backgroundColor), '#abcdef');
    await page.evaluate(id => window.switchVerifyMap(id), ids[0]);
    await ready(page);
    await savedReady(page, ids[0]);
    assert.equal(await page.evaluate(() => window.verifySettings.current.topBar.backgroundColor), '#123456');
    assert.equal(await page.evaluate(() => window.verifyDrawings.current.graphics.length), 1);
    pass('Rapid switches ignore stale fetch results; reopening a saved map restores its own header and layers');

    await page.evaluate(id => window.switchVerifyMap(id), ids[2]);
    await page.getByRole('alert').filter({ hasText: 'Failed to load map data' }).waitFor();
    assert.equal(await page.getByRole('status').filter({ hasText: 'Loading map data...' }).count(), 0);
    await page.evaluate(id => window.switchVerifyMap(id), ids[1]);
    await ready(page);
    await savedReady(page, ids[1]);
    pass('Fatal configuration errors display existing error UI without a loader; selecting another map recovers normally');

    const embed = await context.newPage();
    embed.on('pageerror', error => errors.push(error.message));
    const embedded = hold(ids[0]);
    await embed.goto(baseUrl + '/loading-verification-fixture?iframe=true');
    const frame = embed.frameLocator('iframe[title="Shared map"]');
    await embedded.started;
    await loading(frame);
    embedded.release(); gates.delete(ids[0]);
    await ready(frame);
    await savedReady(frame, ids[0]);
    assert.equal(await frame.locator('.MuiAppBar-root').count(), 0);
    assert.equal(await frame.getByRole('button', { name: 'Edit Map Top Bar', exact: true }).count(), 0);
    assert.equal(await frame.locator('header[aria-label="Map top bar"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(18, 52, 86)');
    const iframe = embed.frames().find(frame => frame.url().includes('/share/'));
    await assertSamples(frame);
    await embed.screenshot({ path: path.join(output, 'iframe-ready.png') });
    await iframe.goto(baseUrl + '/share/' + ids[0]);
    await ready(frame);
    await savedReady(frame, ids[0]);
    await assertSamples(frame);
    pass('Actual share route inside iframe renders progressively with the saved header and no builder controls; iframe refresh works');
    assert.deepEqual(errors, []);
    pass('No unhandled browser/iframe errors');
    const unexpectedConsoleErrors = consoleErrors.filter(message =>
      !message.includes("id: 'feature:0'") &&
      !message.includes("id:'feature:0'") &&
      !message.includes('Failed to load resource: the server responded with a status of 403') &&
      !message.includes('[esri.Basemap] #load() Failed to load basemap') &&
      !message.includes('HTTP 403: Permission denied')
    );
    assert.deepEqual(unexpectedConsoleErrors, []);
    // Retain third-party HTTP failures separately from intentionally failed fixtures.
    const externalFailures = failedResponses.filter(response => !response.url.startsWith(baseUrl));
    if (externalFailures.length) console.log('NOTE: External map services returned HTTP failures; see results.json. Failed resources did not block readiness.');
    pass('Console output contains only tested failures or external resource failures');
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checked, errors, consoleErrors, failedResponses }, null, 2));
  } catch (error) {
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checked, errors, consoleErrors, failedResponses, failure: String(error) }, null, 2));
    if (page) {
      console.log(await page.evaluate(() => ({ text: document.body.innerText.slice(0, 1200), samples: window.loadingSamples, ready: window.verifyMapView?.current?.ready, updating: window.verifyMapView?.current?.updating })));
      await page.screenshot({ path: path.join(output, 'failure.png') });
    }
    throw error;
  } finally {
    for (const gate of gates.values()) gate.release();
    releaseOptional?.();
    if (browser) await browser.close();
    fs.unlinkSync(path.join(fixtureDir, 'page.tsx'));
    fs.rmdirSync(fixtureDir);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
