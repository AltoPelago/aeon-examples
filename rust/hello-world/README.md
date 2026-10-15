# AEON Rust Hello World

A minimal Rust example that loads a small AEON document into a typed Rust struct and prints one value.

## Usage

```bash
cd rust/hello-world
cargo run
```

## Files

- `hello.aeon` - strict-mode AEON input document
- `src/main.rs` - minimal typed loading example

## What It Shows

This example pins the published crates.io facade at 0.15.0:

- `altopelago_aeon::load_file`
- `altopelago_aeon::LoadOptions`

Use Rust 1.93.1 or newer. Run `cargo test --locked` to check typed loading
and rejection of incompatible application data.

That makes it the Rust counterpart to the higher-level hello-world flows in the TypeScript and Python examples.
