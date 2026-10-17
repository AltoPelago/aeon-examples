# AEON Rust Sayonara Sun

A slightly richer Rust example that loads a typed AEON config, validates it with AEOS rules, applies a couple of business checks, and prints the message for a fixed example hour.

## Usage

```bash
cd rust/sayonara-sun
cargo run
```

## Files

- `sun.aeon` - strict-mode AEON input document
- `src/main.rs` - typed loading, AEOS validation, and message rendering

## What It Shows

This example uses the Rust library surface directly:

- `altopelago_aeon::load_file` from the published 0.16.0 facade
- `altopelago-aeon-core` and `altopelago-aeon-aeos` for options and schema types

Use Rust 1.93.1 or newer. Run `cargo test --locked` for schema and business-rule
regressions. The custom `:farewell` and `:ver` labels are explicitly enabled
by the consumer's compile options; their application meaning is checked separately.

That makes it the Rust counterpart to the stronger Sayonara Sun flows in the TypeScript and Python examples.
