pub mod error;
pub mod hasher;
pub mod lang;
pub mod resolver;
pub mod types;

pub use error::{Error, Result};
pub use hasher::Hasher;
pub use lang::LanguageRegistry;
pub use types::{HashupOptions, HashupResult};

/// Hash files with their transitive imports.
pub fn hashup(options: &HashupOptions) -> Result<HashupResult> {
    let mut hasher = Hasher::new();
    hasher.hash(options)
}
