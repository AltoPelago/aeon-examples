# AEON Examples

Public examples for AEON documents, schemas, tooling, and SDK usage.

The examples are configured for registry package versions rather than
sibling-repo local-path dependencies. Publishing those packages is the remaining
blocker before fresh installs can succeed from public registries.

- `typescript/`
- `python/`
- `rust/`
- `shared/` for language-neutral example assets

See [`TRANSFER-EVALUATION.md`](./TRANSFER-EVALUATION.md) for the current
promotion plan and cleanup notes.

## Examples

- `typescript/aeon-1-hello-world`
- `typescript/aeon-2-goodnight-moon`
- `typescript/aeon-3-sayonara-sun`
- `typescript/validating-a-contact-list`
- `typescript/aeon-web-todo`
- `typescript/aeon-alignment-playground`
- `python/python-hello-world`
- `python/python-sayonara-sun`
- `rust/hello-world`
- `rust/sayonara-sun`
- `shared/contracts-baseline`
- `shared/reference-safe-schema`
- `shared/schema-policy-showcase`

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
