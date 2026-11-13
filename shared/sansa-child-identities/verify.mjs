import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Select the candidate graph explicitly. Never silently substitute released pins.
const modules = process.argv.slice(2);
if (modules.length !== 3 || modules.some(value => !value.startsWith('file:'))) {
  throw new Error('Usage: node verify.mjs <core file: URL> <sdk/sansa file: URL> <sansa file: URL> (candidate builds required)');
}
const [{compile}, {createAeonNamespace}, {parseAddress, resolveAddress, evaluateQuery}] = await Promise.all(modules.map(value => import(value)));
const source = readFileSync(new URL('./inventory.aeon', import.meta.url), 'utf8');
const load = text => {
  const result = compile(text);
  assert.deepEqual(result.errors, []);
  return createAeonNamespace(result.events, {scope: 'payload'});
};
const namespace = load(source);
const selector = '$.inventory.items.\\item1\\.\\name1\\';
assert.equal(parseAddress(selector).address.isExact, false);
const first = resolveAddress(selector, namespace);
assert.equal(first.ok, true);
assert.equal(first.bindings.length, 1);
assert.equal(first.bindings[0].address, '$.inventory.items[0].name');
assert.equal(first.bindings[0].value, 'Widget');
assert.equal(first.bindings[0], resolveAddress('$.inventory.items[0].name', namespace).bindings[0]);
assert.deepEqual(resolveAddress('$.inventory.\\name1\\', namespace).bindings, []);

const query = evaluateQuery('from $.inventory.items.*\nselect .\\name1\\', namespace);
assert.equal(query.ok, true);
assert.equal(query.results.length, 2);
assert.equal(query.results[0].value.bindings[0].address, '$.inventory.items[0].name');
assert.deepEqual(query.results[1].value, {type: 'bindingSet', bindings: []});
const filtered = evaluateQuery('from $.inventory.items.*\nwhere exists(.\\name1\\)\nselect .\\name1\\', namespace);
assert.equal(filtered.ok, true);
assert.equal(filtered.results.length, 1);

// Recompile a new snapshot: this demonstrates selection after reorder, not
// occurrence continuity or a mutation/ordering API.
const lines = source.split('\n');
[lines[2], lines[3]] = [lines[3], lines[2]];
const after = resolveAddress(selector, load(lines.join('\n')));
assert.equal(after.ok, true);
assert.equal(after.bindings[0].address, '$.inventory.items[1].name');
assert.equal(after.bindings[0].value, 'Widget');
for (const marker of ['~', '~>']) {
  assert.ok(compile(`bad = ${marker}${selector}`).errors.length > 0);
}
console.log(JSON.stringify({before: first.bindings[0].address, after: after.bindings[0].address,
  candidates: query.results.length, emptyProjection: '(empty Binding Set)', filteredCandidates: filtered.results.length,
  directChildrenOnly: true, identityReferencesRejected: true}));
