import { messages as en } from "./locales/en.json?lingui";

const catalogs = import.meta.glob("./locales/*.json", { eager: true });

export const messages = { ...en, catalogs: Object.keys(catalogs).length };
