import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createAeonNamespace, readAeonNamespace } from '@altopelago/aeon-sdk/sansa';
import { canonicalAddress, loadInventory, queries, queryRequired, queryValueForDisplay, resolveRequired, sampleAddresses } from './explorer.js';

const source = readFileSync(new URL('../inventory.aeon', import.meta.url), 'utf8');
const skus = ['A-100', 'B-200', 'C-300', 'D-250', 'E-110', 'S-400'];
const names = ['Adapter Bracket', 'Heavy Duty Clamp', 'Coupler Nut M8', 'Torque Driver', 'Extractor Bit Set', 'Thermal Probe'];

test('uses the published adapter and keeps header fields outside payload queries', () => {
  const { compile, namespace } = loadInventory(source);
  assert.deepEqual(compile.errors, []);
  assert.deepEqual(namespace.root.children.map(binding => binding.name), ['inventory']);
  assert.equal(resolveRequired('$.inventory', namespace)[0].semanticType, 'inventoryRecord');
  assert.equal(resolveRequired('$.inventory.items', namespace)[0].representationKind, 'ListNode');
  const warehouse = resolveRequired('$.inventory.warehouse', namespace)[0];
  assert.equal(warehouse.value, 'Pacific-North');
  assert.equal(warehouse.origin, `sha256:${createHash('sha256').update(source).digest('hex')}`);
  assert.ok(warehouse.span);
  const [start, end] = warehouse.span.split(':').map(Number);
  assert.equal(Buffer.from(source).subarray(start, end).toString('utf8'), 'warehouse:string = "Pacific-North"');
  const full = createAeonNamespace(compile.events, { scope: 'full' });
  assert.equal(resolveRequired('$.header.["aeon:mode"]', full)[0].value, 'custom');
  assert.equal(resolveRequired('$.body.inventory.warehouse', full)[0].value, 'Pacific-North');
});

test('address parsing, wildcard resolution and portable representation filters work', () => {
  const { namespace } = loadInventory(source);
  assert.deepEqual(sampleAddresses.map(address => canonicalAddress(address).exact), [true, false, false, false]);
  for (const address of sampleAddresses) {
    const parsed = canonicalAddress(address);
    assert.equal(canonicalAddress(parsed.canonical).canonical, parsed.canonical);
    assert.ok(resolveRequired(address, namespace).length > 0, address);
  }
  const bindings = resolveRequired('$.inventory.items.*.sku', namespace);
  assert.deepEqual(bindings.map(binding => binding.value), skus);
  assert.deepEqual(bindings.map(binding => binding.address), skus.map((_, index) => `$.inventory.items[${index}].sku`));
  assert.deepEqual(resolveRequired('$.inventory.items.*.qty%NumberLiteral', namespace).map(binding => binding.value), [14, 4, 0, 8, 2, 6]);
});

test('native numbers are explicit and the adapter retains numeric lexemes', () => {
  const { compile, namespace } = loadInventory(source);
  const price = resolveRequired('$.inventory.items[1].price', namespace)[0];
  assert.equal(price.value, 24.5);
  assert.equal(price.numericLexeme, '24.5');
  const lossless = createAeonNamespace(compile.events);
  assert.equal(resolveRequired('$.inventory.items[1].price', lossless)[0].value, '24.5');
  const precise = readAeonNamespace('value = 9007199254740993').namespace;
  assert.equal(resolveRequired('$.value', precise)[0].value, '9007199254740993');
});

const expectedValues = [
  skus.map((sku, index) => ({ sku, name: names[index] })),
  [0, 1, 3, 5].map(index => ({ sku: skus[index], name: names[index], price: [9.95, 24.5, 15, 34.99, 49.95, 89][index] })),
  [1, 2].map(index => ({ sku: skus[index], name: names[index], price: [9.95, 24.5, 15][index] })),
  [{ name: names[0], qty: 14 }, { name: names[3], qty: 8 }, { name: names[5], qty: 6 }],
  [{ sku: skus[1], name: names[1], category: 'hardware' }, { sku: skus[5], name: names[5], category: 'sensors' }],
];
const expectedIndices = [[0, 1, 2, 3, 4, 5], [0, 1, 3, 5], [1, 2], [0, 3, 5], [1, 5]];

