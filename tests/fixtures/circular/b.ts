import { getA } from "./a.js";

export function getB(): string {
  return `b+${getA()}`;
}
