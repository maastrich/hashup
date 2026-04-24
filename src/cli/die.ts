export function die(message: string, code = 1): never {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}
