use crate::error::{Error, Result};
use crate::types::{ImportKind, ImportSpecifier};
use std::path::{Path, PathBuf};

use super::LanguageParser;

pub struct RustParser {
    language: tree_sitter::Language,
}

impl RustParser {
    pub fn new() -> Self {
        Self {
            language: tree_sitter_rust::LANGUAGE.into(),
        }
    }
}

impl Default for RustParser {
    fn default() -> Self {
        Self::new()
    }
}

impl LanguageParser for RustParser {
    fn extensions(&self) -> &[&str] {
        &["rs"]
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
        collect_mod_declarations(tree.root_node(), content, &mut imports);
        Ok(imports)
    }

    fn lockfile_names(&self) -> &[&str] {
        &["Cargo.lock"]
    }

    fn resolve_import(
        &self,
        source_file: &Path,
        specifier: &ImportSpecifier,
        _base_dir: &Path,
    ) -> Result<Option<PathBuf>> {
        let source_dir = source_file.parent().unwrap_or(Path::new("."));
        let mod_name = &specifier.raw;

        // Try mod_name.rs
        let as_file = source_dir.join(format!("{mod_name}.rs"));
        if as_file.is_file() {
            return Ok(Some(as_file));
        }

        // Try mod_name/mod.rs
        let as_dir = source_dir.join(mod_name).join("mod.rs");
        if as_dir.is_file() {
            return Ok(Some(as_dir));
        }

        Ok(None)
    }
}

fn collect_mod_declarations(
    node: tree_sitter::Node,
    source: &str,
    imports: &mut Vec<ImportSpecifier>,
) {
    // We only care about `mod foo;` (not `mod foo { ... }`)
    if node.kind() == "mod_item" {
        if let Some(name_node) = node.child_by_field_name("name") {
            let has_body = node.child_by_field_name("body").is_some();
            if !has_body {
                let mod_name = name_node
                    .utf8_text(source.as_bytes())
                    .unwrap_or_default()
                    .to_string();
                imports.push(ImportSpecifier {
                    raw: mod_name,
                    kind: ImportKind::Relative,
                });
            }
        }
    }

    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        collect_mod_declarations(child, source, imports);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_imports(code: &str) -> Vec<ImportSpecifier> {
        let parser = RustParser::new();
        parser.extract_imports(Path::new("lib.rs"), code).unwrap()
    }

    #[test]
    fn test_mod_declaration() {
        let imports = parse_imports("mod foo;\nmod bar;");
        assert_eq!(imports.len(), 2);
        assert_eq!(imports[0].raw, "foo");
        assert_eq!(imports[1].raw, "bar");
    }

    #[test]
    fn test_inline_mod_ignored() {
        let imports = parse_imports("mod foo { fn bar() {} }");
        assert_eq!(imports.len(), 0);
    }

    #[test]
    fn test_mixed_mods() {
        let imports = parse_imports("mod external;\nmod inline { }\nmod another;");
        assert_eq!(imports.len(), 2);
        assert_eq!(imports[0].raw, "external");
        assert_eq!(imports[1].raw, "another");
    }

    #[test]
    fn test_resolve_file() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("lib.rs");
        let target = dir.path().join("foo.rs");
        std::fs::write(&src, "").unwrap();
        std::fs::write(&target, "").unwrap();

        let parser = RustParser::new();
        let spec = ImportSpecifier::relative("foo");
        let resolved = parser.resolve_import(&src, &spec, dir.path()).unwrap();
        assert_eq!(resolved, Some(target));
    }

    #[test]
    fn test_resolve_mod_dir() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("lib.rs");
        let sub = dir.path().join("foo");
        std::fs::create_dir(&sub).unwrap();
        let mod_file = sub.join("mod.rs");
        std::fs::write(&src, "").unwrap();
        std::fs::write(&mod_file, "").unwrap();

        let parser = RustParser::new();
        let spec = ImportSpecifier::relative("foo");
        let resolved = parser.resolve_import(&src, &spec, dir.path()).unwrap();
        assert_eq!(resolved, Some(mod_file));
    }
}
