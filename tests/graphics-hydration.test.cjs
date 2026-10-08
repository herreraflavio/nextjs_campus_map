const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/components/map/hydrateGraphics.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exported = { exports: {} };
new Function('module', 'exports', code)(exported, exported.exports);
const { hydrateGraphics } = exported.exports;

test('graphics hydrate in bounded batches without lost or repeated records', async () => {
  const source = Array.from({ length: 123 }, (_, i) => i);
  const seen = [], batches = [];
  await hydrateGraphics(source, item => { seen.push(item); return item; }, batch => batches.push(batch), new AbortController().signal);
  assert.deepEqual(seen, source);
  assert.deepEqual(batches.flat(), source);
  assert.ok(batches.length >= 4);
  assert.ok(batches.every(batch => batch.length <= 40));
});

test('null graphics do not prevent later records from loading', async () => {
  const result = [];
  await hydrateGraphics([0, 1, 2, 3], item => item === 1 ? null : item, batch => result.push(...batch), new AbortController().signal);
  assert.deepEqual(result, [0, 2, 3]);
});

test('switch/unmount aborts work between batches without appending stale graphics', async () => {
  const controller = new AbortController();
  const result = [];
  await assert.rejects(hydrateGraphics(Array.from({ length: 200 }, (_, i) => i), item => item, batch => {
    result.push(...batch);
    controller.abort();
  }, controller.signal), { name: 'AbortError' });
  assert.ok(result.length > 0 && result.length <= 40);
});
