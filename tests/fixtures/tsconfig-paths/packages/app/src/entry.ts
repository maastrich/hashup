import { useThing } from "@/features/nav/use-thing";
import config from "@config";
import fallback from "@/fallback.json";
import { shared } from "@shared/util";
import { local } from "./local";

export const value = [useThing(), config.name, fallback.name, shared, local].join(":");
