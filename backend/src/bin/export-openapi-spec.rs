//! Binary to export the OpenAPI spec to a JSON file.
//!
//! Usage: `cargo run --bin export-openapi-spec`
//! Output: `openapi.json` in the project root.

use coop_data_backend::api::openapi::create_openapi_spec;

fn main() {
    let spec = create_openapi_spec();
    for path in spec.paths.paths.keys() {
        println!("Binary sees path: {}", path);
    }
    let json = serde_json::to_string_pretty(&spec).expect("Failed to serialize OpenAPI spec");
    let path = std::env::current_dir().unwrap().join("openapi.json");
    std::fs::write(&path, &json).expect("Failed to write openapi.json");
    println!("OpenAPI spec exported to {}", path.display());
}
