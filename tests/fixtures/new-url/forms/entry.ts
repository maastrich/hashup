// Followed
const double = new URL("./double.ts", import.meta.url);
const single = new URL("./single.ts", import.meta.url);
const tpl = new URL(`./template.ts`, import.meta.url);
const shared = new SharedWorker(new URL("./shared.worker.ts", import.meta.url));
const queried = new Worker(new URL("./queried.worker.ts?worker", import.meta.url));
const icon = new URL("./assets/icon.svg?url", import.meta.url);
const noExt = new URL("./no-ext", import.meta.url);
const bare = new URL("bare.ts", import.meta.url);
const spaced = new URL("./spaced.ts", import.meta.url);
const fromLegacy = new URL("./legacy.js", import.meta.url);

// Missing target: reported as `unresolved`
const missing = new URL("./missing.ts", import.meta.url);

// Reported, not followed
const name = "x";
const interpolated = new URL(`./dyn/${name}.ts`, import.meta.url);
const dynamic = new URL(name, import.meta.url);
const rooted = new URL("/rooted.svg", import.meta.url);

// Ignored
const remote = new URL("https://example.com/remote.js", import.meta.url);
const protocolRelative = new URL("//cdn.example.com/cdn.js", import.meta.url);
const data = new URL("data:text/javascript,export{}", import.meta.url);
const here = new URL(".", import.meta.url);
const parent = new URL("../", import.meta.url);
const dir = new URL("./dir", import.meta.url);
const noBase = new URL("./no-base.ts");
const otherBase = new URL("./other-base.ts", "https://example.com/");
// new URL("./commented.ts", import.meta.url)
const inString = "new URL('./in-string.ts', import.meta.url)";

export {
  double,
  single,
  tpl,
  shared,
  queried,
  icon,
  noExt,
  bare,
  spaced,
  fromLegacy,
  missing,
  interpolated,
  dynamic,
  rooted,
  remote,
  protocolRelative,
  data,
  here,
  parent,
  dir,
  noBase,
  otherBase,
  inString,
};
