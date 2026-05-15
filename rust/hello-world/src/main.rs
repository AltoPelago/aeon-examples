use std::fs;
use std::path::PathBuf;

use aeon_core::CompileOptions;
use aeon_finalize::{from_aeon_str, FinalizeOptions};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct HelloDocument {
    greeting: String,
}

fn main() {
    let source = fs::read_to_string(example_file()).expect("failed to read hello.aeon");
    let document: HelloDocument = from_aeon_str(
        &source,
        CompileOptions::default(),
        FinalizeOptions::default(),
    )
    .expect("failed to load AEON document");

    println!("Greeting: {}", document.greeting);
}

fn example_file() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("hello.aeon")
}
