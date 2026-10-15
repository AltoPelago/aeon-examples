import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import fixtures from '../fixtures/playground-parity.json' with { type: 'json' };
import { processWithRustWasm, processWithTypeScriptCore } from '../src/playground-processor.js';
import { parseSchemaText, schemaToAeon } from '../src/schema-codec.js';
import { seedSchemaFromAeonSource } from '../src/schema-seed.js';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const LOCAL_WASM_ARTIFACT = resolve(
  TEST_DIR,
  '../../../../aeon/implementations/typescript/packages/wasm/pkg/aeon_wasm_bg.wasm',
);

const PACKAGE_WASM_ARTIFACT = resolve(
  dirname(fileURLToPath(import.meta.resolve('@altopelago/aeon-wasm'))),
  '../pkg/aeon_wasm_bg.wasm',
);

const PRIMARY_WASM_ARTIFACT = PACKAGE_WASM_ARTIFACT;
const testLocalWasm = process.env.AEON_TEST_LOCAL === '1' && existsSync(LOCAL_WASM_ARTIFACT);
const WASM_ARTIFACTS = [
  { name: 'package rust wasm', path: PACKAGE_WASM_ARTIFACT },
  ...(testLocalWasm ? [{ name: 'local rust wasm', path: LOCAL_WASM_ARTIFACT }] : []),
];

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
    if ('finalizedDocument' in fixture) {
      assert.deepEqual(result.finalized.document, fixture.finalizedDocument);
    }
    const roundTrip = await processWithTypeScriptCore(result.canonical.text, buildOptions(fixture.validationMode));
    assert.equal(roundTrip.canonical.text, result.canonical.text);
    if (!fixture.canonicalRoundTripIssue) {
      assert.deepEqual(roundTrip.finalized, result.finalized);
      assert.deepEqual(roundTrip.errors.map(error => error.code), result.errors.map(error => error.code));
    }
  });

  if (fixture.canonicalRoundTripIssue) {
    test(`canonical reference round-trip: ${fixture.name}`, { todo: fixture.canonicalRoundTripIssue }, async () => {
      const options = buildOptions(fixture.validationMode);
      const original = await processWithTypeScriptCore(fixture.source, options);
      const reparsed = await processWithTypeScriptCore(original.canonical.text, options);
      assert.deepEqual(reparsed.finalized, original.finalized);
      assert.deepEqual(reparsed.errors.map(error => error.code), original.errors.map(error => error.code));
    });
  }
}

for (const wasmArtifact of WASM_ARTIFACTS) {
  for (const fixture of fixtures) {
    const comparison = fixture.diagnosticDifferences ? 'preserves documented diagnostic differences' : 'matches typescript playground output';
    test(`${wasmArtifact.name} ${comparison}: ${fixture.name}`, async () => {
      const options = buildOptions(fixture.validationMode);
      const typescript = await processWithTypeScriptCore(fixture.source, options);
      const rust = await processWithRustWasm(
        fixture.source,
        options,
        readFileSync(wasmArtifact.path),
      );

      assert.deepEqual(rust.ok, typescript.ok);
      assert.deepEqual(rust.canonical, typescript.canonical);
      assert.deepEqual(rust.finalized, typescript.finalized);
      assert.deepEqual(rust.annotations, typescript.annotations);
      assert.deepEqual(rust.events, typescript.events);
      if (fixture.diagnosticDifferences) {
        // Keep the known wording/range difference visible in the comparison UI.
        // Assert it explicitly instead of deleting messages/spans from normalization.
        const stable = ({ code, path, phase }) => ({ code, path, phase });
        assert.deepEqual(rust.errors.map(stable), typescript.errors.map(stable));
        assert.deepEqual(rust.warnings, typescript.warnings);
        assert.equal(rust.errors.length, 1);
        assert.equal(rust.errors[0].message, fixture.diagnosticDifferences.rustMessage);
        assert.equal(typescript.errors[0].message, fixture.diagnosticDifferences.typescriptMessage);
        assert.equal(rust.errors[0].span.start.column, fixture.diagnosticDifferences.rustStartColumn);
        assert.equal(typescript.errors[0].span.start.column, fixture.diagnosticDifferences.typescriptStartColumn);
        assert.deepEqual(rust.errors[0].span.end, typescript.errors[0].span.end);
      } else {
        assert.deepEqual(rust.diagnostics, typescript.diagnostics);
      }
    });
  }
}

