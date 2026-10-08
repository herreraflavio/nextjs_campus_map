const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const fixtureDir = path.join(root, 'src/app/top-bar-verification-fixture');
const fixtureFile = path.join(fixtureDir, 'page.tsx');
const output = path.join(root, 'tools/top-bar-verification');
fs.mkdirSync(output, { recursive: true });
if (fs.existsSync(fixtureDir)) throw new Error('Verification fixture already exists');
fs.mkdirSync(fixtureDir);
fs.writeFileSync(fixtureFile, `"use client";
import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import LoggedInDashboard from "@/app/components/LoggedInDashboard";
import { MapProvider } from "@/app/context/MapContext";
import { MapViewRef, settingsRef } from "@/app/components/map/arcgisRefs";
export default function Verify() {
  const query = useSearchParams();
  const canEdit = query.get("editor") !== "false";
  useEffect(() => { Object.assign(window, { verifyMapView: MapViewRef, verifySettings: settingsRef }); }, []);
  const session = { user: { email: "verify@example.test" }, expires: "2099-01-01" };
  if (query.get("iframe") === "true") return <iframe title="Shared map" src="/share/111111111111111111111111" style={{ width: "100%", height: "100vh", border: 0, display: "block" }} />;
  return <SessionProvider session={session}><MapProvider mapId="111111111111111111111111"><LoggedInDashboard user={session.user} canEdit={canEdit} /></MapProvider></SessionProvider>;
}`);

let browser, lastPage;
const baseUrl = process.env.VERIFY_BASE_URL || 'http://localhost:3000';
const id = '111111111111111111111111';
let data = {
  polygons: [], labels: [], events: [],
  categories: [{ id: 'campus', name: 'Campus', parentId: null, iconUrl: null, order: 0 }],
  settings: { zoom: 15, center: [-120.422045, 37.368169], constraints: null, featureLayers: [], mapTile: null, baseMap: 'gray-vector', apiSources: [] },
};
const posts = [];
let uploadCount = 0, uploadMode = 'ok', saveMode = 'ok', releaseUpload;
let holdInitialLoad = true, releaseInitialLoad;
const logos = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="40"><rect width="300" height="40" fill="white"/><text x="12" y="28" font-size="24" fill="#002856">UC MERCED</text></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="180"><rect width="40" height="180" fill="gold"/></svg>',
];
const checked = [];
function pass(name) { checked.push(name); console.log('PASS:', name); }
async function mock(context) {
  await context.route('**/api/auth/session', route => route.fulfill({ json: { user: { email: 'verify@example.test' }, expires: '2099-01-01' } }));
  await context.route('**/api/maps/' + id, async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      posts.push(body);
      if (saveMode === 'fail') return route.fulfill({ status: 500, json: { error: 'Simulated failure' } });
      data = { ...data, ...body };
      await route.fulfill({ json: data });
    } else {
      if (holdInitialLoad) await new Promise(resolve => { releaseInitialLoad = resolve; });
      await route.fulfill({ json: data });
    }
  });
  await context.route('**/api/upload', async route => {
    uploadCount++;
    if (uploadMode === 'pending') await new Promise(resolve => { releaseUpload = resolve; });
    if (uploadMode === 'fail') return route.fulfill({ status: 500, json: { error: 'Simulated upload failure' } });
    if (uploadMode === 'missing') return route.fulfill({ json: {} });
    await route.fulfill({ json: { imageUrl: 'https://assets.example/logo-' + uploadCount + '.svg', key: 'images/logo-' + uploadCount + '.svg' } });
  });
  await context.route('https://assets.example/**', route => route.fulfill({ contentType: 'image/svg+xml', body: logos[route.request().url().includes('logo-2') ? 1 : 0] }));
}
async function waitUntil(fn, name, timeout = 30000) {
  const start = Date.now();
  while (!(await fn())) { if (Date.now() - start > timeout) throw new Error('Timed out: ' + name); await new Promise(resolve => setTimeout(resolve, 100)); }
}
async function openSettings(page) {
  await page.getByTestId('SettingsIcon').locator('..').click();
  await page.getByRole('button', { name: 'Edit Map Top Bar', exact: true }).last().click();
  await page.getByRole('dialog', { name: 'Edit Map Top Bar' }).waitFor();
}
async function openPencil(page) { await page.getByRole('button', { name: 'Edit Map Top Bar', exact: true }).click(); }
async function save(page) {
  await page.getByRole('dialog', { name: 'Edit Map Top Bar' }).getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('dialog', { name: 'Edit Map Top Bar' }).waitFor({ state: 'hidden' });
}

