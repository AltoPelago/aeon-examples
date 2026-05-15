import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import fixtures from '../fixtures/playground-parity.json' with { type: 'json' };
import { processWithRustWasm, processWithTypeScriptCore } from '../src/playground-processor.js';

const WASM_ARTIFACT = resolve(
  dirname(fileURLToPath(import.meta.resolve('@altopelago/aeon-wasm'))),
  '../pkg/aeon_wasm_bg.wasm',
);

function buildOptions(validationMode) {
  return {
    validationMode,
    maxSeparatorDepth: 8,
    maxAttributeDepth: 1,
    maxGenericDepth: 1,
    materializationMode: 'all',
    finalizeScope: 'payload',
    includePaths: [],
  };
}

for (const fixture of fixtures) {
  test(`typescript playground parity: ${fixture.name}`, async () => {
    const result = await processWithTypeScriptCore(
      fixture.source,
      buildOptions(fixture.validationMode),
      null,
    );

    for (const expected of fixture.canonicalContains ?? []) {
      assert.match(result.canonical.text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    assert.equal(result.engine, 'typescript');
    assert.equal(result.ok, (fixture.errorCodes ?? []).length === 0);
    assert.deepEqual(
      result.errors.map((error) => error.code),
      fixture.errorCodes ?? [],
    );
    assert.deepEqual(
      result.warnings.map((warning) => warning.code),
      fixture.warningCodes ?? [],
    );
    assert.deepEqual(
      result.events.map((event) => event.path),
      fixture.eventPaths ?? [],
    );
    assert.deepEqual(
      result.events.map((event) => event.valueType),
      fixture.eventTypes ?? [],
    );
  });
}

for (const fixture of fixtures) {
  test(`rust wasm matches typescript playground output: ${fixture.name}`, async () => {
    const options = buildOptions(fixture.validationMode);
    const typescript = await processWithTypeScriptCore(fixture.source, options, null);
    const rust = await processWithRustWasm(
      fixture.source,
      options,
      null,
      readFileSync(WASM_ARTIFACT),
    );

    assert.deepEqual(rust.ok, typescript.ok);
    assert.deepEqual(rust.canonical, typescript.canonical);
    assert.deepEqual(rust.finalized, typescript.finalized);
    assert.deepEqual(rust.annotations, typescript.annotations);
    assert.deepEqual(rust.events, typescript.events);
    assert.deepEqual(rust.diagnostics, typescript.diagnostics);
  });
}

test('typescript playground exposes structured annotation stream records', async () => {
  const result = await processWithTypeScriptCore(
    '//# document note\n//@ inline hint\na:string = "ok"\n',
    buildOptions('strict'),
    null,
  );

  assert.equal(result.errors.length, 0);
  assert.equal(result.ok, true);
  assert.equal(result.annotations.length, 2);
  assert.equal(result.annotations[0].kind, 'doc');
  assert.equal(result.annotations[1].kind, 'annotation');
  assert.deepEqual(result.annotations[1].target, {
    kind: 'path',
    path: '$.a',
  });
});

test('typescript playground finalizes anonymous attributed children', async () => {
  const result = await processWithTypeScriptCore(
    'width:list = [@{unit:string = "cm"} = 3]\n',
    buildOptions('strict'),
    null,
  );

  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.finalized.document, {
    width: [3],
    '@': {
      width: {
        '@items': {
          '0': {
            unit: 'cm',
          },
        },
      },
    },
  });
});

test('typescript playground projects binding and child attributes separately', async () => {
  const result = await processWithTypeScriptCore(
    'width@{x:string = "cm"}:list = [@{unit:string = "cm"} = 3]\n',
    buildOptions('strict'),
    null,
  );

  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.finalized.document, {
    width: [3],
    '@': {
      width: {
        x: 'cm',
        '@items': {
          '0': {
            unit: 'cm',
          },
        },
      },
    },
  });
});

test('rust wasm playground adapter emits the normalized engine shape', async () => {
  const result = await processWithRustWasm(
    'state:toggle = on\n',
    buildOptions('strict'),
    null,
    readFileSync(WASM_ARTIFACT),
  );

  assert.equal(result.engine, 'rust-wasm');
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.events[0]?.valueType, 'ToggleLiteral');
  assert.deepEqual(result.finalized.document, { state: true });
});
