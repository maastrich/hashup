use crate::error::{Error, Result};
use crate::types::{ImportKind, ImportSpecifier};
use std::path::{Path, PathBuf};

use super::LanguageParser;

pub struct JavaScriptParser {
    js_language: tree_sitter::Language,
    ts_language: tree_sitter::Language,
    tsx_language: tree_sitter::Language,
}

impl Default for JavaScriptParser {
    fn default() -> Self {
        Self::new()
    }
}

impl JavaScriptParser {
    pub fn new() -> Self {
        Self {
            js_language: tree_sitter_javascript::LANGUAGE.into(),
            ts_language: tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(),
            tsx_language: tree_sitter_typescript::LANGUAGE_TSX.into(),
        }
    }

    fn language_for_ext(&self, ext: &str) -> &tree_sitter::Language {
        match ext {
            "ts" | "mts" => &self.ts_language,
            "tsx" => &self.tsx_language,
            _ => &self.js_language,
        }
    }
}

const JS_EXTENSIONS: &[&str] = &["js", "jsx", "mjs", "ts", "tsx", "mts"];

/// Extensions to try when resolving imports
const RESOLVE_EXTENSIONS: &[&str] = &["ts", "tsx", "mts", "js", "jsx", "mjs", "json"];

/// Extension aliases: when a specifier ends with .js, also try .ts etc.
const EXTENSION_ALIASES: &[(&str, &[&str])] = &[
    ("js", &["ts", "tsx"]),
    ("jsx", &["tsx"]),
    ("mjs", &["mts"]),
];

impl LanguageParser for JavaScriptParser {
    fn extensions(&self) -> &[&str] {
        JS_EXTENSIONS
    }

    fn extract_imports(&self, file_path: &Path, content: &str) -> Result<Vec<ImportSpecifier>> {
        let ext = file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("js");
        let language = self.language_for_ext(ext);

        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(language)
            .map_err(|e| Error::parse(file_path, e.to_string()))?;

        let tree = parser
            .parse(content, None)
            .ok_or_else(|| Error::parse(file_path, "failed to parse"))?;

        let mut imports = Vec::new();
        collect_imports(tree.root_node(), content, &mut imports);
        Ok(imports)
    }

    fn lockfile_names(&self) -> &[&str] {
        &[
            "pnpm-lock.yaml",
            "yarn.lock",
            "package-lock.json",
            "bun.lock",
        ]
    }

    fn resolve_import(
        &self,
        source_file: &Path,
        specifier: &ImportSpecifier,
        _base_dir: &Path,
    ) -> Result<Option<PathBuf>> {
        // Skip bare/package imports
        if !specifier.is_relative() {
            return Ok(None);
        }

        let source_dir = source_file.parent().unwrap_or(Path::new("."));
        let target = source_dir.join(&specifier.raw);

        // 1. Try exact path if it already has an extension and exists
        if target.extension().is_some() {
            if target.is_file() {
                return Ok(Some(target));
            }
            // Try extension aliases (e.g. .js -> .ts)
            if let Some(ext) = target.extension().and_then(|e| e.to_str()) {
                for &(alias_from, alias_to) in EXTENSION_ALIASES {
                    if ext == alias_from {
                        for alt_ext in alias_to {
                            let alt = target.with_extension(alt_ext);
                            if alt.is_file() {
                                return Ok(Some(alt));
                            }
                        }
                    }
                }
            }
        }

        // 2. Try adding extensions
        for ext in RESOLVE_EXTENSIONS {
            let candidate = append_ext(&target, ext);
            if candidate.is_file() {
                return Ok(Some(candidate));
            }
        }

        // 3. Try as directory with /index.*
        if target.is_dir() {
            for ext in RESOLVE_EXTENSIONS {
                let candidate = target.join(format!("index.{ext}"));
                if candidate.is_file() {
                    return Ok(Some(candidate));
                }
            }
        }

        Ok(None)
    }
}

fn append_ext(path: &Path, ext: &str) -> PathBuf {
    let mut s = path.as_os_str().to_owned();
    s.push(".");
    s.push(ext);
    PathBuf::from(s)
}

fn classify_specifier(raw: &str) -> ImportKind {
    if raw.starts_with('.') {
        ImportKind::Relative
    } else {
        ImportKind::Bare
    }
}