queries.forEach(({ title, query }, index) => {
  test(`query results and provenance: ${title}`, () => {
    const { namespace } = loadInventory(source);
    const rows = queryRequired(query, namespace);
    assert.deepEqual(rows.map(row => row.value), expectedValues[index].map(value => ({ type: 'object', value })));
    assert.deepEqual(rows.map(row => row.candidateAddress), expectedIndices[index].map(item => `$.inventory.items[${item}]`));
    assert.deepEqual(rows.map(row => queryValueForDisplay(row.value)), expectedValues[index]);
  });
});

test('display formatting handles scalar and binding-set results without changing their tags', () => {
  const { namespace } = loadInventory(source);
  const scalar = queryRequired('from $.inventory.items[0] select 1', namespace)[0].value;
  assert.deepEqual(scalar, { type: 'scalar', value: '1' });
  assert.equal(queryValueForDisplay(scalar), '1');
  const bindings = queryRequired('from $.inventory.items[0] select .sku', namespace)[0].value;
  assert.equal(bindings.type, 'bindingSet');
  assert.deepEqual(queryValueForDisplay(bindings), [{ address: '$.inventory.items[0].sku', value: 'A-100' }]);
  assert.equal(bindings.type, 'bindingSet');
});

test('0.15 adapter keeps binding and node-head metadata and content distinct', () => {
  const { namespace } = readAeonNamespace(String.raw`value\BINDING\@{keyMeta = "outer"} = <tag\HEAD\@{role = "button"}("hello")>`);
  const binding = resolveRequired('$.value', namespace)[0];
  const head = resolveRequired('$.value[0]%NodeHead', namespace)[0];
  assert.equal(binding.identity, 'BINDING');
  assert.equal(binding.representationKind, 'NodeLiteral');
  assert.equal(head.identity, 'HEAD');
  assert.equal(head.representationKind, 'NodeHead');
  assert.equal(resolveRequired('$.value.@.keyMeta', namespace)[0].value, 'outer');
  assert.equal(resolveRequired('$.value[0].@.role', namespace)[0].value, 'button');
  assert.equal(resolveRequired('$.value[0][0]', namespace)[0].value, 'hello');
  assert.equal(namespace.parent?.(head), binding);
});

test('adapter preserves symbols and Core reduced-date/WTC payloads without JSON conversion', () => {
  // readAeonNamespace gates compilation; these assertions inspect the namespace,
  // not strict-JSON finalization (symbols are intentionally not JSON strings).
  const { namespace } = readAeonNamespace('stage = |approved|\nwindow = 2024-T10:&Europe');
  const stage = resolveRequired('$.stage', namespace)[0];
  assert.equal(stage.representationKind, 'SymbolicLiteral');
  assert.equal(stage.scalarKind, 'symbol');
  assert.equal(stage.value, 'approved');
  const window = resolveRequired('$.window', namespace)[0];
  assert.equal(window.representationKind, 'WTCDateTimeLiteral');
  assert.equal(window.value, '2024-T10:&Europe');
});

test('compile, finalization, address and query errors do not produce a success summary', () => {
  assert.throws(() => loadInventory('inventory = {'), /AEON compile failed/);
  assert.throws(() => loadInventory('value = |approved|'), /AEON finalize failed/);
  assert.throws(() => canonicalAddress('$..['), /Address parse failed/);
  const { namespace } = loadInventory(source);
  assert.throws(() => resolveRequired('$..[', namespace), /Address resolution failed/);
  assert.throws(() => resolveRequired('$.missing', namespace), /No bindings found/);
  assert.throws(() => queryRequired('from $.inventory.items.* where', namespace), /Query failed/);
});

test('console walkthrough runs from outside the example directory', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./index.js', import.meta.url))], { cwd: tmpdir(), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal((result.stdout.match(/Result records \(/g) ?? []).length, 5);
  assert.match(result.stdout, /Completed AEON -> AES -> SANSA walkthrough/);
});