(async () => {
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true });
    await mock(context);
    const page = await context.newPage();
    lastPage = page;
    page.on('pageerror', error => console.log('BROWSER ERROR:', error.stack));
    const response = await page.goto(baseUrl + '/top-bar-verification-fixture', { waitUntil: 'domcontentloaded' });
    assert.ok((await response.text()).includes('aria-label="Map top bar"'));
    const bar = page.locator('header[aria-label="Map top bar"]');
    await bar.waitFor();
    assert.equal(await bar.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(0, 40, 86)');
    assert.equal(await page.getByRole('button', { name: 'Add map logo', exact: true }).count(), 1);
    const navbarBefore = await page.locator('.MuiAppBar-root').boundingBox();
    const rect = await bar.boundingBox();
    const sidebarRect = await page.locator('[data-map-body] > aside').boundingBox();
    const mapRect = await page.locator('[data-map-body] > main').boundingBox();
    assert.equal(rect.x, 0); assert.equal(rect.width, 1440); assert.equal(rect.height, 56);
    assert.equal(rect.y, navbarBefore.y + navbarBefore.height);
    assert.equal(sidebarRect.y, rect.y + rect.height);
    assert.equal(mapRect.y, rect.y + rect.height);
    await waitUntil(() => !!releaseInitialLoad, 'initial map request');
    holdInitialLoad = false;
    releaseInitialLoad();
    await page.getByRole('button', { name: 'Edit Campus', exact: true }).waitFor();
    await waitUntil(() => page.evaluate(() => !!window.verifyMapView?.current?.ready), 'ArcGIS ready', 60000);
    await page.screenshot({ path: path.join(output, 'initial-desktop.png') });
    await page.evaluate(() => { window.initialMapView = window.verifyMapView.current; window.initialLayers = window.verifyMapView.current.map.layers.toArray(); window.initialCenter = window.verifyMapView.current.center.clone(); window.initialZoom = window.verifyMapView.current.zoom; });
    pass('Legacy map immediately has a full-width header between the Logit navbar and sidebar/map body');

    await openSettings(page);
    let dialog = page.getByRole('dialog', { name: 'Edit Map Top Bar' });
    await dialog.getByLabel('Hex color').fill('#123456');
    assert.equal(posts.length, 0);
    assert.equal(await bar.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(0, 40, 86)');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).focus();
    await page.keyboard.press('Enter');
    assert.equal(posts.length, 0);
    await openSettings(page);
    dialog = page.getByRole('dialog', { name: 'Edit Map Top Bar' });
    assert.equal(await dialog.getByLabel('Hex color').inputValue(), '#002856');
    await dialog.getByLabel('Hex color').fill('#123456');
    await save(page);
    await bar.waitFor();
    assert.equal(await bar.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(18, 52, 86)');
    await page.getByRole('button', { name: 'Edit Map Top Bar', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.initialMapView === window.verifyMapView.current), true);
    assert.deepEqual(await page.locator('.MuiAppBar-root').boundingBox(), navbarBefore);
    assert.deepEqual(await bar.boundingBox(), rect);
    pass('Color drafts, keyboard Cancel, Save, pencil/placeholder without logo and unchanged navbar');

    await openPencil(page);
    dialog = page.getByRole('dialog', { name: 'Edit Map Top Bar' });
    uploadMode = 'pending';
    await dialog.locator('input[type=file]').setInputFiles({ name: 'wide.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(logos[0]) });
    await waitUntil(() => !!releaseUpload, 'upload pending');
    assert.equal(await dialog.getByRole('button', { name: 'Save', exact: true }).isDisabled(), true);
    uploadMode = 'ok'; releaseUpload(); releaseUpload = null;
    await dialog.getByRole('img', { name: 'Map top bar logo preview' }).waitFor();
    await waitUntil(() => dialog.getByRole('button', { name: 'Save', exact: true }).isEnabled(), 'logo resolved');
    await page.screenshot({ path: path.join(output, 'editor-desktop.png') });
    await save(page);
    const logo = page.getByRole('img', { name: 'Map logo', exact: true });
    assert.equal(await logo.getAttribute('src'), 'https://assets.example/logo-1.svg');
    const wide = await logo.boundingBox();
    assert.ok(Math.abs(wide.width / wide.height - 7.5) < 0.01);
    pass('Upload progress blocks Save; uploaded asset renders without stretching or cropping');

    await openPencil(page);
    dialog = page.getByRole('dialog', { name: 'Edit Map Top Bar' });
    await dialog.locator('input[type=file]').setInputFiles({ name: 'tall.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(logos[1]) });
    await waitUntil(() => dialog.getByRole('button', { name: 'Save', exact: true }).isEnabled(), 'replacement loaded');
    await save(page);
    const tall = await logo.boundingBox();
    assert.ok(Math.abs(tall.width / tall.height - 40 / 180) < 0.01);
    assert.ok(tall.height <= 40);
    pass('Replace logo retains the aspect ratio of a portrait asset');

    await openPencil(page);
    dialog = page.getByRole('dialog', { name: 'Edit Map Top Bar' });
    await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
    await dialog.getByLabel('Hex color').fill('invalid');
    assert.equal(await dialog.getByRole('button', { name: 'Save', exact: true }).isDisabled(), true);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await logo.getAttribute('src'), 'https://assets.example/logo-2.svg');
    await openPencil(page);
    dialog = page.getByRole('dialog', { name: 'Edit Map Top Bar' });
    await dialog.getByLabel('Background color picker').fill('#abcdef');
    assert.equal(await dialog.getByLabel('Hex color').inputValue(), '#abcdef');
    await save(page);
    pass('Clear and invalid color remain drafts; Cancel restores logo; picker syncs hex input');

    await page.getByRole('button', { name: 'Edit Campus', exact: true }).click();
    const category = page.getByRole('dialog', { name: 'Edit Category' });
    await waitUntil(async () => await category.getByLabel('Name').inputValue() === 'Campus', 'category draft initialized');
    await category.getByLabel('Name').fill('Campus updated');
    await category.getByRole('button', { name: 'Save', exact: true }).click();
    await waitUntil(() => data.categories[0]?.name === 'Campus updated', 'category saved');
    assert.equal(data.settings.topBar.logoUrl, 'https://assets.example/logo-2.svg');
    assert.equal(data.settings.topBar.backgroundColor, '#abcdef');
    assert.equal(await page.evaluate(() => window.initialMapView === window.verifyMapView.current && window.initialLayers.every((layer, i) => layer === window.verifyMapView.current.map.layers.getItemAt(i)) && window.initialZoom === window.verifyMapView.current.zoom && window.initialCenter.equals(window.verifyMapView.current.center)), true);
    pass('Category editor and save still work; bar, ArcGIS view, center, zoom and layers persist');

    await page.reload();
    await page.getByRole('img', { name: 'Map logo', exact: true }).waitFor();
    await waitUntil(() => page.evaluate(() => !!window.verifyMapView?.current?.ready), 'reloaded ArcGIS ready');
    assert.equal(await bar.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(171, 205, 239)');
    pass('Reload loads the saved bar');

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileRect = await bar.boundingBox();
    assert.equal(mobileRect.x, 0); assert.equal(mobileRect.width, 390);
    await openPencil(page);
    await waitUntil(() => page.getByRole('dialog', { name: 'Edit Map Top Bar' }).getByRole('button', { name: 'Save', exact: true }).isEnabled(), 'mobile logo loaded');
    const mobilePopup = await page.getByRole('dialog', { name: 'Edit Map Top Bar' }).boundingBox();
    assert.ok(mobilePopup.x >= 0 && mobilePopup.x + mobilePopup.width <= 390);
    await page.screenshot({ path: path.join(output, 'editor-mobile.png') });
    await page.getByRole('dialog', { name: 'Edit Map Top Bar' }).getByRole('button', { name: 'Cancel', exact: true }).click();
    pass('Responsive bar and popup remain inside the map preview');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPencil(page);
    dialog = page.getByRole('dialog', { name: 'Edit Map Top Bar' });
    uploadMode = 'missing';
    await dialog.locator('input[type=file]').setInputFiles({ name: 'broken.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(logos[0]) });
    await dialog.getByRole('alert').waitFor();
    assert.equal(await dialog.getByRole('button', { name: 'Save', exact: true }).isDisabled(), true);
    await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
    saveMode = 'fail';
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.getByText('Could not save the map top bar. Please try again.').waitFor();
    assert.equal(await logo.getAttribute('src'), 'https://assets.example/logo-2.svg');
    saveMode = 'ok';
    await save(page);
    assert.equal(await logo.count(), 0);
    pass('Unresolved upload blocks Save; failed persistence retains prior appearance; retry clears logo');

    await openSettings(page);
    dialog = page.getByRole('dialog', { name: 'Edit Map Top Bar' });
    assert.equal(await dialog.getByLabel('Enable map top bar').count(), 0);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await bar.waitFor();
    assert.equal(await page.getByRole('button', { name: 'Add map logo', exact: true }).count(), 1);
    pass('Clearing the logo leaves the header and editable placeholder visible; settings still open the editor');

    await openPencil(page);
    dialog = page.getByRole('dialog', { name: 'Edit Map Top Bar' });
    uploadMode = 'ok';
    await dialog.locator('input[type=file]').setInputFiles({ name: 'final.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(logos[0]) });
    await waitUntil(() => dialog.getByRole('button', { name: 'Save', exact: true }).isEnabled(), 'final logo loaded');
    await save(page);

    await page.screenshot({ path: path.join(output, 'builder-desktop.png') });
    const embed = await context.newPage();
    lastPage = embed;
    embed.on('pageerror', error => console.log('EMBED ERROR:', error.stack));
    await embed.goto(baseUrl + '/share/' + id);
    const embedBar = embed.locator('header[aria-label="Map top bar"]');
    await embedBar.waitFor();
    assert.equal(await embed.getByRole('button', { name: 'Edit Map Top Bar', exact: true }).count(), 0);
    assert.equal(await embed.getByRole('button', { name: 'Edit Campus updated', exact: true }).count(), 0);
    assert.equal(await embed.locator('.MuiAppBar-root').count(), 0);
    assert.equal(await embedBar.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(171, 205, 239)');
    assert.equal(await embed.getByRole('img', { name: 'Map logo', exact: true }).getAttribute('src'), data.settings.topBar.logoUrl);
    const embedRect = await embedBar.boundingBox();
    assert.equal(embedRect.x, 0); assert.equal(embedRect.width, 1440); assert.equal(embedRect.y, 0);
    const embedSidebarRect = await embed.locator('aside').boundingBox();
    const embedMapRect = await embed.locator('main').boundingBox();
    assert.equal(embedSidebarRect.y, embedRect.height); assert.equal(embedMapRect.y, embedRect.height);
    assert.equal(await embed.getByRole('button', { name: 'Add map logo', exact: true }).count(), 0);
    await embed.screenshot({ path: path.join(output, 'embed-desktop.png') });
    pass('Actual /share route displays identical saved bar with no editor or builder navbar');
    let sharedUrl;
    page.once('dialog', async dialog => { sharedUrl = dialog.message().split('url: ')[1]; await dialog.dismiss(); });
    await page.getByRole('button', { name: 'Share Map', exact: true }).click();
    await waitUntil(() => !!sharedUrl, 'share URL');
    assert.equal(new URL(sharedUrl).pathname, '/share/' + id);
    const iframeHost = await context.newPage();
    lastPage = iframeHost;
    await iframeHost.goto(baseUrl + '/top-bar-verification-fixture?iframe=true');
    const frame = iframeHost.frameLocator('iframe[title="Shared map"]');
    const frameBar = frame.locator('header[aria-label="Map top bar"]');
    await waitUntil(async () => await frameBar.evaluate(el => getComputedStyle(el).backgroundColor) === 'rgb(171, 205, 239)', 'iframe saved header');
    assert.equal(await frame.getByRole('img', { name: 'Map logo', exact: true }).getAttribute('src'), data.settings.topBar.logoUrl);
    assert.equal(await frame.locator('.MuiAppBar-root').count(), 0);
    assert.equal(await frame.getByRole('button', { name: 'Edit Map Top Bar', exact: true }).count(), 0);
    assert.equal(await frame.getByRole('button', { name: 'Add map logo', exact: true }).count(), 0);
    const frameBounds = await frameBar.evaluate(el => {
      const root = el.closest('[data-map-root]');
      return [el, root.querySelector('aside'), root.querySelector('main')].map(node => {
        const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
    });
    assert.equal(frameBounds[0].x, 0); assert.equal(frameBounds[0].y, 0); assert.equal(frameBounds[0].width, 1440);
    assert.equal(frameBounds[1].y, 56); assert.equal(frameBounds[2].y, 56);
    await iframeHost.screenshot({ path: path.join(output, 'iframe-desktop.png') });
    await iframeHost.setViewportSize({ width: 390, height: 844 });
    const mobileFrameBounds = await frameBar.evaluate(el => {
      const root = el.closest('[data-map-root]');
      return [el, root.querySelector('aside'), root.querySelector('main')].map(node => {
        const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
    });
    assert.equal(mobileFrameBounds[0].width, 390);
    assert.equal(mobileFrameBounds[2].y, 56);
    assert.ok(mobileFrameBounds[1].y >= mobileFrameBounds[2].y + mobileFrameBounds[2].height - 1);
    await iframeHost.screenshot({ path: path.join(output, 'iframe-mobile.png') });
    pass('Share flow URL renders the header above both columns inside a real iframe at desktop/mobile sizes');
    data.settings.topBar = { ...data.settings.topBar, enabled: false };
    const viewer = await context.newPage();
    lastPage = viewer;
    await viewer.goto(baseUrl + '/top-bar-verification-fixture?editor=false');
    await viewer.getByRole('img', { name: 'Map logo', exact: true }).waitFor();
    assert.equal(await viewer.locator('header[aria-label="Map top bar"]').count(), 1);
    assert.equal(await viewer.getByRole('button', { name: 'Edit Map Top Bar', exact: true }).count(), 0);
    await viewer.getByTestId('SettingsIcon').locator('..').click();
    assert.equal(await viewer.getByRole('button', { name: 'Edit Map Top Bar', exact: true }).count(), 0);
    pass('Previously disabled settings still render their saved header; unauthorized viewers have no editing controls');
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ checked, posts: posts.length, uploads: uploadCount }, null, 2));
  } catch (error) {
    if (lastPage) {
      await lastPage.screenshot({ path: path.join(output, 'failure.png') });
      console.log(await lastPage.evaluate(() => ({ text: document.body.innerText.slice(0,1500), viewExists: !!window.verifyMapView?.current, ready: window.verifyMapView?.current?.ready, fulfilled: window.verifyMapView?.current?.isFulfilled?.() })));
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    fs.unlinkSync(fixtureFile);
    fs.rmdirSync(fixtureDir);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