test('local rust wasm playground adapter accepts SANSA address literals', async (t) => {
  if (!testLocalWasm) {
    t.skip('set AEON_TEST_LOCAL=1 to test the optional sibling artifact');
    return;
  }

  const { loadAeonWasm } = await import(
    '../../../../aeon/implementations/typescript/packages/wasm/dist/index.js'
  );
  const runtime = await loadAeonWasm(readFileSync(LOCAL_WASM_ARTIFACT));
  const result = runtime.processAeon('csv:sansa = $.inventory:csv[","]\nctx:sansa = ?.name\n', {
    ...buildOptions('strict'),
    validationMode: 'strict',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.events.map((event) => event.valueType),
    ['SansaAddressLiteral', 'SansaAddressLiteral'],
  );
  assert.deepEqual(result.finalized, {
    document: {
      csv: '$.inventory:csv[","]',
      ctx: '?.name',
    },
  });
});

test('published playground processors accept SANSA address literal boundaries', async () => {
  const source = [
    'a:sansa = $.name/* block */',
    'b:sansa = $.name// line',
    'c:list = [$.name]',
    'd:node = <tag($.name)>',
    'e:tuple = ($.name)',
  ].join('\n');
  const options = buildOptions('strict');
  const typescript = await processWithTypeScriptCore(source, options);
  const rust = await processWithRustWasm(source, options, readFileSync(PACKAGE_WASM_ARTIFACT));

  assert.equal(typescript.ok, true);
  assert.deepEqual(typescript.errors, []);
  assert.deepEqual(
    typescript.events.map((event) => event.path),
    ['$.a', '$.b', '$.c', '$.c[0]', '$.d', '$.d[0]', '$.e', '$.e[0]'],
  );
  assert.deepEqual(
    typescript.events.map((event) => event.valueType),
    [
      'SansaAddressLiteral',
      'SansaAddressLiteral',
      'ListNode',
      'SansaAddressLiteral',
      'NodeLiteral',
      'SansaAddressLiteral',
      'TupleLiteral',
      'SansaAddressLiteral',
    ],
  );
  assert.deepEqual(rust.ok, typescript.ok);
  assert.deepEqual(rust.events, typescript.events);
  assert.deepEqual(rust.diagnostics, typescript.diagnostics);
});

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
      '$.["aeon:mode"]',
      '$.["aeon:encoding"]',
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

test('typescript playground accepts AEON schema text', async () => {
  const result = await processWithTypeScriptCore(
    'app:object = {\n  name:string = "ok"\n  port:number = 70000\n}\n',
    {
      ...buildOptions('strict'),
      schemaEnabled: true,
      schemaText: schemaToAeon({
        world: 'open',
        rules: [
          { path: '$.app', constraints: { type: 'ObjectNode', required: true } },
          { path: '$.app.name', constraints: { type: 'StringLiteral', required: true } },
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

test('schema codec emits AEOS wrapper and format directive', () => {
  const schemaText = schemaToAeon({
    world: 'open',
    rules: [
      { path: '$.app.name', constraints: { type: 'StringLiteral', required: true } },
      { selector: '$.app.tags.*', constraints: { type: 'StringLiteral' } },
    ],
  });

  assert.match(schemaText, /^\/\/! format:aeos-v1\n/);
  assert.match(schemaText, /aeos:schema = \{/);
  assert.match(schemaText, /selector:sansa = \$\.app\.tags\.\*/);
  assert.match(schemaText, /path:sansa = \$\.app\.name/);
  assert.deepEqual(parseSchemaText(schemaText), {
    world: 'open',
    rules: [
      { path: '$.app.name', constraints: { type: 'StringLiteral', required: true } },
      { selector: '$.app.tags.*', constraints: { type: 'StringLiteral' } },
    ],
  });
});

test('schema codec rejects legacy indexed wildcard rules', () => {
  assert.throws(
    () => parseSchemaText(JSON.stringify({
      world: 'open',
      rules: [
        { path: '$.items[*]', constraints: { type: 'StringLiteral' } },
      ],
    })),
    /Legacy indexed wildcard '\[\*\]' is not valid/,
  );
});

test('typescript playground applies SANSA selector schema rules', async () => {
  const result = await processWithTypeScriptCore(
    'app:object = {\n  tags:list = ["ok", 3]\n}\n',
    {
      ...buildOptions('strict'),
      schemaEnabled: true,
      schemaText: JSON.stringify({
        world: 'open',
        rules: [
          { path: '$.app', constraints: { type: 'ObjectNode', required: true } },
          { path: '$.app.tags', constraints: { type: 'ListNode', required: true } },
          { selector: '$.app.tags.*', constraints: { type: 'StringLiteral' } },
        ],
      }),
    },
  );

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    ['type_mismatch'],
  );
});

test('typescript playground resolves schema selectors with SANSA patterns, descendants, and filters', async () => {
  const result = await processWithTypeScriptCore(
    [
      'inventory:object = {',
      '  items:list = [',
      '    {',
      '      sku:string = "A-100"',
      '      qty:number = 2',
      '    }',
      '    {',
      '      sku:string = "B-200"',
      '      qty:number = 3',
      '    }',
      '  ]',
      '}',
    ].join('\n'),
    {
      ...buildOptions('strict'),
      schemaEnabled: true,
      schemaText: JSON.stringify({
        world: 'open',
        rules: [
          { selector: '$.inventory.**.("s?u")#string%string', constraints: { type: 'StringLiteral', pattern: '^A-' } },
          { selector: '$.inventory.items.*.qty#number%number', constraints: { type: 'NumberLiteral', min_value: '1' } },
        ],
      }),
    },
  );

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => [error.code, error.path]),
    [['string_pattern', '$.inventory.items[1].sku']],
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
      ...buildOptions('transport'),
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
      ...buildOptions('transport'),
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

test('typescript playground validates schema rules against SANSA attribute-space paths', async () => {
  const passing = await processWithTypeScriptCore(
    'width@{x:string = "cm"}:list = [@{unit:string = "cm"} = 3]\n',
    {
      ...buildOptions('strict'),
      schemaEnabled: true,
      schemaText: schemaToAeon({
        world: 'open',
        rules: [
          { path: '$.width.@.x', constraints: { type: 'StringLiteral', required: true } },
          { path: '$.width[0].@.unit', constraints: { type: 'StringLiteral', required: true } },
        ],
      }),
    },
  );
  assert.equal(passing.ok, true);

  const failing = await processWithTypeScriptCore(
    'width@{x:string = "cm"}:list = [@{unit:string = "cm"} = 3]\n',
    {
      ...buildOptions('strict'),
      schemaEnabled: true,
      schemaText: schemaToAeon({
        world: 'open',
        rules: [
          { path: '$.width.@.missing', constraints: { type: 'StringLiteral', required: true } },
          { selector: '$.width.*.@.unit', constraints: { type: 'NumberLiteral', required: true } },
        ],
      }),
    },
  );

  assert.equal(failing.ok, false);
  assert.deepEqual(
    failing.errors.map((error) => error.code),
    ['missing_required_field', 'type_mismatch'],
  );
});

test('typescript playground closed-world schemas use SANSA selector resolution', async () => {
  const result = await processWithTypeScriptCore(
    [
      'reading@{unit:string = "cm"}:number = 12',
      'other:string = "outside"',
    ].join('\n'),
    {
      ...buildOptions('strict'),
      schemaEnabled: true,
      schemaText: schemaToAeon({
        world: 'closed',
        rules: [
          { selector: '$.reading.@.*#string%string', constraints: { type: 'StringLiteral' } },
          { path: '$.reading', constraints: { type: 'NumberLiteral' } },
        ],
      }),
    },
  );

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => [error.code, error.path]),
    [['unexpected_binding', '$.other']],
  );
});

test('schema builder seed preserves nested source paths', () => {
  const rules = seedSchemaFromAeonSource(
    [
      'app:object = {',
      '  name:string = "ok"',
      '  nested:object = {',
      '    enabled:boolean = true',
      '  }',
      '  tags:list = ["browser", "wasm"]',
      '}',
    ].join('\n'),
    {
      validationMode: 'strict',
      maxSeparatorDepth: 8,
      maxAttributeDepth: 1,
      maxGenericDepth: 1,
    },
  );

  assert.deepEqual(
    rules.map((rule) => [rule.path, rule.constraints.type]),
    [
      ['$.app', 'ObjectNode'],
      ['$.app.name', 'StringLiteral'],
      ['$.app.nested', 'ObjectNode'],
      ['$.app.nested.enabled', 'BooleanLiteral'],
      ['$.app.tags', 'ListNode'],
      ['$.app.tags[0]', 'StringLiteral'],
      ['$.app.tags[1]', 'StringLiteral'],
    ],
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
  const rust = await processWithRustWasm(source, options, readFileSync(PRIMARY_WASM_ARTIFACT));

  assert.deepEqual(typescript.errors, []);
  assert.deepEqual(rust.errors, []);
  assert.deepEqual(rust.canonical, typescript.canonical);
  assert.deepEqual(rust.finalized, typescript.finalized);
  assert.deepEqual(
    typescript.events.map((event) => event.path),
    ['$.["aeon:mode"]', '$.["aeon:encoding"]'],
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
    readFileSync(PRIMARY_WASM_ARTIFACT),
  );

  assert.equal(result.engine, 'rust-wasm');
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.events[0]?.valueType, 'ToggleLiteral');
  assert.deepEqual(result.finalized.document, { state: true });
});
