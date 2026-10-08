const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(
    name => name in mocks ? mocks[name] : require(name), module, module.exports,
  );
  return module.exports;
}

const flush = () => new Promise(resolve => setImmediate(resolve));
const bar = color => ({ logoUrl: null, backgroundColor: color });
const point = (id, name = id) => ({
  attributes: { id, name },
  geometry: { type: 'point', x: -120, y: 37, spatialReference: { wkid: 4326 } },
  symbol: { color: [1, 2, 3, 1], size: 10 },
});
const settings = () => ({ zoom: 15, center: [-120, 37], constraints: null, featureLayers: [] });

function harness() {
  const hydration = load('src/app/components/map/mapHydration.ts');
  const refs = {
    finalizedLayerRef: { current: { graphics: { items: [] } } },
    labelsLayerRef: { current: { graphics: { items: [] } } },
    eventsLayerRef: { current: { graphics: { items: [] } } },
    eventsStore: { items: [] },
    settingsRef: { current: { topBar: bar('#112233') } },
  };
  const categories = [];
  const save = load('src/app/helper/saveMap.ts', {
    '@/app/components/map/arcgisRefs': refs,
    '@/app/components/map/categories/categoryStore': { getCategories: () => categories.map(item => ({ ...item })) },
    '@/app/components/map/mapHydration': hydration,
    '@/app/types/mapTopBar': load('src/app/types/mapTopBar.ts'),
    '@/app/types/myTypes': load('src/app/types/myTypes.ts'),
  });
  return { hydration, refs, categories, save: save.saveMapToServer };
}

test('saved-data hydration waits for completion, without any tile or feed dependency', async () => {
  const h = load('src/app/components/map/mapHydration.ts');
  assert.equal(h.getMapHydrationStatus('map'), 'ready');
  assert.equal(await h.waitForMapHydration('map'), true);
  const loadMap = h.beginMapHydration('map');
  let settled = false;
  const waiting = h.waitForMapHydration('map').then(result => { settled = true; return result; });
  await flush();
  assert.equal(settled, false);
  loadMap.complete();
  assert.equal(await waiting, true);
  assert.equal(h.getMapHydrationStatus('map'), 'ready');
  loadMap.complete();
  assert.equal(await h.waitForMapHydration('map'), true);
});

test('unmount and replacing a load invalidate waits; stale callbacks cannot complete the next map', async () => {
  const h = load('src/app/components/map/mapHydration.ts');
  const first = h.beginMapHydration('first');
  const waiting = h.waitForMapHydration('first');
  const next = h.beginMapHydration('next');
  first.complete();
  first.cancel();
  assert.equal(await waiting, false);
  assert.equal(h.getMapHydrationStatus('next'), 'pending');
  assert.equal(await h.waitForMapHydration('first'), false);
  const nextWaiting = h.waitForMapHydration('next');
  next.cancel();
  next.complete();
  assert.equal(await nextWaiting, false);
  assert.equal(h.getMapHydrationStatus('next'), 'cancelled');
});

test('a same-map reload between completion and promise delivery invalidates the previous wait', async () => {
  const h = load('src/app/components/map/mapHydration.ts');
  const first = h.beginMapHydration('map');
  const guard = h.captureMapHydrationGuard('map');
  const waiting = h.waitForMapHydration('map');
  first.complete();
  const reopened = h.beginMapHydration('map');
  reopened.complete();
  assert.equal(await waiting, false);
  assert.equal(guard(), false);
  assert.equal(await h.waitForMapHydration('map'), true);
});

test('an early save waits before export and includes every hydrated record while preserving action settings', async () => {
  const { hydration, refs, categories, save } = harness();
  const loadMap = hydration.beginMapHydration('map');
  const bodies = [];
  const previous = global.fetch;
  global.fetch = async (_, options) => { bodies.push(JSON.parse(options.body)); return Response.json({}); };
  try {
    const draft = settings();
    const saving = save('map', 'owner@example.test', draft);
    draft.center[0] = 80;
    await flush();
    assert.equal(bodies.length, 0);
    refs.finalizedLayerRef.current.graphics.items.push(point('first'), point('last'));
    refs.labelsLayerRef.current.graphics.items.push({
      attributes: { parentId: 'last' },
      geometry: { type: 'point', x: -120, y: 37, spatialReference: { wkid: 4326 } },
      symbol: { font: { size: 12 }, color: [0, 0, 0, 1], haloColor: [255, 255, 255, 1], haloSize: 2, text: 'Last label' },
    });
    refs.eventsLayerRef.current.graphics.items.push({
      attributes: { id: 'saved-event', event_name: 'Saved Event', fromUser: true },
      geometry: { x: -120, y: 37 },
    });
    categories.push({ id: 'category', name: 'Category', parentId: null, order: 0 });
    refs.settingsRef.current.topBar = bar('#abcdef');
    loadMap.complete();
    assert.equal(await saving, true);
    assert.deepEqual(bodies[0].polygons.map(item => item.attributes.id), ['first', 'last']);
    assert.deepEqual(bodies[0].events.map(item => item.attributes.id), ['saved-event']);
    assert.deepEqual(bodies[0].labels.map(item => item.attributes.parentId), ['last']);
    assert.equal(bodies[0].categories.length, 1);
    assert.deepEqual(bodies[0].settings.center, [-120, 37]);
    assert.deepEqual(bodies[0].settings.topBar, bar('#abcdef'));
  } finally { global.fetch = previous; }
});

