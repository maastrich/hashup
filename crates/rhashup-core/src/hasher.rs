use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::error::{Error, Result};
use crate::lang::LanguageRegistry;
use crate::lockfile::LockfileLookup;
use crate::resolver;
use crate::types::{HashupOptions, HashupResult, ImportKind};

pub struct Hasher {
    registry: LanguageRegistry,
    cache: HashMap<PathBuf, Vec<String>>,
    lockfile_cache: HashMap<PathBuf, Option<LockfileLookup>>,
}

impl Hasher {
    pub fn new() -> Self {
        Self {
            registry: LanguageRegistry::new(),
            cache: HashMap::new(),
            lockfile_cache: HashMap::new(),
        }
    }

    pub fn with_registry(registry: LanguageRegistry) -> Self {
        Self {
            registry,
            cache: HashMap::new(),
            lockfile_cache: HashMap::new(),
        }
    }

    pub fn hash(&mut self, options: &HashupOptions) -> Result<HashupResult> {
        if options.entry_files.is_empty() {
            return Err(Error::NoEntryFiles);
        }

        let base_dir = resolver::normalize_path(&options.base_dir);
        let mut all_hashes: Vec<String> = Vec::new();

        // Hash each entry file and its transitive imports
        for entry in &options.entry_files {
            let path = resolver::normalize_path(entry);
            let hashes = self.hash_file(&path, &base_dir)?;
            for h in &hashes {
                if !all_hashes.contains(h) {
                    all_hashes.push(h.clone());
                }
            }
        }

        // Add extras
        for extra in &options.extras {
            let hash = sha256_hex(extra.as_bytes());
            all_hashes.push(hash);
        }

        // Collect all visited files from the cache
        let mut all_files: Vec<String> = self
            .cache
            .keys()
            .map(|p| resolver::make_relative(p, &base_dir))
            .collect();
        all_files.sort();

        let combined = combine_hashes(&all_hashes);
        Ok(HashupResult {
            hash: combined,
            files: all_files,
        })
    }

    fn hash_file(&mut self, path: &Path, base_dir: &Path) -> Result<Vec<String>> {
        let canonical = resolver::normalize_path(path);

        // Return cached result (also handles circular deps)
        if let Some(cached) = self.cache.get(&canonical) {
            return Ok(cached.clone());
        }

        // Insert empty vec to break circular dependencies
        self.cache.insert(canonical.clone(), Vec::new());

        // Read file content
        let content = std::fs::read_to_string(&canonical).map_err(|e| Error::io(&canonical, e))?;

        // Hash this file's content
        let file_hash = sha256_hex(content.as_bytes());
        let mut hashes = vec![file_hash];

        // Extract and resolve imports (collect resolved paths first to avoid borrow conflict)
        let (resolved_paths, unresolved_bare, lockfile_names) =
            if let Some(parser) = self.registry.parser_for_file(&canonical) {
                let imports = parser.extract_imports(&canonical, &content)?;
                let lf_names: Vec<String> = parser.lockfile_names().iter().map(|s| s.to_string()).collect();
                let mut paths = Vec::new();
                let mut bare = Vec::new();
                for import in &imports {
                    if let Some(resolved) =
                        parser.resolve_import(&canonical, import, base_dir)?
                    {
                        paths.push(resolved);
                    } else if matches!(import.kind, ImportKind::Bare) {
                        bare.push(import.raw.clone());
                    }
                }
                (paths, bare, lf_names)
            } else {
                (Vec::new(), Vec::new(), Vec::new())
            };

        // Look up bare imports from lockfile (separate from parser borrow)
        if !unresolved_bare.is_empty() {
            let lf_refs: Vec<&str> = lockfile_names.iter().map(|s| s.as_str()).collect();
            for pkg_name in &unresolved_bare {
                if let Some(version) = self.lookup_bare_import(base_dir, &lf_refs, pkg_name) {
                    let h = sha256_hex(format!("{}@{}", pkg_name, version).as_bytes());
                    if !hashes.contains(&h) {
                        hashes.push(h);
                    }
                }
            }
        }

        for resolved in resolved_paths {
            let dep_hashes = self.hash_file(&resolved, base_dir)?;
            for h in dep_hashes {
                if !hashes.contains(&h) {
                    hashes.push(h);
                }
            }
        }

        // Update cache with actual hashes
        self.cache.insert(canonical, hashes.clone());
        Ok(hashes)
    }

    fn lookup_bare_import(
        &mut self,
        base_dir: &Path,
        lockfile_names: &[&str],
        package_name: &str,
    ) -> Option<String> {
        // Cache lockfile lookup per base_dir
        if !self.lockfile_cache.contains_key(base_dir) {
            let lookup = LockfileLookup::discover(base_dir, lockfile_names);
            self.lockfile_cache.insert(base_dir.to_path_buf(), lookup);
        }

        self.lockfile_cache
            .get(base_dir)?
            .as_ref()?
            .get(package_name)
            .map(|s| s.to_string())
    }
}

impl Default for Hasher {
    fn default() -> Self {
        Self::new()
    }
}

fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

