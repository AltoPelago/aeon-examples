import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import fixtures from '../fixtures/playground-parity.json' with { type: 'json' };
import { processWithRustWasm, processWithTypeScriptCore } from '../src/playground-processor.js';

const LOCAL_WASM_ARTIFACT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../aeon/implementations/typescript/packages/wasm/pkg/aeon_wasm_bg.wasm',
);

const PACKAGE_WASM_ARTIFACT = resolve(
  dirname(fileURLToPath(import.meta.resolve('@altopelago/aeon-wasm'))),
  '../pkg/aeon_wasm_bg.wasm',
);

const WASM_ARTIFACT = existsSync(LOCAL_WASM_ARTIFACT) ? LOCAL_WASM_ARTIFACT : PACKAGE_WASM_ARTIFACT;

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
    const typescript = await processWithTypeScriptCore(fixture.source, options);
    const rust = await processWithRustWasm(
      fixture.source,
      options,
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

test('typescript playground preserves structured headers with comment trivia before the object', async () => {
  const result = await processWithTypeScriptCore(
    [
      'aeon : header /# #/=   /# #/{',
      '  mode:string = "strict"',
      '  encoding:string = "utf-8"',
      '  profile:string = "aeon.gp.profile.v1"',
      '  version:string = "1"',
      '}',
    ].join('\n'),
    {
      ...buildOptions('strict'),
      finalizeScope: 'full',
    },
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.finalized.document, {
    header: {
      mode: 'strict',
      encoding: 'utf-8',
      profile: 'aeon.gp.profile.v1',
      version: '1',
    },
    payload: {},
  });
  assert.deepEqual(
    result.events.map((event) => event.path),
    [
      '$.["aeon:encoding"]',
      '$.["aeon:mode"]',
      '$.["aeon:profile"]',
      '$.["aeon:version"]',
    ],
  );
});

test('typescript playground applies custom schema validation', async () => {
  const result = await processWithTypeScriptCore(
    'app:object = {\n  name:string = "ok"\n  port:number = 70000\n}\n',
    {
      ...buildOptions('strict'),
      schemaEnabled: true,
      schemaText: JSON.stringify({
        world: 'open',
        rules: [
          { path: '$.app', constraints: { type: 'ObjectNode', required: true } },
          { path: '$.app.name', constraints: { type: 'StringLiteral', required: true, min_length: 1 } },
          { path: '$.app.port', constraints: { type: 'NumberLiteral', required: true, max_value: '65535' } },
        ],
      }),
    },
  );

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    ['numeric_max_value'],
  );
});

test('typescript playground rejects unexpected bindings in closed schema world', async () => {
  const result = await processWithTypeScriptCore(
    'app:object = {\n  name:string = "ok"\n  debug:boolean = true\n}\n',
    {
      ...buildOptions('strict'),
      schemaEnabled: true,
      schemaText: JSON.stringify({
        world: 'closed',
        rules: [
          { path: '$.app', constraints: { type: 'ObjectNode', required: true } },
          { path: '$.app.name', constraints: { type: 'StringLiteral', required: true } },
        ],
      }),
    },
  );

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    ['unexpected_binding'],
  );
});

test('typescript playground validates toggle pair constraints', async () => {
  const result = await processWithTypeScriptCore(
    'enabled:toggle = yes\nvisible:toggle = on\n',
    {
      ...buildOptions('strict'),
      schemaEnabled: true,
      schemaText: JSON.stringify({
        world: 'open',
        rules: [
          { path: '$.enabled', constraints: { type: 'ToggleLiteral', toggle_pair: 'yes_no' } },
          { path: '$.visible', constraints: { type: 'ToggleLiteral', toggle_pair: 'yes_no' } },
        ],
      }),
    },
  );

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    ['toggle_pair_mismatch'],
  );
});

test('typescript playground validates nullable, null value, numeric widening, and child cardinality constraints', async () => {
  const passing = await processWithTypeScriptCore(
    'app:o = {\n  name:null = !none\n  score:infinity = Infinity\n  sample:nan = NaN\n}\n',
    {
      ...buildOptions('loose'),
      schemaEnabled: true,
      schemaText: JSON.stringify({
        world: 'open',
        rules: [
          { path: '$.app', constraints: { type: 'ObjectNode', min_children: 3, max_children: 3 } },
          { path: '$.app.name', constraints: { type: 'StringLiteral', nullable: true, null_value: 'none' } },
          { path: '$.app.score', constraints: { type: 'NumberLiteral', allow_infinity: true } },
          { path: '$.app.sample', constraints: { type: 'NumberLiteral', allow_nan: true } },
        ],
      }),
    },
  );
  assert.equal(passing.ok, true);

  const failing = await processWithTypeScriptCore(
    'app:o = {\n  name:null = !notApplicable\n  score:infinity = Infinity\n}\n',
    {
      ...buildOptions('loose'),
      schemaEnabled: true,
      schemaText: JSON.stringify({
        world: 'open',
        rules: [
          { path: '$.app', constraints: { type: 'ObjectNode', max_children: 1 } },
          { path: '$.app.name', constraints: { type: 'StringLiteral', nullable: true, null_value: 'none' } },
          { path: '$.app.score', constraints: { type: 'NumberLiteral' } },
        ],
      }),
    },
  );

  assert.equal(failing.ok, false);
  assert.deepEqual(
    failing.errors.map((error) => error.code),
    ['container_cardinality_mismatch', 'null_value_mismatch', 'type_mismatch'],
  );
});

test('playground validation mode does not duplicate tokenized structured headers', async () => {
  const source = [
    'aeon',
    ':',
    'header /# #/=   /# #/{',
    '  mode:',
    'string = "strict"',
    '  encoding:string = "utf-8"',
    '}',
  ].join('\n');
  const options = {
    ...buildOptions('strict'),
    finalizeScope: 'full',
  };
  const typescript = await processWithTypeScriptCore(source, options);
  const rust = await processWithRustWasm(source, options, readFileSync(WASM_ARTIFACT));

  assert.deepEqual(typescript.errors, []);
  assert.deepEqual(rust.errors, []);
  assert.deepEqual(rust.canonical, typescript.canonical);
  assert.deepEqual(rust.finalized, typescript.finalized);
  assert.deepEqual(
    typescript.events.map((event) => event.path),
    ['$.["aeon:encoding"]', '$.["aeon:mode"]'],
  );
  assert.deepEqual(rust.events, typescript.events);
});

test('typescript playground finalizes anonymous attributed children', async () => {
  const result = await processWithTypeScriptCore(
    'width:list = [@{unit:string = "cm"} = 3]\n',
    buildOptions('strict'),
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
    readFileSync(WASM_ARTIFACT),
  );

  assert.equal(result.engine, 'rust-wasm');
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.events[0]?.valueType, 'ToggleLiteral');
  assert.deepEqual(result.finalized.document, { state: true });
});