fn collect_imports(node: tree_sitter::Node, source: &str, imports: &mut Vec<ImportSpecifier>) {
    match node.kind() {
        // import ... from "specifier"
        // export ... from "specifier"
        "import_statement" | "export_statement" => {
            if let Some(src) = node.child_by_field_name("source") {
                if let Some(raw) = extract_string_value(src, source) {
                    imports.push(ImportSpecifier {
                        raw: raw.clone(),
                        kind: classify_specifier(&raw),
                    });
                }
            }
        }
        // require("specifier") or dynamic import("specifier")
        "call_expression" => {
            if let Some(func) = node.child_by_field_name("function") {
                let func_text = func
                    .utf8_text(source.as_bytes())
                    .unwrap_or_default();
                if func_text == "require" || func_text == "import" {
                    if let Some(args) = node.child_by_field_name("arguments") {
                        // First argument
                        if args.named_child_count() > 0 {
                            if let Some(first_arg) = args.named_child(0) {
                                if first_arg.kind() == "string"
                                    || first_arg.kind() == "template_string"
                                {
                                    if let Some(raw) = extract_string_value(first_arg, source) {
                                        imports.push(ImportSpecifier {
                                            raw: raw.clone(),
                                            kind: classify_specifier(&raw),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        _ => {}
    }

    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        collect_imports(child, source, imports);
    }
}

fn extract_string_value(node: tree_sitter::Node, source: &str) -> Option<String> {
    let text = node.utf8_text(source.as_bytes()).ok()?;
    // Strip quotes
    if (text.starts_with('"') && text.ends_with('"'))
        || (text.starts_with('\'') && text.ends_with('\''))
    {
        Some(text[1..text.len() - 1].to_string())
    } else if text.starts_with('`') && text.ends_with('`') {
        // Template literal with no interpolation
        if !text.contains("${") {
            Some(text[1..text.len() - 1].to_string())
        } else {
            None
        }
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_imports(code: &str, ext: &str) -> Vec<ImportSpecifier> {
        let parser = JavaScriptParser::new();
        let path = PathBuf::from(format!("test.{ext}"));
        parser.extract_imports(&path, code).unwrap()
    }

    #[test]
    fn test_es_imports() {
        let imports = parse_imports(
            r#"
            import foo from "./foo";
            import { bar } from "./bar";
            import * as baz from "../baz";
            "#,
            "ts",
        );
        assert_eq!(imports.len(), 3);
        assert_eq!(imports[0].raw, "./foo");
        assert_eq!(imports[1].raw, "./bar");
        assert_eq!(imports[2].raw, "../baz");
        assert!(imports.iter().all(|i| i.is_relative()));
    }

    #[test]
    fn test_require() {
        let imports = parse_imports(
            r#"
            const x = require("./utils");
            const y = require("lodash");
            "#,
            "js",
        );
        assert_eq!(imports.len(), 2);
        assert_eq!(imports[0].raw, "./utils");
        assert!(imports[0].is_relative());
        assert_eq!(imports[1].raw, "lodash");
        assert!(!imports[1].is_relative());
    }

    #[test]
    fn test_reexports() {
        let imports = parse_imports(
            r#"
            export { foo } from "./foo";
            export * from "./bar";
            "#,
            "ts",
        );
        assert_eq!(imports.len(), 2);
        assert_eq!(imports[0].raw, "./foo");
        assert_eq!(imports[1].raw, "./bar");
    }

    #[test]
    fn test_bare_imports_classified() {
        let imports = parse_imports(
            r#"
            import React from "react";
            import { join } from "path";
            "#,
            "tsx",
        );
        assert_eq!(imports.len(), 2);
        assert!(!imports[0].is_relative());
        assert!(!imports[1].is_relative());
    }

    #[test]
    fn test_tsx_syntax() {
        let imports = parse_imports(
            r#"
            import React from "react";
            import { Component } from "./component";

            const App = () => <Component />;
            export default App;
            "#,
            "tsx",
        );
        assert_eq!(imports.len(), 2);
    }

    #[test]
    fn test_resolve_with_extension() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("index.ts");
        let target = dir.path().join("utils.ts");
        std::fs::write(&src, "").unwrap();
        std::fs::write(&target, "").unwrap();

        let parser = JavaScriptParser::new();
        let spec = ImportSpecifier::relative("./utils");
        let resolved = parser.resolve_import(&src, &spec, dir.path()).unwrap();
        assert_eq!(resolved, Some(target));
    }

    #[test]
    fn test_resolve_js_to_ts_alias() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("index.ts");
        let target = dir.path().join("utils.ts");
        std::fs::write(&src, "").unwrap();
        std::fs::write(&target, "").unwrap();

        let parser = JavaScriptParser::new();
        let spec = ImportSpecifier::relative("./utils.js");
        let resolved = parser.resolve_import(&src, &spec, dir.path()).unwrap();
        assert_eq!(resolved, Some(target));
    }

    #[test]
    fn test_resolve_index() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("main.ts");
        let sub_dir = dir.path().join("utils");
        std::fs::create_dir(&sub_dir).unwrap();
        let index = sub_dir.join("index.ts");
        std::fs::write(&src, "").unwrap();
        std::fs::write(&index, "").unwrap();

        let parser = JavaScriptParser::new();
        let spec = ImportSpecifier::relative("./utils");
        let resolved = parser.resolve_import(&src, &spec, dir.path()).unwrap();
        assert_eq!(resolved, Some(index));
    }

    #[test]
    fn test_bare_import_returns_none() {
        let parser = JavaScriptParser::new();
        let spec = ImportSpecifier::bare("lodash");
        let resolved = parser
            .resolve_import(Path::new("/src/index.ts"), &spec, Path::new("/src"))
            .unwrap();
        assert_eq!(resolved, None);
    }
}
