// Repro from issue #30.
const w = new URL("./w.worker.ts", import.meta.url);
const worker = new Worker(new URL("./w.worker.ts", import.meta.url), { type: "module" });

export { w, worker };
