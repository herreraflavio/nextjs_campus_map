const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { ObjectId } = require('mongodb');

// Exercise the actual TypeScript modules without introducing a test framework.
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (name) => name in mocks ? mocks[name] : require(name);
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}
const barModule = load('src/app/types/mapTopBar.ts');
const savedBar = { logoUrl: 'https://assets.example/logo.png', backgroundColor: '#002856' };

test('missing settings get a visible default color and obsolete disabled flags cannot hide the header', () => {
  assert.deepEqual(barModule.normalizeMapTopBar(undefined), { logoUrl: null, backgroundColor: '#002856' });
  assert.deepEqual(barModule.normalizeMapTopBar({ ...savedBar, enabled: false }), savedBar);
  for (const bar of [null, {}, { ...savedBar, logoUrl: 'javascript:alert(1)' }, { ...savedBar, backgroundColor: 'red' }]) {
    assert.equal(barModule.isMapTopBarSettings(bar), false);
    assert.deepEqual(barModule.normalizeMapTopBar(bar), barModule.DEFAULT_MAP_TOP_BAR);
  }
  assert.deepEqual(barModule.normalizeMapTopBar({ ...savedBar, backgroundColor: '#AABBCC' }), { ...savedBar, backgroundColor: '#aabbcc' });
  assert.equal(barModule.isMapTopBarSettings({ ...savedBar, logoUrl: null }), true);
});

test('image upload uses category API, credentials and returned URL; errors remain unresolved', async () => {
  const previous = global.fetch;
  const upload = load('src/app/helper/uploadImage.ts');
  try {
    let received;
    global.fetch = async (url, options) => {
      received = { url, options };
      return Response.json({ imageUrl: savedBar.logoUrl, key: 'images/logo.png' });
    };
    assert.equal(await upload.uploadImage(new File(['logo'], 'logo.png', { type: 'image/png' })), savedBar.logoUrl);
    assert.equal(received.url, '/api/upload');
    assert.equal(received.options.credentials, 'same-origin');
    assert.equal(received.options.body.get('file').name, 'logo.png');
    await assert.rejects(upload.uploadImage(new File(['text'], 'text.txt', { type: 'text/plain' })), /Only image/);
    global.fetch = async () => Response.json({});
    await assert.rejects(upload.uploadImage(new File(['logo'], 'logo.png', { type: 'image/png' })), /no image URL/);
    global.fetch = async () => new Response('', { status: 500 });
    await assert.rejects(upload.uploadImage(new File(['logo'], 'logo.png', { type: 'image/png' })), /500/);
  } finally { global.fetch = previous; }
});

test('empty maps save, queued category saves retain the new bar, and failed saves do not commit', async () => {
  const previous = global.fetch;
  const refs = {
    finalizedLayerRef: { current: null }, labelsLayerRef: { current: null },
    eventsLayerRef: { current: null }, eventsStore: { items: [] },
    settingsRef: { current: { topBar: { ...barModule.DEFAULT_MAP_TOP_BAR } } },
  };
  const saveModule = load('src/app/helper/saveMap.ts', {
    '@/app/components/map/arcgisRefs': refs,
    '@/app/components/map/categories/categoryStore': { getCategories: () => [] },
    '@/app/types/mapTopBar': barModule,
    '@/app/types/myTypes': {},
  });
  const settings = { zoom: 15, center: [-120, 37], constraints: null, featureLayers: [] };
  try {
    const bodies = [];
    let release;
    global.fetch = async (_, options) => {
      bodies.push(JSON.parse(options.body));
      if (bodies.length === 1) await new Promise(resolve => { release = resolve; });
      return Response.json({});
    };
    const topBarSave = saveModule.saveMapToServer('map', 'owner@example.test', { ...settings, topBar: savedBar });
    const categorySave = saveModule.saveMapToServer('map', 'owner@example.test', settings);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(bodies.length, 1);
    const otherMapBar = { ...savedBar, backgroundColor: '#123456' };
    refs.settingsRef.current.topBar = otherMapBar;
    release();
    assert.equal(await topBarSave, true);
    assert.equal(await categorySave, true);
    assert.deepEqual(bodies[1].settings.topBar, savedBar);
    assert.deepEqual(bodies[0].polygons, []);
    // Finishing a save for an unmounted map must not change another map's refs.
    assert.deepEqual(refs.settingsRef.current.topBar, otherMapBar);
    refs.settingsRef.current.topBar = savedBar;
    global.fetch = async () => new Response('', { status: 403 });
    assert.equal(await saveModule.saveMapToServer('map', 'owner@example.test', { ...settings, topBar: { ...savedBar, backgroundColor: '#ffffff' } }), false);
    assert.deepEqual(refs.settingsRef.current.topBar, savedBar);
  } finally { global.fetch = previous; }
});

test('map API validates, authorizes, persists, reloads, and preserves settings for legacy saves', async () => {
  const ownerId = new ObjectId();
  const mapId = new ObjectId();
  const map = { _id: mapId, ownerId, isPrivate: false, settings: { topBar: savedBar } };
  let session = { user: { email: 'owner@example.test' } };
  let user = { _id: ownerId };
  let writes = 0;
  const collection = {
    findOne: async () => map,
    updateOne: async (_, update) => { writes++; Object.assign(map, update.$set); return { matchedCount: 1 }; },
  };
  const route = load('src/app/api/maps/[id]/route.ts', {
    '@/lib/auth': { auth: async () => session },
    '@/lib/mongodb': { getMongoClient: async () => ({ db: () => ({ collection: () => collection }) }) },
    '@/lib/userModel': { findUserByEmail: async () => user },
    '@/app/types/mapTopBar': barModule,
  });
  const context = { params: Promise.resolve({ id: String(mapId) }) };
  const body = { userEmail: 'owner@example.test', polygons: [], labels: [], events: [], categories: [], settings: { zoom: 15, center: [-120, 37], constraints: null, featureLayers: [] } };
  const post = (value) => route.POST(new Request('http://localhost/api/maps/map', { method: 'POST', body: JSON.stringify(value) }), context);
  assert.equal((await post({ ...body, settings: { ...body.settings, topBar: { ...savedBar, backgroundColor: 'invalid' } } })).status, 400);
  session = null;
  assert.equal((await post(body)).status, 401);
  session = { user: { email: 'other@example.test' } };
  user = { _id: new ObjectId() };
  assert.equal((await post(body)).status, 403);
  assert.equal(writes, 0);
  user = { _id: ownerId };
  assert.equal((await post(body)).status, 200);
  assert.deepEqual(map.settings.topBar, savedBar);
  const cleared = { ...savedBar, logoUrl: null, backgroundColor: '#ABCDEF' };
  assert.equal((await post({ ...body, settings: { ...body.settings, topBar: cleared } })).status, 200);
  const reloaded = await (await route.GET(new Request('http://localhost/api/maps/map'), context)).json();
  assert.deepEqual(reloaded.settings.topBar, { ...cleared, backgroundColor: '#abcdef' });
});
