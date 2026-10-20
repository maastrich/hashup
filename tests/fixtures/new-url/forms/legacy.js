// Plain .js skips esbuild, so this comment reaches the lexer verbatim:
// new URL("./js-commented.ts", import.meta.url)
/* new URL("./js-block-commented.ts", import.meta.url) */
export const worker = new URL("./from-js.ts", import.meta.url);
