import type { Recipe } from "@types-only/pkg/types";
import type { Local } from "./local-types";
import { type Inline, value } from "./value";
import "./side-effect";
import unused from "./unused";
export type { Reexported } from "./reexported-types";

export const all: [Recipe | Local | Inline | undefined, string] = [undefined, value];
