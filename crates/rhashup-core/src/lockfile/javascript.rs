use std::collections::HashMap;

/// Parse pnpm-lock.yaml — extract package names and versions from the `packages:` section.
///
/// Format (v9):
/// ```yaml
/// packages:
///   react@19.0.0:
///     resolution: {integrity: sha512-...}
/// ```
///
/// The key format is `<name>@<version>` where name may be scoped (`@scope/pkg@1.0.0`).
pub fn parse_pnpm_lock(content: &str) -> HashMap<String, String> {
    let mut versions = HashMap::new();

    // Use serde_yaml to parse the YAML
    let value: serde_yaml::Value = match serde_yaml::from_str(content) {
        Ok(v) => v,
        Err(_) => return versions,
    };

    // pnpm v9: packages are under "packages" key with format "name@version"
    if let Some(packages) = value.get("packages").and_then(|p| p.as_mapping()) {
        for (key, val) in packages {
            if let Some(key_str) = key.as_str() {
                // Parse "react@19.0.0" or "@scope/pkg@1.0.0"
                if let Some((name, version)) = parse_pnpm_package_key(key_str) {
                    // Prefer integrity hash from resolution field if available
                    let resolved_value = extract_pnpm_integrity(val)
                        .unwrap_or_else(|| version.to_string());
                    versions.insert(name.to_string(), resolved_value);
                }
            }
        }
    }

    // pnpm v6 and older: packages under "packages" with path-like keys like "/react/18.2.0"
    // Also try "dependencies" key for snapshots
    if versions.is_empty() {
        if let Some(packages) = value.get("packages").and_then(|p| p.as_mapping()) {
            for (key, val) in packages {
                if let Some(key_str) = key.as_str() {
                    // v6 format: "/react/18.2.0" → look at nested version field
                    if let Some(path) = key_str.strip_prefix('/') {
                        if let Some(version) = val
                            .get("version")
                            .and_then(|v| v.as_str())
                        {
                            if let Some(name) = extract_name_from_pnpm_v6_path(path) {
                                versions.insert(name.to_string(), version.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    versions
}

/// Extract the integrity hash from a pnpm package value's resolution field.
/// e.g., `resolution: {integrity: sha512-abc...}` → `"sha512-abc..."`
fn extract_pnpm_integrity(val: &serde_yaml::Value) -> Option<String> {
    val.get("resolution")?
        .get("integrity")?
        .as_str()
        .map(|s| s.to_string())
}

/// Parse "react@19.0.0" or "@scope/pkg@1.0.0" into (name, version).
fn parse_pnpm_package_key(key: &str) -> Option<(&str, &str)> {
    // For scoped packages like "@scope/pkg@1.0.0", find the '@' that separates name from version
    let at_pos = find_version_at(key)?;
    let name = &key[..at_pos];
    let version = &key[at_pos + 1..];
    if !name.is_empty() && !version.is_empty() {
        Some((name, version))
    } else {
        None
    }
}

/// Extract package name from pnpm v6 path format: "react/18.2.0" → "react"
fn extract_name_from_pnpm_v6_path(path: &str) -> Option<&str> {
    if path.starts_with('@') {
        // "@scope/pkg/1.0.0" → find second '/'
        let first_slash = path.find('/')?;
        let rest = &path[first_slash + 1..];
        let second_slash = rest.find('/')?;
        Some(&path[..first_slash + 1 + second_slash])
    } else {
        // "react/18.2.0" → find first '/'
        let slash = path.find('/')?;
        Some(&path[..slash])
    }
}

/// Parse yarn.lock — line-by-line text parse.
///
/// Format:
/// ```text
/// "react@^18.0.0", "react@^18.2.0":
///   version "18.2.0"
///
/// "@scope/pkg@^1.0.0":
///   version "1.0.0"
/// ```
pub fn parse_yarn_lock(content: &str) -> HashMap<String, String> {
    let mut versions = HashMap::new();
    let mut current_names: Vec<String> = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();

        // Skip comments and empty lines
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        // Package header line — ends with ':'
        if !line.starts_with(' ') && !line.starts_with('\t') && trimmed.ends_with(':') {
            current_names.clear();
            let header = &trimmed[..trimmed.len() - 1]; // strip trailing ':'
            // Split by ", " for multiple version ranges
            for spec in header.split(", ") {
                let spec = spec.trim().trim_matches('"');
                // Extract package name from "react@^18.0.0" or "@scope/pkg@^1.0.0"
                if let Some(name) = extract_yarn_package_name(spec) {
                    current_names.push(name.to_string());
                }
            }
        }

        // Version line
        if (line.starts_with(' ') || line.starts_with('\t'))
            && trimmed.starts_with("version ")
        {
            let version = trimmed
                .strip_prefix("version ")
                .unwrap_or("")
                .trim()
                .trim_matches('"');
            if !version.is_empty() {
                for name in &current_names {
                    versions.entry(name.clone()).or_insert_with(|| version.to_string());
                }
            }
            current_names.clear();
        }
    }

    versions
}

/// Extract package name from a yarn.lock specifier like "react@^18.0.0" or "@scope/pkg@npm:^1.0.0"
fn extract_yarn_package_name(spec: &str) -> Option<&str> {
    find_version_at(spec).map(|pos| &spec[..pos])
}

/// Parse package-lock.json (v2/v3 format).
///
/// Format:
/// ```json
/// {
///   "packages": {
///     "node_modules/react": { "version": "18.2.0" },
///     "node_modules/@scope/pkg": { "version": "1.0.0" }
///   }
/// }
/// ```
pub fn parse_package_lock_json(content: &str) -> HashMap<String, String> {
    let mut versions = HashMap::new();

    let value: serde_json::Value = match serde_json::from_str(content) {
        Ok(v) => v,
        Err(_) => return versions,
    };

    if let Some(packages) = value.get("packages").and_then(|p| p.as_object()) {
        for (key, val) in packages {
            // Keys are like "node_modules/react" or "node_modules/@scope/pkg"
            if let Some(name) = key.strip_prefix("node_modules/") {
                // Skip nested node_modules (e.g., "node_modules/a/node_modules/b")
                if !name.contains("node_modules/") {
                    if let Some(version) = val.get("version").and_then(|v| v.as_str()) {
                        versions.insert(name.to_string(), version.to_string());
                    }
                }
            }
        }
    }

    versions
}

/// Parse bun.lock (JSON-based format).
///
/// Format:
/// ```json
/// {
///   "packages": {
///     "react": ["react@18.2.0", ...],
///     "@scope/pkg": ["@scope/pkg@1.0.0", ...]
///   }
/// }
/// ```
pub fn parse_bun_lock(content: &str) -> HashMap<String, String> {
    let mut versions = HashMap::new();

    let value: serde_json::Value = match serde_json::from_str(content) {
        Ok(v) => v,
        Err(_) => return versions,
    };

    if let Some(packages) = value.get("packages").and_then(|p| p.as_object()) {
        for (key, val) in packages {
            // The first array element is the resolved string like "react@18.2.0"
            if let Some(arr) = val.as_array() {
                if let Some(resolved) = arr.first().and_then(|v| v.as_str()) {
                    // Extract version from "react@18.2.0" or "@scope/pkg@1.0.0"
                    if let Some(version) = extract_version_from_resolved(resolved) {
                        versions.insert(key.clone(), version.to_string());
                    }
                }
            }
        }
    }

    versions
}

/// Extract version from a resolved string like "react@18.2.0" → "18.2.0"
fn extract_version_from_resolved(resolved: &str) -> Option<&str> {
    find_version_at(resolved).map(|pos| &resolved[pos + 1..])
}

/// Find the position of the '@' that separates package name from version.
/// For scoped packages like "@scope/pkg@1.0.0", skips the leading '@'.
fn find_version_at(s: &str) -> Option<usize> {
    if let Some(rest) = s.strip_prefix('@') {
        rest.find('@').map(|p| p + 1)
    } else {
        s.find('@')
    }
}

/// Fallback: read version from node_modules/<pkg>/package.json.
/// This is not called from parse_lockfile but can be used as an additional fallback.
pub fn read_node_modules_version(base_dir: &std::path::Path, package_name: &str) -> Option<String> {
    let pkg_json = base_dir
        .join("node_modules")
        .join(package_name)
        .join("package.json");
    let content = std::fs::read_to_string(pkg_json).ok()?;
    let value: serde_json::Value = serde_json::from_str(&content).ok()?;
    value.get("version").and_then(|v| v.as_str()).map(|s| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_pnpm_lock_v9() {
        let content = r#"
lockfileVersion: '9.0'

packages:
  react@19.0.0:
    resolution: {integrity: sha512-abc}
  "@acme/design-tokens@2.1.0":
    resolution: {integrity: sha512-def}
"#;
        let versions = parse_pnpm_lock(content);
        // Prefers integrity hash over version
        assert_eq!(versions.get("react").map(|s| s.as_str()), Some("sha512-abc"));
        assert_eq!(
            versions.get("@acme/design-tokens").map(|s| s.as_str()),
            Some("sha512-def")
        );
    }

    #[test]
    fn test_parse_pnpm_lock_v9_no_integrity_falls_back_to_version() {
        let content = r#"
lockfileVersion: '9.0'

packages:
  react@19.0.0:
    engines: {node: '>=16'}
"#;
        let versions = parse_pnpm_lock(content);
        // Falls back to version when no integrity hash
        assert_eq!(versions.get("react").map(|s| s.as_str()), Some("19.0.0"));
    }

    #[test]
    fn test_parse_yarn_lock() {
        let content = r#"
# yarn lockfile v1

"react@^18.0.0", "react@^18.2.0":
  version "18.2.0"
  resolved "https://registry.yarnpkg.com/react/-/react-18.2.0.tgz"

"@scope/pkg@^1.0.0":
  version "1.5.3"
"#;
        let versions = parse_yarn_lock(content);
        assert_eq!(versions.get("react").map(|s| s.as_str()), Some("18.2.0"));
        assert_eq!(versions.get("@scope/pkg").map(|s| s.as_str()), Some("1.5.3"));
    }

    #[test]
    fn test_parse_package_lock_json() {
        let content = r#"{
  "name": "my-project",
  "lockfileVersion": 3,
  "packages": {
    "": { "name": "my-project" },
    "node_modules/react": { "version": "18.2.0" },
    "node_modules/@scope/pkg": { "version": "1.0.0" },
    "node_modules/a/node_modules/nested": { "version": "2.0.0" }
  }
}"#;
        let versions = parse_package_lock_json(content);
        assert_eq!(versions.get("react").map(|s| s.as_str()), Some("18.2.0"));
        assert_eq!(versions.get("@scope/pkg").map(|s| s.as_str()), Some("1.0.0"));
        // Nested should be skipped
        assert!(versions.get("nested").is_none());
    }

    #[test]
    fn test_parse_bun_lock() {
        let content = r#"{
  "packages": {
    "react": ["react@18.2.0", {}],
    "@scope/pkg": ["@scope/pkg@1.0.0", {}]
  }
}"#;
        let versions = parse_bun_lock(content);
        assert_eq!(versions.get("react").map(|s| s.as_str()), Some("18.2.0"));
        assert_eq!(versions.get("@scope/pkg").map(|s| s.as_str()), Some("1.0.0"));
    }

    #[test]
    fn test_parse_pnpm_package_key() {
        assert_eq!(parse_pnpm_package_key("react@19.0.0"), Some(("react", "19.0.0")));
        assert_eq!(
            parse_pnpm_package_key("@scope/pkg@1.0.0"),
            Some(("@scope/pkg", "1.0.0"))
        );
        assert_eq!(parse_pnpm_package_key("invalid"), None);
    }

    #[test]
    fn test_extract_yarn_package_name() {
        assert_eq!(extract_yarn_package_name("react@^18.0.0"), Some("react"));
        assert_eq!(extract_yarn_package_name("@scope/pkg@^1.0.0"), Some("@scope/pkg"));
    }

    #[test]
    fn test_parse_pnpm_lock_v9_real_format() {
        // Real pnpm v9 format with quoted scoped packages and resolution fields
        let content = r#"
lockfileVersion: '9.0'

settings:
  autoInstallPeers: true

importers:
  .:
    dependencies:
      enhanced-resolve:
        specifier: ^5.17.1
        version: 5.18.3

packages:

  '@babel/runtime@7.28.4':
    resolution: {integrity: sha512-Q/N6JNWvIvPnLDvjlE1OUBLPQHH6l3CltCEsHIujp45zQUSSh8K+gHnaEX45yAT1nyngnINhvWtzN+Nb9D8RAQ==}
    engines: {node: '>=6.9.0'}

  enhanced-resolve@5.18.3:
    resolution: {integrity: sha512-fakehash123==}

  esbuild@0.24.2:
    resolution: {integrity: sha512-anotherhash==}
    engines: {node: '>=18'}
    hasBin: true

snapshots:

  '@babel/runtime@7.28.4': {}
"#;
        let versions = parse_pnpm_lock(content);
        println!("Parsed versions: {:?}", versions);
        // Integrity hashes are preferred over versions
        assert_eq!(
            versions.get("@babel/runtime").map(|s| s.as_str()),
            Some("sha512-Q/N6JNWvIvPnLDvjlE1OUBLPQHH6l3CltCEsHIujp45zQUSSh8K+gHnaEX45yAT1nyngnINhvWtzN+Nb9D8RAQ==")
        );
        assert_eq!(versions.get("enhanced-resolve").map(|s| s.as_str()), Some("sha512-fakehash123=="));
        assert_eq!(versions.get("esbuild").map(|s| s.as_str()), Some("sha512-anotherhash=="));
    }

    #[test]
    fn test_parse_invalid_json() {
        let versions = parse_package_lock_json("not json at all");
        assert!(versions.is_empty());
    }

    #[test]
    fn test_parse_invalid_yaml() {
        let versions = parse_pnpm_lock("not: valid: yaml: [[[");
        assert!(versions.is_empty());
    }
}