fn combine_hashes(hashes: &[String]) -> String {
    let combined = hashes.join("");
    sha256_hex(combined.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sha256_hex() {
        let hash = sha256_hex(b"hello");
        assert_eq!(
            hash,
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }

    #[test]
    fn test_combine_hashes() {
        let h1 = sha256_hex(b"a");
        let h2 = sha256_hex(b"b");
        let combined = combine_hashes(&[h1.clone(), h2.clone()]);
        // Should be deterministic
        let combined2 = combine_hashes(&[h1, h2]);
        assert_eq!(combined, combined2);
    }

    #[test]
    fn test_hash_single_file() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("test.ts");
        std::fs::write(&file, "const x = 1;").unwrap();

        let mut hasher = Hasher::new();
        let result = hasher
            .hash(&HashupOptions {
                entry_files: vec![file],
                extras: vec![],
                base_dir: dir.path().to_path_buf(),
            })
            .unwrap();

        assert!(!result.hash.is_empty());
        assert_eq!(result.hash.len(), 64); // SHA256 hex length
    }

    #[test]
    fn test_hash_with_import() {
        let dir = tempfile::tempdir().unwrap();
        let main = dir.path().join("main.ts");
        let utils = dir.path().join("utils.ts");
        std::fs::write(&main, r#"import { foo } from "./utils";"#).unwrap();
        std::fs::write(&utils, "export const foo = 42;").unwrap();

        let mut hasher = Hasher::new();
        let result = hasher
            .hash(&HashupOptions {
                entry_files: vec![main],
                extras: vec![],
                base_dir: dir.path().to_path_buf(),
            })
            .unwrap();

        assert_eq!(result.hash.len(), 64);
    }

    #[test]
    fn test_hash_deterministic() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("test.ts");
        std::fs::write(&file, "const x = 1;").unwrap();

        let opts = HashupOptions {
            entry_files: vec![file],
            extras: vec![],
            base_dir: dir.path().to_path_buf(),
        };

        let mut h1 = Hasher::new();
        let r1 = h1.hash(&opts).unwrap();

        let mut h2 = Hasher::new();
        let r2 = h2.hash(&opts).unwrap();

        assert_eq!(r1.hash, r2.hash);
    }

    #[test]
    fn test_hash_with_extras() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("test.ts");
        std::fs::write(&file, "const x = 1;").unwrap();

        let mut h1 = Hasher::new();
        let r1 = h1
            .hash(&HashupOptions {
                entry_files: vec![file.clone()],
                extras: vec!["v1".to_string()],
                base_dir: dir.path().to_path_buf(),
            })
            .unwrap();

        let mut h2 = Hasher::new();
        let r2 = h2
            .hash(&HashupOptions {
                entry_files: vec![file],
                extras: vec!["v2".to_string()],
                base_dir: dir.path().to_path_buf(),
            })
            .unwrap();

        assert_ne!(r1.hash, r2.hash);
    }

    #[test]
    fn test_circular_deps() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a.ts");
        let b = dir.path().join("b.ts");
        std::fs::write(&a, r#"import { x } from "./b";"#).unwrap();
        std::fs::write(&b, r#"import { y } from "./a";"#).unwrap();

        let mut hasher = Hasher::new();
        let result = hasher.hash(&HashupOptions {
            entry_files: vec![a],
            extras: vec![],
            base_dir: dir.path().to_path_buf(),
        });
        // Should not stack overflow
        assert!(result.is_ok());
    }

    #[test]
    fn test_no_entry_files() {
        let mut hasher = Hasher::new();
        let result = hasher.hash(&HashupOptions {
            entry_files: vec![],
            extras: vec![],
            base_dir: PathBuf::from("."),
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_bare_import_with_lockfile() {
        let dir = tempfile::tempdir().unwrap();

        // Create a package-lock.json with react version
        std::fs::write(
            dir.path().join("package-lock.json"),
            r#"{"lockfileVersion":3,"packages":{"node_modules/react":{"version":"18.2.0"}}}"#,
        )
        .unwrap();

        let main = dir.path().join("main.ts");
        std::fs::write(&main, r#"import React from "react";"#).unwrap();

        let mut hasher = Hasher::new();
        let r1 = hasher
            .hash(&HashupOptions {
                entry_files: vec![main.clone()],
                extras: vec![],
                base_dir: dir.path().to_path_buf(),
            })
            .unwrap();

        // Change react version in lockfile
        std::fs::write(
            dir.path().join("package-lock.json"),
            r#"{"lockfileVersion":3,"packages":{"node_modules/react":{"version":"19.0.0"}}}"#,
        )
        .unwrap();

        let mut hasher2 = Hasher::new();
        let r2 = hasher2
            .hash(&HashupOptions {
                entry_files: vec![main],
                extras: vec![],
                base_dir: dir.path().to_path_buf(),
            })
            .unwrap();

        // Hash should change when dependency version changes
        assert_ne!(r1.hash, r2.hash);
    }

    #[test]
    fn test_bare_import_without_lockfile() {
        let dir = tempfile::tempdir().unwrap();
        let main = dir.path().join("main.ts");
        std::fs::write(&main, r#"import React from "react";"#).unwrap();

        let mut hasher = Hasher::new();
        let result = hasher
            .hash(&HashupOptions {
                entry_files: vec![main],
                extras: vec![],
                base_dir: dir.path().to_path_buf(),
            })
            .unwrap();

        // Should still succeed, just without the bare import hash
        assert_eq!(result.hash.len(), 64);
    }
}
