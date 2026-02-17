use std::collections::HashMap;

/// Parse go.sum — line-based format.
///
/// Format:
/// ```text
/// github.com/pkg/errors v0.9.1 h1:FEBLx1zS214owpjy7qsBeixbURkuhQAwrK5UwLGTwt4=
/// github.com/pkg/errors v0.9.1/go.mod h1:bwawxfHBFNV+L2hUp1rHADufV3IMtnDRdf1r5NINEl0=
/// golang.org/x/net v0.17.0 h1:tnT7PORFMqB+YGXEMoEuLP0xsVLrXR1g7JhJjwV8TJg=
/// ```
///
/// We extract the module path and the `h1:` hash from lines that don't end with `/go.mod`.
pub fn parse_go_sum(content: &str) -> HashMap<String, String> {
    let mut versions = HashMap::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let parts: Vec<&str> = trimmed.splitn(3, ' ').collect();
        if parts.len() != 3 {
            continue;
        }

        let module = parts[0];
        let version = parts[1];
        let hash = parts[2];

        // Skip go.mod entries — we want the source hash
        if version.ends_with("/go.mod") {
            continue;
        }

        // Extract h1: hash
        if hash.starts_with("h1:") {
            versions
                .entry(module.to_string())
                .or_insert_with(|| hash.to_string());
        }
    }

    versions
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_go_sum() {
        let content = r#"
github.com/pkg/errors v0.9.1 h1:FEBLx1zS214owpjy7qsBeixbURkuhQAwrK5UwLGTwt4=
github.com/pkg/errors v0.9.1/go.mod h1:bwawxfHBFNV+L2hUp1rHADufV3IMtnDRdf1r5NINEl0=
golang.org/x/net v0.17.0 h1:tnT7PORFMqB+YGXEMoEuLP0xsVLrXR1g7JhJjwV8TJg=
golang.org/x/net v0.17.0/go.mod h1:NxSam+9ovI078l5lHyUyKBQEsODL/9rAutR6enBQv=
"#;
        let versions = parse_go_sum(content);
        assert_eq!(
            versions.get("github.com/pkg/errors").map(|s| s.as_str()),
            Some("h1:FEBLx1zS214owpjy7qsBeixbURkuhQAwrK5UwLGTwt4=")
        );
        assert_eq!(
            versions.get("golang.org/x/net").map(|s| s.as_str()),
            Some("h1:tnT7PORFMqB+YGXEMoEuLP0xsVLrXR1g7JhJjwV8TJg=")
        );
    }

    #[test]
    fn test_parse_go_sum_empty() {
        let versions = parse_go_sum("");
        assert!(versions.is_empty());
    }

    #[test]
    fn test_parse_go_sum_skips_go_mod() {
        let content = "github.com/foo/bar v1.0.0/go.mod h1:abc=\n";
        let versions = parse_go_sum(content);
        assert!(versions.is_empty());
    }
}
