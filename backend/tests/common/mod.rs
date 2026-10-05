// Shared helpers are compiled into every integration-test crate; items used
// only by some crates would otherwise trigger dead_code there.
#[allow(dead_code)]
pub mod mock;
#[allow(dead_code)]
pub mod mock_db;

#[allow(unused_imports)]
pub use mock::{test_config, TestApp};
