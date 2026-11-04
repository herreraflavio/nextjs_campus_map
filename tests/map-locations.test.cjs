const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { ObjectId } = require('mongodb');
const root = path.resolve(__dirname, '..');

function loader(mocks = {}) {
  const cache = new Map();
  const load = file => {
    const absolute = path.resolve(root, file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} };
    cache.set(absolute, module);
    const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const localRequire = name => {
      if (name in mocks) return mocks[name];
      if (!name.startsWith('.') && !name.startsWith('@/')) return require(name);
      const base = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(absolute), name);
      const resolved = [base, base + '.ts', base + '.tsx'].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
      return load(resolved);
    };
    new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
    return module.exports;
  };
  return load;
}

const sr = { wkid: 4326, latestWkid: 4326 };
function drawing(id, name, categoryId = null, extra = {}) {
  return { attributes: { id, name, description: name, categoryId, ...extra },
    geometry: { type: 'polygon', rings: [[[-120.43, 37.36], [-120.42, 37.36], [-120.42, 37.37], [-120.43, 37.37], [-120.43, 37.36]]], spatialReference: sr },
    symbol: { type: 'simple-fill', color: [0, 50, 100, 1], outline: { color: [0, 0, 0, 1], width: 1 } } };
}
const category = (id, parentId = null, extra = {}) => ({ id, name: id, parentId, order: 0, ...extra });
const layer = items => ({ graphics: { toArray: () => items, items } });

test('URL locations reuse navigation aliases, partial names, ids and public-node filtering with one graph fetch', async () => {
  const previous = global.fetch;
  const requests = [];
  global.fetch = async url => {
    requests.push(url);
    return Response.json(JSON.parse(fs.readFileSync(path.join(root, 'public', url.slice(1)), 'utf8')));
  };
  try {
    const load = loader();
    const search = load('src/app/helper/searchLocation.tsx');
    const [graph, sameGraph] = await Promise.all([search.loadLocationGraph(), search.loadLocationGraph()]);
    assert.equal(graph, sameGraph);
    assert.equal(requests.length, 3);
    const nodes = graph.nodes.filter(node => !node.hidden);
    const options = nodes.map(node => ({ id: node.id, label: node.name, aliases: graph.metaById[node.id].aliases }));
    const { resolveMapLocation } = load('src/app/components/map/mapLocation.ts');
    const field = drawing('field', 'Recreation Field');
    const hall = drawing('hall', 'Cathedral Hall');
    for (const input of ['  rF  ', ' Rec   Field ', 'Recreation F', '462']) {
      const result = resolveMapLocation(input, [field, hall], options, nodes);
      assert.equal(result.drawing, field, input);
      assert.equal(result.node.id, '462', input);
    }
    assert.equal(resolveMapLocation('CH', [field, hall], options, nodes).drawing, hall);
    assert.equal(resolveMapLocation('field', [field, hall], options, nodes).drawing, field);
    assert.equal(resolveMapLocation('absolutely unknown place', [field, hall], options, nodes), null);
    assert.equal(resolveMapLocation('   ', [field], options, nodes), null);
    assert.equal(search.findBestLocationMatchId(options, 'Other Field'), null,
      'The TH alias must not match the middle of Other');
    assert.equal(search.findBestLocationMatchId(options, '999999999'), null,
      'Unknown IDs must not match shorter existing IDs');
  } finally { global.fetch = previous; }
});

test('a graph location can select a containing polygon; custom drawings route to a nearby public node', () => {
  const { resolveMapLocation } = loader()('src/app/components/map/mapLocation.ts');
  const nodes = [
    { id: 'a', name: 'Entrance', lon: -120.425, lat: 37.365, x: 0, y: 0 },
    { id: 'b', name: 'Far away', lon: -121, lat: 38, x: 100, y: 100 },
  ];
  const options = nodes.map(node => ({ id: node.id, label: node.name, aliases: [node.name] }));
  const custom = drawing('custom', 'My custom venue');
  const result = resolveMapLocation('Entrance', [custom], options, nodes);
  assert.equal(result.drawing, custom);
  assert.equal(result.node.id, 'a');
  assert.equal(resolveMapLocation('custom', [custom], options, nodes).node.id, 'a');
  assert.equal(resolveMapLocation('Entrance', [], options, nodes).drawing, null);
});

