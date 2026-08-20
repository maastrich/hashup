import { marker } from "fake-lib";
import { readFile } from "node:fs/promises";
import path from "path";
import virtual from "virtual:thing";
import { missing } from "./missing";
import { nope } from "@nope/pkg";
import { broken } from "./broken";
import { ok } from "./ok";

export const all = [marker, readFile, path, virtual, missing, nope, broken, ok];
