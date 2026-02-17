use crate::error::{Error, Result};
use crate::types::{ImportKind, ImportSpecifier};
use std::path::{Path, PathBuf};

use super::LanguageParser;

pub struct PythonParser {
    language: tree_sitter::Language,
}

impl PythonParser {
    pub fn new() -> Self {
        Self {
            language: tree_sitter_python::LANGUAGE.into(),
        }
    }
}

impl Default for PythonParser {
    fn default() -> Self {
        Self::new()
    }
}

impl LanguageParser for PythonParser {
    fn extensions(&self) -> &[&str] {
        &["py"]
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
        collect_python_imports(tree.root_node(), content, &mut imports);
        Ok(imports)
    }

    fn lockfile_names(&self) -> &[&str] {
        &["poetry.lock", "uv.lock", "Pipfile.lock"]
    }

    fn resolve_import(
        &self,
        source_file: &Path,
        specifier: &ImportSpecifier,
        base_dir: &Path,
    ) -> Result<Option<PathBuf>> {
        match specifier.kind {
            ImportKind::Relative => {
                // Relative imports (with dots) resolve from file's directory
                let source_dir = source_file.parent().unwrap_or(Path::new("."));
                let raw = &specifier.raw;

                // Count leading dots
                let dots = raw.chars().take_while(|&c| c == '.').count();
                let module_part = &raw[dots..];

                // Go up (dots - 1) directories from source_dir
                let mut resolve_dir = source_dir.to_path_buf();
                for _ in 1..dots {
                    resolve_dir = resolve_dir
                        .parent()
                        .unwrap_or(Path::new("."))
                        .to_path_buf();
                }

                if module_part.is_empty() {
                    // `from . import something` — refers to __init__.py
                    let init = resolve_dir.join("__init__.py");
                    if init.is_file() {
                        return Ok(Some(init));
                    }
                    return Ok(None);
                }

                resolve_python_module(&resolve_dir, module_part)
            }
            ImportKind::Bare => {
                // Absolute imports resolve from base_dir
                resolve_python_module(base_dir, &specifier.raw)
            }
        }
    }
}

fn resolve_python_module(base: &Path, module: &str) -> Result<Option<PathBuf>> {
    let rel_path = module.replace('.', "/");

    // Try as file: base/module.py
    let as_file = base.join(format!("{rel_path}.py"));
    if as_file.is_file() {
        return Ok(Some(as_file));
    }

    // Try as package: base/module/__init__.py
    let as_package = base.join(&rel_path).join("__init__.py");
    if as_package.is_file() {
        return Ok(Some(as_package));
    }

    Ok(None)
}

fn collect_python_imports(
    node: tree_sitter::Node,
    source: &str,
    imports: &mut Vec<ImportSpecifier>,
) {
    match node.kind() {
        // `import foo.bar`
        "import_statement" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                let text = name_node.utf8_text(source.as_bytes()).unwrap_or_default();
                // Could be `import a, b` — handle dotted names
                for module in text.split(',') {
                    let module = module.trim();
                    if !module.is_empty() {
                        imports.push(ImportSpecifier {
                            raw: module.to_string(),
                            kind: ImportKind::Bare,
                        });
                    }
                }
            }
        }
        // `from foo import bar` or `from .foo import bar`
        "import_from_statement" => {
            if let Some(module_node) = node.child_by_field_name("module_name") {
                let module = module_node
                    .utf8_text(source.as_bytes())
                    .unwrap_or_default()
                    .to_string();

                let kind = if module.starts_with('.') {
                    ImportKind::Relative
                } else {
                    ImportKind::Bare
                };

                imports.push(ImportSpecifier { raw: module, kind });
            } else {
                // `from . import something` (no module_name, just dots)
                // Check for the relative_import node
                let mut cursor = node.walk();
                for child in node.children(&mut cursor) {
                    if child.kind() == "relative_import" {
                        let text = child
                            .utf8_text(source.as_bytes())
                            .unwrap_or_default()
                            .to_string();
                        imports.push(ImportSpecifier {
                            raw: text,
                            kind: ImportKind::Relative,
                        });
                        break;
                    }
                }
            }
        }
        _ => {}
    }

    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        collect_python_imports(child, source, imports);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_imports(code: &str) -> Vec<ImportSpecifier> {
        let parser = PythonParser::new();
        parser.extract_imports(Path::new("test.py"), code).unwrap()
    }

    #[test]
    fn test_import_statement() {
        let imports = parse_imports("import os\nimport sys");
        assert!(imports.len() >= 2);
    }

    #[test]
    fn test_from_import() {
        let imports = parse_imports("from os.path import join");
        assert_eq!(imports.len(), 1);
        assert_eq!(imports[0].raw, "os.path");
        assert!(!imports[0].is_relative());
    }

    #[test]
    fn test_relative_import() {
        let imports = parse_imports("from .utils import helper\nfrom ..models import User");
        assert_eq!(imports.len(), 2);
        assert!(imports[0].raw.starts_with('.'));
        assert!(imports[0].is_relative());
        assert!(imports[1].raw.starts_with(".."));
        assert!(imports[1].is_relative());
    }

    #[test]
    fn test_resolve_module_file() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("main.py");
        let target = dir.path().join("utils.py");
        std::fs::write(&src, "").unwrap();
        std::fs::write(&target, "").unwrap();

        let parser = PythonParser::new();
        let spec = ImportSpecifier::relative(".utils");
        let resolved = parser.resolve_import(&src, &spec, dir.path()).unwrap();
        assert_eq!(resolved, Some(target));
    }

    #[test]
    fn test_resolve_package_init() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("main.py");
        let pkg_dir = dir.path().join("mypkg");
        std::fs::create_dir(&pkg_dir).unwrap();
        let init = pkg_dir.join("__init__.py");
        std::fs::write(&src, "").unwrap();
        std::fs::write(&init, "").unwrap();

        let parser = PythonParser::new();
        let spec = ImportSpecifier::bare("mypkg");
        let resolved = parser.resolve_import(&src, &spec, dir.path()).unwrap();
        assert_eq!(resolved, Some(init));
    }
}