test('location focus hides siblings, other categories, labels and sprites while admin pins stay visible and locked', () => {
  const target = drawing('target', 'Target', 'child');
  const sibling = drawing('sibling', 'Sibling', 'child');
  const other = drawing('other-item', 'Other', 'other');
  const pinned = drawing('pinned', 'Pinned', 'hidden', { alwaysVisible: true, adminVisible: false });
  const inherited = drawing('inherited', 'Inherited', 'pinned-child', { adminVisible: false });
  const rootDrawing = drawing('root', 'Root');
  const items = [target, sibling, other, pinned, inherited, rootDrawing];
  const labels = items.map(graphic => ({ attributes: { parentId: graphic.attributes.id, showAtZoom: 16, hideAtZoom: 20 } }));
  const sprites = items.map(graphic => ({ attributes: { sourceDrawingId: graphic.attributes.id, runtimeBaseVisible: true } }));
  const refs = { finalizedLayerRef: { current: layer(items) }, labelsLayerRef: { current: layer(labels) }, eventsLayerRef: { current: layer([]) },
    spriteLayerRef: { current: layer(sprites) }, MapViewRef: { current: { zoom: 18 } } };
  const load = loader({ '../arcgisRefs': refs });
  const store = load('src/app/components/map/categories/categoryStore.ts');
  const visibility = load('src/app/components/map/categories/categoryVisibility.ts');
  store.setCategories([category('parent'), category('child', 'parent'), category('other'),
    category('hidden', null, { adminVisible: false }), category('pinned-cat', null, { alwaysVisible: true }), category('pinned-child', 'pinned-cat')]);
  visibility.setMapLocationFocus('target', 'child');
  assert.deepEqual(items.map(item => item.visible), [true, false, false, true, true, false]);
  assert.deepEqual(labels.map(item => item.visible), items.map(item => item.visible));
  assert.deepEqual(sprites.map(item => item.visible), items.map(item => item.visible));
  assert.equal(visibility.getCategoryOwnVisibility('parent'), true);
  assert.equal(visibility.getCategoryOwnVisibility('other'), false);
  visibility.toggleCategoryVisibility('parent');
  assert.equal(target.visible, false);
  assert.equal(pinned.visible, true);
  visibility.toggleItemVisibility('pinned');
  visibility.setItemVisibility('inherited', false);
  visibility.toggleCategoryVisibility('pinned-cat');
  assert.equal(pinned.visible, true);
  assert.equal(inherited.visible, true);
  assert.equal(visibility.getCategoryOwnVisibility('pinned-cat'), true);
  visibility.applyMapVisibility(21);
  assert.equal(labels[3].visible, false, 'Pinned items retain label zoom rules');
  visibility.resetMapVisibility();
  assert.ok(items.every(item => item.visible), 'Query filtering does not persist into another map');
});

test('public maps and lite exports honor pins over admin hiding and preserve reachable category paths', () => {
  const load = loader();
  const policy = load('src/app/types/mapVisibility.ts');
  const categories = [category('hidden', null, { adminVisible: false }),
    category('pinned-category', 'hidden', { alwaysVisible: true }), category('regular')];
  const drawings = [drawing('hidden-item', 'Hidden', 'hidden'), drawing('own-pin', 'Own pin', 'hidden', { alwaysVisible: true }),
    drawing('inherited-pin', 'Inherited', 'pinned-category', { adminVisible: false }), drawing('item-hidden', 'Hidden item', 'regular', { adminVisible: false })];
  assert.deepEqual(drawings.map(item => policy.isDrawingAdminVisibleInList(categories, item.attributes)), [false, true, true, false]);
  assert.deepEqual(policy.publicMapCategories(categories, drawings).map(item => item.id), ['hidden', 'pinned-category', 'regular']);
  const payload = load('src/lib/liteMap.ts').createLiteMapPayload({ categories, polygons: drawings });
  assert.equal(payload.counts.drawings, 2);
  assert.equal(payload.categories.find(item => item.id === 'pinned-category').alwaysVisible, true);
});

test('visibility flags survive the actual drawing export and category normalization without persisting URL visibility', () => {
  const item = drawing('pinned', 'Pinned', 'category', { alwaysVisible: true, adminVisible: true });
  item.visible = false;
  const refs = { finalizedLayerRef: { current: layer([item]) }, labelsLayerRef: { current: layer([]) },
    eventsLayerRef: { current: layer([]) }, eventsStore: { items: [] } };
  const categories = [category('category', null, { alwaysVisible: true, adminVisible: true })];
  const load = loader({ '@/app/components/map/arcgisRefs': refs,
    '@/app/components/map/categories/categoryStore': { getCategories: () => categories } });
  const exported = load('src/app/helper/saveMap.ts').generateExport();
  assert.equal(exported.polygons[0].attributes.alwaysVisible, true);
  assert.equal(exported.polygons[0].attributes.adminVisible, true);
  assert.equal('visible' in exported.polygons[0], false);
  assert.equal(exported.categories[0].alwaysVisible, true);
  const store = loader()('src/app/components/map/categories/categoryStore.ts');
  store.setCategories(categories);
  assert.equal(store.getCategories()[0].alwaysVisible, true);
});

