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

This example is wired to public `@altopelago/aeon-*` package names. It should be installed
after the `@altopelago/aeon-annotation-stream`, `@altopelago/aeon-canonical`, `@altopelago/aeon-core`,
`@altopelago/aeon-finalize`, and `@altopelago/aeon-wasm` packages are published at `0.9.3` or newer.
Before installing from npm, verify that none of the direct or transitive
packages were published or updated in the last 7 days. This example also ships
an `.npmrc` with `ignore-scripts=true` so dependency lifecycle scripts do not run
during install.

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
