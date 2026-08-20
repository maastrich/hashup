export const USAGE = `Usage:
  hashup [options]              Hash every entry in hashup.json
  hashup <file> [options]       Hash a single entry file

Options:
  -c, --config <path>   Path to config file (default: hashup.json)
  -e, --extra <file>    Extra file to include (repeatable, single-file mode)
      --cwd <dir>       Run as if from this directory (default: process.cwd())
  -b, --base-dir <dir>  Base directory for resolution (default: cwd)
      --json            Output JSON instead of plain text
      --files           Include resolved file list in JSON output
      --no-tsconfig     Ignore tsconfig.json paths/baseUrl when resolving imports
      --fail-on-unresolved[=<n>]
                        Exit 1 when more than <n> imports are unresolved (default 0)
      --print-schema    Print the JSON schema for hashup.json to stdout
  -o, --out <path>      Write output to a file instead of stdout
  -l, --log-level <lvl> Verbosity: silent (default), warn, info, debug
  -h, --help            Show this help
`;
