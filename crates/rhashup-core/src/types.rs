use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HashupOptions {
    pub entry_files: Vec<PathBuf>,
    #[serde(default)]
    pub extras: Vec<String>,
    #[serde(default = "default_base_dir")]
    pub base_dir: PathBuf,
}

fn default_base_dir() -> PathBuf {
    PathBuf::from(".")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HashupResult {
    pub hash: String,
    pub files: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportSpecifier {
    pub raw: String,
    pub kind: ImportKind,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ImportKind {
    /// A relative import (./foo, ../bar)
    Relative,
    /// An absolute/bare import (package name, std lib, etc.)
    Bare,
}

impl ImportSpecifier {
    pub fn relative(raw: impl Into<String>) -> Self {
        Self {
            raw: raw.into(),
            kind: ImportKind::Relative,
        }
    }

    pub fn bare(raw: impl Into<String>) -> Self {
        Self {
            raw: raw.into(),
            kind: ImportKind::Bare,
        }
    }

    pub fn is_relative(&self) -> bool {
        matches!(self.kind, ImportKind::Relative)
    }
}
