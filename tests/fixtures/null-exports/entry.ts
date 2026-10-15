import { browser } from "cond-pkg/browser";
import { feature } from "cond-pkg/features/x";
import { nested } from "cond-pkg/nested";
import { sub } from "@scope/pkg/sub";
import { main } from "cond-pkg";
import { missing } from "cond-pkg/missing";
import { local } from "./local";

export const all = [browser, feature, nested, sub, main, missing, local];
