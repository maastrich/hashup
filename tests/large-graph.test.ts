import { describe, expect, test } from "vite-plus/test";
import { pushAll } from "../src/lib/push-all.js";

describe("pushAll", () => {
  test("does not stack-overflow when appending a very large array", () => {
    const target: number[] = [];
    const source = new Array<number>(500_000).fill(1);

    expect(() => pushAll(target, source)).not.toThrow();
    expect(target.length).toBe(500_000);
  });

  test("matches spread-push semantics for small inputs", () => {
    const target = [1, 2];
    pushAll(target, [3, 4, 5]);

    expect(target).toEqual([1, 2, 3, 4, 5]);
  });

  test("spread-push would overflow at this size (guards against regression)", () => {
    const big = new Array<number>(500_000).fill(1);
    const bad: number[] = [];

    expect(() => bad.push(...big)).toThrow(RangeError);
  });
});
