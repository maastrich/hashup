/** The call site starting at `from`, up to end-of-line (or 80 chars), for reports. */
export function callSnippet(src: string, from: number): string {
  const eol = src.indexOf("\n", from);
  const end = Math.min(eol === -1 ? src.length : eol, from + 80);
  return src.slice(from, end).trim();
}
