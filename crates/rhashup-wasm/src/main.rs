use rhashup_core::HashupOptions;
use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap_or_else(|e| {
        eprintln!("Failed to read stdin: {e}");
        std::process::exit(1);
    });

    let options: HashupOptions = serde_json::from_str(&input).unwrap_or_else(|e| {
        eprintln!("Failed to parse JSON input: {e}");
        std::process::exit(1);
    });

    match rhashup_core::hashup(&options) {
        Ok(result) => {
            let json = serde_json::to_string(&result).unwrap();
            println!("{json}");
        }
        Err(e) => {
            eprintln!("Error: {e}");
            std::process::exit(1);
        }
    }
}
