use crate::error::{Error, Result};
use crate::types::{ImportKind, ImportSpecifier};
use std::path::{Path, PathBuf};

use super::LanguageParser;

pub struct GoParser {
    language: tree_sitter::Language,
}

impl GoParser {
    pub fn new() -> Self {
        Self {
            language: tree_sitter_go::LANGUAGE.into(),
        }
    }
}

impl Default for GoParser {
    fn default() -> Self {
        Self::new()
    }
}

impl LanguageParser for GoParser {
    fn extensions(&self) -> &[&str] {
        &["go"]
    }

    fn extract_imports(&self, file_path: &Path, content: &str) -> Result<Vec<ImportSpecifier>> {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&self.language)
            .map_err(|e| Error::parse(file_path, e.to_string()))?;

        let tree = parser
            .parse(content, None)
            .ok_or_else(|| Error::parse(file_path, "failed to parse"))?;

        let mut imports = Vec::new();
        collect_go_imports(tree.root_node(), content, &mut imports);
        Ok(imports)
    }

    fn resolve_import(
        &self,
        _source_file: &Path,
        specifier: &ImportSpecifier,
        base_dir: &Path,
    ) -> Result<Option<PathBuf>> {
        // Only resolve local (relative) imports
        if !specifier.is_relative() {
            return Ok(None);
        }

        let import_path = &specifier.raw;
        // Resolve relative to the Go module root (base_dir)
        let pkg_dir = base_dir.join(import_path.trim_start_matches("./"));

        if pkg_dir.is_dir() {
            // Find the first .go file in the package directory
            // In practice we'd want to hash all .go files in the package
            if let Ok(entries) = std::fs::read_dir(&pkg_dir) {
                let mut go_files: Vec<PathBuf> = entries
                    .filter_map(|e| e.ok())
                    .map(|e| e.path())
                    .filter(|p| {
                        p.extension().and_then(|e| e.to_str()) == Some("go")
                            && !p
                                .file_name()
                                .and_then(|n| n.to_str())
                                .map(|n| n.ends_with("_test.go"))
                                .unwrap_or(false)
                    })
                    .collect();
                go_files.sort();
                if let Some(first) = go_files.first() {
                    return Ok(Some(first.clone()));
                }
            }
        }

        Ok(None)
    }
}

fn classify_go_import(path: &str) -> ImportKind {
    if path.starts_with('.') || path.starts_with('/') {
        ImportKind::Relative
    } else {
        ImportKind::Bare
    }
}

fn collect_go_imports(
    node: tree_sitter::Node,
    source: &str,
    imports: &mut Vec<ImportSpecifier>,
) {
    if node.kind() == "import_declaration" {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "import_spec_list" {
                let mut inner_cursor = child.walk();
                for spec in child.children(&mut inner_cursor) {
                    if spec.kind() == "import_spec" {
                        extract_go_import_spec(spec, source, imports);
                    }
                }
            } else if child.kind() == "import_spec" {
                extract_go_import_spec(child, source, imports);
            }
        }
    }

    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        collect_go_imports(child, source, imports);
    }
}

fn extract_go_import_spec(
    node: tree_sitter::Node,
    source: &str,
    imports: &mut Vec<ImportSpecifier>,
) {
    if let Some(path_node) = node.child_by_field_name("path") {
        let text = path_node
            .utf8_text(source.as_bytes())
            .unwrap_or_default();
        // Strip quotes
        let raw = text.trim_matches('"').to_string();
        let kind = classify_go_import(&raw);
        imports.push(ImportSpecifier { raw, kind });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_imports(code: &str) -> Vec<ImportSpecifier> {
        let parser = GoParser::new();
        parser.extract_imports(Path::new("main.go"), code).unwrap()
    }

    #[test]
    fn test_single_import() {
        let imports = parse_imports(r#"package main; import "fmt""#);
        assert_eq!(imports.len(), 1);
        assert_eq!(imports[0].raw, "fmt");
        assert!(!imports[0].is_relative());
    }

    #[test]
    fn test_grouped_imports() {
        let imports = parse_imports(
            r#"
            package main

            import (
                "fmt"
                "os"
                "./internal/utils"
            )
            "#,
        );
        assert_eq!(imports.len(), 3);
        assert!(!imports[0].is_relative());
        assert!(!imports[1].is_relative());
        assert!(imports[2].is_relative());
        assert_eq!(imports[2].raw, "./internal/utils");
    }

    #[test]
    fn test_named_import() {
        let imports = parse_imports(r#"package main; import u "./utils""#);
        assert_eq!(imports.len(), 1);
        assert_eq!(imports[0].raw, "./utils");
        assert!(imports[0].is_relative());
    }
}
