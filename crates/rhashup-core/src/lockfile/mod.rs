pub mod go_lock;
pub mod javascript;
pub mod python;
pub mod rust_lock;

use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Holds resolved package → version/checksum mappings from a lockfile.
pub struct LockfileLookup {
    versions: HashMap<String, String>,
}

impl LockfileLookup {
    /// Walk up from `start_dir` looking for any of the given lockfile names.
    /// Parse the first one found and cache all package → version entries.
    pub fn discover(start_dir: &Path, lockfile_names: &[&str]) -> Option<Self> {
        let (path, filename) = find_lockfile(start_dir, lockfile_names)?;
        let content = std::fs::read_to_string(&path).ok()?;
        let versions = parse_lockfile(&filename, &content)?;
        if versions.is_empty() {
            return None;
        }
        Some(Self { versions })
    }

    /// Look up a bare import. Returns version or checksum string.
    pub fn get(&self, package_name: &str) -> Option<&str> {
        self.versions.get(package_name).map(|s| s.as_str())
    }
}

/// Walk up directories from `start_dir` looking for any file named in `lockfile_names`.
fn find_lockfile(start_dir: &Path, lockfile_names: &[&str]) -> Option<(PathBuf, String)> {
    let mut dir = start_dir.to_path_buf();
    loop {
        for &name in lockfile_names {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some((candidate, name.to_string()));
            }
        }
        if !dir.pop() {
            break;
        }
    }
    None
}

/// Dispatch to the appropriate parser based on filename.
fn parse_lockfile(filename: &str, content: &str) -> Option<HashMap<String, String>> {
    match filename {
        "pnpm-lock.yaml" => Some(javascript::parse_pnpm_lock(content)),
        "yarn.lock" => Some(javascript::parse_yarn_lock(content)),
        "package-lock.json" => Some(javascript::parse_package_lock_json(content)),
        "bun.lock" => Some(javascript::parse_bun_lock(content)),
        "poetry.lock" => Some(python::parse_poetry_lock(content)),
        "uv.lock" => Some(python::parse_uv_lock(content)),
        "Pipfile.lock" => Some(python::parse_pipfile_lock(content)),
        "Cargo.lock" => Some(rust_lock::parse_cargo_lock(content)),
        "go.sum" => Some(go_lock::parse_go_sum(content)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_discover_walks_up() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("a").join("b").join("c");
        std::fs::create_dir_all(&sub).unwrap();
        std::fs::write(
            dir.path().join("package-lock.json"),
            r#"{"lockfileVersion":3,"packages":{"node_modules/react":{"version":"18.2.0"}}}"#,
        )
        .unwrap();

        let lookup = LockfileLookup::discover(&sub, &["package-lock.json"]).unwrap();
        assert_eq!(lookup.get("react"), Some("18.2.0"));
    }

    #[test]
    fn test_discover_no_lockfile() {
        let dir = tempfile::tempdir().unwrap();
        let result = LockfileLookup::discover(dir.path(), &["nonexistent.lock"]);
        assert!(result.is_none());
    }

    #[test]
    fn test_discover_prefers_first_in_list() {
        let dir = tempfile::tempdir().unwrap();
        // Create both pnpm-lock.yaml and package-lock.json
        std::fs::write(
            dir.path().join("pnpm-lock.yaml"),
            "lockfileVersion: '9.0'\npackages:\n  react@19.0.0:\n    resolution: {integrity: sha256-abc}\n",
        )
        .unwrap();
        std::fs::write(
            dir.path().join("package-lock.json"),
            r#"{"lockfileVersion":3,"packages":{"node_modules/react":{"version":"18.2.0"}}}"#,
        )
        .unwrap();

        let lookup = LockfileLookup::discover(
            dir.path(),
            &["pnpm-lock.yaml", "package-lock.json"],
        )
        .unwrap();
        // Should use pnpm-lock.yaml (first in list) → integrity hash
        assert_eq!(lookup.get("react"), Some("sha256-abc"));
    }
}
