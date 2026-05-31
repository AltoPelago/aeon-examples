use std::collections::BTreeMap;
use std::path::PathBuf;

use aeon_aeos::{Schema, SchemaRule};
use aeon_core::{CompileOptions, DatatypePolicy};
use aeon_sdk::{LoadOptions, load_file};
use serde::Deserialize;
use serde_json::{Value as JsonValue, json};

#[derive(Debug, Deserialize)]
struct FarewellDocument {
    sun: Farewell,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Farewell {
    version: String,
    daytime: String,
    farewell: String,
    sleep_tight: String,
    sunset_hour: i64,
    cooldown_hours: i64,
    sleep_hour: i64,
    wake_hour: i64,
}

impl Farewell {
    fn normalized_version(&self) -> &str {
        self.version.strip_prefix('^').unwrap_or(&self.version)
    }

    fn sunset_window(&self) -> String {
        let end_hour = (self.sunset_hour + self.cooldown_hours) % 24;
        format!("{:02}:00-{:02}:00", self.sunset_hour, end_hour)
    }

    fn sleep_window(&self) -> String {
        format!("{:02}:00-{:02}:00", self.sleep_hour, self.wake_hour)
    }

    fn hour_in_window(&self, current_hour: i64, start_hour: i64, end_hour: i64) -> bool {
        if start_hour == end_hour {
            return true;
        }
        if start_hour < end_hour {
            return start_hour <= current_hour && current_hour < end_hour;
        }
        start_hour <= current_hour || current_hour < end_hour
    }

    fn message_for_hour(&self, current_hour: i64) -> &str {
        let sunset_end = (self.sunset_hour + self.cooldown_hours) % 24;
        if self.hour_in_window(current_hour, self.sleep_hour, self.wake_hour) {
            &self.sleep_tight
        } else if self.hour_in_window(current_hour, self.sunset_hour, sunset_end) {
            &self.farewell
        } else {
            &self.daytime
        }
    }
}

fn main() {
    // Load the typed config and apply AEOS schema validation in one step.
    let loaded = load_file::<FarewellDocument, _>(
        example_file(),
        LoadOptions {
            compile: CompileOptions {
                datatype_policy: Some(DatatypePolicy::AllowCustom),
                ..CompileOptions::default()
            },
            schema: Some(build_schema()),
            ..LoadOptions::default()
        },
    )
    .expect("failed to load FarewellDocument");

    // Schema validation checks structure and literal kinds; these are app rules on top.
    require_business_rules(&loaded.document.sun);

    let current_hour = 19_i64;
    println!(
        "AEON configuration loaded correctly (v{})",
        loaded.document.sun.normalized_version()
    );
    println!("Current example hour: {current_hour:02}:00");
    println!("Sunset window: {}", loaded.document.sun.sunset_window());
    println!("Sleep window: {}", loaded.document.sun.sleep_window());
    println!("---");
    println!("{}", loaded.document.sun.message_for_hour(current_hour));
}

fn example_file() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("sun.aeon")
}

fn build_schema() -> Schema {
    Schema {
        rules: vec![
            rule("$.sun", json!({"required": true, "type": "ObjectNode"})),
            rule(
                "$.sun.version",
                json!({"required": true, "type": "SeparatorLiteral"}),
            ),
            rule(
                "$.sun.daytime",
                json!({"required": true, "type": "StringLiteral"}),
            ),
            rule(
                "$.sun.farewell",
                json!({"required": true, "type": "StringLiteral"}),
            ),
            rule(
                "$.sun.sleepTight",
                json!({"required": true, "type": "StringLiteral"}),
            ),
            rule(
                "$.sun.sunsetHour",
                json!({
                    "required": true,
                    "type": "NumberLiteral",
                    "sign": "unsigned",
                    "min_digits": 1,
                    "max_digits": 2
                }),
            ),
            rule(
                "$.sun.cooldownHours",
                json!({
                    "required": true,
                    "type": "NumberLiteral",
                    "sign": "unsigned",
                    "min_digits": 1,
                    "max_digits": 1
                }),
            ),
            rule(
                "$.sun.sleepHour",
                json!({
                    "required": true,
                    "type": "NumberLiteral",
                    "sign": "unsigned",
                    "min_digits": 1,
                    "max_digits": 2
                }),
            ),
            rule(
                "$.sun.wakeHour",
                json!({
                    "required": true,
                    "type": "NumberLiteral",
                    "sign": "unsigned",
                    "min_digits": 1,
                    "max_digits": 1
                }),
            ),
        ],
        datatype_rules: BTreeMap::new(),
        datatype_allowlist: vec![String::from("farewell")],
        world: String::from("open"),
    }
}

fn rule(path: &str, constraints: JsonValue) -> SchemaRule {
    SchemaRule {
        path: Some(String::from(path)),
        constraints,
    }
}

fn require_business_rules(farewell: &Farewell) {
    if !(16..=21).contains(&farewell.sunset_hour) {
        panic!(
            "$.sun.sunsetHour must be between 16 and 21. Got: {}",
            farewell.sunset_hour
        );
    }
    if !(1..=6).contains(&farewell.cooldown_hours) {
        panic!(
            "$.sun.cooldownHours must be between 1 and 6. Got: {}",
            farewell.cooldown_hours
        );
    }
    if !(21..=23).contains(&farewell.sleep_hour) {
        panic!(
            "$.sun.sleepHour must be between 21 and 23. Got: {}",
            farewell.sleep_hour
        );
    }
    if !(1..=7).contains(&farewell.wake_hour) {
        panic!(
            "$.sun.wakeHour must be between 1 and 7. Got: {}",
            farewell.wake_hour
        );
    }
}
