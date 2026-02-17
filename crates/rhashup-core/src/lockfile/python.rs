use std::collections::HashMap;

/// Parse poetry.lock — TOML-like text with `[[package]]` sections.
///
/// Format:
/// ```toml
/// [[package]]
/// name = "requests"
/// version = "2.31.0"
///
/// [[package]]
/// name = "flask"
/// version = "3.0.0"
/// ```
pub fn parse_poetry_lock(content: &str) -> HashMap<String, String> {
    parse_toml_packages(content)
}

/// Parse uv.lock — same TOML-like `[[package]]` format as poetry.lock.
pub fn parse_uv_lock(content: &str) -> HashMap<String, String> {
    parse_toml_packages(content)
}

/// Parse `[[package]]` sections from TOML-like text, extracting `name` and `version` fields.
fn parse_toml_packages(content: &str) -> HashMap<String, String> {
    let mut versions = HashMap::new();
    let mut current_name: Option<String> = None;
    let mut current_version: Option<String> = None;
    let mut in_package = false;

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed == "[[package]]" {
            // Flush previous package
            if let (Some(name), Some(version)) = (current_name.take(), current_version.take()) {
                versions.entry(name).or_insert(version);
            }
            in_package = true;
            current_name = None;
            current_version = None;
            continue;
        }

        // A new section header that isn't [[package]] ends the current package
        if trimmed.starts_with('[') {
            if let (Some(name), Some(version)) = (current_name.take(), current_version.take()) {
                versions.entry(name).or_insert(version);
            }
            in_package = false;
            continue;
        }

        if !in_package {
            continue;
        }

        if let Some(val) = trimmed.strip_prefix("name = ") {
            current_name = Some(unquote(val).to_string());
        } else if let Some(val) = trimmed.strip_prefix("version = ") {
            current_version = Some(unquote(val).to_string());
        }
    }

    // Flush last package
    if let (Some(name), Some(version)) = (current_name, current_version) {
        versions.entry(name).or_insert(version);
    }

    versions
}

/// Parse Pipfile.lock — JSON format.
///
/// Format:
/// ```json
/// {
///   "default": {
///     "requests": { "version": "==2.31.0" },
///     "flask": { "version": "==3.0.0" }
///   },
///   "develop": { ... }
/// }
/// ```
pub fn parse_pipfile_lock(content: &str) -> HashMap<String, String> {
    let mut versions = HashMap::new();

    let value: serde_json::Value = match serde_json::from_str(content) {
        Ok(v) => v,
        Err(_) => return versions,
    };

    // Collect from both "default" and "develop" sections
    for section in &["default", "develop"] {
        if let Some(packages) = value.get(section).and_then(|p| p.as_object()) {
            for (name, val) in packages {
                if let Some(version) = val.get("version").and_then(|v| v.as_str()) {
                    // Strip leading "==" prefix common in Pipfile.lock
                    let clean = version.strip_prefix("==").unwrap_or(version);
                    versions.entry(name.clone()).or_insert_with(|| clean.to_string());
                }
            }
        }
    }

    versions
}

/// Strip surrounding quotes from a TOML value string.
fn unquote(s: &str) -> &str {
    let s = s.trim();
    if (s.starts_with('"') && s.ends_with('"')) || (s.starts_with('\'') && s.ends_with('\'')) {
        &s[1..s.len() - 1]
    } else {
        s
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_poetry_lock() {
        let content = r#"
[[package]]
name = "requests"
version = "2.31.0"
description = "HTTP library"

[[package]]
name = "flask"
version = "3.0.0"
description = "Web framework"

[metadata]
lock-version = "2.0"
"#;
        let versions = parse_poetry_lock(content);
        assert_eq!(versions.get("requests").map(|s| s.as_str()), Some("2.31.0"));
        assert_eq!(versions.get("flask").map(|s| s.as_str()), Some("3.0.0"));
    }

    #[test]
    fn test_parse_uv_lock() {
        let content = r#"
[[package]]
name = "httpx"
version = "0.25.0"

[[package]]
name = "pydantic"
version = "2.5.0"
"#;
        let versions = parse_uv_lock(content);
        assert_eq!(versions.get("httpx").map(|s| s.as_str()), Some("0.25.0"));
        assert_eq!(versions.get("pydantic").map(|s| s.as_str()), Some("2.5.0"));
    }

    #[test]
    fn test_parse_pipfile_lock() {
        let content = r#"{
  "_meta": { "hash": { "sha256": "abc" } },
  "default": {
    "requests": { "version": "==2.31.0" },
    "flask": { "version": "==3.0.0" }
  },
  "develop": {
    "pytest": { "version": "==7.4.0" }
  }
}"#;
        let versions = parse_pipfile_lock(content);
        assert_eq!(versions.get("requests").map(|s| s.as_str()), Some("2.31.0"));
        assert_eq!(versions.get("flask").map(|s| s.as_str()), Some("3.0.0"));
        assert_eq!(versions.get("pytest").map(|s| s.as_str()), Some("7.4.0"));
    }

    #[test]
    fn test_parse_pipfile_lock_invalid_json() {
        let versions = parse_pipfile_lock("not json");
        assert!(versions.is_empty());
    }

    #[test]
    fn test_unquote() {
        assert_eq!(unquote("\"hello\""), "hello");
        assert_eq!(unquote("'world'"), "world");
        assert_eq!(unquote("bare"), "bare");
    }
}
