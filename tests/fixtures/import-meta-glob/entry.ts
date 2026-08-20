const catalogs = import.meta.glob("./locales/*.json", { eager: true });
const mods = import.meta.glob(["./mods/*.ts", "!./mods/skip.ts"]);
const icons = import.meta.globEager("./icons/*.svg");
const pattern = "./mods/*.ts";
const dynamic = import.meta.glob(pattern);
const templated = import.meta.glob(`./${pattern}`);

export { catalogs, mods, icons, dynamic, templated };
