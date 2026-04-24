/**
 * Append every element of `source` to `target`.
 *
 * Used instead of `target.push(...source)` because V8 materializes each
 * spread element as a stack argument to `push`, which throws
 * `RangeError: Maximum call stack size exceeded` once `source` gets big
 * enough (tens of thousands of items, easy to hit in large monorepos).
 */
export function pushAll<T>(target: T[], source: readonly T[]): void {
  for (let i = 0; i < source.length; i++) {
    target.push(source[i] as T);
  }
}
