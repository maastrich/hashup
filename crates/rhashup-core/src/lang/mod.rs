pub mod go_lang;
pub mod javascript;
pub mod python;
pub mod rust_lang;

use crate::error::Result;
use crate::types::ImportSpecifier;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub trait LanguageParser: Send + Sync {
    fn extensions(&self) -> &[&str];
    fn extract_imports(&self, file_path: &Path, content: &str) -> Result<Vec<ImportSpecifier>>;
    fn resolve_import(
        &self,
        source_file: &Path,
        specifier: &ImportSpecifier,
        base_dir: &Path,
    ) -> Result<Option<PathBuf>>;
}

pub struct LanguageRegistry {
    parsers: Vec<Box<dyn LanguageParser>>,
    extension_map: HashMap<String, usize>,
}

impl LanguageRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            parsers: Vec::new(),
            extension_map: HashMap::new(),
        };
        registry.register(Box::new(javascript::JavaScriptParser::new()));
        registry.register(Box::new(python::PythonParser::new()));
        registry.register(Box::new(rust_lang::RustParser::new()));
        registry.register(Box::new(go_lang::GoParser::new()));
        registry
    }

    pub fn register(&mut self, parser: Box<dyn LanguageParser>) {
        let idx = self.parsers.len();
        for ext in parser.extensions() {
            self.extension_map.insert(ext.to_string(), idx);
        }
        self.parsers.push(parser);
    }

    pub fn parser_for_extension(&self, ext: &str) -> Option<&dyn LanguageParser> {
        self.extension_map
            .get(ext)
            .map(|&idx| self.parsers[idx].as_ref())
    }

    pub fn parser_for_file(&self, path: &Path) -> Option<&dyn LanguageParser> {
        let ext = path.extension()?.to_str()?;
        self.parser_for_extension(ext)
    }
}

impl Default for LanguageRegistry {
    fn default() -> Self {
        Self::new()
    }
}
