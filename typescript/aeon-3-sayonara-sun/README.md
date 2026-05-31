# AEON Sayonara Sun

A config-loading example focused on reducing AEON boilerplate without hiding the phase boundaries.

## What this example is showing

Instead of inlining every validation branch in one file, this example pulls the repetitive pieces into a small helper module:

1. `loadAeonDocument(...)`
   - reads the file
   - compiles it
   - fail-closes on compile errors
   - indexes events by canonical path
2. `requireDatatype(...)`
   - checks stream-level datatype expectations
3. `requireSchema(...)`
   - runs AEOS schema validation over the assignment stream
4. `requireUnsignedIntegerRange(...)`
   - applies app-level business rules on trusted stream events
5. `requireNoFinalizeErrors(...)`
   - ensures finalization produced a clean object

The result is that `src/config.ts` still reads in phase order, but the boilerplate is lower and the app code only deals with trusted data.

## Files

- `sun.aeon`
  - strict-mode AEON config file
- `schema.aeos`
  - canonical AEOS schema artifact declared by `sun.aeon`
- `schema.json`
  - runtime mirror of the same schema for tools that still consume `SchemaV1` directly
- `src/aeon-config.ts`
  - reusable helper layer for staged validation
- `src/config.ts`
  - the actual config loader for this example
- `src/Farewell.ts`
  - small application model
- `src/index.ts`
  - runtime entrypoint

## Usage

```bash
cd typescript/aeon-3-sayonara-sun
npm install --ignore-scripts
npm start
```

## Why this pattern is useful

- It keeps AEON phase boundaries explicit.
- It avoids repeating the same compile/finalize/schema error plumbing in every app.
- It gives consumers one place to standardize how config failures are reported.

This is a better fit once you move beyond the smallest `hello-world` style example and want a reusable loading pattern.

House-style note:
- `sun.aeon` now declares `schema = "altopelago.sayonara-sun.schema.v1"` in `aeon:header`
- `schema.aeos` is the authoring artifact for that schema identity
- `schema.json` mirrors the same constraints as the current inline `requireSchema(...)` call
