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

This example uses the Rust library surface directly:

- `aeon-core::CompileOptions`
- `aeon-finalize::from_aeon_str`

That makes it the Rust counterpart to the higher-level hello-world flows in the TypeScript and Python examples.
