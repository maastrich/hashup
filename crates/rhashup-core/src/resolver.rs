use std::path::{Path, PathBuf};

/// Canonicalize a path, falling back to the original if canonicalization fails.
pub fn normalize_path(path: &Path) -> PathBuf {
    std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

/// Make a path relative to a base directory.
pub fn make_relative(path: &Path, base: &Path) -> String {
    let path = normalize_path(path);
    let base = normalize_path(base);

    path.strip_prefix(&base)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| path.to_string_lossy().to_string())
}
