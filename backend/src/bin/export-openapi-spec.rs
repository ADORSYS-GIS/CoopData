//! Binary to export the OpenAPI spec to a JSON file.
//!
//! Usage: `cargo run --bin export-openapi-spec`
//! Output: `openapi.json` in the project root.

use coop_data_backend::api::openapi::create_openapi_spec;

fn main() {
    let spec = create_openapi_spec();
    let json = serde_json::to_string_pretty(&spec).expect("Failed to serialize OpenAPI spec");
    println!("{}", json);
}
