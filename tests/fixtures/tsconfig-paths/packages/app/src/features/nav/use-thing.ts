import { shared } from "@shared/util";

export function useThing(): string {
  return `thing:${shared}`;
}
