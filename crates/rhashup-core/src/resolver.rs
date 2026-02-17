use std::path::{Component, Path, PathBuf};

/// Canonicalize a path, falling back to logical normalization if canonicalization fails.
pub fn normalize_path(path: &Path) -> PathBuf {
    std::fs::canonicalize(path).unwrap_or_else(|_| clean_path(path))
}

/// Logically normalize a path by resolving `.` and `..` components without touching the filesystem.
fn clean_path(path: &Path) -> PathBuf {
    let mut components = Vec::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                if let Some(last) = components.last() {
                    if !matches!(last, Component::RootDir | Component::Prefix(_)) {
                        components.pop();
                        continue;
                    }
                }
                components.push(component);
            }
            _ => components.push(component),
        }
    }
    components.iter().collect()
}

/// Make a path relative to a base directory.
pub fn make_relative(path: &Path, base: &Path) -> String {
    let path = normalize_path(path);
    let base = normalize_path(base);

    path.strip_prefix(&base)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| path.to_string_lossy().to_string())
}
