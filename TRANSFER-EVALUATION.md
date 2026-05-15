# Transfer Evaluation

Source: `altopelago/aeon-examples-private`

This is the initial public-readiness pass. The public repo should start with
small, portable examples, then bring over larger app demos after cleanup and
dependency updates.

## Recommended First Transfer

- `python/python-hello-world`
- `python/python-sayonara-sun`
- `rust/hello-world`
- `rust/sayonara-sun`
- `shared/contracts-baseline`
- `shared/reference-safe-schema`
- `shared/schema-policy-showcase`
- `typescript/aeon-1-hello-world`
- `typescript/aeon-2-goodnight-moon`
- `typescript/aeon-3-sayonara-sun`
- `typescript/aeon-alignment-playground`
- `typescript/validating-a-contact-list`

These have been copied into the public repo as the first tranche. They are
compact, mostly documentation-and-file examples, and no obvious secret material
was found in the initial scan.

The transferred TypeScript, Python, and Rust examples now use registry package
coordinates:

- TypeScript: `@altopelago/aeon-*` and `@altopelago/aeos-core` at `^0.9.0`
- Python: `aeon-python==0.9.0`
- Rust: `aeon-* = "0.9.0"`

Registry verification found that the package coordinates are not published yet:

- npm: `@altopelago/aeon-sdk@0.9.0` and `@altopelago/aeos-core@0.9.0` return `404 Not Found`
- npm: `@altopelago/aeon-annotation-stream@0.9.0` returned `404 Not Found` on 2026-05-16
- PyPI: `aeon-python` has no matching distribution
- crates.io: `cargo search aeon-core` returns no matching crate

The examples are therefore structurally converted away from local paths, but
fresh install/run checks are blocked until the packages are published.

## Transfer After Cleanup

- `shared/aeon-gp-security-conventions`: useful shared example, but review the
  security vocabulary before public release so the naming matches current specs.
- `typescript/aeon-template-demo`: likely good public material, but its local
  highlighter still labels AEON boolean literals as `switch`.
- `typescript/aeon-live-references`: useful browser demo, but its highlighter
  still labels boolean literals as `switch`.
- `typescript/aeon-playground`: useful, but larger than a minimal example and
  still labels boolean literals as `switch`.
- `typescript/aeos-schema-creator`: likely useful, but README wording includes
  "switch nodes" and should be reviewed for the new `toggle` terminology.
- `typescript/vector-scene-validation-and-svg-rendering`: likely useful, but its
  local highlighter still labels boolean literals as `switch`.
- `typescript/replaying-draw-events-over-aeon`: promising app-style demo, but
  should be checked for browser sandbox assumptions and current package APIs.
- `typescript/signed-aeon-cli`: public candidate, but document clearly that
  `AEON_SIGNING_SECRET` is a throwaway demo secret and never commit generated
  signed payloads containing private material.
- `typescript/signed-aeon-cli-asymmetric`: public candidate. The scan found a
  public key only, but transfer should verify that generated private keys remain
  ignored.

## Hold For Later

- `typescript/aeon-ai-demo`: depends on a local AI server/Ollama flow and local
  proxy ports. It should become an advanced example after its public setup is
  tightened.
- `typescript/aeon-mortgage-chat-demo`: contains a real `.env` in the private
  source and a private absolute planning link in the README. Do not transfer
  until sanitized and turned into a public-safe advanced demo.
- Desktop Neon wrapper playground behavior from the former
  `typescript/aeon-tauri-playground`: keep out of the public browser alignment
  example until it is split into a separate public-safe desktop wrapper example.

## Converted From Tauri

- `typescript/aeon-web-todo`: promoted from the private `aeon-tauri-todo`
  example as a browser-only Svelte/Vite app. It uses browser file import,
  `localStorage` draft persistence, and AEON download export instead of Tauri
  commands or desktop filesystem access.
- `typescript/aeon-alignment-playground`: promoted from the private
  `aeon-tauri-playground` as a browser-only Vite app. Tauri and private Neon
  wrapper scripts were removed; Rust processing is exercised through
  `@altopelago/aeon-wasm`, and fixture tests compare TypeScript and Rust-WASM normalized
  outputs.

## Cleanup Requirements Before Copying

- Remove `.DS_Store`, `.env`, generated outputs, build caches, and dependency
  directories.
- Exclude generated Tauri schema output unless it is intentionally part of a
  checked-in app example.
- Replace AEON literal terminology from `switch` to `toggle` where it refers to
  the literal kind. Ordinary programming-language `switch` statements can stay.
- Replace private absolute paths with repository-relative documentation.
- Publish the `0.9.0` packages, or update these examples to the actual published
  public package coordinates.
- Before installing from npm, verify package publish/update timestamps and do
  not install any dependency published or updated less than 7 days ago. Use
  `--ignore-scripts`; public web examples may also include `.npmrc` with
  `ignore-scripts=true`.
- Confirm package installs work after the packages are available from their
  public registries.
- Add per-example run checks after dependency installation is available in CI.
