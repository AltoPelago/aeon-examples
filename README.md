# AEON Examples

Public examples for AEON documents, schemas, tooling, and SDK usage.

The examples use published AEON 0.15.0 packages from npm, crates.io and PyPI.
Rust uses the public `altopelago-aeon` facade; native Python imports
`altopelago.aeon` on CPython 3.12–3.14, not the separate pure-Python reference.
Fresh installs exercise registry artifacts, not sibling-repository paths.

AEON remains on the v1 language line. Consumers of the TypeScript SANSA
adapter should read the [0.15.0 migration guide](https://github.com/AltoPelago/aeon/blob/main/docs/migration-0.15.0.md):
node heads and content have distinct addresses, representation names use
PascalCase, reference paths are portable strings, and key/head metadata remain
separate. The ordinary JSON-profile loading examples do not use that adapter.

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

Create a virtual environment with CPython 3.12, 3.13 or 3.14 before installing
the pinned requirements. Only the native distribution is used here:

```bash
python3 -m venv ../aeon-examples-venv
source ../aeon-examples-venv/bin/activate
python -m pip install -r python/python-hello-world/requirements.txt
python -m unittest discover -s python -p 'test_*.py'
```

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
| [Reference-Safe Schema](./shared/reference-safe-schema/) | AEOS reference hardening with `reference_target_pattern` and `resolve_reference_form`, showing valid references, swapped-domain failures, and laundered-terminal failures. |
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

Focused regression commands after installing each example's dependencies:

- Contact list: `npm test` in `typescript/validating-a-contact-list`.
- Alignment playground: `npm run test:playground` in
  `typescript/aeon-alignment-playground` (published WASM by default).
- Rust: `cargo test --locked` in each Rust example directory.
- Python: the unittest command above, using the installed PyPI wheel.
