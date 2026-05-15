# AEON Rust Sayonara Sun

A slightly richer Rust example that loads a typed AEON config, validates it with AEOS rules, applies a couple of business checks, and prints the message for the current local hour.

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

- `aeon-sdk::load_file`

That makes it the Rust counterpart to the stronger Sayonara Sun flows in the TypeScript and Python examples.
