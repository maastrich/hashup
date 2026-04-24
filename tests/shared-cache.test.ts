import { describe, expect, test } from "vite-plus/test";
import { collectReachable, createHashupCache, createResolver, hashup } from "../src/index.js";

const ENTRY = "./examples/src/index.ts";

describe("shared cache", () => {
  test("second identical call adds no new cache entries (work was reused)", async () => {
    const cache = createHashupCache();
    const resolver = createResolver();

    await hashup(ENTRY, { cache, resolver });
    const sizeAfterFirst = cache.hashes.size;
    expect(sizeAfterFirst).toBeGreaterThan(1);

    await hashup(ENTRY, { cache, resolver });
    expect(cache.hashes.size).toBe(sizeAfterFirst);
  });

  test("produces the same final hash whether cache is shared or fresh", async () => {
    const fresh = await hashup(ENTRY);

    const cache = createHashupCache();
    const resolver = createResolver();
    // Pre-warm with an unrelated-but-overlapping call
    await hashup("./examples/src/utils/math.ts", { cache, resolver });
    const reused = await hashup(ENTRY, { cache, resolver });

    expect(reused.hash).toBe(fresh.hash);
  });

  test("files list is the per-call reachable set, not the whole cache", async () => {
    const cache = createHashupCache();
    const resolver = createResolver();

    const mathOnly = await hashup("./examples/src/utils/math.ts", { cache, resolver });
    const full = await hashup(ENTRY, { cache, resolver });

    // Second call's files should match a fresh run's files exactly —
    // even though `cache.hashes.size` now covers both calls.
    const freshFull = await hashup(ENTRY);
    expect(new Set(full.files)).toEqual(new Set(freshFull.files));

    // And the narrower call's files must not include the broader set.
    expect(mathOnly.files.length).toBeLessThan(full.files.length);
    expect(full.files.some((f) => !mathOnly.files.includes(f))).toBe(true);
  });

  test("extras are tracked as roots in files", async () => {
    const result = await hashup(ENTRY, { extras: ["./package.json"] });
    expect(result.files.some((f) => f.endsWith("package.json"))).toBe(true);
  });

  test("extras' reachability is folded in with a shared cache too", async () => {
    const cache = createHashupCache();
    const resolver = createResolver();
    const r = await hashup(ENTRY, { extras: ["./package.json"], cache, resolver });
    expect(r.files.some((f) => f.endsWith("package.json"))).toBe(true);
  });

  test("cross-entry sharing: overlap between entries is walked once", async () => {
    const cache = createHashupCache();
    const resolver = createResolver();

    // Two different entry files that share a transitive dep
    // (examples/src/utils/math.ts is imported by index.ts).
    const shared = "./examples/src/utils/math.ts";
    await hashup(shared, { cache, resolver });
    const mathSize = cache.hashes.size;

    await hashup(ENTRY, { cache, resolver });
    const finalSize = cache.hashes.size;

    // ENTRY pulls in everything math.ts did plus more. The cache grew
    // by strictly less than a fresh run would have produced.
    const freshCache = createHashupCache();
    await hashup(ENTRY, { cache: freshCache, resolver: createResolver() });

    expect(finalSize).toBe(freshCache.hashes.size);
    expect(finalSize - mathSize).toBeLessThan(freshCache.hashes.size);
  });
});

describe("collectReachable", () => {
  test("iterative walk handles deep chains without stack overflow", () => {
    const cache = createHashupCache();
    const N = 50_000;
    for (let i = 0; i < N; i++) {
      cache.hashes.set(`/f${i}`, "x");
      cache.deps.set(`/f${i}`, i + 1 < N ? [`/f${i + 1}`] : []);
    }
    const files = collectReachable(["/f0"], cache);
    expect(files.length).toBe(N);
  });

  test("multiple roots produce the union of reachable sets", () => {
    const cache = createHashupCache();
    cache.deps.set("/a", ["/c"]);
    cache.deps.set("/b", ["/d"]);
    cache.deps.set("/c", []);
    cache.deps.set("/d", []);
    const files = collectReachable(["/a", "/b"], cache);
    expect(new Set(files)).toEqual(new Set(["/a", "/b", "/c", "/d"]));
  });

  test("cycles don't loop forever", () => {
    const cache = createHashupCache();
    cache.deps.set("/a", ["/b"]);
    cache.deps.set("/b", ["/a"]);
    const files = collectReachable(["/a"], cache);
    expect(new Set(files)).toEqual(new Set(["/a", "/b"]));
  });

  test("tolerates missing deps entries", () => {
    const cache = createHashupCache();
    const files = collectReachable(["/missing"], cache);
    expect(files).toEqual(["/missing"]);
  });
});
