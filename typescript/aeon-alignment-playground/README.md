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
`@altopelago/aeon-finalize`, and `@altopelago/aeon-wasm` packages are published at `0.9.0` or newer.
Before installing from npm, verify that none of the direct or transitive
packages were published or updated in the last 7 days. This example also ships
an `.npmrc` with `ignore-scripts=true` so dependency lifecycle scripts do not run
during install.

## Run

```bash
npm run dev
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
- Rust comparison uses `@altopelago/aeon-wasm`.
- AEON open/save uses browser file and download APIs.
- Neon wrapper controls are visible only as alignment-context settings; container read/write belongs in a separate desktop wrapper example.
- Schema-authoring mode can be layered on later without changing the engine comparison contract.