test('map API validates visibility flags and retains category pins on save and reload', async () => {
  const ownerId = new ObjectId();
  const mapId = new ObjectId();
  const map = { _id: mapId, ownerId, isPrivate: false, settings: {} };
  const collection = { findOne: async () => map,
    updateOne: async (_, update) => { Object.assign(map, update.$set); return { matchedCount: 1 }; } };
  const load = loader({ '@/lib/auth': { auth: async () => ({ user: { email: 'owner@example.test' } }) },
    '@/lib/mongodb': { getMongoClient: async () => ({ db: () => ({ collection: () => collection }) }) },
    '@/lib/userModel': { findUserByEmail: async () => ({ _id: ownerId }) } });
  const route = load('src/app/api/maps/[id]/route.ts');
  const context = { params: Promise.resolve({ id: String(mapId) }) };
  const body = { userEmail: 'owner@example.test', polygons: [drawing('pin', 'Pinned', 'cat', { alwaysVisible: true })],
    labels: [], events: [], categories: [category('cat', null, { alwaysVisible: true })],
    settings: { zoom: 15, center: [-120, 37], constraints: null, featureLayers: [] } };
  const post = value => route.POST(new Request('http://localhost/api/maps/map', { method: 'POST', body: JSON.stringify(value) }), context);
  assert.equal((await post(body)).status, 200);
  const saved = await (await route.GET(new Request('http://localhost/api/maps/map'), context)).json();
  assert.equal(saved.categories[0].alwaysVisible, true);
  assert.equal(saved.polygons[0].attributes.alwaysVisible, true);
  assert.equal((await post({ ...body, categories: [category('cat', null, { alwaysVisible: 'true' })] })).status, 400);
  assert.equal((await post({ ...body, polygons: [drawing('pin', 'Pinned', 'cat', { alwaysVisible: 'true' })] })).status, 400);
});

test('cancelled URL navigation cannot reopen a stale popup after the map or location changes', async () => {
  const previous = global.window;
  const frames = [];
  global.window = { requestAnimationFrame: callback => frames.push(callback), setTimeout: () => {} };
  try {
    let finishNavigation;
    let current = true;
    let opens = 0;
    const graphic = { geometry: { type: 'point', x: 0, y: 0 }, attributes: { id: 'target' } };
    const view = { popup: { close() {} },
      goTo: () => new Promise(resolve => { finishNavigation = resolve; }),
      openPopup: async () => { opens++; view.popup.selectedFeature = graphic; } };
    const refs = { MapViewRef: { current: view } };
    const { goToDrawing } = loader({ '../arcgisRefs': refs })('src/app/components/map/sidebar/useMapDrawings.ts');
    const cancelled = goToDrawing(graphic, { dock: true, isCurrent: () => current });
    current = false;
    finishNavigation();
    await cancelled;
    assert.equal(frames.length, 0);
    assert.equal(opens, 0);
    current = true;
    const selected = goToDrawing(graphic, { dock: true, isCurrent: () => current });
    finishNavigation();
    await selected;
    frames.shift()();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(opens, 1);
    assert.equal(view.popup.dockEnabled, true);
    assert.equal(view.popup.dockOptions.position, 'top-right');
    const switched = goToDrawing(graphic, { dock: true });
    refs.MapViewRef.current = null;
    finishNavigation();
    await switched;
    assert.equal(frames.length, 0);
    assert.equal(opens, 1);
  } finally { global.window = previous; }
});

test('readable location links and source-qualified event links encode names and record IDs safely', () => {
  const sharing = loader()('src/app/helper/mapSharing.ts');
  const location = 'Science & Engineering / North';
  const url = new URL(sharing.publicMapUrl('map', { location }, 'https://maps.example'));
  assert.equal(url.pathname, '/share/map');
  assert.equal(url.searchParams.get('location'), location);
  assert.deepEqual(sharing.graphicShareTarget({ id: 'old-id', name: location }), { location });
  assert.deepEqual(sharing.graphicShareTarget({ id: 'page-id', event_name: 'Showcase', sourceId: 'api-source', location }),
    { event: 'page-id', source: 'api-source' });
});

