use rhashup_core::lang::{javascript::JavaScriptParser, LanguageParser};
use std::path::Path;

#[test]
fn debug_component_imports() {
    let path = Path::new("/tmp/test-project/packages/ui/src/components/Button/Button.tsx");
    if !path.exists() {
        eprintln!("Skipping: file not found");
        return;
    }

    let content = std::fs::read_to_string(path).unwrap();
    let parser = JavaScriptParser::new();
    let imports = parser.extract_imports(path, &content).unwrap();

    let base_dir = Path::new("/tmp/test-project/packages/ui");

    for imp in &imports {
        let resolved = parser.resolve_import(path, imp, base_dir).unwrap();
        eprintln!(
            "import {:?} relative={} -> {:?}",
            imp.raw,
            imp.is_relative(),
            resolved
        );
    }
}
