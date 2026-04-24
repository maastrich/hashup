export const USAGE = `Usage:
  hashup [options]              Hash every entry in hashup.json
  hashup <file> [options]       Hash a single entry file

Options:
  -c, --config <path>   Path to config file (default: hashup.json)
  -e, --extra <file>    Extra file to include (repeatable, single-file mode)
  -b, --base-dir <dir>  Base directory for resolution (default: cwd)
      --json            Output JSON instead of plain text
      --files           Include resolved file list in JSON output
      --print-schema    Print the JSON schema for hashup.json to stdout
  -h, --help            Show this help
`;
