import { getB } from "./b.js";

export function getA(): string {
  return `a+${getB()}`;
}
