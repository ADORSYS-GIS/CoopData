//! Route modules for the 4-level IAM hierarchy.
//!
//! # Route Structure
//! - `ministry` - Level 1: Platform super-admin routes (requires `ministry` role)
//! - `federation` - Level 2: Organization admin routes (requires `federation` role)
//! - `apex` - Level 3: Group admin routes (requires `apex` role)
//! - `cooperative` - Level 4: End user routes (requires `cooperative` or `apex` role)
//! - `shared` - Shared routes accessible by multiple roles
//! - `users` - User management routes (accessible by ministry, federation, apex)

pub mod apex;
mod cooperative;
pub mod federation;
pub mod ministry;
pub mod shared;
mod users;

pub mod api;

pub use api::create_app;
