use std::path::PathBuf;

use altopelago_aeon::{LoadOptions, load_file};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct HelloDocument {
    greeting: String,
}

fn main() {
    let loaded = load_file::<HelloDocument, _>(example_file(), LoadOptions::default())
        .expect("failed to load AEON document");

    println!("Greeting: {}", loaded.document.greeting);
}

fn example_file() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("hello.aeon")
}

#[cfg(test)]
mod tests {
    use super::*;
    use altopelago_aeon::load_str;

    #[test]
    fn loads_the_published_facade_into_a_struct() {
        let loaded = load_file::<HelloDocument, _>(example_file(), LoadOptions::default()).unwrap();
        assert_eq!(loaded.document.greeting, "Hello, World from AEON!");
    }

    #[test]
    fn rejects_incompatible_application_data() {
        assert!(load_str::<HelloDocument>("greeting = 42", LoadOptions::default()).is_err());
    }
}
