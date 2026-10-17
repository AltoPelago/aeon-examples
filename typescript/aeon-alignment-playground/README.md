# AEON Alignment Playground

Browser playground for AEON implementation alignment:

- `TypeScript` runs directly in the frontend from published `@altopelago` packages.
- `Rust` runs in the frontend through the published `@altopelago/aeon-wasm` package.
- `Compare` runs both engines and reports normalized output matches and mismatches.

It focuses on the shared processing path:

- source editor
- TypeScript, Rust WASM, and comparison actions
- TypeScript vs Rust WASM comparison
- validation mode selector
- canonical output
- finalized JSON output
- annotation stream output
- optional AEOS-shaped schema validation
- schema builder overlay for peer, child, and wildcard child rules
- normalized event summary comparison
- diagnostics
- fixture-driven parity tests

## Install

From this directory:

```bash
npm install --ignore-scripts
```

This example pins published AEON 0.16.0 and independently versioned SANSA 0.14.2.
Before installing, run `npm run check:npm-package-age` from the repository
root. Its seven-day third-party quarantine explicitly exempts the first-party
AltoPelago release packages. This example also ships an `.npmrc` with
`ignore-scripts=true` so dependency lifecycle scripts do not run during install.

## Run

```bash
npm run dev
```

To run against the local AEON monorepo builds instead of the published npm
packages:

```bash
cd ../../../aeon/implementations/typescript
pnpm -r build
pnpm --filter @altopelago/aeon-wasm build:wasm
cd ../../../aeon-examples/typescript/aeon-alignment-playground
npm run dev:local
```

For a production frontend build:

```bash
npm run build
```

## Test

```bash
npm run test:playground
```

The default tests use the installed npm WASM binary, including SANSA literals,
symbols, reduced dates/WTC, second 60, authored fractional precision and
canonical trimtick/backtick payloads. They do not silently prefer a sibling
checkout. To additionally test a built local WASM binary:

```bash
AEON_TEST_LOCAL=1 npm run test:playground
```

The same command also tests the editor's trimtick token pattern: a single `>`
with optional SPACE/TAB before the backtick is highlighted as a trimtick string;
repeated `>>`, `>>>` and `>>>>` markers are not. This is a highlighting fix, not
a parser or canonical-writer behavior change.

The comparison normalizes native string-spelling labels, identifies WTC
separately from ordinary datetime, retains authored header order, and supplies
the known finalization phase for TypeScript finalizer diagnostics. Symbol JSON
rejection currently differs between engines in diagnostic wording and start
span. Those exact differences are regression-tested and remain visible as a
diagnostics mismatch; canonical output, event families and data are still
compared independently without discarding diagnostic messages or spans.

The former canonical-reference TODO regressions are ordinary passing assertions
against published 0.16.0 packages. Default reference-safe ordering preserves
reference legality and chooses the smallest eligible key at each step. Both
engines must preserve round-trip payloads and canonical fixed points; separate
tests check clone/pointer forms and targets without comparing authored spans or
requiring event emission order to survive sorting. Invalid authored references
are rejected, not repaired by canonicalization. See the
[0.16.0 migration guide](https://github.com/AltoPelago/aeon/blob/main/docs/migration-0.16.0.md)
before reusing stored canonical bytes or numeric clarifier ASTs.

## Notes

- The frontend uses published `@altopelago/aeon-*` package versions.
- `npm run dev:local` and `npm run build:local` alias `@altopelago/aeon-*`
  imports to `../../../aeon/implementations/typescript/packages/*/dist` and the
  local Rust WASM artifact.
- Local mode also aliases `@altopelago/sansa` to `../../../sansa/src/index.js`
  so current SANSA address literal parser changes are available before publish.
- Rust comparison uses `@altopelago/aeon-wasm`.
- AEON open/save uses browser file and download APIs.
- Schema validation is intentionally dependency-light in this playground and
  supports the shared v1 rule shape used by AEOS: `world`, `rules`, exact
  `path` rules, SANSA `selector` rules using `.*`, and common constraints such
  as `required`, `type`, `datatype`, string length and pattern checks, numeric
  bounds, container kind, and exact child count.