test('cancelled pending saves never export another map or issue a write', async () => {
  const { hydration, refs, save } = harness();
  const first = hydration.beginMapHydration('first');
  let writes = 0;
  const previous = global.fetch;
  global.fetch = async () => { writes++; return Response.json({}); };
  try {
    const staleSave = save('first', 'owner@example.test', settings());
    const next = hydration.beginMapHydration('next');
    refs.finalizedLayerRef.current.graphics.items.push(point('next-map-drawing'));
    next.complete();
    first.complete();
    assert.equal(await staleSave, false);
    assert.equal(await save('first', 'owner@example.test', settings()), false);
    assert.equal(writes, 0);
  } finally { global.fetch = previous; }
});

test('a drawing activation registered first yields after hydration so pending saves capture complete layers', async () => {
  const { hydration, refs, save } = harness();
  const { yieldMapWork } = load('src/app/components/map/hydrateGraphics.ts');
  const loadMap = hydration.beginMapHydration('map');
  const controller = new AbortController();
  const bodies = [];
  const previous = global.fetch;
  global.fetch = async (_, options) => { bodies.push(JSON.parse(options.body)); return Response.json({}); };
  try {
    const isCurrent = hydration.captureMapHydrationGuard('map');
    // Drawing was requested first. Its activation must not empty shared layers
    // in a promise continuation before an early editing save exports them.
    const drawingActivation = (async () => {
      if (!await hydration.waitForMapHydration('map')) return;
      await yieldMapWork(controller.signal);
      if (!isCurrent()) return;
      refs.finalizedLayerRef.current.graphics.items = [];
      refs.labelsLayerRef.current.graphics.items = [];
    })();
    const pendingSave = save('map', 'owner@example.test', { ...settings(), topBar: bar('#445566') });
    refs.finalizedLayerRef.current.graphics.items.push(point('first'), point('last'));
    refs.labelsLayerRef.current.graphics.items.push({
      attributes: { parentId: 'last' },
      geometry: { type: 'point', x: -120, y: 37, spatialReference: { wkid: 4326 } },
      symbol: { font: { size: 12 }, color: [0, 0, 0, 1], haloColor: [255, 255, 255, 1], haloSize: 2, text: 'Last label' },
    });
    loadMap.complete();
    assert.equal(await pendingSave, true);
    await drawingActivation;
    assert.deepEqual(bodies[0].polygons.map(item => item.attributes.id), ['first', 'last']);
    assert.deepEqual(bodies[0].labels.map(item => item.attributes.parentId), ['last']);
    assert.deepEqual(bodies[0].settings.topBar, bar('#445566'));
    assert.equal(refs.finalizedLayerRef.current.graphics.items.length, 0);
  } finally { controller.abort(); global.fetch = previous; }
});

test('ready maps retain synchronous action snapshots and ordered header/category save semantics', async () => {
  const { refs, save } = harness();
  refs.finalizedLayerRef.current.graphics.items.push(point('drawing', 'First name'));
  const bodies = [];
  let release;
  const previous = global.fetch;
  global.fetch = async (_, options) => {
    bodies.push(JSON.parse(options.body));
    if (bodies.length === 1) await new Promise(resolve => { release = resolve; });
    return Response.json({});
  };
  try {
    const headerSave = save('map', 'owner@example.test', { ...settings(), topBar: bar('#445566') });
    refs.finalizedLayerRef.current.graphics.items[0].attributes.name = 'Second name';
    const categorySave = save('map', 'owner@example.test', settings());
    refs.finalizedLayerRef.current.graphics.items[0].attributes.name = 'Later name';
    await flush();
    assert.equal(bodies.length, 1);
    assert.equal(bodies[0].polygons[0].attributes.name, 'First name');
    release();
    assert.equal(await headerSave, true);
    assert.equal(await categorySave, true);
    assert.equal(bodies[1].polygons[0].attributes.name, 'Second name');
    assert.deepEqual(bodies[1].settings.topBar, bar('#445566'));
  } finally { global.fetch = previous; }
});

test('deferred header/category saves keep call ordering and inherit the successfully saved header', async () => {
  const { hydration, refs, save } = harness();
  const loadMap = hydration.beginMapHydration('map');
  const bodies = [];
  let release;
  const previous = global.fetch;
  global.fetch = async (_, options) => {
    bodies.push(JSON.parse(options.body));
    if (bodies.length === 1) await new Promise(resolve => { release = resolve; });
    return Response.json({});
  };
  try {
    const headerSave = save('map', 'owner@example.test', { ...settings(), topBar: bar('#445566') });
    const categorySave = save('map', 'owner@example.test', settings());
    refs.settingsRef.current.topBar = bar('#abcdef');
    refs.finalizedLayerRef.current.graphics.items.push(point('saved-drawing'));
    loadMap.complete();
    await flush();
    assert.equal(bodies.length, 1);
    assert.equal(bodies[0].polygons.length, 1);
    release();
    assert.equal(await headerSave, true);
    assert.equal(await categorySave, true);
    assert.deepEqual(bodies[1].settings.topBar, bar('#445566'));
  } finally { global.fetch = previous; }
});

test('failed deferred header writes do not leak draft settings into the next queued save', async () => {
  const { hydration, refs, save } = harness();
  const loadMap = hydration.beginMapHydration('map');
  const bodies = [];
  const previous = global.fetch;
  const previousError = console.error;
  console.error = () => {};
  global.fetch = async (_, options) => {
    bodies.push(JSON.parse(options.body));
    return bodies.length === 1 ? new Response('', { status: 403 }) : Response.json({});
  };
  try {
    const headerSave = save('map', 'owner@example.test', { ...settings(), topBar: bar('#445566') });
    const categorySave = save('map', 'owner@example.test', settings());
    refs.settingsRef.current.topBar = bar('#abcdef');
    loadMap.complete();
    assert.equal(await headerSave, false);
    assert.equal(await categorySave, true);
    assert.deepEqual(bodies[1].settings.topBar, bar('#abcdef'));
  } finally { global.fetch = previous; console.error = previousError; }
});
