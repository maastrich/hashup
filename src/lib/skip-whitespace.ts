/** Index of the first non-whitespace character at or after `from`. */
export function skipWhitespace(src: string, from: number): number {
  let i = from;
  while (i < src.length && /\s/.test(src[i] as string)) i++;
  return i;
}