test('legacy sources default to Events; custom tabs persist independently of source order and item IDs', () => {
  const sources = loader()('src/app/types/apiSources.ts');
  const urls = ['https://one.example/events', 'https://two.example/data'];
  assert.deepEqual(sources.normalizeApiSourceTabs(urls, undefined).map(source => source.tabName), ['Events', 'Events']);
  assert.deepEqual(sources.normalizeApiSourceTabs([...urls].reverse(), [{ url: urls[0], tabName: ' Activities ' }]),
    [{ url: urls[1], tabName: 'Events' }, { url: urls[0], tabName: 'Activities' }]);
  assert.equal(sources.normalizeApiSourceTabs(urls, [{ url: urls[0], tabName: 'Home' }])[0].tabName, 'Events');
  assert.notEqual(sources.eventKey({ sourceUrl: urls[0], id: 'page' }), sources.eventKey({ sourceUrl: urls[1], id: 'page' }));
});

test('API records use location for mapping, retain page IDs and room details, and support undated data', async () => {
  const calls = [];
  const target = { node: { lon: -120.42, lat: 37.36 } };
  const load = loader({ './eventLocations': { resolveEventLocation: async location => { calls.push(location); return target; } },
    './mapHydration': { waitForMapHydration: async () => true } });
  const { normalizeApiEvent } = load('src/app/components/map/apiEvents.ts');
  const raw = { page_id: 'page-123', title: 'API notice', location: 'RF', location_at: 'Room 213' };
  const event = await normalizeApiEvent(raw, 'https://feed.example/data', 'map');
  assert.equal(event.id, 'page-123');
  assert.equal(event.location, 'RF');
  assert.equal(event.location_at, 'Room 213');
  assert.equal(event.date, undefined);
  assert.deepEqual(calls, ['RF']);
  assert.deepEqual(event.geometry, { x: -120.42, y: 37.36, wkid: 4326 });
  const generated = { title: 'No provided ID', lat: '37.36', lon: '-120.42' };
  assert.equal((await normalizeApiEvent(generated, 'https://feed.example/data', 'map')).id,
    (await normalizeApiEvent(generated, 'https://feed.example/data', 'map')).id);
  assert.equal((await normalizeApiEvent({ id: 0, lat: 37, lon: -120 }, 'https://feed.example/data', 'map')).id, '0');
  assert.equal(await normalizeApiEvent({ location_at: 'RF' }, 'https://feed.example/data', 'map'), null);
});

test('bulk visibility applies to the active content while calendar filters and admin locks remain effective', () => {
  const items = [drawing('building', 'Building', 'buildings'), drawing('pin', 'Pinned', null, { alwaysVisible: true })];
  const events = [{ attributes: { id: 'page', sourceUrl: 'one', runtimeCalendarVisible: true } },
    { attributes: { id: 'page', sourceUrl: 'two', runtimeCalendarVisible: true } }];
  const refs = { finalizedLayerRef: { current: layer(items) }, eventsLayerRef: { current: layer(events) },
    labelsLayerRef: { current: layer([]) }, spriteLayerRef: { current: layer([]) }, MapViewRef: { current: { zoom: 18 } } };
  const load = loader({ '../arcgisRefs': refs });
  load('src/app/components/map/categories/categoryStore.ts').setCategories([category('buildings')]);
  const visibility = load('src/app/components/map/categories/categoryVisibility.ts');
  visibility.setHomeVisibility(false);
  assert.deepEqual(items.map(item => item.visible), [false, true]);
  assert.ok(events.every(event => event.visible));
  visibility.setEventSourcesVisibility(['one'], false);
  const late = { attributes: { id: 'late', sourceUrl: 'one' } };
  events.push(late);
  visibility.applyEventVisibility();
  assert.deepEqual(events.map(event => event.visible), [false, true, false]);
  visibility.setHomeVisibility(true);
  assert.equal(events[0].visible, false, 'Home show-all does not reset the Events tab');
  events[0].attributes.runtimeCalendarVisible = false;
  visibility.setEventSourcesVisibility(['one'], true);
  assert.equal(events[0].visible, false, 'Show-all still honors the calendar');
  const { eventKey } = load('src/app/types/apiSources.ts');
  visibility.setMapLocationFocus('building', 'buildings', eventKey(events[0].attributes));
  assert.deepEqual(events.map(event => event.visible), [true, false, false], 'A shared event overrides date filters only for its qualified source and ID');
});
