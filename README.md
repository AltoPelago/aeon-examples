# AEON Examples

Public examples for AEON documents, schemas, tooling, and SDK usage.

The examples are configured for registry package versions rather than
sibling-repo local-path dependencies, so fresh installs exercise the public
package surface.

- `typescript/`
- `python/`
- `rust/`
- `shared/` for language-neutral example assets

## Examples

Start with the Hello World examples if you are learning the language shape.
Move to the Sayonara Sun examples when you want a fuller config-loading pattern
with validation and application rules. Use the shared examples when you want to
study schema and conformance behavior without committing to one implementation
language.

### TypeScript

| Example | What it demonstrates |
| --- | --- |
| [Hello World](./typescript/aeon-1-hello-world/) | Minimal AEON file loading with best-practice two-stage validation: check the assignment stream, finalize, then print trusted application data. |
| [Goodnight Moon](./typescript/aeon-2-goodnight-moon/) | A deeper config example with nested objects, custom datatypes, separator-literal validation, business rules, and time-based application logic. |
| [Sayonara Sun](./typescript/aeon-3-sayonara-sun/) | A reusable config-loading pattern that keeps compile, schema validation, business checks, and finalization explicit while reducing boilerplate. |
| [Validating a Contact List](./typescript/validating-a-contact-list/) | Contact-list ingestion with strict validation, AEOS schema artifacts, assignment-stream checks, sample data generation, and mapping into typed application objects. |
| [AEON Todo Web App](./typescript/aeon-web-todo/) | A Svelte + Vite browser app that imports todo lists from AEON, autosaves a browser draft, and exports the current list back to AEON. |
| [AEON Alignment Playground](./typescript/aeon-alignment-playground/) | Browser playground for comparing TypeScript and Rust WASM processing, including canonical output, finalized JSON, annotations, diagnostics, and schema checks. |

### Python

| Example | What it demonstrates |
| --- | --- |
| [Hello World](./python/python-hello-world/) | The smallest Python starting point: load `hello.aeon`, read one value, and compare minimal, commented, and finalized-document styles. |
| [Sayonara Sun](./python/python-sayonara-sun/) | Python counterpart to the staged Sayonara Sun flow: high-level loading, schema validation, business checks, and mapping into a small model. |

### Rust

| Example | What it demonstrates |
| --- | --- |
| [Hello World](./rust/hello-world/) | Minimal Rust loading into a typed struct using the Rust library surface directly. |
| [Sayonara Sun](./rust/sayonara-sun/) | Richer Rust config loading with AEOS validation, business checks, and message rendering from trusted data. |

### Shared

| Example | What it demonstrates |
| --- | --- |
| [Contracts Baseline](./shared/contracts-baseline/) | Contract registry resolution for `aeon:profile` and `aeon:schema`, including trusted artifact hash verification before load. |
| [Reference-Safe Schema](./shared/reference-safe-schema/) | AEOS reference hardening with `reference_target_path` and `resolve_reference_form`, showing valid references, swapped-domain failures, and laundered-terminal failures. |
| [Schema Policy Showcase](./shared/schema-policy-showcase/) | Comparative schema behavior: open vs closed world, reference allowed vs forbidden, and direct-literal requirements over the same AEON document. |

## Repository Hygiene

Run these checks before publishing changes:

```sh
npm run clean:check
npm run check:local-paths
npm run check:npm-install-policy
```

Use `npm run clean` to remove generated files and local-only environment files.
Before running `npm install --ignore-scripts` in any example, run
`npm run check:npm-package-age` from the repo root.
