#!/usr/bin/env node
import { die } from "./cli/die.js";
import { main } from "./cli/main.js";

main(process.argv.slice(2)).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  die(message);
});
